import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': 'http://backend:5000' } } ,
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.js', // Global setup file
        coverage: {
        provider: 'v8', // Code coverage ke liye engine
        reporter: ['text', 'json', 'lcov'], // SonarQube lcov report read karta hai
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/__tests__/**', 'src/main.jsx', 'src/setupTests.js'],
    },
  },
});
