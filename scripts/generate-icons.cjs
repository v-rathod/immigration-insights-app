const sharp = require('sharp');
const path = require('path');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <g transform="translate(256,256)">
    <circle cx="0" cy="0" r="170" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4"/>
    <polygon points="0,-155 -40,10 0,-20 40,10" fill="white" opacity="0.95"/>
    <polygon points="0,155 -40,-10 0,20 40,-10" fill="white" opacity="0.3"/>
    <circle cx="0" cy="0" r="12" fill="white" opacity="0.9"/>
    <rect x="145" y="-3" width="30" height="6" rx="3" fill="white" opacity="0.4"/>
    <rect x="-175" y="-3" width="30" height="6" rx="3" fill="white" opacity="0.4"/>
  </g>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="50%" stop-color="#111118"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="url(#accent)"/>
  <g transform="translate(100,200)">
    <circle cx="40" cy="40" r="35" fill="none" stroke="url(#accent)" stroke-width="2.5"/>
    <polygon points="40,10 28,48 40,35 52,48" fill="#3b82f6" opacity="0.9"/>
    <polygon points="40,70 28,32 40,45 52,32" fill="white" opacity="0.2"/>
    <circle cx="40" cy="40" r="4" fill="white" opacity="0.8"/>
  </g>
  <text x="100" y="330" font-family="system-ui,-apple-system,sans-serif" font-size="64" font-weight="700" fill="white">Compass</text>
  <text x="100" y="385" font-family="system-ui,-apple-system,sans-serif" font-size="28" fill="#a1a1aa">Free Immigration Insights &amp; Green Card Tracker</text>
  <text x="100" y="450" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#71717a">Priority Date Forecasts · Employer Sponsorship Scores · Visa Bulletin Tracking</text>
  <text x="100" y="490" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#71717a">Salary Benchmarks · Processing Speed · 18.5M+ Government Data Points</text>
  <rect x="100" y="540" width="200" height="40" rx="20" fill="url(#accent)" opacity="0.15"/>
  <text x="140" y="566" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="600" fill="#818cf8">100% Free · Open Source</text>
</svg>`;

const ROOT = path.resolve(__dirname, '..');

async function generate() {
  const svgBuffer = Buffer.from(iconSvg);
  const ogBuffer = Buffer.from(ogSvg);

  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(ROOT, 'public', 'favicon-32x32.png'));
  await sharp(svgBuffer).resize(16, 16).png().toFile(path.join(ROOT, 'public', 'favicon-16x16.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(ROOT, 'public', 'apple-touch-icon.png'));
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(ROOT, 'public', 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(ROOT, 'public', 'icon-512.png'));
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(ROOT, 'src', 'app', 'favicon.ico'));
  console.log('Icons generated');

  await sharp(ogBuffer).resize(1200, 630).png().toFile(path.join(ROOT, 'public', 'og-image.png'));
  console.log('OG image generated');
}

generate().catch(console.error);
