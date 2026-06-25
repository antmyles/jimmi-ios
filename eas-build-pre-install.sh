#!/bin/bash
set -e

echo "🎯 [EAS Prebuild] Starting JIMMI logo injection..."

PROJECT_ROOT="$(pwd)"
JIMMI_LOGO="$PROJECT_ROOT/assets/images/icon.png"
IOS_DIR="$PROJECT_ROOT/ios/JIMMI"
APPICON_DIR="$IOS_DIR/Images.xcassets/AppIcon.appiconset"

if [ ! -f "$JIMMI_LOGO" ]; then
  echo "❌ JIMMI logo not found"
  exit 1
fi

echo "✅ JIMMI logo found"

mkdir -p "$APPICON_DIR"

# Generate icon sizes
convert "$JIMMI_LOGO" -resize 120x120 "$APPICON_DIR/icon-120.png"
convert "$JIMMI_LOGO" -resize 1024x1024 "$APPICON_DIR/icon-1024.png"

echo "✅ Icons generated"

# Create Contents.json
cat > "$APPICON_DIR/Contents.json" << 'INNER'
{
  "images": [
    {"filename": "icon-120.png", "idiom": "iphone", "platform": "ios", "size": "120x120", "scale": "2x"},
    {"filename": "icon-120.png", "idiom": "iphone", "platform": "ios", "size": "120x120", "scale": "3x"},
    {"filename": "icon-1024.png", "idiom": "ios-marketing", "platform": "ios", "size": "1024x1024", "scale": "1x"}
  ],
  "info": {"version": 1, "author": "xcode"}
}
INNER

echo "✅ Contents.json created"

# Lock app.json
cat > "$PROJECT_ROOT/app.json" << 'INNER'
{
  "name": "JIMMI",
  "displayName": "JIMMI",
  "ios": {"icon": "./assets/images/icon.png", "supportsTablet": true},
  "android": {"icon": "./assets/images/icon.png"}
}
INNER

echo "✅ app.json locked"
echo "🎉 Prebuild complete!"
