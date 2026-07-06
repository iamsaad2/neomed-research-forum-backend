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
          enum: ["MD", "DO", "PhD", "MD/PhD", "MS", "BS", "BA", "Other"],
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

    // Required PDF Upload (stored on Cloudinary; `path` is the full secure URL)
    pdfFile: {
      filename: {
        type: String,
        required: true,
      },
      path: {
        type: String,
        required: true,
      },
      // Cloudinary public_id — kept so the file can be deleted later if needed.
      publicId: {
        type: String,
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
        scores: {
          background: {
            type: Number,
            min: 1,
            max: 5,
          },
          methods: {
            type: Number,
            min: 1,
            max: 5,
          },
          results: {
            type: Number,
            min: 1,
            max: 5,
          },
          conclusions: {
            type: Number,
            min: 1,
            max: 5,
          },
          originality: {
            type: Number,
            min: 1,
            max: 5,
          },
        },
        totalScore: {
          type: Number,
          min: 1,
          max: 5,
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

    // Author's response to acceptance
    authorResponse: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },

    // Whether author wants their abstract displayed on public showcase
    // ONE-TIME choice made when author accepts - cannot be changed later
    displayOnShowcase: {
      type: Boolean,
      default: false,
    },

    // Deadline for author to respond to acceptance
    authorResponseDeadline: {
      type: Date,
      default: null,
    },

    // When the author responded
    authorRespondedAt: {
      type: Date,
      default: null,
    },

    // Presentation submission tracking (self-reported)
    presentationSubmitted: {
      type: Boolean,
      default: false,
    },

    presentationSubmittedAt: {
      type: Date,
      default: null,
    },

    // Presentation file upload (optional)
    presentationFile: {
      filename: String,
      path: String,
      uploadedAt: Date,
      externalUrl: String,
    },

    // Deadline for presentation upload
    presentationDeadline: {
      type: Date,
      default: null,
    },

    // Track if acceptance email was sent
    acceptanceEmailSent: {
      type: Boolean,
      default: false,
    },

    acceptanceEmailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
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

  const sum = this.reviews.reduce((acc, review) => acc + review.totalScore, 0);
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
    hasPDF: !!this.pdfFile,
    status: this.status,
    statusMessage: this.statusMessage,
    submittedAt: this.createdAt,
    acceptedAt: this.acceptedAt,
    rejectedAt: this.rejectedAt,
    // Author response flow fields
    authorResponse: this.authorResponse || "pending",
    displayOnShowcase: this.displayOnShowcase || false,
    authorResponseDeadline: this.authorResponseDeadline,
    authorRespondedAt: this.authorRespondedAt,
    presentationDeadline: this.presentationDeadline,
    presentationSubmitted: this.presentationSubmitted || false,
    presentationSubmittedAt: this.presentationSubmittedAt,
    // Don't expose: reviews, averageScore, viewToken, pdfUrl
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
        if (!this.authorResponse || this.authorResponse === "pending") {
          this.statusMessage =
            "Congratulations! Your abstract has been accepted. Please respond by the deadline to confirm your participation.";
        }
        this.acceptedAt = this.acceptedAt || new Date();
        break;
      case "rejected":
        this.statusMessage =
          "Thank you for your submission. Unfortunately, your abstract was not selected for this year's forum.";
        this.rejectedAt = this.rejectedAt || new Date();
        break;
    }
  }

  // Update status message based on author response
  if (this.isModified("authorResponse")) {
    if (this.authorResponse === "accepted") {
      this.statusMessage =
        "You have confirmed your participation! Please submit your presentation slides by the deadline.";
    } else if (this.authorResponse === "declined") {
      this.statusMessage =
        "You have declined the presentation spot. Thank you for your submission to NEOMED Research Forum 2026.";
    }
  }

  next();
});

module.exports = mongoose.model("Abstract", abstractSchema);
