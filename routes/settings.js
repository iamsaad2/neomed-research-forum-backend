const express = require("express");
const router = express.Router();
const { getSettings } = require("../controllers/settingsController");

// Public route - get site settings (year, dates, copy, recap photos, etc.)
router.get("/", getSettings);

module.exports = router;
