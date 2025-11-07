// uploadImages.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const ImageKit = require('imagekit');
const Product = require('./src/models/product.model');

// ✅ Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ✅ Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rajkonna';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Folder containing your local product images
const folderPath = path.join(__dirname, 'uploads/products');

// Helper function to upload a single image
async function uploadImage(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = `${uuidv4()}_${path.basename(filePath)}`;

  const result = await imagekit.upload({
    file: fileBuffer,
    fileName,
    folder: '/products',
  });

  return { url: result.url, filename: result.name };
}

// ✅ Main function to upload all images and create a product entry
async function uploadProduct() {
  try {
    const files = fs.readdirSync(folderPath);
    if (files.length === 0) throw new Error('No files found in uploads/products');

    const imageUploads = [];
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const uploaded = await uploadImage(filePath);
      imageUploads.push(uploaded);
      console.log(`✅ Uploaded: ${file} → ${uploaded.url}`);
    }

    // Example product creation
    const product = new Product({
      name: 'Herbal Facewash',
      description: 'A gentle facewash with natural herbs for glowing skin.',
      price: 450,
      stock: 25,
      category: 'Skincare',
      images: imageUploads,
    });

    await product.save();
    console.log('✅ Product saved to MongoDB:', product);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    mongoose.connection.close();
  }
}

uploadProduct();
