require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// CORS Middleware - UPDATED to allow OPTIONS method
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const allowedOrigins = process.env.FRONTEND_URL?.split(",") || [
        "http://localhost:5173",
      ];

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes("*")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Length", "X-JSON"],
    maxAge: 86400, // 24 hours
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// Basic test route
app.get("/", (req, res) => {
  res.json({
    message: "🎓 NEOMED Research Forum API",
    status: "Server is running",
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/abstracts", require("./routes/abstracts"));
app.use("/api/reviewers", require("./routes/reviewers"));
app.use("/api/admin", require("./routes/admin"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🌐 CORS enabled for: ${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }`
  );
});
