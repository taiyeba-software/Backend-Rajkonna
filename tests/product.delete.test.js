const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Product = require('../src/models/product.model');
const Order = require('../src/models/order.model');
const User = require('../src/models/user.model');

let regularUser;
let adminUser;
let sellerUser;
let regularToken;
let adminToken;
let sellerToken;

beforeAll(async () => {
  // Create test users
  regularUser = new User({
    name: 'Regular User',
    email: 'regular@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await regularUser.save();

  adminUser = new User({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'hashedpassword',
    role: 'admin',
  });
  await adminUser.save();

  sellerUser = new User({
    name: 'Seller User',
    email: 'seller@example.com',
    password: 'hashedpassword',
    role: 'seller',
  });
  await sellerUser.save();

  // Generate tokens
  regularToken = jwt.sign({ userId: regularUser._id, role: regularUser.role }, process.env.JWT_SECRET || 'fallback_secret');
  adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET || 'fallback_secret');
  sellerToken = jwt.sign({ userId: sellerUser._id, role: sellerUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Order.deleteMany({});
});

describe('DELETE /api/products/:id', () => {
  it('returns 403 if user role is not admin/seller', async () => {
    // Insert a sample product
    const product = new Product({
      name: 'Test Product',
      price: 29.99,
      stock: 10,
      category: 'Electronics',
    });
    await product.save();

    // Send DELETE with regular user token
    const response = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Cookie', `token=${regularToken}`)
      .expect(403);

    expect(response.body).toHaveProperty('message', 'Unauthorized');
  });

  it('returns 400 for invalid ObjectId', async () => {
    const response = await request(app)
      .delete('/api/products/invalid-id')
      .set('Cookie', `token=${adminToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Invalid product id');
  });

  it('returns 404 if product not found', async () => {
    // Generate a valid ObjectId not in DB
    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/api/products/${fakeId}`)
      .set('Cookie', `token=${adminToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Product not found');
  });

  it('soft deletes (archives) when orders exist', async () => {
    // Create a product P
    const product = new Product({
      name: 'Product P',
      price: 19.99,
      stock: 5,
      category: 'Books',
    });
    await product.save();

    // Create an order referencing product P
    const order = new Order({
      user: regularUser._id,
      items: [{
        product: product._id,
        qty: 1,
        priceAt: product.price,
      }],
      subtotal: product.price,
      deliveryCharge: 0,
      discountPercent: 0,
      discountAmount: 0,
      total: product.price,
    });
    await order.save();

    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Send DELETE with admin token
    const response = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Cookie', `token=${adminToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('archived');
    expect(response.body).toHaveProperty('product');
    expect(response.body.product.status).toBe('archived');

    // Verify in DB
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.status).toBe('archived');

    // Verify console log
    expect(consoleSpy).toHaveBeenCalledWith(`Product ${product.name} archived by admin`);

    consoleSpy.mockRestore();
  });

  it('hard deletes when no orders exist', async () => {
    // Create a product Q
    const product = new Product({
      name: 'Product Q',
      price: 9.99,
      stock: 3,
      category: 'Toys',
    });
    await product.save();

    // Ensure no orders reference Q (already cleaned in beforeEach)

    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Send DELETE with seller token
    const response = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Cookie', `token=${sellerToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Product deleted');
    expect(response.body).toHaveProperty('product');

    // Verify deleted from DB
    const deletedProduct = await Product.findById(product._id);
    expect(deletedProduct).toBeNull();

    // Verify console log
    expect(consoleSpy).toHaveBeenCalledWith(`Product ${product.name} deleted by seller`);

    consoleSpy.mockRestore();
  });
});
