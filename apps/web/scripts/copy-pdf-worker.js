const fs = require('fs');
const path = require('path');

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const publicDirectory = path.resolve(__dirname, '../public');

fs.mkdirSync(publicDirectory, { recursive: true });
fs.copyFileSync(workerPath, path.join(publicDirectory, 'pdf.worker.min.mjs'));
