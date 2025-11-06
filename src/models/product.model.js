const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  images: [{
    url: String,
    filename: String,
  }],
}, {
  timestamps: true,
});

// Create compound text index for search
productSchema.index({ name: "text", description: "text", category: "text" });

module.exports = mongoose.model('Product', productSchema);
