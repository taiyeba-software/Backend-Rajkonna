const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const createOrderValidator = [
  // Optional: paymentMethod validation
  body('paymentMethod')
    .optional()
    .isString()
    .withMessage('Payment method must be a string')
];

const getOrderValidator = [
  param('id')
    .custom(value => {
      if (!mongoose.isValidObjectId(value)) {
        throw new Error('Invalid order ID');
      }
      return true;
    })
];

const listOrdersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Limit must be a positive integer')
];

module.exports = { createOrderValidator, getOrderValidator, listOrdersValidator };
