const jwt = require("jsonwebtoken");

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route - no token provided",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Add user info to request
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized - invalid token",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in authentication",
      error: error.message,
    });
  }
};

// Check if user is reviewer
exports.isReviewer = (req, res, next) => {
  if (req.user && req.user.role === "reviewer") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied - reviewer only",
    });
  }
};

// Check if user is admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied - admin only",
    });
  }
};
