// Test environment. Integration tests use a separate database (never the real one).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-that-is-long-enough-for-validation-123456';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/medstock_test';
