const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock redis service
jest.mock('../src/services/redis.service', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

// Mock Product and Cart models
jest.mock('../src/models/product.model');
jest.mock('../src/models/cart.model');

const cartRoutes = require('../src/routes/cart.routes');
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
  testUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'user',
  };

  // Generate token
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/cart/items/:productId', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .patch('/api/cart/items/507f1f77bcf86cd799439011')
      .send({ quantity: 2 });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('returns 400 for invalid productId', async () => {
    const response = await request(app)
      .patch('/api/cart/items/invalid-id')
      .set('Cookie', `token=${token}`)
      .send({ quantity: 2 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('returns 400 for invalid quantity', async () => {
    const response = await request(app)
      .patch('/api/cart/items/507f1f77bcf86cd799439011')
      .set('Cookie', `token=${token}`)
      .send({ quantity: 'not-a-number' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('updates quantity and returns updated cart', async () => {
    const mockProduct = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Product',
      price: 100,
    };

    const mockCart = {
      user: testUser._id,
      items: [
        {
          product: '507f1f77bcf86cd799439011',
          qty: 1,
          _id: 'item1',
        },
      ],
      save: jest.fn().mockResolvedValue(),
    };

    Cart.findOne.mockResolvedValue(mockCart);
    Product.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProduct),
    });

    const response = await request(app)
      .patch('/api/cart/items/507f1f77bcf86cd799439011')
      .set('Cookie', `token=${token}`)
      .send({ quantity: 3 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].qty).toBe(3);
    expect(response.body.items[0].lineTotal).toBe(300); // 100 * 3
    expect(response.body.subtotal).toBe(300);
  });

  it('removes item when quantity is 0', async () => {
    const mockProduct = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Product',
      price: 100,
    };

    const mockCart = {
      user: testUser._id,
      items: [
        {
          product: '507f1f77bcf86cd799439011',
          qty: 2,
          _id: 'item1',
        },
      ],
      save: jest.fn().mockResolvedValue(),
    };

    Cart.findOne.mockResolvedValue(mockCart);
    Product.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProduct),
    });

    const response = await request(app)
      .patch('/api/cart/items/507f1f77bcf86cd799439011')
      .set('Cookie', `token=${token}`)
      .send({ quantity: 0 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
    expect(response.body.subtotal).toBe(0);
  });
});
