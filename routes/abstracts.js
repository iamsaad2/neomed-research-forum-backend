const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  submitAbstract,
  getAllAbstracts,
  getAbstractById,
  getPublishedAbstracts,
} = require("../controllers/abstractController");

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error("Multer error:", err);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Public routes
router.post(
  "/submit",
  (req, res, next) => {
    upload.single("pdfFile")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "File upload error: " + err.message,
        });
      }
      // Log for debugging
      console.log("After multer - req.body:", req.body);
      console.log("After multer - req.file:", req.file);
      next();
    });
  },
  submitAbstract
);

router.get("/published", getPublishedAbstracts);

// Protected routes (we'll add auth middleware later)
router.get("/", getAllAbstracts);
router.get("/:id", getAbstractById);

module.exports = router;
