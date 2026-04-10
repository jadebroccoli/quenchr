/**
 * Generate all app icon + splash PNG assets from logo-primary-dark.svg.
 * Run with: node scripts/generate-icons.mjs
 *
 * Uses the real brand SVG so the halo properly wraps around the Q
 * (the dark ellipse masks the back arc against the dark background).
 *
 * NOTE: sharp is NOT in package.json (it breaks EAS cloud builds).
 * Install it locally before running this script:
 *   pnpm add -D sharp --filter mobile   (then remove it before committing)
 *   or: npx --yes sharp   (one-off, no install needed)
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');
const brandingDir = join(assetsDir, 'branding', 'quenchr-logos');

const logoDarkPath = join(brandingDir, 'logo-primary-dark.svg');

// ── Android adaptive icon foreground ──
// Q + halo on transparent bg. The dark ellipse fill (#191714) masks the
// back arc — it becomes invisible when composited over the dark background layer.
// Coordinates are logo-primary-dark.svg × 5.12 (200 → 1024).
const androidForegroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="707" text-anchor="middle" font-family="Georgia,serif" font-size="573" fill="#F4EEE2">Q</text>
  <ellipse cx="497" cy="317" rx="159" ry="46" fill="#191714" stroke="#191714" stroke-width="41"/>
  <path d="M338 317 A159 46 0 0 1 655 317" fill="none" stroke="#C4922A" stroke-width="36" stroke-linecap="round" transform="rotate(-10 497 317)"/>
  <path d="M338 317 A159 46 0 0 0 655 317" fill="none" stroke="#C4922A" stroke-width="36" stroke-linecap="round" stroke-opacity=".35" transform="rotate(-10 497 317)"/>
</svg>`;

// ── Android monochrome (notification icon) ──
const androidMonochromeSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="707" text-anchor="middle" font-family="Georgia,serif" font-size="573" fill="white">Q</text>
  <path d="M338 317 A159 46 0 0 1 655 317" fill="none" stroke="white" stroke-width="36" stroke-linecap="round" transform="rotate(-10 497 317)"/>
  <path d="M338 317 A159 46 0 0 0 655 317" fill="none" stroke="white" stroke-width="36" stroke-linecap="round" stroke-opacity=".4" transform="rotate(-10 497 317)"/>
</svg>`;

async function generate() {
  console.log('Generating app icons from logo-primary-dark.svg...\n');

  // 1. icon.png — 1024×1024 square (iOS App Store + Android base)
  //    Circle logo (920 px) centred on a full-bleed dark square.
  //    iOS rounds the corners automatically; Android uses adaptive layers.
  const squareBg = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 25, g: 23, b: 20, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const circleLogo = await sharp(logoDarkPath).resize(920, 920).png().toBuffer();

  await sharp(squareBg)
    .composite([{ input: circleLogo, gravity: 'center' }])
    .png()
    .toFile(join(assetsDir, 'icon.png'));
  console.log('✅ icon.png (1024×1024)');

  // 2. splash-icon.png — 512×512 (Expo splash screen centre image)
  await sharp(logoDarkPath)
    .resize(512, 512)
    .png()
    .toFile(join(assetsDir, 'splash-icon.png'));
  console.log('✅ splash-icon.png (512×512)');

  // 3. favicon.png — 32×32 (web/PWA)
  await sharp(logoDarkPath)
    .resize(32, 32)
    .png()
    .toFile(join(assetsDir, 'favicon.png'));
  console.log('✅ favicon.png (32×32)');

  // 4. android-icon-foreground.png — 1024×1024 transparent bg
  await sharp(Buffer.from(androidForegroundSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-foreground.png'));
  console.log('✅ android-icon-foreground.png (1024×1024)');

  // 5. android-icon-background.png — 1024×1024 solid dark
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 25, g: 23, b: 20, alpha: 1 } },
  })
    .png()
    .toFile(join(assetsDir, 'android-icon-background.png'));
  console.log('✅ android-icon-background.png (1024×1024)');

  // 6. android-icon-monochrome.png — 1024×1024 white on transparent
  await sharp(Buffer.from(androidMonochromeSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-monochrome.png'));
  console.log('✅ android-icon-monochrome.png (1024×1024)');

  console.log('\nAll icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
