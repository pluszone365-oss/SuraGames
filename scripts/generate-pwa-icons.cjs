const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  const sourceAsset = path.join(__dirname, '..', 'src', 'assets', 'images', 'game_app_icon_1786707249717.jpg');

  if (!fs.existsSync(sourceAsset)) {
    console.error('No source logo image found!');
    return;
  }

  const { data, info } = await sharp(sourceAsset)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  // Flood fill light corner pixels to remove white canvas
  const visited = new Uint8Array(w * h);
  const queue = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  visited[0] = 1;
  visited[w - 1] = 1;
  visited[(h - 1) * w] = 1;
  visited[(h - 1) * w + w - 1] = 1;

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nidx = ny * w + nx;
        if (!visited[nidx]) {
          const pidx = nidx * 3;
          const lum = 0.299 * data[pidx] + 0.587 * data[pidx + 1] + 0.114 * data[pidx + 2];
          if (lum > 70) {
            visited[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  const dilated = new Uint8Array(visited);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (visited[idx] === 0) {
        if (visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w]) {
          const pidx = idx * 3;
          const lum = 0.299 * data[pidx] + 0.587 * data[pidx + 1] + 0.114 * data[pidx + 2];
          if (lum > 55) dilated[idx] = 1;
        }
      }
    }
  }

  const rgbaBuffer = Buffer.alloc(w * h * 4);
  const rgbDarkBuffer = Buffer.alloc(w * h * 3);
  const bgR = 7, bgG = 11, bgB = 20;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sIdx = (y * w + x) * 3;
      const dIdx = (y * w + x) * 4;
      const isOuter = dilated[y * w + x] === 1;

      if (isOuter) {
        rgbaBuffer[dIdx] = bgR;
        rgbaBuffer[dIdx + 1] = bgG;
        rgbaBuffer[dIdx + 2] = bgB;
        rgbaBuffer[dIdx + 3] = 0;

        rgbDarkBuffer[sIdx] = bgR;
        rgbDarkBuffer[sIdx + 1] = bgG;
        rgbDarkBuffer[sIdx + 2] = bgB;
      } else {
        rgbaBuffer[dIdx] = data[sIdx];
        rgbaBuffer[dIdx + 1] = data[sIdx + 1];
        rgbaBuffer[dIdx + 2] = data[sIdx + 2];
        rgbaBuffer[dIdx + 3] = 255;

        rgbDarkBuffer[sIdx] = data[sIdx];
        rgbDarkBuffer[sIdx + 1] = data[sIdx + 1];
        rgbDarkBuffer[sIdx + 2] = data[sIdx + 2];
      }
    }
  }

  // Ensure public/app-logo.jpg with seamless dark background
  await sharp(rgbDarkBuffer, { raw: { width: w, height: h, channels: 3 } })
    .resize(512, 512, { fit: 'contain', background: { r: bgR, g: bgG, b: bgB } })
    .jpeg({ quality: 95 })
    .toFile(path.join(publicDir, 'app-logo.jpg'));

  // Ensure public/app-logo-transparent.png
  await sharp(rgbaBuffer, { raw: { width: w, height: h, channels: 4 } })
    .resize(512, 512, { fit: 'contain', background: { r: bgR, g: bgG, b: bgB, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'app-logo-transparent.png'));

  const targets = [
    { file: 'pwa-192.png', size: 192 },
    { file: 'pwa-512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 },
    { file: 'favicon.png', size: 64 },
  ];

  for (const t of targets) {
    const outPath = path.join(publicDir, t.file);
    await sharp(rgbaBuffer, { raw: { width: w, height: h, channels: 4 } })
      .resize(t.size, t.size, { fit: 'contain', background: { r: bgR, g: bgG, b: bgB, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated standard PNG: ${t.file} (${t.size}x${t.size})`);
  }

  // Generate maskable icons with 15% safe margin on dark background
  const maskableTargets = [
    { file: 'pwa-maskable-192.png', size: 192 },
    { file: 'pwa-maskable-512.png', size: 512 },
  ];

  for (const m of maskableTargets) {
    const innerSize = Math.round(m.size * 0.76); // 12% padding on all sides for safe-zone
    const innerBuffer = await sharp(rgbaBuffer, { raw: { width: w, height: h, channels: 4 } })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: bgR, g: bgG, b: bgB, alpha: 0 } })
      .png()
      .toBuffer();

    const outPath = path.join(publicDir, m.file);
    await sharp({
      create: {
        width: m.size,
        height: m.size,
        channels: 4,
        background: { r: bgR, g: bgG, b: bgB, alpha: 1 }
      }
    })
      .composite([{ input: innerBuffer, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated maskable PNG: ${m.file} (${m.size}x${m.size}) with safe zone`);
  }
}

generateIcons().catch(err => {
  console.error('Failed to generate PNG icons:', err);
  process.exit(1);
});
