const Settings = require("../models/Settings");
const cloudinary = require("../config/cloudinary");

// The current (2026) live content. Used to seed the singleton the very first
// time settings are requested, so deploying this feature changes nothing on the
// site until an admin edits it. After that, the DB is the source of truth.
const DEFAULT_SETTINGS = {
  key: "main",
  eventName: "Research Forum",
  year: 2026,
  university: "Northeast Ohio Medical University",
  eventDate: "February 25, 2026",
  eventTime: "4:00 PM",
  contactEmail: "sbadat@neomed.edu",
  submissionsOpen: true,
  submissionDeadlineText: "January 12, 2026",
  keyDates: [
    { date: "Dec 15, 2025", title: "Submissions Open", status: "complete" },
    { date: "Jan 12, 2026", title: "Submission Deadline", status: "complete" },
    { date: "Jan 28, 2026", title: "Acceptance Notification", status: "complete" },
    { date: "Feb 21, 2026", title: "Final Presentation Due", status: "complete" },
    { date: "Feb 25, 2026", title: "Research Forum Day", status: "current" },
  ],
  confirmByText: "Friday, February 6, 2026 at 11:59 PM",
  confirmDeadlineDisplay: "Thursday, February 5, 2026",
  presentationDueText: "Saturday, February 21, 2026 at 11:59 PM",
  reviewPeriodText: "January 13 – 28, 2026",
  decisionNotificationText: "January 28, 2026",
  recapPhotos: [
    { url: "/recap/recap-1.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-2.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-3.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-4.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-5.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-6.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-7.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-8.jpg", caption: "", publicId: "" },
    { url: "/recap/recap-9.jpg", caption: "", publicId: "" },
  ],
};

// Fields an admin is allowed to update via PUT /api/admin/settings.
const EDITABLE_FIELDS = [
  "eventName",
  "year",
  "university",
  "eventDate",
  "eventTime",
  "contactEmail",
  "submissionsOpen",
  "submissionDeadlineText",
  "keyDates",
  "confirmByText",
  "confirmDeadlineDisplay",
  "presentationDueText",
  "reviewPeriodText",
  "decisionNotificationText",
  "recapPhotos",
];

// Find the one settings doc, creating it from defaults on first ever call.
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({ key: "main" });
  if (!settings) {
    settings = await Settings.create(DEFAULT_SETTINGS);
    console.log("⚙️  Seeded default site settings");
  }
  return settings;
};

// @desc    Get site settings (public)
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching settings",
      error: error.message,
    });
  }
};

// @desc    Update site settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    console.log("⚙️  Site settings updated");

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: "Error updating settings",
      error: error.message,
    });
  }
};

// @desc    Upload a recap photo to Cloudinary and append it to the gallery
// @route   POST /api/admin/settings/recap-photo
// @access  Private (Admin only)
exports.uploadRecapPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Stream the in-memory buffer up to Cloudinary.
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "neomed-forum/recap", resource_type: "image" },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(req.file.buffer);
    });

    const settings = await getOrCreateSettings();
    settings.recapPhotos.push({
      url: result.secure_url,
      caption: req.body.caption || "",
      publicId: result.public_id,
    });
    await settings.save();

    console.log(`⚙️  Recap photo uploaded: ${result.public_id}`);

    res.status(201).json({
      success: true,
      message: "Photo uploaded successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error uploading recap photo:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading photo",
      error: error.message,
    });
  }
};

// @desc    Delete a recap photo (from Cloudinary and the gallery)
// @route   DELETE /api/admin/settings/recap-photo
// @access  Private (Admin only)
// @body    { publicId } for Cloudinary-hosted photos, OR { url } to just remove
//          a legacy/relative photo from the list.
exports.deleteRecapPhoto = async (req, res) => {
  try {
    const { publicId, url } = req.body;
    const settings = await getOrCreateSettings();

    // Remove the image from Cloudinary if it lives there.
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("Cloudinary destroy failed (continuing):", e.message);
      }
    }

    settings.recapPhotos = settings.recapPhotos.filter((p) =>
      publicId ? p.publicId !== publicId : p.url !== url
    );
    await settings.save();

    res.status(200).json({
      success: true,
      message: "Photo removed successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error deleting recap photo:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting photo",
      error: error.message,
    });
  }
};
