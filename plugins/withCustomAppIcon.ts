import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

interface IconSize {
  filename: string;
  idiom: 'iphone' | 'ipad' | 'ios-marketing';
  size: string;
  scale: '1x' | '2x' | '3x';
  dimensions: number;
}

const ICON_SIZES: IconSize[] = [
  { filename: 'Icon-App-20x20@2x.png', idiom: 'iphone', size: '20x20', scale: '2x', dimensions: 40 },
  { filename: 'Icon-App-20x20@3x.png', idiom: 'iphone', size: '20x20', scale: '3x', dimensions: 60 },
  { filename: 'Icon-App-29x29@1x.png', idiom: 'iphone', size: '29x29', scale: '1x', dimensions: 29 },
  { filename: 'Icon-App-29x29@2x.png', idiom: 'iphone', size: '29x29', scale: '2x', dimensions: 58 },
  { filename: 'Icon-App-29x29@3x.png', idiom: 'iphone', size: '29x29', scale: '3x', dimensions: 87 },
  { filename: 'Icon-App-40x40@2x.png', idiom: 'iphone', size: '40x40', scale: '2x', dimensions: 80 },
  { filename: 'Icon-App-40x40@3x.png', idiom: 'iphone', size: '40x40', scale: '3x', dimensions: 120 },
  { filename: 'Icon-App-60x60@2x.png', idiom: 'iphone', size: '60x60', scale: '2x', dimensions: 120 },
  { filename: 'Icon-App-60x60@3x.png', idiom: 'iphone', size: '60x60', scale: '3x', dimensions: 180 },
  { filename: 'Icon-App-76x76@1x.png', idiom: 'ipad', size: '76x76', scale: '1x', dimensions: 76 },
  { filename: 'Icon-App-76x76@2x.png', idiom: 'ipad', size: '76x76', scale: '2x', dimensions: 152 },
  { filename: 'Icon-App-83.5x83.5@2x.png', idiom: 'ipad', size: '83.5x83.5', scale: '2x', dimensions: 167 },
  { filename: 'Icon-App-1024x1024@1x.png', idiom: 'ios-marketing', size: '1024x1024', scale: '1x', dimensions: 1024 },
];

const withCustomAppIcon: ConfigPlugin = config => {
  return withDangerousMod(config, [
    'ios',
    async modConfig => {
      try {
        const projectRoot = modConfig.modRequest.projectRoot;
        const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
        const projectName = modConfig.modRequest.projectName;

        const sourceIconPath = path.join(projectRoot, 'assets', 'images', 'icon.png');
        const appIconSetPath = path.join(
          platformProjectRoot,
          projectName,
          'Images.xcassets',
          'AppIcon.appiconset'
        );

        try {
          await fs.access(sourceIconPath);
        } catch {
          console.warn('Source icon not found at ' + sourceIconPath);
          return modConfig;
        }

        await fs.mkdir(appIconSetPath, { recursive: true });
        console.log('Created AppIcon.appiconset directory');

        console.log('Generating icon sizes...');
        for (const icon of ICON_SIZES) {
          const outputPath = path.join(appIconSetPath, icon.filename);
          await sharp(sourceIconPath)
            .resize(icon.dimensions, icon.dimensions, {
              fit: 'cover',
              position: 'center',
            })
            .png()
            .toFile(outputPath);
          console.log('  Generated ' + icon.filename + ' (' + icon.dimensions + 'x' + icon.dimensions + ')');
        }

        const contentsJson = {
          images: ICON_SIZES.map(icon => ({
            filename: icon.filename,
            idiom: icon.idiom,
            size: icon.size,
            scale: icon.scale,
          })),
          info: {
            author: 'com.jimmi.ios',
            version: 1,
          },
        };

        const contentsJsonPath = path.join(appIconSetPath, 'Contents.json');
        await fs.writeFile(contentsJsonPath, JSON.stringify(contentsJson, null, 2));
        console.log('Generated Contents.json');

        console.log('Successfully injected JIMMI app icon into AppIcon.appiconset');
      } catch (error) {
        console.error('Error injecting app icon:', error);
        throw error;
      }

      return modConfig;
    },
  ]);
};

export default withCustomAppIcon;
