const mongoose = require("mongoose");

const reviewerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Profile information
    department: String,
    specialization: String,

    // Statistics
    totalReviewsCompleted: {
      type: Number,
      default: 0,
    },

    // Assignment type: "all" = sees all abstracts, "limited" = sees only assigned abstracts
    assignmentType: {
      type: String,
      enum: ["all", "limited"],
      default: "all",
    },

    // Assigned abstracts - used when assignmentType is "limited"
    // For "all" type, this tracks which ones they've reviewed (for stats)
    // For "limited" type, this is the ONLY abstracts they can see
    assignedAbstracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Abstract",
      },
    ],

    // Target number of abstracts for limited reviewers (for display purposes)
    assignedLimit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Reviewer", reviewerSchema);
