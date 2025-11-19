const Admin = require("../models/Admin");
const Abstract = require("../models/Abstract");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

    // Format response
    const formattedAbstracts = abstracts.map((abstract) => ({
      id: abstract._id,
      title: abstract.title,
      authors: abstract.authors,
      email: abstract.email,
      department: abstract.department,
      category: abstract.category,
      keywords: abstract.keywords,
      abstract: abstract.abstract,
      hasPDF: !!abstract.pdfFile,
      pdfUrl: abstract.pdfFile ? `/${abstract.pdfFile.path}` : null,
      status: abstract.status,
      reviewCount: abstract.reviews.length,
      averageScore: abstract.averageScore,
      reviews: abstract.reviews.map((r) => ({
        reviewerName: r.reviewerId.name,
        reviewerEmail: r.reviewerId.email,
        score: r.score,
        comments: r.comments,
        submittedAt: r.submittedAt,
      })),
      published: abstract.published,
      submittedAt: abstract.createdAt,
      acceptedAt: abstract.acceptedAt,
      publishedAt: abstract.publishedAt,
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

// @desc    Accept an abstract
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

    abstract.status = "accepted";
    abstract.acceptedAt = new Date();
    await abstract.save();

    res.status(200).json({
      success: true,
      message: "Abstract accepted",
      data: {
        id: abstract._id,
        title: abstract.title,
        status: abstract.status,
        acceptedAt: abstract.acceptedAt,
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
    await abstract.save();

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

// @desc    Publish accepted abstracts to showcase
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
    const published = await Abstract.countDocuments({ published: true });

    // Get average score of all abstracts
    const abstracts = await Abstract.find({ "reviews.0": { $exists: true } });
    const avgScore =
      abstracts.length > 0
        ? abstracts.reduce((sum, a) => sum + a.averageScore, 0) /
          abstracts.length
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAbstracts,
        pending,
        underReview,
        accepted,
        rejected,
        published,
        averageScore: avgScore.toFixed(2),
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
