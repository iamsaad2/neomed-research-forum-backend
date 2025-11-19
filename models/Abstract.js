const mongoose = require("mongoose");

const abstractSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
    },
    authors: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    department: {
      type: String,
      required: true,
      enum: [
        "cardiology",
        "neurology",
        "oncology",
        "pediatrics",
        "internal",
        "surgery",
        "psychiatry",
        "radiology",
        "pathology",
        "emergency",
        "anesthesiology",
        "dermatology",
      ],
    },
    category: {
      type: String,
      required: true,
      enum: ["clinical", "education", "basic", "public"],
    },
    keywords: {
      type: String,
      trim: true,
    },

    // Abstract Content
    abstract: {
      type: String,
      required: true,
    },

    // Optional PDF Upload
    pdfFile: {
      filename: String,
      path: String,
      uploadedAt: Date,
    },

    // Status and Review Information
    status: {
      type: String,
      enum: ["pending", "under_review", "accepted", "rejected"],
      default: "pending",
    },

    // Reviews and Scoring
    reviews: [
      {
        reviewerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Reviewer",
        },
        score: {
          type: Number,
          min: 1,
          max: 10,
        },
        comments: String,
        submittedAt: Date,
      },
    ],

    averageScore: {
      type: Number,
      default: 0,
    },

    // Publication Information
    published: {
      type: Boolean,
      default: false,
    },
    acceptedAt: Date,
    publishedAt: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Calculate average score whenever reviews are updated
abstractSchema.methods.calculateAverageScore = function () {
  if (this.reviews.length === 0) {
    this.averageScore = 0;
    return 0;
  }

  const sum = this.reviews.reduce((acc, review) => acc + review.score, 0);
  this.averageScore = sum / this.reviews.length;
  return this.averageScore;
};

module.exports = mongoose.model("Abstract", abstractSchema);
