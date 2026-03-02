const mongoose = require("mongoose");

const winnerSchema = new mongoose.Schema(
  {
    // Winner details
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    award: {
      type: String,
      required: true,
      trim: true,
    },
    // e.g., "1st Place - Clinical Research", "Best Poster", "People's Choice"
    category: {
      type: String,
      trim: true,
    },
    // Optional link to abstract
    abstractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Abstract",
      default: null,
    },
    // Display order (lower = displayed first)
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Winner", winnerSchema);
