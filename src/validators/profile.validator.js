const { body } = require('express-validator');

const updateProfileValidator = [
  body('phone')
    .optional()
    .isString()
    .isLength({ min: 7 })
    .withMessage('Phone must be at least 7 characters long'),
  body('address.line1').optional().isString(),
  body('address.line2').optional().isString(),
  body('address.city').optional().isString(),
  body('address.state').optional().isString(),
  body('address.postalCode').optional().isString(),
  body('address.country').optional().isString(),
];

module.exports = { updateProfileValidator };