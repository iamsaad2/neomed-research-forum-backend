const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  adminLogin,
  createFirstAdmin,
  getAllAbstracts,
  acceptAbstract,
  rejectAbstract,
  publishAbstract,
  unpublishAbstract,
  getDashboardStats,
} = require("../controllers/adminController");

// Public routes
router.post("/login", adminLogin);
router.post("/create-first", createFirstAdmin); // Only works if no admins exist

// Protected routes (require admin authentication)
router.get("/abstracts", protect, isAdmin, getAllAbstracts);
router.get("/stats", protect, isAdmin, getDashboardStats);
router.put("/accept/:abstractId", protect, isAdmin, acceptAbstract);
router.put("/reject/:abstractId", protect, isAdmin, rejectAbstract);
router.put("/publish/:abstractId", protect, isAdmin, publishAbstract);
router.put("/unpublish/:abstractId", protect, isAdmin, unpublishAbstract);

module.exports = router;
