const ImageKit = jest.fn().mockImplementation(() => ({
  upload: jest.fn().mockResolvedValue({
    url: 'https://ik.imagekit.io/mock/test-image.jpg',
    fileId: 'mock-file-id',
  }),
}));

module.exports = ImageKit;
