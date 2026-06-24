#!/bin/bash
# This hook runs before the build and preserves our custom icon

# Copy our custom icon to a temporary location
cp -r ios/JIMMI/Images.xcassets/AppIcon.appiconset /tmp/jimmi-icon-backup

echo "✅ Icon backed up before prebuild"
