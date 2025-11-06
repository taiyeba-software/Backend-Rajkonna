# Rajkonna Backend

A Node.js backend API for the Rajkonna e-commerce platform, built with Express.js, MongoDB, Redis, and JWT authentication. It includes features for user authentication, product management, order handling, and image uploads via ImageKit.

## Features

- User authentication (register, login, logout) with JWT
- User profile management (get and update profile)
- Product CRUD operations
- Order management (with address fallback for order creation)
- Cart functionality
- Image upload and management with ImageKit
- Redis caching
- Input validation with express-validator
- Comprehensive test suite with Jest

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Image Handling**: ImageKit
- **Validation**: express-validator
- **Testing**: Jest with Supertest
- **Other**: bcryptjs for password hashing, multer for file uploads, uuid for unique IDs

## Project Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Redis (local or cloud instance)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd rajkonna-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the required values (see Environment Variables section below)

4. Start the server:
   ```bash
   npx nodemon server.js
   ```

   The server will run on `http://localhost:5000` (or the port specified in your `.env` file).

### Testing

Run the test suite:
```bash
npm test
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/rajkonna
JWT_SECRET=your_jwt_secret_key
REDIS_URL=redis://localhost:6379
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

### Explanation

- `PORT`: The port on which the server will run (default: 5000)
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `REDIS_URL`: Redis connection URL
- `IMAGEKIT_PUBLIC_KEY`: Public key for ImageKit
- `IMAGEKIT_PRIVATE_KEY`: Private key for ImageKit
- `IMAGEKIT_URL_ENDPOINT`: ImageKit URL endpoint for image access

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create new order

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove item from cart

## Project Structure

```
rajkonna-backend/
├── src/
│   ├── app.js                 # Express app setup
│   ├── controllers/           # Route controllers
│   ├── db/                    # Database connection
│   ├── middlewares/           # Custom middlewares
│   ├── models/                # Mongoose models
│   ├── routes/                # API routes
│   ├── services/              # External services (Redis, ImageKit)
│   └── validators/            # Input validation
├── tests/                     # Test files
├── .env.example               # Environment variables template
├── package.json               # Dependencies and scripts
├── server.js                  # Server entry point
└── README.md                  # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run tests: `npm test`
6. Submit a pull request

## Quick Commands

If user wants to check the test cases, run `npm test`. To open server, run `npx nodemon server.js`.

## License

This project is licensed under the ISC License.
