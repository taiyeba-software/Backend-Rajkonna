const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/user.model');

// Note: connection to an in-memory MongoDB is handled by tests/setup.js

beforeEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/auth/login', () => {
  it('should login successfully and return user info with token in cookie', async () => {
    // Create a test user
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123', // Will be hashed by pre-save hook
    });
    await user.save();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('_id');
    expect(response.body.user).toHaveProperty('name', 'Test User');
    expect(response.body.user).toHaveProperty('email', 'test@example.com');
    expect(response.body.user).not.toHaveProperty('password');

    // Check if token cookie is set
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(cookie => cookie.startsWith('token='))).toBe(true);

    // Verify token
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    const token = tokenCookie.split(';')[0].split('=')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    expect(decoded).toHaveProperty('userId', user._id.toString());
    expect(decoded).toHaveProperty('email', 'test@example.com');
  });

  it('should return 400 for invalid credentials (wrong email)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Invalid credentials');
  });

  it('should return 400 for invalid credentials (wrong password)', async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
    });
    await user.save();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Invalid credentials');
  });

  it('should return 400 for invalid input (missing email)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  it('should return 400 for invalid input (invalid email)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  it('should return 400 for invalid input (missing password)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
