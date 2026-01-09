const Reviewer = require("../models/Reviewer");
const Abstract = require("../models/Abstract");
const jwt = require("jsonwebtoken");

// Rubric criteria definitions
const RUBRIC_CRITERIA = {
  background: {
    id: "background",
    title: "Background & Objective",
    description:
      "Clarity of background, identified gap, and objective or hypothesis.",
  },
  methods: {
    id: "methods",
    title: "Study Design & Methods",
    description:
      "Appropriateness and clarity of study design, data source, variables, and analysis.",
  },
  results: {
    id: "results",
    title: "Results",
    description: "Quality and clarity of reported results.",
  },
  conclusions: {
    id: "conclusions",
    title: "Conclusions",
    description:
      "Extent to which conclusions follow from results and state clear take-home messages.",
  },
  originality: {
    id: "originality",
    title: "Originality & Writing Quality",
    description:
      "Novelty of the work and clarity of writing (organization, grammar, spelling).",
  },
};

const SCORE_LABELS = {
  5: "Excellent",
  4: "Good",
  3: "Satisfactory",
  2: "Weak",
  1: "Poor",
};

// @desc    Reviewer login (shared password)
// @route   POST /api/reviewers/login
// @access  Public
exports.reviewerLogin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check shared password
    if (password !== process.env.REVIEWER_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Find or create reviewer
    let reviewer = await Reviewer.findOne({ email: email.toLowerCase() });

    if (!reviewer) {
      // Create new reviewer profile
      reviewer = await Reviewer.create({
        name,
        email: email.toLowerCase(),
      });
      console.log("✅ New reviewer created:", email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: reviewer._id, email: reviewer.email, role: "reviewer" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      reviewer: {
        id: reviewer._id,
        name: reviewer.name,
        email: reviewer.email,
        totalReviews: reviewer.totalReviewsCompleted,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// @desc    Get rubric criteria
// @route   GET /api/reviewers/rubric
// @access  Private (Reviewer only)
exports.getRubric = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        criteria: RUBRIC_CRITERIA,
        scoreLabels: SCORE_LABELS,
      },
    });
  } catch (error) {
    console.error("Error fetching rubric:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rubric",
      error: error.message,
    });
  }
};

// @desc    Get abstracts for review (pending or under_review)
// @route   GET /api/reviewers/abstracts
// @access  Private (Reviewer only)
exports.getAbstractsForReview = async (req, res) => {
  try {
    // Get abstracts that are pending or under review
    const abstracts = await Abstract.find({
      status: { $in: ["pending", "under_review"] },
    }).sort({ createdAt: 1 }); // Oldest first

    // For each abstract, check if current reviewer has already reviewed it
    const reviewerId = req.user.id;
    const abstractsWithReviewStatus = abstracts.map((abstract) => {
      const hasReviewed = abstract.reviews.some(
        (review) => review.reviewerId.toString() === reviewerId
      );

      return {
        id: abstract._id,
        title: abstract.title,
        authors: abstract.getFormattedAuthors(),
        department: abstract.department,
        category: abstract.category,
        keywords: abstract.keywords,
        abstract: abstract.getFullAbstract(),
        abstractContent: abstract.abstractContent,
        hasPDF: !!abstract.pdfFile,
        pdfUrl: abstract.pdfFile ? `/${abstract.pdfFile.path}` : null,
        status: abstract.status,
        submittedAt: abstract.createdAt,
        hasReviewed,
        reviewCount: abstract.reviews.length,
      };
    });

    res.status(200).json({
      success: true,
      count: abstractsWithReviewStatus.length,
      data: abstractsWithReviewStatus,
    });
  } catch (error) {
    console.error("Error fetching abstracts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching abstracts",
      error: error.message,
    });
  }
};

// @desc    Submit a review for an abstract (with 5-criteria rubric)
// @route   POST /api/reviewers/review/:abstractId
// @access  Private (Reviewer only)
exports.submitReview = async (req, res) => {
  try {
    const { abstractId } = req.params;
    const { scores, comments } = req.body;
    const reviewerId = req.user.id;

    // DEBUG LOGGING - Remove after fixing
    console.log("=== REVIEW SUBMISSION DEBUG ===");
    console.log("Abstract ID:", abstractId);
    console.log("Reviewer ID:", reviewerId);
    console.log("Raw req.body:", JSON.stringify(req.body, null, 2));
    console.log("Scores object:", scores);
    console.log("Scores type:", typeof scores);
    console.log("================================");

    // Validate scores object exists
    if (!scores || typeof scores !== "object") {
      console.log("ERROR: Scores object is missing or not an object");
      return res.status(400).json({
        success: false,
        message: "Scores object is required",
      });
    }

    // Validate all 5 criteria are present and valid (1-5)
    const requiredCriteria = [
      "background",
      "methods",
      "results",
      "conclusions",
      "originality",
    ];
    const validatedScores = {};

    for (const criterion of requiredCriteria) {
      const rawScore = scores[criterion];
      const score = parseInt(rawScore, 10); // Convert to integer in case it's a string

      console.log(`Criterion ${criterion}: raw=${rawScore}, parsed=${score}`);

      if (isNaN(score) || score < 1 || score > 5) {
        console.log(`ERROR: Invalid score for ${criterion}`);
        return res.status(400).json({
          success: false,
          message: `${RUBRIC_CRITERIA[criterion].title} score must be an integer between 1 and 5. Received: ${rawScore}`,
        });
      }

      validatedScores[criterion] = score;
    }

    // Find abstract
    const abstract = await Abstract.findById(abstractId);
    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    // Check if reviewer already reviewed this abstract
    const existingReview = abstract.reviews.find(
      (review) => review.reviewerId.toString() === reviewerId
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this abstract",
      });
    }

    // Calculate total score (average of 5 criteria)
    const totalScore =
      (validatedScores.background +
        validatedScores.methods +
        validatedScores.results +
        validatedScores.conclusions +
        validatedScores.originality) /
      5;

    // Add review
    abstract.reviews.push({
      reviewerId,
      scores: {
        background: validatedScores.background,
        methods: validatedScores.methods,
        results: validatedScores.results,
        conclusions: validatedScores.conclusions,
        originality: validatedScores.originality,
      },
      totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
      comments: comments || "",
      submittedAt: new Date(),
    });

    // Calculate average score across all reviews
    abstract.calculateAverageScore();

    // Update status to under_review if it was pending
    if (abstract.status === "pending") {
      abstract.status = "under_review";
    }

    await abstract.save();

    // Update reviewer's review count
    await Reviewer.findByIdAndUpdate(reviewerId, {
      $inc: { totalReviewsCompleted: 1 },
      $addToSet: { assignedAbstracts: abstractId },
    });

    res.status(200).json({
      success: true,
      message: "Review submitted successfully",
      data: {
        abstractId: abstract._id,
        reviewCount: abstract.reviews.length,
        averageScore: abstract.averageScore,
        yourScore: totalScore,
      },
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting review",
      error: error.message,
    });
  }
};

// @desc    Get reviewer's own review history
// @route   GET /api/reviewers/my-reviews
// @access  Private (Reviewer only)
exports.getMyReviews = async (req, res) => {
  try {
    const reviewerId = req.user.id;

    // Find all abstracts where this reviewer has reviewed
    const abstracts = await Abstract.find({
      "reviews.reviewerId": reviewerId,
    }).select(
      "title primaryAuthor additionalAuthors category reviews createdAt"
    );

    // Filter to only show this reviewer's reviews
    const myReviews = abstracts.map((abstract) => {
      const myReview = abstract.reviews.find(
        (review) => review.reviewerId.toString() === reviewerId
      );

      return {
        abstractId: abstract._id,
        title: abstract.title,
        authors: abstract.getFormattedAuthors(),
        category: abstract.category,
        myScores: myReview.scores,
        myTotalScore: myReview.totalScore,
        myComments: myReview.comments,
        reviewedAt: myReview.submittedAt,
        totalReviews: abstract.reviews.length,
      };
    });

    res.status(200).json({
      success: true,
      count: myReviews.length,
      data: myReviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reviews",
      error: error.message,
    });
  }
};
