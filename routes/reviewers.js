const express = require("express");
const router = express.Router();
const { protect, isReviewer } = require("../middleware/auth");
const {
  reviewerLogin,
  getAbstractsForReview,
  submitReview,
  getMyReviews,
} = require("../controllers/reviewerController");

// Public routes
router.post("/login", reviewerLogin);

// Protected routes (require authentication)
router.get("/abstracts", protect, isReviewer, getAbstractsForReview);
router.post("/review/:abstractId", protect, isReviewer, submitReview);
router.get("/my-reviews", protect, isReviewer, getMyReviews);

module.exports = router;
