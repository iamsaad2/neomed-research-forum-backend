const express = require("express");
const router = express.Router();
const { getWinners } = require("../controllers/winnerController");

// Public route - get all winners
router.get("/", getWinners);

module.exports = router;
