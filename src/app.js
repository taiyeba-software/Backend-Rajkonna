
/*
const express = require("express");
const cookieParser = require("cookie-parser");


const authRoutes = require("./routes/auth.route");
const productRoutes = require("./routes/product.route");
const productGetRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());


app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products", productGetRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

module.exports = app;
*/

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// ✅ Import routes
const authRoutes = require("./routes/auth.route");
const productRoutes = require("./routes/product.route");
const productGetRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();

// ✅ Global middleware (order matters)
// Configure CORS to allow requests from your frontend (and allow cookies)
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};

app.use(cors(corsOptions));
// Make sure preflight requests are handled
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products", productGetRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

// ✅ Export for server.js and tests
module.exports = app;
