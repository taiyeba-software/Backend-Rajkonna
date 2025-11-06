const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  qty: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
}, {
  timestamps: true,
});

// Index for efficient queries
cartSchema.index({ user: 1 });

// Virtual for totalPrice
cartSchema.virtual('totalPrice').get(function() {
  return this.items.reduce((total, item) => {
    // Note: This assumes product price is populated
    // In practice, you might need to populate products first
    return total + (item.product?.price || 0) * item.qty;
  }, 0);
});

// Ensure virtual fields are serialized
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);
