const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const Product = require('../src/models/product.model');

describe('GET /api/products/:id', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
  });

  it('returns 404 if product not found', async () => {
    const validId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .get(`/api/products/${validId}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('returns 400 for invalid ObjectId', async () => {
    const response = await request(app)
      .get('/api/products/invalid-id');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid product id');
  });

  it('returns product details when found', async () => {
    const sampleProduct = {
      name: 'Test Product',
      description: 'A test product description',
      price: 99.99,
      stock: 50,
      category: 'Test Category',
      images: [
        { url: 'https://example.com/image1.jpg', filename: 'image1.jpg' },
        { url: 'https://example.com/image2.jpg', filename: 'image2.jpg' },
      ],
    };

    const createdProduct = await Product.create(sampleProduct);

    const response = await request(app)
      .get(`/api/products/${createdProduct._id}`);

    expect(response.status).toBe(200);
    expect(response.body.product).toBeDefined();
    expect(response.body.product.name).toBe(sampleProduct.name);
    expect(response.body.product.description).toBe(sampleProduct.description);
    expect(response.body.product.price).toBe(sampleProduct.price);
    expect(response.body.product.stock).toBe(sampleProduct.stock);
    expect(response.body.product.category).toBe(sampleProduct.category);
    expect(response.body.product.images).toHaveLength(2);
    expect(response.body.product.images[0]).toMatchObject({
      url: 'https://example.com/image1.jpg',
      filename: 'image1.jpg',
    });
    expect(response.body.product.images[1]).toMatchObject({
      url: 'https://example.com/image2.jpg',
      filename: 'image2.jpg',
    });
    expect(response.body.product._id).toBe(createdProduct._id.toString());
    expect(response.body.product.createdAt).toBeDefined();
    expect(response.body.product.updatedAt).toBeDefined();
  });
});
