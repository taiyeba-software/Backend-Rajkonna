const express = require('express');
const { getProducts, getProductById, updateProduct, deleteProduct } = require('../controllers/product.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.patch('/:id', authenticateToken, updateProduct);
router.delete('/:id', authenticateToken, deleteProduct);

module.exports = router;
