#!/bin/bash
set -e

echo "🎯 Replacing Expo icon with JIMMI logo..."

APPICON_DIR="ios/JIMMI/Images.xcassets/AppIcon.appiconset"

if [ -d "$APPICON_DIR" ]; then
  echo "Found AppIcon directory: $APPICON_DIR"
  cp assets/images/icon.png "$APPICON_DIR/icon-120.png"
  cp assets/images/icon.png "$APPICON_DIR/icon-1024.png"
  echo "✅ JIMMI logo injected!"
else
  echo "⚠️  AppIcon directory not found yet"
fi
