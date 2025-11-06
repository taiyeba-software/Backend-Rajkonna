const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return both a primary message (first error) and the full errors array
    // so tests that expect either format continue to work.
    const arr = errors.array();
    return res.status(400).json({ message: arr[0].msg, errors: arr });
  }
  next();
};

module.exports = { handleValidationErrors };
