const Winner = require("../models/Winner");

// @desc    Get all winners (public)
// @route   GET /api/winners
// @access  Public
exports.getWinners = async (req, res) => {
  try {
    const winners = await Winner.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .populate("abstractId", "title primaryAuthor category department");

    res.status(200).json({
      success: true,
      count: winners.length,
      data: winners,
    });
  } catch (error) {
    console.error("Error fetching winners:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching winners",
      error: error.message,
    });
  }
};

// @desc    Create a winner
// @route   POST /api/admin/winners
// @access  Private (Admin only)
exports.createWinner = async (req, res) => {
  try {
    const { name, title, award, category, abstractId, displayOrder } = req.body;

    if (!name || !title || !award) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, title, and award",
      });
    }

    const winner = await Winner.create({
      name,
      title,
      award,
      category: category || "",
      abstractId: abstractId || null,
      displayOrder: displayOrder || 0,
    });

    console.log(`✅ Winner created: ${name} - ${award}`);

    res.status(201).json({
      success: true,
      message: "Winner added successfully",
      data: winner,
    });
  } catch (error) {
    console.error("Error creating winner:", error);
    res.status(500).json({
      success: false,
      message: "Error creating winner",
      error: error.message,
    });
  }
};

// @desc    Update a winner
// @route   PUT /api/admin/winners/:winnerId
// @access  Private (Admin only)
exports.updateWinner = async (req, res) => {
  try {
    const { winnerId } = req.params;
    const { name, title, award, category, abstractId, displayOrder } = req.body;

    const winner = await Winner.findById(winnerId);
    if (!winner) {
      return res.status(404).json({
        success: false,
        message: "Winner not found",
      });
    }

    if (name !== undefined) winner.name = name;
    if (title !== undefined) winner.title = title;
    if (award !== undefined) winner.award = award;
    if (category !== undefined) winner.category = category;
    if (abstractId !== undefined) winner.abstractId = abstractId || null;
    if (displayOrder !== undefined) winner.displayOrder = displayOrder;

    await winner.save();

    res.status(200).json({
      success: true,
      message: "Winner updated successfully",
      data: winner,
    });
  } catch (error) {
    console.error("Error updating winner:", error);
    res.status(500).json({
      success: false,
      message: "Error updating winner",
      error: error.message,
    });
  }
};

// @desc    Delete a winner
// @route   DELETE /api/admin/winners/:winnerId
// @access  Private (Admin only)
exports.deleteWinner = async (req, res) => {
  try {
    const { winnerId } = req.params;

    const winner = await Winner.findById(winnerId);
    if (!winner) {
      return res.status(404).json({
        success: false,
        message: "Winner not found",
      });
    }

    await Winner.findByIdAndDelete(winnerId);

    console.log(`✅ Winner deleted: ${winner.name} - ${winner.award}`);

    res.status(200).json({
      success: true,
      message: "Winner deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting winner:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting winner",
      error: error.message,
    });
  }
};
