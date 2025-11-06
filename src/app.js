

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

module.exports = app
