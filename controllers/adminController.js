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
      acceptanceEmailSent: abstract.acceptanceEmailSent || false,
      acceptanceEmailSentAt: abstract.acceptanceEmailSentAt,
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

// @desc    Accept an abstract and send acceptance email to author
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

    // Generate magic link for author
    const magicLink = getMagicLinkUrl(abstract.viewToken);
    const formattedAuthors = abstract.getFormattedAuthors();

    // Send acceptance email
    let emailSent = false;
    if (process.env.SENDGRID_API_KEY) {
      try {
        const msg = {
          to: abstract.email,
          from: process.env.SENDGRID_FROM_EMAIL || "sbadat@neomed.edu",
          replyTo: "sbadat@neomed.edu",
          subject:
            "🎉 Congratulations! Your Abstract Has Been Accepted - NEOMED Research Forum 2026",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #059669; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px; }
                .button:hover { background: #047857; }
                .info-box { background: white; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; }
                .warning-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .status-badge { background: #D1FAE5; color: #065F46; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
                .deadline { color: #DC2626; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Congratulations!</h1>
                  <p>Your Abstract Has Been Accepted</p>
                </div>
                
                <div class="content">
                  <p>Dear ${abstract.primaryAuthor.firstName} ${abstract.primaryAuthor.lastName},</p>
                  
                  <p>We are pleased to inform you that your abstract has been <strong>accepted</strong> for presentation at the <strong>NEOMED Research Forum 2026</strong>!</p>
                  
                  <div class="info-box">
                    <strong>Accepted Abstract:</strong><br>
                    <strong>Title:</strong> ${abstract.title}<br>
                    <strong>Authors:</strong> ${formattedAuthors}<br>
                    <strong>Category:</strong> ${abstract.category}<br>
                    <strong>Status:</strong> <span class="status-badge">ACCEPTED</span>
                  </div>
                  
                  <div class="warning-box">
                    <strong>⚠️ Action Required by <span class="deadline">Thursday, February 5th, 2026</span></strong><br><br>
                    Please click the button below to confirm your participation in the Research Forum. You will also have the option to choose whether you would like your abstract to be displayed on our public showcase.
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${magicLink}" class="button">Confirm Your Participation</a>
                  </div>
                  
                  <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${magicLink}">${magicLink}</a></p>
                  
                  <div class="info-box">
                    <strong>📅 Important Dates:</strong><br>
                    • <strong>Response Deadline:</strong> <span class="deadline">February 5, 2026</span><br>
                    • <strong>Presentation Slides Due:</strong> February 21, 2026<br>
                    • <strong>Research Forum:</strong> February 25, 2026
                  </div>
                  
                  <p>If you have any questions, please contact us at <a href="mailto:sbadat@neomed.edu">sbadat@neomed.edu</a></p>
                  
                  <p>Congratulations again on your acceptance!</p>
                  
                  <p>Best regards,<br>
                  <strong>NEOMED Research Forum Committee</strong></p>
                </div>
                
                <div class="footer">
                  <p>Northeast Ohio Medical University<br>
                  Research Forum 2026</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await sgMail.send(msg);
        emailSent = true;

        // Update abstract to track email was sent
        abstract.acceptanceEmailSent = true;
        abstract.acceptanceEmailSentAt = new Date();
        await abstract.save();

        console.log("✅ Acceptance email sent to:", abstract.email);
      } catch (emailError) {
        console.log("⚠️ Acceptance email not sent:", emailError.message);
        if (emailError.response) {
          console.log("SendGrid error details:", emailError.response.body);
        }
      }
    } else {
      console.log(
        "⚠️ SendGrid API key not configured - skipping acceptance email"
      );
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? "Abstract accepted and notification email sent to author"
        : "Abstract accepted (email not sent - SendGrid not configured)",
      data: {
        id: abstract._id,
        title: abstract.title,
        status: abstract.status,
        acceptedAt: abstract.acceptedAt,
        authorResponse: abstract.authorResponse,
        authorResponseDeadline: abstract.authorResponseDeadline,
        emailSent,
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

    // Optionally send rejection email
    let emailSent = false;
    if (process.env.SENDGRID_API_KEY) {
      try {
        const magicLink = getMagicLinkUrl(abstract.viewToken);

        const msg = {
          to: abstract.email,
          from: process.env.SENDGRID_FROM_EMAIL || "sbadat@neomed.edu",
          replyTo: "sbadat@neomed.edu",
          subject: "NEOMED Research Forum 2026 - Submission Decision",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #475569 0%, #64748B 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; border-left: 4px solid #64748B; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Submission Decision</h1>
                  <p>NEOMED Research Forum 2026</p>
                </div>
                
                <div class="content">
                  <p>Dear ${abstract.primaryAuthor.firstName} ${abstract.primaryAuthor.lastName},</p>
                  
                  <p>Thank you for submitting your abstract to the NEOMED Research Forum 2026.</p>
                  
                  <p>After careful review by our committee, we regret to inform you that your abstract was not selected for presentation at this year's forum.</p>
                  
                  <div class="info-box">
                    <strong>Abstract:</strong> ${abstract.title}
                  </div>
                  
                  <p>We received many high-quality submissions this year, making the selection process highly competitive. We encourage you to continue your research and consider submitting to future NEOMED Research Forums.</p>
                  
                  <p>You can view your submission details anytime at: <a href="${magicLink}">${magicLink}</a></p>
                  
                  <p>Thank you for your contribution to advancing medical research.</p>
                  
                  <p>Best regards,<br>
                  <strong>NEOMED Research Forum Committee</strong></p>
                </div>
                
                <div class="footer">
                  <p>Northeast Ohio Medical University<br>
                  Research Forum 2026</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await sgMail.send(msg);
        emailSent = true;
        console.log("✅ Rejection email sent to:", abstract.email);
      } catch (emailError) {
        console.log("⚠️ Rejection email not sent:", emailError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? "Abstract rejected and notification email sent"
        : "Abstract rejected",
      data: {
        id: abstract._id,
        title: abstract.title,
        status: abstract.status,
        emailSent,
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

// @desc    Resend acceptance email
// @route   POST /api/admin/resend-acceptance/:abstractId
// @access  Private (Admin only)
exports.resendAcceptanceEmail = async (req, res) => {
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
        message: "Can only resend acceptance email for accepted abstracts",
      });
    }

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(400).json({
        success: false,
        message: "SendGrid not configured",
      });
    }

    const magicLink = getMagicLinkUrl(abstract.viewToken);
    const formattedAuthors = abstract.getFormattedAuthors();

    const msg = {
      to: abstract.email,
      from: process.env.SENDGRID_FROM_EMAIL || "sbadat@neomed.edu",
      replyTo: "sbadat@neomed.edu",
      subject:
        "🎉 Reminder: Confirm Your Participation - NEOMED Research Forum 2026",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #059669; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px; }
            .info-box { background: white; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; }
            .warning-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .deadline { color: #DC2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📬 Reminder</h1>
              <p>Please Confirm Your Participation</p>
            </div>
            
            <div class="content">
              <p>Dear ${abstract.primaryAuthor.firstName} ${abstract.primaryAuthor.lastName},</p>
              
              <p>This is a reminder that your abstract has been <strong>accepted</strong> for presentation at the NEOMED Research Forum 2026.</p>
              
              <div class="info-box">
                <strong>Title:</strong> ${abstract.title}<br>
                <strong>Authors:</strong> ${formattedAuthors}
              </div>
              
              <div class="warning-box">
                <strong>⚠️ Action Required by <span class="deadline">Thursday, February 5th, 2026</span></strong><br><br>
                Please click the button below to confirm your participation.
              </div>
              
              <div style="text-align: center;">
                <a href="${magicLink}" class="button">Confirm Your Participation</a>
              </div>
              
              <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${magicLink}">${magicLink}</a></p>
              
              <p>If you have any questions, please contact us at <a href="mailto:sbadat@neomed.edu">sbadat@neomed.edu</a></p>
              
              <p>Best regards,<br>
              <strong>NEOMED Research Forum Committee</strong></p>
            </div>
            
            <div class="footer">
              <p>Northeast Ohio Medical University<br>
              Research Forum 2026</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    abstract.acceptanceEmailSent = true;
    abstract.acceptanceEmailSentAt = new Date();
    await abstract.save();

    console.log("✅ Acceptance reminder email sent to:", abstract.email);

    res.status(200).json({
      success: true,
      message: "Acceptance email resent successfully",
      data: {
        id: abstract._id,
        email: abstract.email,
      },
    });
  } catch (error) {
    console.error("Error resending acceptance email:", error);
    res.status(500).json({
      success: false,
      message: "Error resending acceptance email",
      error: error.message,
    });
  }
};
