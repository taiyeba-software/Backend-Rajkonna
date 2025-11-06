const ImageKit = require('imagekit');
const { v4: uuidv4 } = require('uuid');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadImage = async (file) => {
  try {
    const uniqueFilename = `${uuidv4()}_${file.originalname}`;

    const result = await imagekit.upload({
      file: file.buffer,
      fileName: uniqueFilename,
      folder: '/products',
    });

    return {
      url: result.url,
      filename: result.name,
    };
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
};

module.exports = {
  uploadImage,
};
