const multer = require("multer");

// Images are held in memory (not written to disk) and streamed straight to
// Cloudinary, so nothing depends on the ephemeral Railway filesystem.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max per image
});

module.exports = uploadImage;
