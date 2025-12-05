const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middlewares/auth.middleware");
const { getOrderController, createOrderController, deleteOrderController, listOrders } = require("../controllers/order.controller");

const {
  createOrderValidator,
  getOrderValidator
} = require("../validators/order.validator");

// CREATE ORDER
router.post("/", authenticateToken, createOrderValidator, createOrderController);

// LIST ORDERS
router.get("/", authenticateToken, listOrders);

// GET ORDER
router.get("/:id", authenticateToken, getOrderValidator, getOrderController);

// DELETE ORDER  ← NEW
router.delete("/:id", authenticateToken, getOrderValidator, deleteOrderController);

module.exports = router;
