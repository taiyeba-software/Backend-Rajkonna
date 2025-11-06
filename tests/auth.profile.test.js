const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/user.model');

let testUser;
let token;

beforeEach(async () => {
  testUser = new User({
    name: 'Profile User',
    email: 'profile@example.com',
    password: 'hashedpassword',
    role: 'user',
  });
  await testUser.save();
  token = jwt.sign({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET || 'fallback_secret');
});

describe('Profile endpoints', () => {
  test('GET /api/auth/profile returns default empty phone/address', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('name', 'Profile User');
    expect(res.body.user).toHaveProperty('email', 'profile@example.com');
    expect(res.body.user).toHaveProperty('phone', '');
    expect(res.body.user).toHaveProperty('address');
    expect(res.body.user.address).toEqual({
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    });
  });

  test('PUT /api/auth/profile updates phone and address', async () => {
    const payload = {
      phone: '1234567890',
      address: {
        line1: '123 Main St',
        line2: 'Apt 4',
        city: 'Townsville',
        state: 'TS',
        postalCode: '12345',
        country: 'Countryland',
      }
    };

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .send(payload)
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('phone', '1234567890');
    expect(res.body.user.address).toEqual(payload.address);

    // verify persisted
    const updated = await User.findById(testUser._id).lean();
    expect(updated.phone).toBe('1234567890');
    expect(updated.address).toEqual(payload.address);
  });
});
