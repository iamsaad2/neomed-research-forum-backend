const mongoose = require("mongoose");
const crypto = require("crypto");

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

    // Magic Link Token for viewing submission
    viewToken: {
      type: String,
      unique: true,
    },

    // Status and Review Information
    status: {
      type: String,
      enum: ["pending", "under_review", "accepted", "rejected"],
      default: "pending",
    },

    // Status messages visible to submitter
    statusMessage: {
      type: String,
      default: "Your abstract has been received and is pending review.",
    },

    // Reviews and Scoring (hidden from submitter)
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
    rejectedAt: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Generate magic link token before saving
abstractSchema.pre("save", function (next) {
  if (!this.viewToken) {
    this.viewToken = crypto.randomBytes(32).toString("hex");
  }
  next();
});

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

// Get public view of abstract (what submitter sees)
abstractSchema.methods.getPublicView = function () {
  return {
    id: this._id,
    title: this.title,
    authors: this.authors,
    email: this.email,
    department: this.department,
    category: this.category,
    keywords: this.keywords,
    abstract: this.abstract,
    hasPDF: !!this.pdfFile,
    status: this.status,
    statusMessage: this.statusMessage,
    submittedAt: this.createdAt,
    acceptedAt: this.acceptedAt,
    rejectedAt: this.rejectedAt,
    // Don't expose: reviews, averageScore, viewToken
  };
};

// Update status message when status changes
abstractSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    switch (this.status) {
      case "pending":
        this.statusMessage =
          "Your abstract has been received and is pending review.";
        break;
      case "under_review":
        this.statusMessage =
          "Your abstract is currently under review by our committee.";
        break;
      case "accepted":
        this.statusMessage =
          "Congratulations! Your abstract has been accepted for presentation at NEOMED Research Forum 2025.";
        this.acceptedAt = this.acceptedAt || new Date();
        break;
      case "rejected":
        this.statusMessage =
          "Thank you for your submission. Unfortunately, your abstract was not selected for this year's forum.";
        this.rejectedAt = this.rejectedAt || new Date();
        break;
    }
  }
  next();
});

module.exports = mongoose.model("Abstract", abstractSchema);
