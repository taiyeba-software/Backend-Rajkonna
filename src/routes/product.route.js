const express = require("express");
const multer = require("multer");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");
const { productValidator } = require("../validators/product.validator");
const { handleValidationErrors } = require("../validators/validate");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Protected routes
router.post(
  "/",
  authenticateToken,
  upload.array('images', 10), // Accept up to 10 image files
  productValidator,
  handleValidationErrors,
  createProduct
);
router.patch("/:id", authenticateToken, updateProduct);
router.delete("/:id", authenticateToken, deleteProduct);

module.exports = router;
