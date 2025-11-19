const Reviewer = require("../models/Reviewer");
const Abstract = require("../models/Abstract");
const jwt = require("jsonwebtoken");

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
        authors: abstract.authors,
        department: abstract.department,
        category: abstract.category,
        keywords: abstract.keywords,
        abstract: abstract.abstract,
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

// @desc    Submit a review for an abstract
// @route   POST /api/reviewers/review/:abstractId
// @access  Private (Reviewer only)
exports.submitReview = async (req, res) => {
  try {
    const { abstractId } = req.params;
    const { score, comments } = req.body;
    const reviewerId = req.user.id;

    // Validate score
    if (!score || score < 1 || score > 10) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 1 and 10",
      });
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

    // Add review
    abstract.reviews.push({
      reviewerId,
      score,
      comments: comments || "",
      submittedAt: new Date(),
    });

    // Calculate average score
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
    }).select("title authors category reviews createdAt");

    // Filter to only show this reviewer's reviews
    const myReviews = abstracts.map((abstract) => {
      const myReview = abstract.reviews.find(
        (review) => review.reviewerId.toString() === reviewerId
      );

      return {
        abstractId: abstract._id,
        title: abstract.title,
        authors: abstract.authors,
        category: abstract.category,
        myScore: myReview.score,
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
