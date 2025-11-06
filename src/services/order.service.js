const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

const getOrderById = async (orderId, userId, userRole) => {
  const order = await Order.findById(orderId).populate('items.product');
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  // Check permissions
  if (userRole === 'user' && order.user.toString() !== userId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  return order;
};

const createOrder = async (userId, paymentMethod = null, reserveInventory = true) => {
  // Fetch user's cart
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const warnings = [];
  const items = [];
  let subtotal = 0;

  // Fetch latest product prices and compute line totals
  for (const item of cart.items) {
    if (item.product) {
      const prod = await Product.findById(item.product._id).lean();
      if (prod) {
        const price = Number(prod.price);
        const qty = Number(item.qty);
        const lineTotal = Math.round(price * qty * 100) / 100;
        items.push({
          product: prod._id,
          qty,
          priceAt: price
        });
        subtotal += lineTotal;

        // Optionally reserve inventory
        if (reserveInventory) {
          if (prod.stock < qty) {
            throw new Error(`Insufficient stock for product ${prod.name}`);
          }
          prod.stock -= qty;
          await Product.findByIdAndUpdate(prod._id, { stock: prod.stock });
        }
      } else {
        warnings.push(`Product ${item.product._id} not found, skipped`);
      }
    } else {
      warnings.push('Invalid product reference, skipped');
    }
  }

  // Delivery charge calculation
  const DELIVERY_CHARGE = process.env.DELIVERY_CHARGE ? Number(process.env.DELIVERY_CHARGE) : 50;
  const FREE_DELIVERY_THRESHOLD = process.env.FREE_DELIVERY_THRESHOLD ? Number(process.env.FREE_DELIVERY_THRESHOLD) : 1000;
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;

  // Discount calculation (random 5-15 as in getCart)
  const discountPercent = Math.floor(Math.random() * 11) + 5;
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

  // Total payable
  let totalPayable = subtotal + deliveryCharge - discountAmount;
  totalPayable = Math.max(0, totalPayable);
  totalPayable = Math.round(totalPayable * 100) / 100;

  // Create new Order document
  const order = new Order({
    user: userId,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryCharge,
    discountPercent,
    discountAmount,
    total: totalPayable,
    paymentMethod
  });

  await order.save();

  // Clear cart
  cart.items = [];
  await cart.save();

  return order;
};

module.exports = { createOrder, getOrderById };
