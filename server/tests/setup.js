// Test environment variables. Set BEFORE server.js is loaded.
// (dotenv never overrides variables that are already set, so a real .env cannot leak into tests.)
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'admin-pass';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.SMTP_HOST = ''; // no real emails during tests
