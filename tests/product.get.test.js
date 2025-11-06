const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

const app = require('../src/app');
const Product = require('../src/models/product.model');

describe('GET /api/products', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
  });

  it('returns empty list when no products', async () => {
    const response = await request(app)
      .get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      products: [],
      total: 0,
      page: 1,
      pages: 0,
    });
  });

  it('returns paginated products', async () => {
    // Insert 25 products
    const products = [];
    for (let i = 1; i <= 25; i++) {
      products.push({
        name: `Product ${i}`,
        price: i * 10,
        stock: 10,
        category: 'Test',
      });
    }
    await Product.insertMany(products);

    // Page 1
    const response1 = await request(app)
      .get('/api/products?page=1');

    expect(response1.status).toBe(200);
    expect(response1.body.products).toHaveLength(10);
    expect(response1.body.total).toBe(25);
    expect(response1.body.page).toBe(1);
    expect(response1.body.pages).toBe(3);

    // Page 3
    const response3 = await request(app)
      .get('/api/products?page=3');

    expect(response3.status).toBe(200);
    expect(response3.body.products).toHaveLength(5);
    expect(response3.body.total).toBe(25);
    expect(response3.body.page).toBe(3);
    expect(response3.body.pages).toBe(3);
  });

  it('text search q returns relevant products', async () => {
    const products = [
      { name: 'Rose Perfume', price: 50, stock: 10, category: 'Beauty' },
      { name: 'Red Rose Bouquet', price: 30, stock: 5, category: 'Flowers' },
      { name: 'Shampoo', price: 20, stock: 15, category: 'Beauty' },
      { name: 'Tulip Flowers', price: 25, stock: 8, category: 'Flowers' },
    ];
    await Product.insertMany(products);

    const response = await request(app)
      .get('/api/products?q=rose');

    expect(response.status).toBe(200);
    expect(response.body.products.length).toBeGreaterThan(0);
    // Check that all returned products contain 'rose' in name
    response.body.products.forEach(product => {
      expect(product.name.toLowerCase()).toContain('rose');
    });
  });

  it('filters by category and price range', async () => {
    const products = [
      { name: 'Laptop', price: 1000, stock: 5, category: 'Electronics' },
      { name: 'Phone', price: 500, stock: 10, category: 'Electronics' },
      { name: 'Book', price: 20, stock: 20, category: 'Books' },
      { name: 'Tablet', price: 300, stock: 8, category: 'Electronics' },
    ];
    await Product.insertMany(products);

    const response = await request(app)
      .get('/api/products?category=Electronics&price_min=400&price_max=600');

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].name).toBe('Phone');
    expect(response.body.products[0].price).toBe(500);
  });

  it('sorting works', async () => {
    const products = [
      { name: 'Expensive Item', price: 100, stock: 5, category: 'Test' },
      { name: 'Cheap Item', price: 10, stock: 10, category: 'Test' },
      { name: 'Medium Item', price: 50, stock: 8, category: 'Test' },
    ];
    await Product.insertMany(products);

    // Sort by price ascending
    const responseAsc = await request(app)
      .get('/api/products?sort=price:asc');

    expect(responseAsc.status).toBe(200);
    expect(responseAsc.body.products[0].price).toBe(10);
    expect(responseAsc.body.products[1].price).toBe(50);
    expect(responseAsc.body.products[2].price).toBe(100);

    // Sort by price descending
    const responseDesc = await request(app)
      .get('/api/products?sort=price:desc');

    expect(responseDesc.status).toBe(200);
    expect(responseDesc.body.products[0].price).toBe(100);
    expect(responseDesc.body.products[1].price).toBe(50);
    expect(responseDesc.body.products[2].price).toBe(10);
  });
});
