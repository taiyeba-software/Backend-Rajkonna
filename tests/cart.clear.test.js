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

describe('DELETE /api/cart', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .delete('/api/cart');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('returns 404 if cart not found', async () => {
    const response = await request(app)
      .delete('/api/cart')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Cart not found');
  });

  it('clears cart and returns empty cart with totals', async () => {
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
      .delete('/api/cart')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.cart.items).toEqual([]);
    expect(response.body.subtotal).toBe(0);
    expect(response.body.deliveryCharge).toBe(50);
    expect(response.body.discountPercent).toBeGreaterThanOrEqual(5);
    expect(response.body.discountPercent).toBeLessThanOrEqual(15);
    expect(response.body.discountAmount).toBe(0);
    expect(response.body.totalPayable).toBe(0);

    // Verify cart is cleared in DB
    const updatedCart = await Cart.findOne({ user: testUser._id });
    expect(updatedCart.items).toEqual([]);
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

    const cart = new Cart({
      user: testUser._id,
      items: [
        { product: productA._id, qty: 1 }
      ]
    });
    await cart.save();

    const response = await request(app)
      .delete('/api/cart?discount=10')
      .set('Cookie', `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.discountPercent).toBe(10);
    expect(response.body.discountAmount).toBe(0);
    expect(response.body.totalPayable).toBe(0);
  });
});
