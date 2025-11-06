const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/user.model');

// Note: connection to an in-memory MongoDB and DB cleanup are handled by tests/setup.js
beforeEach(async () => {
  await User.deleteMany({});
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('name', 'John Doe');
    expect(response.body.user).toHaveProperty('email', 'john@example.com');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should return 400 for duplicate email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    };

    // First registration
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Duplicate registration
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'User already exists');
  });

  it('should return 400 for invalid input', async () => {
    const invalidData = {
      name: '',
      email: 'invalid-email',
      password: '123',
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
