const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  submitAbstract,
  getAllAbstracts,
  getAbstractById,
  getPublishedAbstracts,
  getAbstractByToken,
} = require("../controllers/abstractController");

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
      next();
    });
  },
  submitAbstract
);

// NEW: Magic link route - view abstract by token
router.get("/view/:token", getAbstractByToken);

router.get("/published", getPublishedAbstracts);

// Protected routes (we'll add auth middleware later)
router.get("/", getAllAbstracts);
router.get("/:id", getAbstractById);

module.exports = router;
