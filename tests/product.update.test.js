const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const Product = require('../src/models/product.model');

jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticateToken: jest.fn(),
}));

const { authenticateToken } = require('../src/middlewares/auth.middleware');

describe('PATCH /api/products/:id', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
  });

  it('returns 403 if user role is not admin/seller', async () => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { role: 'user' };
      next();
    });

    const sampleProduct = {
      name: 'Test Product',
      price: 99.99,
      stock: 50,
      category: 'Test Category',
    };

    const createdProduct = await Product.create(sampleProduct);

    const response = await request(app)
      .patch(`/api/products/${createdProduct._id}`)
      .send({ name: 'Updated Name' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Access denied. Only admin or seller can update products.');
  });

  it('returns 400 for invalid ObjectId', async () => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { role: 'admin' };
      next();
    });

    const response = await request(app)
      .patch('/api/products/invalid-id')
      .send({ name: 'Updated Name' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid product id');
  });

  it('returns 404 if product not found', async () => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { role: 'admin' };
      next();
    });

    const validId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .patch(`/api/products/${validId}`)
      .send({ name: 'Updated Name' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('successfully updates product fields', async () => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { role: 'admin' };
      next();
    });

    const sampleProduct = {
      name: 'Original Product',
      description: 'Original description',
      price: 99.99,
      stock: 50,
      category: 'Original Category',
      images: [{ url: 'https://example.com/image1.jpg', filename: 'image1.jpg' }],
    };

    const createdProduct = await Product.create(sampleProduct);

    const updates = {
      name: 'Updated Product',
      description: 'Updated description',
      price: 149.99,
      stock: 75,
      category: 'Updated Category',
      images: [{ url: 'https://example.com/updated.jpg', filename: 'updated.jpg' }],
    };

    const response = await request(app)
      .patch(`/api/products/${createdProduct._id}`)
      .send(updates);

    expect(response.status).toBe(200);
    expect(response.body.product).toBeDefined();
    expect(response.body.product.name).toBe(updates.name);
    expect(response.body.product.description).toBe(updates.description);
    expect(response.body.product.price).toBe(updates.price);
    expect(response.body.product.stock).toBe(updates.stock);
    expect(response.body.product.category).toBe(updates.category);
    expect(response.body.product.images.map(img => ({ url: img.url, filename: img.filename }))).toEqual(updates.images);

    // Verify in database
    const updatedProductInDb = await Product.findById(createdProduct._id);
    expect(updatedProductInDb.name).toBe(updates.name);
    expect(updatedProductInDb.description).toBe(updates.description);
    expect(updatedProductInDb.price).toBe(updates.price);
    expect(updatedProductInDb.stock).toBe(updates.stock);
    expect(updatedProductInDb.category).toBe(updates.category);
    expect(updatedProductInDb.images.map(img => ({ url: img.url, filename: img.filename }))).toEqual(updates.images);
  });
});
