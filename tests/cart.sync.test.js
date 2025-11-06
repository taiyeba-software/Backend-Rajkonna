const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock redis service
jest.mock('../src/services/redis.service', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

const cartRoutes = require('../src/routes/cart.routes');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Cart = require('../src/models/cart.model');

let app;
let testUser;
let token;

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
  app.use('/api/cart', (req, res, next) => {
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

  app.use('/api/cart', cartRoutes);

  // Create test user
  testUser = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await testUser.save();

  // Generate token
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Cart.deleteMany({});
});

describe('POST /api/cart/sync', () => {
  it('merges localStorage cart into user cart', async () => {
    const productA = new Product({
      name: 'Product A',
      description: 'Test A',
      price: 50,
      stock: 10,
      category: 'Test',
    });
    await productA.save();

    const productB = new Product({
      name: 'Product B',
      description: 'Test B',
      price: 30,
      stock: 5,
      category: 'Test',
    });
    await productB.save();

    const guestItems = [
      { productId: productA._id.toString(), qty: 2 },
      { productId: productB._id.toString(), qty: 1 },
    ];

    const response = await request(app)
      .post('/api/cart/sync')
      .set('Cookie', `token=${token}`)
      .send({ items: guestItems });

    expect(response.status).toBe(200);
    expect(response.body.merged).toBe(true);
    expect(response.body.cart.items).toHaveLength(2);
    expect(response.body.cart.items.find(item => item.product._id.toString() === productA._id.toString()).qty).toBe(2);
    expect(response.body.cart.items.find(item => item.product._id.toString() === productB._id.toString()).qty).toBe(1);
  });

  it('creates cart if none exists and syncs items correctly', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    const guestItems = [
      { productId: product._id.toString(), qty: 2 },
    ];

    const response = await request(app)
      .post('/api/cart/sync')
      .set('Cookie', `token=${token}`)
      .send({ items: guestItems });

    expect(response.status).toBe(200);
    expect(response.body.merged).toBe(true);
    expect(response.body.cart.items).toHaveLength(1);
    expect(response.body.cart.items[0].qty).toBe(2);
  });

  it('caps quantity at available stock and includes warnings', async () => {
    const product = new Product({
      name: 'Limited Stock Product',
      description: 'Test',
      price: 100,
      stock: 3,
      category: 'Test',
    });
    await product.save();

    const guestItems = [
      { productId: product._id.toString(), qty: 5 }, // Exceeds stock
    ];

    const response = await request(app)
      .post('/api/cart/sync')
      .set('Cookie', `token=${token}`)
      .send({ items: guestItems });

    expect(response.status).toBe(200);
    expect(response.body.warnings).toHaveLength(1);
    expect(response.body.warnings[0]).toContain('capped at 3');
    expect(response.body.cart.items[0].qty).toBe(3);
  });
});
