// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  moduleNameMapper: {
    '^imagekit$': '<rootDir>/tests/__mocks__/imagekit.js',
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
