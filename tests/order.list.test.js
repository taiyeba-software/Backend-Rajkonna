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
let otherUser;
let adminUser;
let token;
let otherToken;
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

  // Create test users
  testUser = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await testUser.save();

  otherUser = new User({
    name: 'Other User',
    email: 'other@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await otherUser.save();

  adminUser = new User({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'hashedpassword',
    role: 'admin',
  });
  await adminUser.save();

  // Generate tokens
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
  otherToken = jwt.sign({ userId: otherUser._id, role: otherUser.role }, process.env.JWT_SECRET || 'fallback_secret');
  adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Cart.deleteMany({});
  await Order.deleteMany({});
});

describe('GET /api/orders', () => {
  let orderOne, orderTwo, orderThree;

  beforeEach(async () => {
    // Create products
    const productOne = new Product({
      name: 'Product One',
      price: 10.00,
      stock: 100,
      category: 'Test',
    });
    await productOne.save();

    const productTwo = new Product({
      name: 'Product Two',
      price: 15.00,
      stock: 100,
      category: 'Test',
    });
    await productTwo.save();

    // Create orders for testUser
    orderOne = new Order({
      user: testUser._id,
      items: [{
        product: productOne._id,
        qty: 2,
        priceAt: 10.00
      }],
      subtotal: 20.00,
      deliveryCharge: 5.00,
      discountPercent: 0,
      discountAmount: 0,
      total: 25.00,
      status: 'pending'
    });
    await orderOne.save();

    orderTwo = new Order({
      user: testUser._id,
      items: [{
        product: productTwo._id,
        qty: 1,
        priceAt: 15.00
      }],
      subtotal: 15.00,
      deliveryCharge: 5.00,
      discountPercent: 0,
      discountAmount: 0,
      total: 20.00,
      status: 'shipped'
    });
    await orderTwo.save();

    // Create order for otherUser
    orderThree = new Order({
      user: otherUser._id,
      items: [{
        product: productOne._id,
        qty: 1,
        priceAt: 10.00
      }],
      subtotal: 10.00,
      deliveryCharge: 5.00,
      discountPercent: 0,
      discountAmount: 0,
      total: 15.00,
      status: 'delivered'
    });
    await orderThree.save();
  });

  test('requires authentication', async () => {
    const response = await request(app)
      .get('/api/orders')
      .expect(401);

    expect(response.body.message).toBe('Access token required');
  });

  test('returns user orders with default pagination', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', `token=${token}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(2);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(10);
    expect(response.body.totalOrders).toBe(2);
    expect(response.body.totalPages).toBe(1);

    // Check order structure
    const order = response.body.orders[0];
    expect(order).toHaveProperty('_id');
    expect(order).toHaveProperty('user');
    expect(order).toHaveProperty('items');
    expect(order).toHaveProperty('subtotal');
    expect(order).toHaveProperty('deliveryCharge');
    expect(order).toHaveProperty('discountPercent');
    expect(order).toHaveProperty('discountAmount');
    expect(order).toHaveProperty('totalPayable');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('createdAt');
    expect(order).toHaveProperty('updatedAt');

    // Check items structure
    expect(order.items).toHaveLength(1);
    const item = order.items[0];
    expect(item).toHaveProperty('product');
    expect(item).toHaveProperty('qty');
    expect(item).toHaveProperty('priceAt');
    expect(item).toHaveProperty('lineTotal');
  });

  test('returns user orders with custom pagination', async () => {
    const response = await request(app)
      .get('/api/orders?page=1&limit=1')
      .set('Cookie', `token=${token}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(1);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(1);
    expect(response.body.totalOrders).toBe(2);
    expect(response.body.totalPages).toBe(2);
  });

  test('returns second page correctly', async () => {
    const response = await request(app)
      .get('/api/orders?page=2&limit=1')
      .set('Cookie', `token=${token}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(1);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(1);
    expect(response.body.totalOrders).toBe(2);
    expect(response.body.totalPages).toBe(2);
  });

  test('returns empty array when user has no orders', async () => {
    // Create a new user with no orders
    const newUser = new User({
      name: 'New User',
      email: 'new@example.com',
      password: 'hashedpassword',
      role: 'user'
    });
    await newUser.save();

    const newToken = jwt.sign({ userId: newUser._id, role: newUser.role }, process.env.JWT_SECRET || 'fallback_secret');

    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', `token=${newToken}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(0);
    expect(response.body.totalOrders).toBe(0);
    expect(response.body.totalPages).toBe(0);
  });

  test('admin can see all orders', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', `token=${adminToken}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(3);
    expect(response.body.totalOrders).toBe(3);
  });

  test('orders are sorted by createdAt descending', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', `token=${token}`)
      .expect(200);

    expect(response.body.orders).toHaveLength(2);
    // orderTwo was created after orderOne, so it should be first
    expect(response.body.orders[0]._id.toString()).toBe(orderTwo._id.toString());
    expect(response.body.orders[1]._id.toString()).toBe(orderOne._id.toString());
  });

  test('calculates lineTotal correctly', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', `token=${token}`)
      .expect(200);

    const order = response.body.orders.find(o => o._id.toString() === orderOne._id.toString());
    expect(order.items[0].lineTotal).toBe(20.00); // 2 * 10.00
  });
});
