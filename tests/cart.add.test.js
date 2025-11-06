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

describe('POST /api/cart/items', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/cart/items')
      .send({ productId: 'dummy', qty: 1 });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('creates cart and adds item when user has no cart', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', `token=${token}`)
      .send({ productId: product._id.toString(), qty: 2 });

    expect(response.status).toBe(201);
    expect(response.body.cart.items).toHaveLength(1);
    expect(response.body.cart.items[0].qty).toBe(2);
    expect(response.body.cart.items[0].product._id.toString()).toBe(product._id.toString());
  });

  it('increments qty when item exists and enforces stock limit', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 3,
      category: 'Test',
    });
    await product.save();

    // First add
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', `token=${token}`)
      .send({ productId: product._id.toString(), qty: 1 });

    // Second add - should fail due to stock limit
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', `token=${token}`)
      .send({ productId: product._id.toString(), qty: 3 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Exceeds available stock');
  });

  it('reserve option decrements product.stock when reserve=true', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', `token=${token}`)
      .query({ reserve: 'true' })
      .send({ productId: product._id.toString(), qty: 2 });

    expect(response.status).toBe(201);
    expect(response.body.reserved).toBe(true);

    // Check product stock was decremented
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(3);
  });
});
