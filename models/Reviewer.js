const mongoose = require('mongoose');

const reviewerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  
  // Profile information
  department: String,
  specialization: String,
  
  // Statistics
  totalReviewsCompleted: {
    type: Number,
    default: 0
  },
  
  // Assigned abstracts (for tracking)
  assignedAbstracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Abstract'
  }]
  
}, {
  timestamps: true
});

module.exports = mongoose.model('Reviewer', reviewerSchema);
