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

    // Primary submitter/author
    primaryAuthor: {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      degree: {
        type: String,
        required: true,
        enum: ["MD", "DO", "PhD", "MD/PhD", "MS", "BS", "BA", "Other"],
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
    },

    // Additional authors array
    additionalAuthors: [
      {
        firstName: {
          type: String,
          required: true,
          trim: true,
        },
        lastName: {
          type: String,
          required: true,
          trim: true,
        },
        degree: {
          type: String,
          required: true,
          enum: ["MD", "DO", "PhD", "MD/PhD", "MS", "BS", "Other"],
        },
      },
    ],

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
        "other",
      ],
    },

    departmentOther: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["clinical", "education", "basic", "public"],
    },

    keywords: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one keyword is required",
      },
    },

    // Abstract Content - Split into sections
    abstractContent: {
      background: {
        type: String,
        required: true,
      },
      methods: {
        type: String,
        required: true,
      },
      results: {
        type: String,
        required: true,
      },
      conclusion: {
        type: String,
        required: true,
      },
    },

    // Required PDF Upload
    pdfFile: {
      filename: {
        type: String,
        required: true,
      },
      path: {
        type: String,
        required: true,
      },
      uploadedAt: {
        type: Date,
        required: true,
      },
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

// Helper method to get formatted authors list
abstractSchema.methods.getFormattedAuthors = function () {
  const authors = [
    `${this.primaryAuthor.firstName} ${this.primaryAuthor.lastName}, ${this.primaryAuthor.degree}`,
  ];

  if (this.additionalAuthors && this.additionalAuthors.length > 0) {
    this.additionalAuthors.forEach((author) => {
      authors.push(`${author.firstName} ${author.lastName}, ${author.degree}`);
    });
  }

  return authors.join("; ");
};

// Helper method to get full abstract text
abstractSchema.methods.getFullAbstract = function () {
  return `Background: ${this.abstractContent.background}\n\nMethods: ${this.abstractContent.methods}\n\nResults: ${this.abstractContent.results}\n\nConclusion: ${this.abstractContent.conclusion}`;
};

// Get public view of abstract (what submitter sees)
abstractSchema.methods.getPublicView = function () {
  return {
    id: this._id,
    title: this.title,
    primaryAuthor: this.primaryAuthor,
    additionalAuthors: this.additionalAuthors,
    allAuthors: this.getFormattedAuthors(),
    email: this.email,
    department: this.department,
    departmentOther: this.departmentOther,
    category: this.category,
    keywords: this.keywords,
    abstractContent: this.abstractContent,
    fullAbstract: this.getFullAbstract(),
    hasPDF: true,
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
