#!/bin/bash
set -e

echo "🔧 Post-install hook: Fixing ASSETCATALOG_COMPILER_APPICON_NAME..."

# Path to the Xcode project file
PBXPROJ_PATH="ios/JIMMI.xcodeproj/project.pbxproj"

if [ -f "$PBXPROJ_PATH" ]; then
  # Replace expo with AppIcon in the build settings
  sed -i '' 's/ASSETCATALOG_COMPILER_APPICON_NAME = expo;/ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/g' "$PBXPROJ_PATH"
  echo "✅ Updated ASSETCATALOG_COMPILER_APPICON_NAME to AppIcon"
else
  echo "⚠️  project.pbxproj not found at $PBXPROJ_PATH"
fi
