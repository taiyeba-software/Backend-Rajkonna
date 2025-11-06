const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock redis service
jest.mock('../src/services/redis.service', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

const orderRoutes = require('../src/routes/order.routes');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');
const Order = require('../src/models/order.model');

let app;
let testUser;
let adminUser;
let token;
let adminToken;

beforeAll(async () => {
  // Create test app
  app = express();
  app.use(express.json());

  // Set cookies for authentication
  app.use((req, res, next) => {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.cookies = { token };
    }
    next();
  });

  // Mock authenticateToken middleware
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

  // Create test user
  testUser = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await testUser.save();

  // Create admin user
  adminUser = new User({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'hashedpassword',
    role: 'admin',
  });
  await adminUser.save();

  // Generate tokens
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
  adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Cart.deleteMany({});
  await Order.deleteMany({});
});

describe('GET /api/orders/:id', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .get('/api/orders/507f1f77bcf86cd799439011') // dummy ObjectId
      .send();

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('returns 400 for invalid orderId', async () => {
    const response = await request(app)
      .get('/api/orders/invalid-id')
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid order ID');
  });

  it('returns 404 if order not found', async () => {
    const response = await request(app)
      .get('/api/orders/507f1f77bcf86cd799439011') // non-existent ObjectId
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Order not found');
  });

  it('returns 403 if user accesses another user\'s order', async () => {
    // Create another user
    const otherUser = new User({
      name: 'Other User',
      email: 'other@example.com',
      password: 'hashedpassword',
      role: 'user',
    });
    await otherUser.save();

    // Create product
    const product = new Product({
      name: 'Test Product',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await product.save();

    // Create order for other user
    const order = new Order({
      user: otherUser._id,
      items: [{ product: product._id, qty: 1, priceAt: 100 }],
      subtotal: 100,
      deliveryCharge: 0,
      discountPercent: 5,
      discountAmount: 5,
      total: 95,
    });
    await order.save();

    // Try to access as testUser
    const response = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Forbidden');
  });

  it('successfully returns order for user', async () => {
    // Create product
    const product = new Product({
      name: 'Test Product',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await product.save();

    // Create order for testUser
    const order = new Order({
      user: testUser._id,
      items: [{ product: product._id, qty: 1, priceAt: 100 }],
      subtotal: 100,
      deliveryCharge: 0,
      discountPercent: 5,
      discountAmount: 5,
      total: 95,
      paymentMethod: 'card',
    });
    await order.save();

    const response = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].product._id).toBe(product._id.toString());
    expect(response.body.items[0].qty).toBe(1);
    expect(response.body.items[0].priceAt).toBe(100);
    expect(response.body.items[0].lineTotal).toBe(100);
    expect(response.body.subtotal).toBe(100);
    expect(response.body.deliveryCharge).toBe(0);
    expect(response.body.discountPercent).toBe(5);
    expect(response.body.discountAmount).toBe(5);
    expect(response.body.totalPayable).toBe(95);
    expect(response.body.paymentMethod).toBe('card');
  });

  it('successfully returns order for admin/seller', async () => {
    // Create product
    const product = new Product({
      name: 'Test Product',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await product.save();

    // Create order for testUser
    const order = new Order({
      user: testUser._id,
      items: [{ product: product._id, qty: 1, priceAt: 100 }],
      subtotal: 100,
      deliveryCharge: 0,
      discountPercent: 5,
      discountAmount: 5,
      total: 95,
      paymentMethod: 'card',
    });
    await order.save();

    // Access as admin
    const response = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', `token=${adminToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].product._id).toBe(product._id.toString());
    expect(response.body.subtotal).toBe(100);
    expect(response.body.totalPayable).toBe(95);
  });
});
