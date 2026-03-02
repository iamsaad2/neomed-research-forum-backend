const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  adminLogin,
  createFirstAdmin,
  getAllAbstracts,
  getAllReviewers,
  deleteReviewer,
  updateReviewerAssignment,
  randomizeAssignments,
  clearReviewerAssignments,
  acceptAbstract,
  rejectAbstract,
  publishAbstract,
  unpublishAbstract,
  getDashboardStats,
  updateAbstract, // NEW: Add this import
} = require("../controllers/adminController");

const {
  createWinner,
  updateWinner,
  deleteWinner,
} = require("../controllers/winnerController");

// Public routes
router.post("/login", adminLogin);
router.post("/create-first", createFirstAdmin); // Only works if no admins exist

// Protected routes (require admin authentication)
router.get("/abstracts", protect, isAdmin, getAllAbstracts);
router.put("/abstracts/:abstractId", protect, isAdmin, updateAbstract); // NEW: Edit abstract route
router.get("/reviewers", protect, isAdmin, getAllReviewers);
router.delete("/reviewers/:reviewerId", protect, isAdmin, deleteReviewer);

// Reviewer assignment management routes
router.put(
  "/reviewers/:reviewerId/assignment",
  protect,
  isAdmin,
  updateReviewerAssignment
);
router.post(
  "/reviewers/randomize-assignments",
  protect,
  isAdmin,
  randomizeAssignments
);
router.delete(
  "/reviewers/:reviewerId/assignments",
  protect,
  isAdmin,
  clearReviewerAssignments
);

router.get("/stats", protect, isAdmin, getDashboardStats);
router.put("/accept/:abstractId", protect, isAdmin, acceptAbstract);
router.put("/reject/:abstractId", protect, isAdmin, rejectAbstract);
router.put("/publish/:abstractId", protect, isAdmin, publishAbstract);
router.put("/unpublish/:abstractId", protect, isAdmin, unpublishAbstract);

router.post("/winners", protect, isAdmin, createWinner);
router.put("/winners/:winnerId", protect, isAdmin, updateWinner);
router.delete("/winners/:winnerId", protect, isAdmin, deleteWinner);

module.exports = router;
