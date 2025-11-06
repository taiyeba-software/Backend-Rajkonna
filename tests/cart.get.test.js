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

describe('GET /api/cart', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .get('/api/cart');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('returns empty cart if none exists', async () => {
    const response = await request(app)
      .get('/api/cart')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      subtotal: 0,
      deliveryCharge: 0,
      discountPercent: 0,
      discountAmount: 0,
      totalPayable: 0
    });
  });

  it('returns cart with recomputed prices and totals', async () => {
    const productA = new Product({
      name: 'Product A',
      description: 'Test A',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await productA.save();

    const productB = new Product({
      name: 'Product B',
      description: 'Test B',
      price: 200,
      stock: 5,
      category: 'Test',
    });
    await productB.save();

    const cart = new Cart({
      user: testUser._id,
      items: [
        { product: productA._id, qty: 2 },
        { product: productB._id, qty: 1 }
      ]
    });
    await cart.save();

    const response = await request(app)
      .get('/api/cart')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);

    // Check items
    const itemA = response.body.items.find(item => item.product._id === productA._id.toString());
    const itemB = response.body.items.find(item => item.product._id === productB._id.toString());
    expect(itemA.product.name).toBe('Product A');
    expect(itemA.product.price).toBe(100);
    expect(itemA.qty).toBe(2);
    expect(itemA.lineTotal).toBe(200); // 100 * 2

    expect(itemB.product.name).toBe('Product B');
    expect(itemB.product.price).toBe(200);
    expect(itemB.qty).toBe(1);
    expect(itemB.lineTotal).toBe(200); // 200 * 1

    // Subtotal: 200 + 200 = 400
    expect(response.body.subtotal).toBe(400);

    // Delivery charge: 400 < 1000, so 50
    expect(response.body.deliveryCharge).toBe(50);

    // Discount: random 5-15
    expect(response.body.discountPercent).toBeGreaterThanOrEqual(5);
    expect(response.body.discountPercent).toBeLessThanOrEqual(15);
    const expectedDiscountAmount = Math.round(400 * (response.body.discountPercent / 100) * 100) / 100;
    expect(response.body.discountAmount).toBe(expectedDiscountAmount);

    // Total payable: 400 + 50 - discountAmount
    const expectedTotalPayable = Math.max(0, 400 + 50 - expectedDiscountAmount);
    expect(response.body.totalPayable).toBe(expectedTotalPayable);
  });

  it('discount override via query param (deterministic)', async () => {
    const productA = new Product({
      name: 'Product A',
      description: 'Test A',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await productA.save();

    const productB = new Product({
      name: 'Product B',
      description: 'Test B',
      price: 200,
      stock: 5,
      category: 'Test',
    });
    await productB.save();

    const cart = new Cart({
      user: testUser._id,
      items: [
        { product: productA._id, qty: 2 },
        { product: productB._id, qty: 1 }
      ]
    });
    await cart.save();

    const response = await request(app)
      .get('/api/cart?discount=10')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.discountPercent).toBe(10);
    const expectedDiscountAmount = Math.round(400 * (10 / 100) * 100) / 100;
    expect(response.body.discountAmount).toBe(expectedDiscountAmount);
    const expectedTotalPayable = Math.max(0, 400 + 50 - expectedDiscountAmount);
    expect(response.body.totalPayable).toBe(expectedTotalPayable);
  });

  it('delivery charge free threshold behavior', async () => {
    const productA = new Product({
      name: 'Product A',
      description: 'Test A',
      price: 500,
      stock: 10,
      category: 'Test',
    });
    await productA.save();

    const productB = new Product({
      name: 'Product B',
      description: 'Test B',
      price: 600,
      stock: 5,
      category: 'Test',
    });
    await productB.save();

    const cart = new Cart({
      user: testUser._id,
      items: [
        { product: productA._id, qty: 1 },
        { product: productB._id, qty: 1 }
      ]
    });
    await cart.save();

    const response = await request(app)
      .get('/api/cart')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    // Subtotal: 500 + 600 = 1100 >= 1000, so deliveryCharge = 0
    expect(response.body.subtotal).toBe(1100);
    expect(response.body.deliveryCharge).toBe(0);
  });
});
