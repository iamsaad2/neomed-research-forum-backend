const Admin = require("../models/Admin");
const Abstract = require("../models/Abstract");
const Reviewer = require("../models/Reviewer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sgMail = require("@sendgrid/mail");

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Generate magic link URL
const getMagicLinkUrl = (token) => {
  const frontendUrl =
    process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
  return `${frontendUrl}/view/${token}`;
};

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// @desc    Create first admin (only if no admins exist)
// @route   POST /api/admin/create-first
// @access  Public (only works if no admins exist)
exports.createFirstAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if any admins exist
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin already exists. Use login instead.",
      });
    }

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Create admin
    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by the model
    });

    console.log("✅ First admin created:", email);

    res.status(201).json({
      success: true,
      message: "Admin created successfully. You can now login.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating admin",
      error: error.message,
    });
  }
};

// @desc    Get all abstracts with full details (sorted by score)
// @route   GET /api/admin/abstracts
// @access  Private (Admin only)
exports.getAllAbstracts = async (req, res) => {
  try {
    const { status, sortBy } = req.query;

    // Build filter
    let filter = {};
    if (status) {
      filter.status = status;
    }

    // Get abstracts
    let query = Abstract.find(filter).populate(
      "reviews.reviewerId",
      "name email"
    );

    // Sort
    if (sortBy === "score") {
      query = query.sort({ averageScore: -1 }); // Highest first
    } else if (sortBy === "reviews") {
      query = query.sort({ "reviews.length": -1 }); // Most reviewed first
    } else {
      query = query.sort({ createdAt: -1 }); // Most recent first (default)
    }

    const abstracts = await query;

    // Format response with new review structure
    const formattedAbstracts = abstracts.map((abstract) => ({
      id: abstract._id,
      title: abstract.title,
      authors: abstract.getFormattedAuthors(),
      primaryAuthor: abstract.primaryAuthor,
      additionalAuthors: abstract.additionalAuthors,
      email: abstract.email,
      department: abstract.department,
      departmentOther: abstract.departmentOther,
      category: abstract.category,
      keywords: abstract.keywords,
      abstract: abstract.getFullAbstract(),
      abstractContent: abstract.abstractContent,
      hasPDF: !!abstract.pdfFile,
      pdfUrl: abstract.pdfFile ? `/${abstract.pdfFile.path}` : null,
      status: abstract.status,
      reviewCount: abstract.reviews.length,
      averageScore: abstract.averageScore,
      reviews: abstract.reviews.map((r) => ({
        reviewerName: r.reviewerId?.name || "Unknown",
        reviewerEmail: r.reviewerId?.email || "Unknown",
        scores: r.scores, // Individual criterion scores
        totalScore: r.totalScore, // Average of 5 criteria
        comments: r.comments,
        submittedAt: r.submittedAt,
      })),
      published: abstract.published,
      submittedAt: abstract.createdAt,
      acceptedAt: abstract.acceptedAt,
      publishedAt: abstract.publishedAt,
      // New fields for author response tracking
      authorResponse: abstract.authorResponse || "pending",
      displayOnShowcase: abstract.displayOnShowcase || false,
      authorResponseDeadline: abstract.authorResponseDeadline,
      authorRespondedAt: abstract.authorRespondedAt,
      presentationSubmitted: abstract.presentationSubmitted || false,
      presentationSubmittedAt: abstract.presentationSubmittedAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedAbstracts.length,
      data: formattedAbstracts,
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

// @desc    Get all reviewers with stats
// @route   GET /api/admin/reviewers
// @access  Private (Admin only)
exports.getAllReviewers = async (req, res) => {
  try {
    const reviewers = await Reviewer.find().sort({ totalReviewsCompleted: -1 });

    const formattedReviewers = reviewers.map((reviewer) => ({
      id: reviewer._id,
      name: reviewer.name,
      email: reviewer.email,
      department: reviewer.department,
      specialization: reviewer.specialization,
      totalReviewsCompleted: reviewer.totalReviewsCompleted,
      assignmentType: reviewer.assignmentType || "all",
      assignedAbstracts: reviewer.assignedAbstracts?.length || 0,
      assignedLimit: reviewer.assignedLimit || 0,
      createdAt: reviewer.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedReviewers.length,
      data: formattedReviewers,
    });
  } catch (error) {
    console.error("Error fetching reviewers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reviewers",
      error: error.message,
    });
  }
};

// @desc    Update reviewer assignment type
// @route   PUT /api/admin/reviewers/:reviewerId/assignment
// @access  Private (Admin only)
exports.updateReviewerAssignment = async (req, res) => {
  try {
    const { reviewerId } = req.params;
    const { assignmentType, assignedLimit } = req.body;

    const reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        message: "Reviewer not found",
      });
    }

    // Update assignment type
    if (assignmentType) {
      reviewer.assignmentType = assignmentType;
    }

    // Update limit if provided
    if (assignedLimit !== undefined) {
      reviewer.assignedLimit = assignedLimit;
    }

    // If changing to "all", clear specific assignments
    if (assignmentType === "all") {
      reviewer.assignedAbstracts = [];
      reviewer.assignedLimit = 0;
    }

    await reviewer.save();

    res.status(200).json({
      success: true,
      message: `Reviewer assignment updated to ${reviewer.assignmentType}`,
      data: {
        id: reviewer._id,
        name: reviewer.name,
        assignmentType: reviewer.assignmentType,
        assignedAbstracts: reviewer.assignedAbstracts.length,
        assignedLimit: reviewer.assignedLimit,
      },
    });
  } catch (error) {
    console.error("Error updating reviewer assignment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating reviewer assignment",
      error: error.message,
    });
  }
};

// @desc    Randomize abstract assignments for limited reviewers (non-overlapping)
// @route   POST /api/admin/reviewers/randomize-assignments
// @access  Private (Admin only)
exports.randomizeAssignments = async (req, res) => {
  try {
    const { reviewerIds, abstractsPerReviewer } = req.body;

    if (
      !reviewerIds ||
      !Array.isArray(reviewerIds) ||
      reviewerIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of reviewer IDs",
      });
    }

    if (!abstractsPerReviewer || abstractsPerReviewer < 1) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid number of abstracts per reviewer",
      });
    }

    // Get all pending/under_review abstracts
    const allAbstracts = await Abstract.find({
      status: { $in: ["pending", "under_review"] },
    }).select("_id");

    const abstractIds = allAbstracts.map((a) => a._id.toString());
    const totalAbstracts = abstractIds.length;
    const totalNeeded = reviewerIds.length * abstractsPerReviewer;

    if (totalNeeded > totalAbstracts) {
      return res.status(400).json({
        success: false,
        message: `Not enough abstracts for non-overlapping assignment. Have ${totalAbstracts} abstracts, need ${totalNeeded} (${reviewerIds.length} reviewers × ${abstractsPerReviewer} each)`,
      });
    }

    // Shuffle abstracts using Fisher-Yates algorithm
    const shuffled = [...abstractIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign abstracts to each reviewer (non-overlapping)
    const assignments = [];
    let currentIndex = 0;

    for (const reviewerId of reviewerIds) {
      const reviewer = await Reviewer.findById(reviewerId);
      if (!reviewer) {
        continue; // Skip invalid reviewer IDs
      }

      // Get slice of abstracts for this reviewer
      const assignedAbstractIds = shuffled.slice(
        currentIndex,
        currentIndex + abstractsPerReviewer
      );
      currentIndex += abstractsPerReviewer;

      // Update reviewer
      reviewer.assignmentType = "limited";
      reviewer.assignedAbstracts = assignedAbstractIds;
      reviewer.assignedLimit = abstractsPerReviewer;
      await reviewer.save();

      assignments.push({
        reviewerId: reviewer._id,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
        assignedCount: assignedAbstractIds.length,
      });
    }

    console.log(
      `✅ Randomized assignments for ${assignments.length} reviewers`
    );

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${abstractsPerReviewer} abstracts each to ${assignments.length} reviewers (non-overlapping)`,
      data: {
        totalAbstracts,
        abstractsPerReviewer,
        reviewersAssigned: assignments.length,
        assignments,
      },
    });
  } catch (error) {
    console.error("Error randomizing assignments:", error);
    res.status(500).json({
      success: false,
      message: "Error randomizing assignments",
      error: error.message,
    });
  }
};

// @desc    Clear all assignments for a reviewer (reset to "all")
// @route   DELETE /api/admin/reviewers/:reviewerId/assignments
// @access  Private (Admin only)
exports.clearReviewerAssignments = async (req, res) => {
  try {
    const { reviewerId } = req.params;

    const reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        message: "Reviewer not found",
      });
    }

    reviewer.assignmentType = "all";
    reviewer.assignedAbstracts = [];
    reviewer.assignedLimit = 0;
    await reviewer.save();

    res.status(200).json({
      success: true,
      message: `Cleared assignments for ${reviewer.name}. Now has access to all abstracts.`,
      data: {
        id: reviewer._id,
        name: reviewer.name,
        assignmentType: reviewer.assignmentType,
      },
    });
  } catch (error) {
    console.error("Error clearing assignments:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing assignments",
      error: error.message,
    });
  }
};

// @desc    Delete a reviewer and all their reviews
// @route   DELETE /api/admin/reviewers/:reviewerId
// @access  Private (Admin only)
exports.deleteReviewer = async (req, res) => {
  try {
    const { reviewerId } = req.params;

    // Find the reviewer
    const reviewer = await Reviewer.findById(reviewerId);
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        message: "Reviewer not found",
      });
    }

    // Find all abstracts with reviews from this reviewer
    const abstractsWithReviews = await Abstract.find({
      "reviews.reviewerId": reviewerId,
    });

    let totalReviewsRemoved = 0;

    // Remove this reviewer's reviews from all abstracts
    for (const abstract of abstractsWithReviews) {
      const originalReviewCount = abstract.reviews.length;

      // Filter out reviews from this reviewer
      abstract.reviews = abstract.reviews.filter(
        (review) => review.reviewerId.toString() !== reviewerId
      );

      const reviewsRemoved = originalReviewCount - abstract.reviews.length;
      totalReviewsRemoved += reviewsRemoved;

      // Recalculate average score
      abstract.calculateAverageScore();

      // Update status if no more reviews
      if (abstract.reviews.length === 0 && abstract.status === "under_review") {
        abstract.status = "pending";
      }

      await abstract.save();
    }

    // Delete the reviewer
    await Reviewer.findByIdAndDelete(reviewerId);

    console.log(
      `✅ Deleted reviewer ${reviewer.email} and removed ${totalReviewsRemoved} reviews`
    );

    res.status(200).json({
      success: true,
      message: `Reviewer ${reviewer.name} and their ${totalReviewsRemoved} reviews have been deleted`,
      data: {
        deletedReviewer: {
          id: reviewer._id,
          name: reviewer.name,
          email: reviewer.email,
        },
        reviewsRemoved: totalReviewsRemoved,
        abstractsAffected: abstractsWithReviews.length,
      },
    });
  } catch (error) {
    console.error("Error deleting reviewer:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting reviewer",
      error: error.message,
    });
  }
};

// @desc    Accept an abstract (NO EMAIL - admin sends manually)
// @route   PUT /api/admin/accept/:abstractId
// @access  Private (Admin only)
exports.acceptAbstract = async (req, res) => {
  try {
    const { abstractId } = req.params;

    const abstract = await Abstract.findById(abstractId);
    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    // Set status to accepted
    abstract.status = "accepted";
    abstract.acceptedAt = new Date();

    // Set author response to pending (waiting for author to respond)
    abstract.authorResponse = "pending";

    // Set deadline for author to respond (Thursday February 5th, 2026)
    abstract.authorResponseDeadline = new Date("2026-02-05T23:59:59");

    // Set presentation deadline (February 21st, 2026)
    abstract.presentationDeadline = new Date("2026-02-21T23:59:59");

    await abstract.save();

    // Generate magic link for reference (admin can use this if needed)
    const magicLink = getMagicLinkUrl(abstract.viewToken);

    console.log(`✅ Abstract accepted: ${abstract.title}`);
    console.log(`   Author link: ${magicLink}`);

    res.status(200).json({
      success: true,
      message: "Abstract accepted. Remember to send acceptance email manually.",
      data: {
        id: abstract._id,
        title: abstract.title,
        status: abstract.status,
        acceptedAt: abstract.acceptedAt,
        authorResponse: abstract.authorResponse,
        authorResponseDeadline: abstract.authorResponseDeadline,
        authorEmail: abstract.email,
        magicLink: magicLink, // Provided for admin reference
      },
    });
  } catch (error) {
    console.error("Error accepting abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting abstract",
      error: error.message,
    });
  }
};

// @desc    Reject an abstract
// @route   PUT /api/admin/reject/:abstractId
// @access  Private (Admin only)
exports.rejectAbstract = async (req, res) => {
  try {
    const { abstractId } = req.params;

    const abstract = await Abstract.findById(abstractId);
    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    abstract.status = "rejected";
    abstract.rejectedAt = new Date();
    await abstract.save();

    console.log(`✅ Abstract rejected: ${abstract.title}`);

    res.status(200).json({
      success: true,
      message: "Abstract rejected",
      data: {
        id: abstract._id,
        title: abstract.title,
        status: abstract.status,
      },
    });
  } catch (error) {
    console.error("Error rejecting abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting abstract",
      error: error.message,
    });
  }
};

// @desc    Publish accepted abstracts to showcase (admin manual override)
// @route   PUT /api/admin/publish/:abstractId
// @access  Private (Admin only)
exports.publishAbstract = async (req, res) => {
  try {
    const { abstractId } = req.params;

    const abstract = await Abstract.findById(abstractId);
    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    if (abstract.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Only accepted abstracts can be published",
      });
    }

    abstract.published = true;
    abstract.displayOnShowcase = true;
    abstract.publishedAt = new Date();
    await abstract.save();

    res.status(200).json({
      success: true,
      message: "Abstract published to showcase",
      data: {
        id: abstract._id,
        title: abstract.title,
        published: abstract.published,
        publishedAt: abstract.publishedAt,
      },
    });
  } catch (error) {
    console.error("Error publishing abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error publishing abstract",
      error: error.message,
    });
  }
};

// @desc    Unpublish abstract from showcase
// @route   PUT /api/admin/unpublish/:abstractId
// @access  Private (Admin only)
exports.unpublishAbstract = async (req, res) => {
  try {
    const { abstractId } = req.params;

    const abstract = await Abstract.findById(abstractId);
    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    abstract.published = false;
    abstract.displayOnShowcase = false;
    await abstract.save();

    res.status(200).json({
      success: true,
      message: "Abstract unpublished from showcase",
      data: {
        id: abstract._id,
        title: abstract.title,
        published: abstract.published,
      },
    });
  } catch (error) {
    console.error("Error unpublishing abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error unpublishing abstract",
      error: error.message,
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalAbstracts = await Abstract.countDocuments();
    const pending = await Abstract.countDocuments({ status: "pending" });
    const underReview = await Abstract.countDocuments({
      status: "under_review",
    });
    const accepted = await Abstract.countDocuments({ status: "accepted" });
    const rejected = await Abstract.countDocuments({ status: "rejected" });
    const published = await Abstract.countDocuments({
      published: true,
      displayOnShowcase: true,
    });

    // Author response stats
    const authorAccepted = await Abstract.countDocuments({
      status: "accepted",
      authorResponse: "accepted",
    });
    const authorDeclined = await Abstract.countDocuments({
      status: "accepted",
      authorResponse: "declined",
    });
    const authorPending = await Abstract.countDocuments({
      status: "accepted",
      authorResponse: "pending",
    });

    // Presentation submission stats
    const presentationSubmitted = await Abstract.countDocuments({
      status: "accepted",
      authorResponse: "accepted",
      presentationSubmitted: true,
    });

    // Get average score of all abstracts (now on 1-5 scale)
    const abstracts = await Abstract.find({ "reviews.0": { $exists: true } });
    const avgScore =
      abstracts.length > 0
        ? abstracts.reduce((sum, a) => sum + a.averageScore, 0) /
          abstracts.length
        : 0;

    // Get reviewer count
    const reviewerCount = await Reviewer.countDocuments();

    // Get limited vs all reviewers count
    const limitedReviewers = await Reviewer.countDocuments({
      assignmentType: "limited",
    });
    const allAccessReviewers = reviewerCount - limitedReviewers;

    res.status(200).json({
      success: true,
      data: {
        totalAbstracts,
        pending,
        underReview,
        accepted,
        rejected,
        published,
        // Author response breakdown
        authorResponses: {
          accepted: authorAccepted,
          declined: authorDeclined,
          pending: authorPending,
        },
        presentationSubmitted,
        averageScore: avgScore.toFixed(2),
        scoreScale: "1-5", // Indicate the new scale
        totalReviewers: reviewerCount,
        limitedReviewers,
        allAccessReviewers,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};
