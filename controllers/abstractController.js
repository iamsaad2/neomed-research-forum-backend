const Abstract = require("../models/Abstract");
const nodemailer = require("nodemailer");

// Configure email transporter (we'll set this up properly later)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// @desc    Submit a new abstract
// @route   POST /api/abstracts/submit
// @access  Public
exports.submitAbstract = async (req, res) => {
  try {
    // Log to debug
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    const { title, authors, email, department, category, keywords, abstract } =
      req.body;

    // Validate required fields
    if (!title || !authors || !email || !department || !category || !abstract) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
        received: {
          title: !!title,
          authors: !!authors,
          email: !!email,
          department: !!department,
          category: !!category,
          abstract: !!abstract,
        },
      });
    }

    // Prepare abstract data
    const abstractData = {
      title,
      authors,
      email,
      department,
      category,
      keywords,
      abstract,
      status: "pending",
    };

    // Add PDF file info if uploaded
    if (req.file) {
      abstractData.pdfFile = {
        filename: req.file.filename,
        path: req.file.path,
        uploadedAt: new Date(),
      };
    }

    // Create new abstract
    const newAbstract = await Abstract.create(abstractData);

    // Send confirmation email (we'll implement this properly later)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "NEOMED Research Forum - Abstract Submission Confirmation",
        html: `
          <h2>Thank you for your submission!</h2>
          <p>Dear Author,</p>
          <p>Your abstract titled "<strong>${title}</strong>" has been successfully submitted to the NEOMED Research Forum 2025.</p>
          <p><strong>Submission Details:</strong></p>
          <ul>
            <li>Abstract ID: ${newAbstract._id}</li>
            <li>Title: ${title}</li>
            <li>Authors: ${authors}</li>
            <li>Category: ${category}</li>
            <li>Department: ${department}</li>
            ${req.file ? "<li>PDF: Uploaded ✓</li>" : ""}
          </ul>
          <p>You will receive notification about the review status by January 28, 2025.</p>
          <p>Best regards,<br>NEOMED Research Forum Team</p>
        `,
      });
      console.log("✅ Confirmation email sent to:", email);
    } catch (emailError) {
      console.log(
        "⚠️ Email not sent (configure SMTP settings):",
        emailError.message
      );
      // Don't fail the submission if email fails
    }

    res.status(201).json({
      success: true,
      message: "Abstract submitted successfully",
      data: {
        id: newAbstract._id,
        title: newAbstract.title,
        status: newAbstract.status,
        hasPDF: !!req.file,
        submittedAt: newAbstract.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting abstract",
      error: error.message,
    });
  }
};

// @desc    Get all abstracts (for admin/reviewer)
// @route   GET /api/abstracts
// @access  Private (we'll add authentication later)
exports.getAllAbstracts = async (req, res) => {
  try {
    const abstracts = await Abstract.find()
      .sort({ createdAt: -1 }) // Most recent first
      .select("-reviews"); // Don't include reviews in list view

    res.status(200).json({
      success: true,
      count: abstracts.length,
      data: abstracts,
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

// @desc    Get single abstract by ID
// @route   GET /api/abstracts/:id
// @access  Private (we'll add authentication later)
exports.getAbstractById = async (req, res) => {
  try {
    const abstract = await Abstract.findById(req.params.id);

    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Abstract not found",
      });
    }

    res.status(200).json({
      success: true,
      data: abstract,
    });
  } catch (error) {
    console.error("Error fetching abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching abstract",
      error: error.message,
    });
  }
};

// @desc    Get published abstracts (for public showcase)
// @route   GET /api/abstracts/published
// @access  Public
exports.getPublishedAbstracts = async (req, res) => {
  try {
    const abstracts = await Abstract.find({
      status: "accepted",
      published: true,
    })
      .sort({ averageScore: -1 }) // Highest scored first
      .select(
        "title authors department category keywords averageScore publishedAt"
      );

    res.status(200).json({
      success: true,
      count: abstracts.length,
      data: abstracts,
    });
  } catch (error) {
    console.error("Error fetching published abstracts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching published abstracts",
      error: error.message,
    });
  }
};
