const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');

// Add item to cart (POST /api/cart/items)
const addItemToCart = async (req, res) => {
  try {
    const { productId, qty } = req.body;
    const userId = req.user.userId;
    const reserve = req.query.reserve === 'true';

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate stock availability
    if (product.stock < qty) {
      return res.status(400).json({ message: 'Not enough stock' });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(item =>
      item.product.toString() === productId
    );

    if (existingItem) {
      // Increment quantity
      const newQty = existingItem.qty + qty;
      if (newQty > product.stock) {
        return res.status(400).json({ message: 'Exceeds available stock' });
      }
      existingItem.qty = newQty;
    } else {
      // Add new item
      cart.items.push({ product: productId, qty });
    }

    // Optional: soft-reserve stock
    if (reserve) {
      product.stock -= qty;
      await product.save();
    }

    await cart.save();

    // Populate product details for response
    await cart.populate('items.product', 'name price images');

    const statusCode = cart.items.length === 1 ? 201 : 200;
    res.status(statusCode).json({
      cart,
      ...(reserve && { reserved: true })
    });
  } catch (error) {
    console.error('Add item to cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Sync cart after login/register (POST /api/cart/sync)
const syncCart = async (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.user.userId;
    const reserve = req.query.reserve === 'true';

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items must be an array' });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const warnings = [];

    // Process each incoming item
    for (const item of items) {
      const { productId, qty } = item;

      // Validate product exists
      const product = await Product.findById(productId);
      if (!product) {
        warnings.push(`Product ${productId} not found`);
        continue;
      }

      // Check if product already in cart
      const existingItem = cart.items.find(cartItem =>
        cartItem.product.toString() === productId
      );

      let finalQty = qty;
      if (existingItem) {
        finalQty = existingItem.qty + qty;
      }

      // Cap at available stock
      if (finalQty > product.stock) {
        finalQty = product.stock;
        warnings.push(`Product ${product.name} quantity capped at ${product.stock}`);
      }

      if (existingItem) {
        existingItem.qty = finalQty;
      } else {
        cart.items.push({ product: productId, qty: finalQty });
      }

      // Optional: soft-reserve stock
      if (reserve) {
        product.stock -= (finalQty - (existingItem ? existingItem.qty : 0));
        await product.save();
      }
    }

    await cart.save();

    // Populate product details for response
    await cart.populate('items.product', 'name price images');

    res.status(200).json({
      merged: true,
      cart,
      warnings,
      ...(reserve && { reserved: true })
    });
  } catch (error) {
    console.error('Cart sync error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCart = async (req, res) => {
  try {
    // Find the user's cart
    const cart = await Cart.findOne({ user: req.user.userId }).populate('items.product');

    if (!cart) {
      return res.status(200).json({
        items: [],
        subtotal: 0,
        deliveryCharge: 0,
        discountPercent: 0,
        discountAmount: 0,
        totalPayable: 0
      });
    }

    const warnings = [];
    const items = [];
    let subtotal = 0;

    // Recompute prices from Product model
    for (const item of cart.items) {
      if (item.product) {
        // Fetch latest product data
        const prod = await Product.findById(item.product._id).lean();
        if (prod) {
          const price = Number(prod.price);
          const qty = Number(item.qty);
          const lineTotal = Math.round(price * qty * 100) / 100; // Round to 2 decimals
          items.push({
            product: {
              _id: prod._id,
              name: prod.name,
              price
            },
            qty,
            lineTotal
          });
          subtotal += lineTotal;
        } else {
          warnings.push(`Product ${item.product._id} not found, skipped`);
        }
      } else {
        warnings.push(`Invalid product reference, skipped`);
      }
    }

    // Delivery charge calculation
    const DELIVERY_CHARGE = process.env.DELIVERY_CHARGE ? Number(process.env.DELIVERY_CHARGE) : 50;
    const FREE_DELIVERY_THRESHOLD = process.env.FREE_DELIVERY_THRESHOLD ? Number(process.env.FREE_DELIVERY_THRESHOLD) : 1000;
    const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;

    // Discount calculation
    let discountPercent;
    if (req.query.discount && !isNaN(req.query.discount)) {
      const discountVal = Number(req.query.discount);
      if (discountVal >= 0 && discountVal <= 100) {
        discountPercent = discountVal;
      } else {
        discountPercent = Math.floor(Math.random() * 11) + 5; // 5-15
      }
    } else {
      discountPercent = Math.floor(Math.random() * 11) + 5; // 5-15
    }
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

    // Total payable
    let totalPayable = subtotal + deliveryCharge - discountAmount;
    totalPayable = Math.max(0, totalPayable); // Ensure not below 0
    totalPayable = Math.round(totalPayable * 100) / 100;

    res.status(200).json({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryCharge,
      discountPercent,
      discountAmount,
      totalPayable,
      warnings
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.userId;

    // Validate productId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Find user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Find the item in cart
    const itemIndex = cart.items.findIndex(item =>
      item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // If quantity is 0 or less, remove the item
    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].qty = quantity;
    }

    await cart.save();

    // Recompute cart totals using getCart logic
    const warnings = [];
    const items = [];
    let subtotal = 0;

    for (const item of cart.items) {
      if (item.product) {
        const prod = await Product.findById(item.product._id).lean();
        if (prod) {
          const price = Number(prod.price);
          const qty = Number(item.qty);
          const lineTotal = Math.round(price * qty * 100) / 100;
          items.push({
            product: {
              _id: prod._id,
              name: prod.name,
              price
            },
            qty,
            lineTotal
          });
          subtotal += lineTotal;
        } else {
          warnings.push(`Product ${item.product._id} not found, skipped`);
        }
      } else {
        warnings.push(`Invalid product reference, skipped`);
      }
    }

    const DELIVERY_CHARGE = process.env.DELIVERY_CHARGE ? Number(process.env.DELIVERY_CHARGE) : 50;
    const FREE_DELIVERY_THRESHOLD = process.env.FREE_DELIVERY_THRESHOLD ? Number(process.env.FREE_DELIVERY_THRESHOLD) : 1000;
    const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;

    const discountPercent = Math.floor(Math.random() * 11) + 5;
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

    let totalPayable = subtotal + deliveryCharge - discountAmount;
    totalPayable = Math.max(0, totalPayable);
    totalPayable = Math.round(totalPayable * 100) / 100;

    res.status(200).json({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryCharge,
      discountPercent,
      discountAmount,
      totalPayable,
      warnings
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;

    // Optional double-safety: If not mongoose.isValidObjectId(productId) return res.status(400).json({ message: 'Invalid product ID' });
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: req.user.userId }).populate('items.product');
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Find index of item
    const idx = cart.items.findIndex(it => it.product._id.toString() === productId.toString());
    if (idx === -1) {
      return res.status(404).json({ message: 'Product not found in cart' });
    }

    // Remove the item
    cart.items.splice(idx, 1);

    // Recompute totals identically to getCart logic
    const warnings = [];
    const items = [];
    let subtotal = 0;

    for (const item of cart.items) {
      if (item.product) {
        // Fetch latest product price from DB
        const prod = await Product.findById(item.product._id).lean();
        if (prod) {
          const price = Number(prod.price);
          const qty = Number(item.qty);
          const lineTotal = Math.round(price * qty * 100) / 100;
          items.push({
            product: {
              _id: prod._id,
              name: prod.name,
              price
            },
            qty,
            lineTotal
          });
          subtotal += lineTotal;
        } else {
          warnings.push(`Product ${item.product._id} not found, skipped`);
        }
      } else {
        warnings.push(`Invalid product reference, skipped`);
      }
    }

    // Delivery charge calculation
    const DELIVERY_CHARGE = process.env.DELIVERY_CHARGE ? Number(process.env.DELIVERY_CHARGE) : 50;
    const FREE_DELIVERY_THRESHOLD = process.env.FREE_DELIVERY_THRESHOLD ? Number(process.env.FREE_DELIVERY_THRESHOLD) : 1000;
    const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;

    // Discount calculation
    const discountPercent = Math.floor(Math.random() * 11) + 5; // 5-15
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

    // Total payable
    let totalPayable = subtotal + deliveryCharge - discountAmount;
    totalPayable = Math.max(0, totalPayable);
    totalPayable = Math.round(totalPayable * 100) / 100;

    // Save the cart
    await cart.save();

    // Return response
    res.status(200).json({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryCharge,
      discountPercent,
      discountAmount,
      totalPayable,
      warnings
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.userId }).populate('items.product');

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    // Recompute totals like getCart
    const subtotal = 0;
    const deliveryCharge = process.env.DELIVERY_CHARGE ? Number(process.env.DELIVERY_CHARGE) : 50;
    let discountPercent;
    if (req.query.discount && !isNaN(req.query.discount)) {
      const discountVal = Number(req.query.discount);
      if (discountVal >= 0 && discountVal <= 100) {
        discountPercent = discountVal;
      } else {
        discountPercent = Math.floor(Math.random() * 11) + 5; // 5-15
      }
    } else {
      discountPercent = Math.floor(Math.random() * 11) + 5; // 5-15
    }
    const discountAmount = 0; // since subtotal is 0
    const totalPayable = 0;

    res.status(200).json({
      cart: cart.toObject(),
      subtotal,
      deliveryCharge,
      discountPercent,
      discountAmount,
      totalPayable
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  addItemToCart,
  syncCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
