const sharp = require('sharp');
const path  = require('path');

// TeeWager icon: dark green background, white golf flag on a hill
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Background -->
  <rect width="1024" height="1024" fill="#1A4A2E" rx="0"/>

  <!-- Fairway hill (lighter green arc at bottom) -->
  <ellipse cx="512" cy="820" rx="420" ry="160" fill="#2d6a4f"/>

  <!-- Flagstick -->
  <rect x="490" y="310" width="22" height="340" fill="#ffffff" rx="4"/>

  <!-- Flag (pennant pointing right) -->
  <polygon points="512,310 512,430 660,370" fill="#F5EDD6"/>

  <!-- Golf ball on green -->
  <circle cx="512" cy="700" r="62" fill="#ffffff"/>
  <!-- Dimples -->
  <circle cx="492" cy="685" r="7" fill="#ddd"/>
  <circle cx="518" cy="672" r="7" fill="#ddd"/>
  <circle cx="544" cy="685" r="7" fill="#ddd"/>
  <circle cx="530" cy="708" r="7" fill="#ddd"/>
  <circle cx="498" cy="708" r="7" fill="#ddd"/>
  <circle cx="514" cy="695" r="6" fill="#ddd"/>
</svg>`;

async function generate() {
  const buf = Buffer.from(svg);

  // Main app icon (1024x1024)
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(__dirname, '../assets/icon.png'));
  console.log('✓ assets/icon.png');

  // Favicon (48x48)
  await sharp(buf).resize(48, 48).png().toFile(path.join(__dirname, '../assets/favicon.png'));
  console.log('✓ assets/favicon.png');

  // Splash icon
  await sharp(buf).resize(512, 512).png().toFile(path.join(__dirname, '../assets/splash-icon.png'));
  console.log('✓ assets/splash-icon.png');

  // Android adaptive foreground (safe zone: center 66% of 1024)
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(__dirname, '../assets/android-icon-foreground.png'));
  console.log('✓ assets/android-icon-foreground.png');
}

generate().catch(console.error);
