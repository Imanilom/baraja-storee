#!/usr/bin/env bash
set -e

echo "🔄 Mengupdate aplikasi Baraja Store..."
git pull origin master

echo "📦 Menginstall dependensi jika ada perubahan..."
npm install

echo "🏗️ Membangun ulang Web Next.js..."
NEXT_PUBLIC_API_URL="https://api.barajastore.my.id/api/v1" npm run build:web

echo "⚡ Merestart proses di PM2..."
pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save

echo "✅ Aplikasi berhasil diupdate dan aktif kembali!"
pm2 status
