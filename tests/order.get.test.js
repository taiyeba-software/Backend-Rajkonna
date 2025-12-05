const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock redis
jest.mock("../src/services/redis.service", () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

const orderRoutes = require("../src/routes/order.routes");
const User = require("../src/models/user.model");
const Product = require("../src/models/product.model");
const Order = require("../src/models/order.model");

let app;
let testUser;
let adminUser;
let token;
let adminToken;

beforeAll(async () => {
  app = express();
  app.use(express.json());

  // Attach cookies
  app.use((req, res, next) => {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      req.cookies = { token };
    }
    next();
  });

  // Fake auth middleware for tests
  app.use("/api/orders", (req, res, next) => {
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

  app.use("/api/orders", orderRoutes);

  // Create normal user
  testUser = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "hashedpassword",
    phone: "01700000000",
    address: {
      line1: "House 10",
      city: "Dhaka",
      country: "Bangladesh",
    },
  });

  // Create admin user
  adminUser = await User.create({
    name: "Admin",
    email: "admin@example.com",
    password: "hashedpassword",
    role: "admin",
  });

  token = jwt.sign(
    { userId: testUser._id, role: "user" },
    process.env.JWT_SECRET || "fallback_secret"
  );

  adminToken = jwt.sign(
    { userId: adminUser._id, role: "admin" },
    process.env.JWT_SECRET || "fallback_secret"
  );
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Order.deleteMany({});

  // Recreate users since setup.js deletes them
  testUser = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "hashedpassword",
    phone: "01700000000",
    address: {
      line1: "House 10",
      city: "Dhaka",
      country: "Bangladesh",
    },
  });

  adminUser = await User.create({
    name: "Admin",
    email: "admin@example.com",
    password: "hashedpassword",
    role: "admin",
  });

  token = jwt.sign(
    { userId: testUser._id, role: "user" },
    process.env.JWT_SECRET || "fallback_secret"
  );

  adminToken = jwt.sign(
    { userId: adminUser._id, role: "admin" },
    process.env.JWT_SECRET || "fallback_secret"
  );
});

describe("GET /api/orders/:id INCLUDING USER INFO", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/orders/123");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token required");
  });

  it("returns user info inside the order", async () => {
    const product = await Product.create({
      name: "Cream",
      price: 100,
      stock: 5,
      category: "Test",
    });

    const order = await Order.create({
      user: testUser._id,
      items: [
        {
          product: product._id,
          qty: 2,
          priceAt: 100,
        },
      ],
      subtotal: 200,
      total: 200,
      deliveryCharge: 0,
      discountPercent: 0,
      discountAmount: 0,
      paymentMethod: "cod",
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set("Cookie", `token=${token}`)
      .send();

    expect(res.status).toBe(200);

    // --- Expect user info ---
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.phone).toBe("01700000000");
    expect(res.body.user.address.city).toBe("Dhaka");

    // --- order fields ---
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qty).toBe(2);
    expect(res.body.subtotal).toBe(200);
    expect(res.body.totalPayable).toBe(200);
  });

  it("admin can also view the order with user info", async () => {
    const product = await Product.create({
      name: "Lotion",
      price: 150,
      stock: 10,
      category: "Test",
    });

    const order = await Order.create({
      user: testUser._id,
      items: [
        {
          product: product._id,
          qty: 1,
          priceAt: 150,
        },
      ],
      subtotal: 150,
      total: 150,
      discountPercent: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      paymentMethod: "card",
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set("Cookie", `token=${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.items.length).toBe(1);
  });
});
