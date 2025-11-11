const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema({
    imageUrl: String,
    appLatitude: Number,
    appLongitude: Number,
    exifLatitude: Number,
    exifLongitude: Number,
    matched: Boolean,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Photo", photoSchema);
