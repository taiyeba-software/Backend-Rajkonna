// uploadImages.js
import fs from 'fs';
import path from 'path';
import ImageKit from 'imagekit';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Adjust to your folder path containing product images
const folderPath = path.resolve('./product-images');

async function uploadImages() {
  try {
    const files = fs.readdirSync(folderPath);
    const uploadedImages = [];

    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      const uniqueName = `${uuidv4()}_${fileName}`;

      const result = await imagekit.upload({
        file: fileBuffer,
        fileName: uniqueName,
        folder: '/products',
      });

      uploadedImages.push({
        url: result.url,
        filename: result.name,
      });
    }

    console.log('✅ Uploaded images:');
    console.log(JSON.stringify(uploadedImages, null, 2));
  } catch (error) {
    console.error('❌ Error uploading images:', error);
  }
}

uploadImages();
