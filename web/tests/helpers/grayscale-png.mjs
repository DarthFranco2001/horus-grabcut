import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// Test-only reader for the repository's non-interlaced, 8-bit grayscale/RGB PNGs.
// Unsupported encodings fail explicitly; the application uses the browser decoder.
export function readPng(path) {
  const file = readFileSync(path)
  assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(file.subarray(12, 16).toString(), 'IHDR')
  assert.ok([0, 2].includes(file[25]))
  assert.deepEqual([file[24], ...file.subarray(26, 29)], [8, 0, 0, 0])
  const channels = file[25] === 0 ? 1 : 3
  const width = file.readUInt32BE(16), height = file.readUInt32BE(20)
  const chunks = []
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset)
    if (file.subarray(offset + 4, offset + 8).toString() === 'IDAT') chunks.push(file.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const stride = width * channels
  const raw = inflateSync(Buffer.concat(chunks))
  assert.equal(raw.length, (stride + 1) * height)
  const pixels = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x
      const a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0, c = x >= channels && y ? pixels[i - stride - channels] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth][filter]
      pixels[i] = raw[y * (stride + 1) + x + 1] + predictor
    }
  }
  return { width, height, channels, pixels }
}

export function readGrayscalePng(path) {
  const { width, height, channels, pixels } = readPng(path)
  assert.equal(channels, 1)
  return { width, height, pixels }
}

export function readRgbaPng(path) {
  const { width, height, channels, pixels } = readPng(path)
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba.set([pixels[i * channels], pixels[i * channels + (channels === 1 ? 0 : 1)], pixels[i * channels + (channels === 1 ? 0 : 2)], 255], i * 4)
  }
  return { width, height, rgba }
}
