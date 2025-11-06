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

  // Generate token
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Cart.deleteMany({});
  await Order.deleteMany({});
});

describe('POST /api/orders', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });

  it('should return 400 if cart is empty', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', `token=${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Cart is empty');
  });

  it('should create order successfully', async () => {
    // Create products
    const product1 = new Product({
      name: 'Product 1',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    const product2 = new Product({
      name: 'Product 2',
      price: 200,
      stock: 5,
      category: 'Test',
    });
    await product1.save();
    await product2.save();

    // Add to cart
    const cart = new Cart({
      user: testUser._id,
      items: [
        { product: product1._id, qty: 2 },
        { product: product2._id, qty: 1 },
      ],
    });
    await cart.save();

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', `token=${token}`)
      .send({ paymentMethod: 'card' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Order created');
    expect(response.body.order).toBeDefined();
    expect(response.body.order.user).toBe(testUser._id.toString());
    expect(response.body.order.items).toHaveLength(2);
    expect(response.body.order.items[0].product).toBe(product1._id.toString());
    expect(response.body.order.items[0].qty).toBe(2);
    expect(response.body.order.items[0].priceAt).toBe(100);
    expect(response.body.order.items[1].product).toBe(product2._id.toString());
    expect(response.body.order.items[1].qty).toBe(1);
    expect(response.body.order.items[1].priceAt).toBe(200);
    expect(response.body.order.subtotal).toBe(400); // 2*100 + 1*200
    expect(response.body.order.total).toBeDefined();
    expect(response.body.order.paymentMethod).toBe('card');
  });

  it('should reduce stock', async () => {
    const product = new Product({
      name: 'Test Product',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await product.save();

    const cart = new Cart({
      user: testUser._id,
      items: [{ product: product._id, qty: 3 }],
    });
    await cart.save();

    await request(app)
      .post('/api/orders')
      .set('Cookie', `token=${token}`)
      .send({});

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(7); // 10 - 3
  });

  it('should clear cart after order', async () => {
    const product = new Product({
      name: 'Test Product',
      price: 100,
      stock: 10,
      category: 'Test',
    });
    await product.save();

    const cart = new Cart({
      user: testUser._id,
      items: [{ product: product._id, qty: 1 }],
    });
    await cart.save();

    await request(app)
      .post('/api/orders')
      .set('Cookie', `token=${token}`)
      .send({});

    const updatedCart = await Cart.findOne({ user: testUser._id });
    expect(updatedCart.items).toHaveLength(0);
  });
});
