const Order = require('../models/order.model');
const orderService = require('../services/order.service');
const User = require('../models/user.model');

async function listOrders(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Determine filter based on user role
    const filter = req.user.role === 'user' ? { user: req.user.userId } : {};

    // Fetch orders with pagination
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('items.product');

    // Count total matching orders
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    // Transform orders to include line totals
    const transformedOrders = orders.map(order => ({
      _id: order._id,
      user: order.user,
      items: order.items.map(item => ({
        product: item.product,
        qty: item.qty,
        priceAt: item.priceAt,
        lineTotal: Math.round(item.priceAt * item.qty * 100) / 100
      })),
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      discountPercent: order.discountPercent,
      discountAmount: order.discountAmount,
      totalPayable: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    return res.status(200).json({
      orders: transformedOrders,
      page,
      limit,
      totalOrders,
      totalPages
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getOrderById(req, res) {
  try {
    const orderId = req.params.id;
    // Populate both items.product and user (selecting only contact fields)
    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('user', 'name email phone address') // <-- populate user contact fields
      ;

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // User role check: if requester is a normal user, ensure they own the order
    if (req.user.role === 'user') {
      // order.user might be ObjectId or populated object; normalize
      const orderUserId = (order.user && order.user._id) ? order.user._id.toString() : order.user.toString();
      if (orderUserId !== req.user.userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    // Transform items to include product info and lineTotal
    const transformedItems = order.items.map(item => ({
      product: item.product,
      qty: item.qty,
      priceAt: item.priceAt,
      lineTotal: Math.round(item.priceAt * item.qty * 100) / 100
    }));

    // Build user contact object (if populated)
    let userContact = null;
    if (order.user) {
      if (typeof order.user === 'object' && order.user._id) {
        userContact = {
          _id: order.user._id,
          name: order.user.name || '',
          email: order.user.email || '',
          phone: order.user.phone || '',
          address: order.user.address || {}
        };
      } else {
        // fallback: only id available
        userContact = { _id: order.user.toString() };
      }
    }

    const response = {
      user: userContact, // <-- include user contact info here
      items: transformedItems,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      discountPercent: order.discountPercent,
      discountAmount: order.discountAmount,
      totalPayable: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createOrder(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const { paymentMethod } = req.body;

    // If shippingAddress missing or empty, fall back to user's saved address and phone
    if (!req.body.shippingAddress || Object.keys(req.body.shippingAddress).length === 0) {
      const user = await User.findById(userId).select('address phone').lean();
      if (user) {
        req.body.shippingAddress = user.address || {};
        req.body.phone = req.body.phone || user.phone || '';
      }
    }

    const order = await orderService.createOrder(userId, paymentMethod);
    return res.status(201).json({ message: 'Order created', order });
  } catch(err) {
    if (err.message === 'Cart is empty') {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function deleteOrderController(req, res) {
  try {
    const orderId = req.params.id;
    const userId = req.user.userId || req.user.id;
    const userRole = req.user.role;

    const result = await orderService.deleteOrder(orderId, userId, userRole);
    return res.status(200).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createOrderController: createOrder,
  getOrderController: getOrderById,
  listOrders,
  deleteOrderController
};
