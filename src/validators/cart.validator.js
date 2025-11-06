const { body, param } = require('express-validator');

const addItemValidator = [
  body('productId')
    .isMongoId()
    .withMessage('Invalid product id'),
  body('qty')
    .isInt({ min: 1 })
    .withMessage('Quantity must be >= 1'),
];

const syncCartValidator = [
  body('items')
    .isArray()
    .withMessage('Items must be an array'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('Invalid product id in items'),
  body('items.*.qty')
    .isInt({ min: 1 })
    .withMessage('Quantity must be >= 1 in items'),
];

const updateCartItemValidator = [
  param('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt()
    .withMessage('Quantity must be an integer'),
];

const removeCartItemValidator = [
  param('productId')
    .isMongoId()
    .withMessage('Invalid product ID')
];

module.exports = {
  addItemValidator,
  syncCartValidator,
  updateCartItemValidator,
  removeCartItemValidator,
};
