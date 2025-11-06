const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { uploadImage } = require('../services/imagekit.service');

const createProduct = async (req, res) => {
  try {
    // Check user role
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'seller')) {
      return res.status(403).json({ message: 'Access denied. Only admin or seller can create products.' });
    }

    const { name, price, stock, category } = req.body;

    // Upload images to ImageKit
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageData = await uploadImage(file);
        uploadedImages.push(imageData);
      }
    } else if (req.body.images) {
      // If no files uploaded but images provided in body (e.g., from test)
      uploadedImages.push(...JSON.parse(req.body.images));
    }

    // Create product
    const product = new Product({
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      images: uploadedImages,
    });

    const savedProduct = await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: savedProduct,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getProducts = async (req, res) => {
  try {
    const { q, category, price_min, price_max, page = 1, sort } = req.query;

    // Validate numeric params
    const pageNum = parseInt(page);
    const priceMin = price_min ? parseFloat(price_min) : undefined;
    const priceMax = price_max ? parseFloat(price_max) : undefined;

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ message: 'Invalid page number' });
    }
    if (priceMin !== undefined && isNaN(priceMin)) {
      return res.status(400).json({ message: 'Invalid price_min' });
    }
    if (priceMax !== undefined && isNaN(priceMax)) {
      return res.status(400).json({ message: 'Invalid price_max' });
    }

    let query = {};
    let sortOption = { createdAt: -1 };
    let projection = {};
    let usedTextSearch = false;

    // Build query step-by-step
    if (q && q.trim()) {
      // Use text search
      query.$text = { $search: q.trim() };
      projection.score = { $meta: 'textScore' };
      sortOption = { score: { $meta: 'textScore' } };
      usedTextSearch = true;
    }

    if (category) {
      query.category = category;
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      query.price = {};
      if (priceMin !== undefined) query.price.$gte = priceMin;
      if (priceMax !== undefined) query.price.$lte = priceMax;
    }

    // Apply sorting rules
    if (sort === 'price:asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price:desc') {
      sortOption = { price: -1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (usedTextSearch) {
      // Keep text score sorting
    } else {
      sortOption = { createdAt: -1 };
    }

    // Pagination
    const pageSize = 10;
    const skip = (pageNum - 1) * pageSize;

    // Execute query
    let productsQuery = Product.find(query, projection).sort(sortOption).skip(skip).limit(pageSize).lean();

    // Fallback to regex search if text search returns no results and q.length > 2
    if (usedTextSearch && q.trim().length > 2) {
      const textResults = await Product.find(query, projection).sort(sortOption).limit(1).lean();
      if (textResults.length === 0) {
        // Fallback to regex
        delete query.$text;
        delete projection.score;
        query.name = { $regex: q.trim(), $options: 'i' };
        sortOption = { createdAt: -1 };
        productsQuery = Product.find(query).sort(sortOption).skip(skip).limit(pageSize).lean();
      }
    }

    const products = await productsQuery;

    // Get total count
    const totalQuery = { ...query };
    if (usedTextSearch && q.trim().length > 2 && products.length === 0) {
      // Adjust total query for fallback
      delete totalQuery.$text;
      totalQuery.name = { $regex: q.trim(), $options: 'i' };
    }
    const total = await Product.countDocuments(totalQuery);
    const pages = Math.ceil(total / pageSize);

    res.status(200).json({
      products,
      total,
      page: pageNum,
      pages,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    // Fetch product
    const product = await Product.findById(id).lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      product: {
        ...product,
      },
    });
  } catch (error) {
    console.error('Get product by id error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    // Check user role
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'seller')) {
      return res.status(403).json({ message: 'Access denied. Only admin or seller can update products.' });
    }

    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    // Extract allowed fields
    const allowedFields = ['name', 'description', 'price', 'stock', 'category', 'images'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate numeric fields
    if (updates.price !== undefined) {
      const price = parseFloat(updates.price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: 'Invalid price: must be a number >= 0' });
      }
      updates.price = price;
    }
    if (updates.stock !== undefined) {
      const stock = parseInt(updates.stock);
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ message: 'Invalid stock: must be an integer >= 0' });
      }
      updates.stock = stock;
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Log update
    console.log(`${updatedProduct.name} updated by ${req.user.role}`);

    res.status(200).json({
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    // Ensure only users with role 'admin' or 'seller' are allowed
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'seller')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Find product by id
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Determine if product exists in any orders
    const orderCount = await Order.countDocuments({ 'items.product': id });

    if (orderCount > 0) {
      // Soft-delete: set product.status = 'archived'
      product.status = 'archived';
      await product.save();
      console.log(`Product ${product.name} archived by ${req.user.role}`);
      return res.status(200).json({ message: 'Product archived (has orders)', product: product.toObject() });
    } else {
      // Hard delete
      const deletedProduct = await Product.findByIdAndDelete(id);
      console.log(`Product ${product.name} deleted by ${req.user.role}`);
      return res.status(200).json({ message: 'Product deleted', product: deletedProduct });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
