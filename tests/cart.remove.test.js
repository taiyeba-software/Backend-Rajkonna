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

describe('DELETE /api/cart/items/:productId', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .delete('/api/cart/items/dummy')
      .send();

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('should remove item and return updated cart', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    // Create cart with item
    const cart = new Cart({
      user: testUser._id,
      items: [{ product: product._id, qty: 2 }],
    });
    await cart.save();

    const response = await request(app)
      .delete(`/api/cart/items/${product._id.toString()}`)
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
    expect(response.body.subtotal).toBe(0);
    expect(response.body.deliveryCharge).toBe(50);
    expect(response.body.discountPercent).toBeGreaterThanOrEqual(5);
    expect(response.body.discountAmount).toBe(0);
    expect(response.body.totalPayable).toBe(50);

    // Verify item removed from DB
    const updatedCart = await Cart.findOne({ user: testUser._id });
    expect(updatedCart.items).toHaveLength(0);
  });

  it('should return 404 if item not found in cart', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    // Create cart without the product
    const cart = new Cart({
      user: testUser._id,
      items: [],
    });
    await cart.save();

    const response = await request(app)
      .delete(`/api/cart/items/${product._id.toString()}`)
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found in cart');
  });

  it('should return 404 if cart not found', async () => {
    const product = new Product({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      stock: 5,
      category: 'Test',
    });
    await product.save();

    const response = await request(app)
      .delete(`/api/cart/items/${product._id.toString()}`)
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Cart not found');
  });

  it('should return 400 for invalid productId', async () => {
    const response = await request(app)
      .delete('/api/cart/items/invalid-id')
      .set('Cookie', `token=${token}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid product ID');
  });
});
