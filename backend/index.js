// index.js — Full production-ready Geo-Tagged Selfie Verification API

const express = require("express");
const multer = require("multer");
const { exiftool } = require("exiftool-vendored");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const canvas = require("canvas");
const faceapi = require("face-api.js");
const Photo = require("./models/Photo");

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
app.use(express.json());

// config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/geotag";
const PHOTO_MAX_AGE_MINUTES = 5; // photo must be taken within last N minutes
const DISTANCE_THRESHOLD_METERS = 50; // distance tolerance in meters

// static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// Multer storage
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Connect MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// load face-api models from ./models directory
const MODELS_PATH = path.join(__dirname, "models");
async function loadFaceModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    console.log("✅ face-api models loaded");
  } catch (err) {
    console.error("❌ Error loading face-api models:", err);
  }
}
loadFaceModels(); // start loading (async)

// util: parse EXIF date (ExifTool returns DateTimeOriginal as string typically)
function parseExifDate(exifDateStr) {
  if (!exifDateStr) return null;
  // exifDateStr often like "2025:11:11 18:30:02" — make it ISO-friendly
  try {
    // Replace first two ':' with '-' for year-month-day if needed
    const s = String(exifDateStr).trim();
    // If it already parses fine, use it
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
    // Otherwise transform "YYYY:MM:DD hh:mm:ss" -> "YYYY-MM-DDThh:mm:ss"
    const t = s.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T");
    const parsed2 = new Date(t);
    if (!isNaN(parsed2.getTime())) return parsed2;
  } catch (e) {
    // ignore
  }
  return null;
}

// util: haversine distance (meters)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // earth radius meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// test root
app.get("/", (req, res) => res.send("✅ Geo-Tagged Selfie Verification API"));

// upload endpoint
app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    // Basic request checks
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Photo is required" });
    }
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "lat and lng are required" });
    }

    const appLat = Number(lat);
    const appLng = Number(lng);
    if (isNaN(appLat) || isNaN(appLng)) {
      return res.status(400).json({ success: false, message: "Invalid lat or lng" });
    }

    // Read EXIF via exiftool
    const exif = await exiftool.read(req.file.path).catch((e) => {
      console.error("exiftool read error:", e);
      return {};
    });

    // EXIF GPS must exist
    const exifLat = exif.GPSLatitude;
    const exifLng = exif.GPSLongitude;
    if (!exifLat || !exifLng) {
      // cleanup exiftool process resources for safety
      // (exiftool-vendored keeps a child process)
      // exiftool.end() not called here; library handles lifecycle on exit.
      return res.status(400).json({
        success: false,
        message: "No GPS data found in image. Turn ON location for camera and retry.",
      });
    }

    // Parse and validate EXIF timestamp (DateTimeOriginal or CreateDate)
    const exifDateStr = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
    const photoTakenAt = parseExifDate(exifDateStr);
    if (!photoTakenAt) {
      return res.status(400).json({
        success: false,
        message:
          "No valid photo timestamp found in EXIF. Ensure camera saved DateTimeOriginal metadata.",
      });
    }

    // Verify photo recency
    const now = new Date();
    const diffMinutes = Math.abs((now - photoTakenAt) / (1000 * 60));
    if (diffMinutes > PHOTO_MAX_AGE_MINUTES) {
      return res.status(400).json({
        success: false,
        message: `Photo must be taken within last ${PHOTO_MAX_AGE_MINUTES} minutes.`,
        photoTakenAt: photoTakenAt.toISOString(),
        diffMinutes: diffMinutes,
      });
    }

    // Distance check (meters)
    const distanceMeters = calculateDistanceMeters(appLat, appLng, exifLat, exifLng);
    const geoMatched = distanceMeters <= DISTANCE_THRESHOLD_METERS;

    // Face detection — ensure at least one face exists
    // load image using canvas and detect
    let faceDetected = false;
    try {
      const img = await canvas.loadImage(req.file.path);
      const detections = await faceapi.detectAllFaces(img);
      faceDetected = Array.isArray(detections) && detections.length > 0;
    } catch (err) {
      console.error("Face detection error:", err);
      // If face-api fails, we can either reject or continue — here we reject to be strict
      return res.status(500).json({
        success: false,
        message: "Face detection failed on server. Check face-api model files and environment.",
        error: String(err),
      });
    }
    if (!faceDetected) {
      return res.status(400).json({
        success: false,
        message: "No face detected. Please upload a clear selfie.",
      });
    }

    // Save to DB (optional: you can extend schema to store distance & photoTakenAt)
    const saved = await Photo.create({
      imageUrl: req.file.filename,
      appLatitude: appLat,
      appLongitude: appLng,
      exifLatitude: exifLat,
      exifLongitude: exifLng,
      matched: geoMatched,
    });

    // respond with details including distance and timestamps
    return res.json({
      success: true,
      message: "Uploaded Successfully",
      match_status: geoMatched,
      distance_meters: Math.round(distanceMeters * 100) / 100, // 2 decimals
      photoTakenAt: photoTakenAt.toISOString(),
      data: saved,
    });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: String(err) });
  }
});

// graceful shutdown for exiftool child process
process.on("exit", async () => {
  try {
    await exiftool.end();
  } catch (e) {
    // ignore
  }
});

// start server
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
