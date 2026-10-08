import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// Test-only reader for the repository's non-interlaced, 8-bit grayscale PNGs.
// Unsupported encodings fail explicitly; the application uses the browser decoder.
export function readGrayscalePng(path) {
  const file = readFileSync(path)
  assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(file.subarray(12, 16).toString(), 'IHDR')
  assert.deepEqual([...file.subarray(24, 29)], [8, 0, 0, 0, 0])
  const width = file.readUInt32BE(16), height = file.readUInt32BE(20)
  const chunks = []
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset)
    if (file.subarray(offset + 4, offset + 8).toString() === 'IDAT') chunks.push(file.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  assert.equal(raw.length, (width + 1) * height)
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)]
    assert.ok(filter <= 4)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const a = x ? pixels[i - 1] : 0, b = y ? pixels[i - width] : 0, c = x && y ? pixels[i - width - 1] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth][filter]
      pixels[i] = raw[y * (width + 1) + x + 1] + predictor
    }
  }
  return { width, height, pixels }
}
