#!/bin/bash
set -e

echo "🧹 Cleaning all build artifacts and caches..."
rm -rf .next node_modules/.cache

echo "📦 Verifying dependencies..."
if [ ! -d "node_modules/leaflet" ]; then
  echo "❌ ERROR: leaflet not found in node_modules"
  echo "Installing leaflet explicitly..."
  npm install leaflet@^1.9.4 --legacy-peer-deps
fi

echo "🗺️  Leaflet version:"
node -e "console.log(require('leaflet/package.json').version)"

echo "🏗️  Building Next.js application..."
NODE_ENV=production NEXT_IGNORE_INCORRECT_LOCKFILE=1 next build

echo "✅ Build completed successfully!"
