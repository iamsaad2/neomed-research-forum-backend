const Abstract = require("../models/Abstract");
const sgMail = require("@sendgrid/mail");

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid API key configured");
} else {
  console.log("⚠️ SENDGRID_API_KEY not set - emails will not be sent");
}

// Generate magic link URL
const getMagicLinkUrl = (token) => {
  const frontendUrl =
    process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
  return `${frontendUrl}/view/${token}`;
};

// @desc    Submit a new abstract
// @route   POST /api/abstracts/submit
// @access  Public
exports.submitAbstract = async (req, res) => {
  try {
    const { title, authors, email, department, category, keywords, abstract } =
      req.body;

    // Validate required fields
    if (!title || !authors || !email || !department || !category || !abstract) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
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

    // Create new abstract (viewToken generated automatically)
    const newAbstract = await Abstract.create(abstractData);

    // Generate magic link
    const magicLink = getMagicLinkUrl(newAbstract.viewToken);

    // Send confirmation email with magic link using SendGrid API
    if (process.env.SENDGRID_API_KEY) {
      try {
        const msg = {
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "saadbadat.1@gmail.com", // Must be verified in SendGrid
          subject: "NEOMED Research Forum - Submission Confirmed",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #004963 0%, #0072BC 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #0072BC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                .button:hover { background: #004963; }
                .info-box { background: white; border-left: 4px solid #0072BC; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .status-badge { background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✓ Submission Received!</h1>
                  <p>NEOMED Research Forum 2025</p>
                </div>
                
                <div class="content">
                  <h2>Thank you for your submission!</h2>
                  
                  <p>Dear ${authors.split(",")[0].trim()},</p>
                  
                  <p>Your abstract titled "<strong>${title}</strong>" has been successfully submitted to the NEOMED Research Forum 2025.</p>
                  
                  <div class="info-box">
                    <strong>Submission Details:</strong><br>
                    <strong>Submission ID:</strong> #${newAbstract._id
                      .toString()
                      .slice(-6)
                      .toUpperCase()}<br>
                    <strong>Title:</strong> ${title}<br>
                    <strong>Authors:</strong> ${authors}<br>
                    <strong>Category:</strong> ${category}<br>
                    <strong>Status:</strong> <span class="status-badge">PENDING REVIEW</span><br>
                    ${req.file ? "<strong>PDF:</strong> Uploaded ✓<br>" : ""}
                    <strong>Submitted:</strong> ${new Date().toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" }
                    )}
                  </div>
                  
                  <h3>📋 View Your Submission Anytime</h3>
                  <p>Click the button below to view your abstract and check its status:</p>
                  
                  <div style="text-align: center;">
                    <a href="${magicLink}" class="button">View My Submission</a>
                  </div>
                  
                  <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${magicLink}">${magicLink}</a></p>
                  
                  <div class="info-box">
                    <strong>⏱ What's Next?</strong><br>
                    • <strong>Review Period:</strong> January 7 - January 28, 2025<br>
                    • <strong>Notification:</strong> January 28, 2025<br>
                    • <strong>Final Slides Due:</strong> February 18, 2025<br>
                    • <strong>Forum Date:</strong> February 25, 2025
                  </div>
                  
                  <p><strong>Important:</strong> Save this email! The link above is your unique access link to view your submission status. No login required.</p>
                  
                  <p>If you have any questions, please contact us at <a href="mailto:sbadat@neomed.edu">sbadat@neomed.edu</a></p>
                  
                  <p>Best regards,<br>
                  <strong>NEOMED Research Forum Committee</strong></p>
                </div>
                
                <div class="footer">
                  <p>Northeast Ohio Medical University<br>
                  Research Forum 2025</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await sgMail.send(msg);
        console.log("✅ Confirmation email sent via SendGrid to:", email);
      } catch (emailError) {
        console.log("⚠️ Email not sent:", emailError.message);
        if (emailError.response) {
          console.log("SendGrid error details:", emailError.response.body);
        }
        // Don't fail the submission if email fails
      }
    } else {
      console.log("⚠️ SendGrid API key not configured - skipping email");
    }

    res.status(201).json({
      success: true,
      message:
        "Abstract submitted successfully! Check your email for the confirmation and tracking link.",
      data: {
        id: newAbstract._id,
        title: newAbstract.title,
        status: newAbstract.status,
        viewToken: newAbstract.viewToken,
        magicLink: magicLink,
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

// @desc    Get abstract by magic link token
// @route   GET /api/abstracts/view/:token
// @access  Public (but requires token)
exports.getAbstractByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const abstract = await Abstract.findOne({ viewToken: token });

    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: "Submission not found. Please check your link and try again.",
      });
    }

    // Return public view only (no reviews, scores, etc.)
    res.status(200).json({
      success: true,
      data: abstract.getPublicView(),
    });
  } catch (error) {
    console.error("Error fetching abstract:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching submission",
      error: error.message,
    });
  }
};

// @desc    Get all abstracts (admin/reviewer view)
// @route   GET /api/abstracts
// @access  Private
exports.getAllAbstracts = async (req, res) => {
  try {
    const abstracts = await Abstract.find()
      .sort({ createdAt: -1 })
      .select("-viewToken"); // Don't expose magic links to admins

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

// @desc    Get single abstract by ID (admin/reviewer)
// @route   GET /api/abstracts/:id
// @access  Private
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
      .sort({ averageScore: -1 })
      .select(
        "title authors department category keywords abstract averageScore publishedAt createdAt"
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
