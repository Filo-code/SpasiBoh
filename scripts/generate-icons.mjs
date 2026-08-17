/**
 * Generates the PWA icon set from an inline SVG.
 *
 * Run with `npm run icons` whenever the mark changes. The output is committed
 * so a plain `npm install && npm run build` never needs sharp at build time.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')

const BG = '#0a0e13'
const FG = '#e9eff6'
const ACCENT = '#4d8dff'

/** `safe` insets the glyph for maskable icons, which get cropped to a circle. */
function markSvg(size, { maskable = false } = {}) {
  const scale = maskable ? 0.62 : 0.78
  const fontSize = Math.round(size * scale)
  const radius = maskable ? 0 : Math.round(size * 0.22)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <rect x="0" y="${size - Math.round(size * 0.055)}" width="${size}" height="${Math.round(size * 0.055)}" fill="${ACCENT}"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
        font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-weight="800"
        font-size="${fontSize}" fill="${FG}">Я</text>
</svg>`
}

async function main() {
  await mkdir(publicDir, { recursive: true })

  const targets = [
    { file: 'pwa-192.png', size: 192, maskable: false },
    { file: 'pwa-512.png', size: 512, maskable: false },
    { file: 'pwa-maskable-512.png', size: 512, maskable: true },
    { file: 'apple-touch-icon.png', size: 180, maskable: true },
  ]

  for (const target of targets) {
    const svg = markSvg(target.size, { maskable: target.maskable })
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    await writeFile(resolve(publicDir, target.file), png)
    console.log(`✓ ${target.file} (${target.size}×${target.size})`)
  }

  await writeFile(resolve(publicDir, 'favicon.svg'), markSvg(64))
  console.log('✓ favicon.svg')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
