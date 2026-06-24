#!/bin/bash
# This hook runs after prebuild and restores our custom icon

# Restore our custom icon
rm -rf ios/JIMMI/Images.xcassets/AppIcon.appiconset
cp -r /tmp/jimmi-icon-backup ios/JIMMI/Images.xcassets/AppIcon.appiconset

echo "✅ Custom icon restored after prebuild"
