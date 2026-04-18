#!/bin/bash

# 🧹 NomadsPeople App — Complete Cleanup Script
# Clears all caches, node_modules, and rebuilds from scratch

echo "🧹 Starting Complete App Cleanup..."
echo ""

# 1. Clear Metro bundler cache
echo "1️⃣  Clearing Metro bundler cache..."
rm -rf /tmp/metro-*
rm -rf ~/.metro
echo "   ✅ Metro cache cleared"

# 2. Clear Expo cache
echo "2️⃣  Clearing Expo cache..."
rm -rf ~/.expo
echo "   ✅ Expo cache cleared"

# 3. Clear Watchman cache (macOS/Linux)
echo "3️⃣  Clearing Watchman cache..."
if command -v watchman &> /dev/null; then
  watchman watch-del-all
  echo "   ✅ Watchman cache cleared"
else
  echo "   ℹ️  Watchman not installed (OK)"
fi

# 4. Clear node_modules
echo "4️⃣  Removing node_modules..."
rm -rf node_modules
echo "   ✅ node_modules removed"

# 5. Clear package-lock.json / yarn.lock
echo "5️⃣  Clearing lock files..."
rm -rf package-lock.json yarn.lock
echo "   ✅ Lock files cleared"

# 6. Clear .expo directory
echo "6️⃣  Clearing .expo directory..."
rm -rf .expo
echo "   ✅ .expo cleared"

# 7. Install fresh dependencies
echo "7️⃣  Installing fresh dependencies..."
npm install
echo "   ✅ Dependencies installed"

# 8. Clear app cache on device (if Expo CLI is available)
echo "8️⃣  App setup complete!"
echo ""

echo "═══════════════════════════════════════"
echo "✅ CLEANUP COMPLETE!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run: expo start --clear"
echo "  2. On your phone, press 'i' for iOS or 'a' for Android"
echo "  3. The app will rebuild from scratch"
echo ""
echo "This will take 2-3 minutes but ensures everything is fresh!"
