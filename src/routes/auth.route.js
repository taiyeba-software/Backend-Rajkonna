const express = require('express');
const { register, login, logout } = require('../controllers/auth.controller');
const { getProfile, updateProfile } = require('../controllers/profile.controller');
const { updateProfileValidator } = require('../validators/profile.validator');
const { registerValidation, loginValidation } = require('../validators/auth.validator');
const { handleValidationErrors } = require('../validators/validate');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/auth/register
router.post('/register', registerValidation, handleValidationErrors, register);

// POST /api/auth/login
router.post('/login', loginValidation, handleValidationErrors, login);

// POST /api/auth/logout
router.post('/logout', authenticateToken, logout);

// GET /api/auth/profile
router.get('/profile', authenticateToken, getProfile);

// PUT /api/auth/profile
router.put('/profile', authenticateToken, updateProfileValidator, handleValidationErrors, updateProfile);

module.exports = router;
