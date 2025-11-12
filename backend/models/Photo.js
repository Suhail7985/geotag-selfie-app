const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    imageUrl: String,
    appLatitude: Number,
    appLongitude: Number,
    exifLatitude: Number,
    exifLongitude: Number,
    matched: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Photo", photoSchema);
