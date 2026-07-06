const mongoose = require("mongoose");

// One row in the "Key Dates" timeline on the home page.
const keyDateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true }, // e.g. "Feb 25, 2026"
    title: { type: String, required: true, trim: true }, // e.g. "Research Forum Day"
    // "complete" = dimmed/done, "current" = highlighted, "upcoming" = future
    status: {
      type: String,
      enum: ["complete", "current", "upcoming"],
      default: "upcoming",
    },
  },
  { _id: false }
);

// One photo in the "Event Recap" gallery. `url` points at Cloudinary.
const recapPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    caption: { type: String, default: "", trim: true },
    // Cloudinary public_id — kept so we can delete the image from Cloudinary too.
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Site-wide, year-specific content for the Research Forum.
 *
 * This is a SINGLETON: there is only ever ONE Settings document, identified by
 * `key: "main"`. The admin dashboard edits it; every public page reads it.
 * To roll the site over to a new year, an admin just edits these values —
 * no code changes or redeploys needed.
 */
const settingsSchema = new mongoose.Schema(
  {
    // Singleton guard — never change this.
    key: { type: String, default: "main", unique: true },

    // ----- Identity -----
    eventName: { type: String, default: "Research Forum", trim: true },
    year: { type: Number, default: new Date().getFullYear() },
    university: {
      type: String,
      default: "Northeast Ohio Medical University",
      trim: true,
    },
    eventDate: { type: String, default: "", trim: true }, // "February 25, 2026"
    eventTime: { type: String, default: "", trim: true }, // "4:00 PM"
    contactEmail: { type: String, default: "sbadat@neomed.edu", trim: true },

    // ----- Submissions -----
    // When false, the submit page shows the "submissions closed" message.
    submissionsOpen: { type: Boolean, default: true },
    submissionDeadlineText: { type: String, default: "", trim: true }, // "January 12, 2026"

    // ----- Home page timeline -----
    keyDates: { type: [keyDateSchema], default: [] },

    // ----- Participant deadlines (shown on the abstract magic-link page) -----
    confirmByText: { type: String, default: "", trim: true }, // "Friday, February 6, 2026 at 11:59 PM"
    confirmDeadlineDisplay: { type: String, default: "", trim: true }, // "Thursday, February 5, 2026"
    presentationDueText: { type: String, default: "", trim: true }, // "Saturday, February 21, 2026 at 11:59 PM"
    reviewPeriodText: { type: String, default: "", trim: true }, // "January 13 – 28, 2026"
    decisionNotificationText: { type: String, default: "", trim: true }, // "January 28, 2026"

    // ----- Event recap gallery -----
    recapPhotos: { type: [recapPhotoSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
