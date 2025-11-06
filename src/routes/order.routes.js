const router = require('express').Router();
const { createOrderValidator, getOrderValidator, listOrdersValidator } = require('../validators/order.validator');
const { createOrder, getOrderById, listOrders } = require('../controllers/order.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { handleValidationErrors } = require('../validators/validate');

router.get('/', authenticateToken, listOrdersValidator, handleValidationErrors, listOrders);
router.get('/:id', authenticateToken, getOrderValidator, handleValidationErrors, getOrderById);
router.post('/', authenticateToken, createOrderValidator, handleValidationErrors, createOrder);

module.exports = router;
