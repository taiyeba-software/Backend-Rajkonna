const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Mock redis service
jest.mock('../src/services/redis.service', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

const orderRoutes = require('../src/routes/order.routes');
const Order = require('../src/models/order.model');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');

let app;
let userToken, adminToken, user, admin, order;

beforeAll(async () => {
  jest.setTimeout(20000);

  // Create test app
  app = express();
  app.use(express.json());

  // Attach cookies from Authorization header
  app.use((req, res, next) => {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.cookies = { token };
    }
    next();
  });

  // Fake auth middleware for tests
  app.use('/api/orders', (req, res, next) => {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (token) {
      req.cookies = req.cookies || {};
      req.cookies.token = token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
        next();
      } catch (error) {
        next();
      }
    } else {
      next();
    }
  });

  app.use('/api/orders', orderRoutes);

  // Create user
  user = await User.create({
    name: "Regular User",
    email: "user@example.com",
    password: "password123",
    role: "user",
  });

  admin = await User.create({
    name: "Admin User",
    email: "admin@example.com",
    password: "password123",
    role: "admin",
  });

  // Tokens
  userToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret');
  adminToken = jwt.sign({ userId: admin._id, role: admin.role }, process.env.JWT_SECRET || 'fallback_secret');

  // Product
  const product = await Product.create({
    name: "Test Product",
    price: 100,
    stock: 10,
    category: 'General'
  });

  // Cart
  await Cart.create({
    user: user._id,
    items: [{ product: product._id, qty: 1 }]
  });

  // Order
  order = await Order.create({
    user: user._id,
    items: [{ product: product._id, qty: 1, priceAt: 100 }],
    subtotal: 100,
    deliveryCharge: 50,
    discountPercent: 10,
    discountAmount: 10,
    total: 140,
    paymentMethod: "COD"
  });
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Cart.deleteMany({});
  await Order.deleteMany({});

  // Recreate product, cart and order for each test (use same user created in beforeAll)
  const product = await Product.create({
    name: "Test Product",
    price: 100,
    stock: 10,
    category: 'General'
  });

  await Cart.create({
    user: user._id,
    items: [{ product: product._id, qty: 1 }]
  });

  order = await Order.create({
    user: user._id,
    items: [{ product: product._id, qty: 1, priceAt: 100 }],
    subtotal: 100,
    deliveryCharge: 50,
    discountPercent: 10,
    discountAmount: 10,
    total: 140,
    paymentMethod: "COD"
  });
});

// rely on global test setup/teardown in `tests/setup.js` for DB lifecycle


// ----------------------
//    DELETE Tests
// ----------------------

describe("DELETE /api/orders/:id", () => {

  test("❌ should return 404 if order not found", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/orders/${fakeId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Order not found");
  });


  test("❌ should not allow user to delete someone else's order", async () => {
    const otherUser = await User.create({
      name: "Another User",
      email: "other@example.com",
      password: "pass1234",
      role: "user",
    });

    const otherOrder = await Order.create({
      user: otherUser._id,
      items: [],
      subtotal: 0,
      deliveryCharge: 0,
      discountPercent: 0,
      discountAmount: 0,
      total: 0,
      paymentMethod: 'cod'
    });

    const res = await request(app)
      .delete(`/api/orders/${otherOrder._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });


  test("✅ admin should delete ANY order", async () => {
    const res = await request(app)
      .delete(`/api/orders/${order._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Order deleted successfully");

    const check = await Order.findById(order._id);
    expect(check).toBeNull();
  });


  test("✅ user should delete their OWN order", async () => {
    const newOrder = await Order.create({
      user: user._id,
      items: [],
      subtotal: 0,
      deliveryCharge: 0,
      discountPercent: 0,
      discountAmount: 0,
      total: 0,
      paymentMethod: 'cod'
    });

    const res = await request(app)
      .delete(`/api/orders/${newOrder._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Order deleted successfully");

    const check = await Order.findById(newOrder._id);
    expect(check).toBeNull();
  });

});
