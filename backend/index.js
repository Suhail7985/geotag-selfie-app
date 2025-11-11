const express = require("express");
const multer = require("multer");
const { exiftool } = require("exiftool-vendored");
const mongoose = require("mongoose");
const Photo = require("./models/Photo");

console.log("✅ Server file loaded");

const app = express();
app.use(express.json());

// MongoDB Connect
mongoose.connect("mongodb://127.0.0.1:27017/geotag")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
      console.log("❌ MongoDB Error:", err);
  });

// Multer Storage
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Test route
app.get("/", (req, res) => {
  res.send("✅ API Working");
});

// Upload route
app.post("/upload", upload.single("photo"), async (req, res) => {
  console.log("✅ /upload hit");
  
  try {
      const { lat, lng } = req.body;
      console.log("📍 Body →", req.body);

      const exif = await exiftool.read(req.file.path);
      console.log("📸 EXIF →", exif);

      const exifLat = exif.GPSLatitude || 0;
      const exifLng = exif.GPSLongitude || 0;

      const matched =
          Math.abs(exifLat - lat) < 0.0005 &&
          Math.abs(exifLng - lng) < 0.0005;

      const newPhoto = await Photo.create({
          imageUrl: req.file.filename,
          appLatitude: lat,
          appLongitude: lng,
          exifLatitude: exifLat,
          exifLongitude: exifLng,
          matched
      });

      res.json({
          success: true,
          message: "Uploaded Successfully",
          match_status: matched,
          data: newPhoto
      });

  } catch (err) {
      console.log("❌ Upload Error:", err);
      res.status(500).json({ success: false, message: "Error" });
  }
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
