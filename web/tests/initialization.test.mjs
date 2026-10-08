import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rgbaToGrayscale } from '../src/core/image.ts'
import { initializeLabels, labelsToRgba } from '../src/core/initialization.ts'

test('conserva exactamente todas las intensidades grises de 8 bits', () => {
  const rgba = new Uint8ClampedArray(256 * 4)
  for (let i = 0; i < 256; i++) rgba.set([i, i, i, 255], i * 4)
  const image = rgbaToGrayscale(rgba, { width: 16, height: 16 })
  assert.deepEqual(image.pixels, Uint8Array.from({ length: 256 }, (_, i) => i))
  assert.equal(image.width, 16)
  assert.equal(image.height, 16)
})

test('convierte RGB en orden RGBA y rechaza transparencia y tamaños inválidos', () => {
  const image = rgbaToGrayscale(Uint8ClampedArray.from([255,0,0,255, 0,255,0,255, 0,0,255,255]), { width: 3, height: 1 })
  assert.deepEqual([...image.pixels], [76, 150, 29])
  assert.throws(() => rgbaToGrayscale(new Uint8Array(4), { width: 1, height: 1 }), /opaca/)
  assert.throws(() => rgbaToGrayscale(new Uint8Array(4), { width: 2, height: 1 }), /dimensiones/)
  assert.throws(() => rgbaToGrayscale(new Uint8Array(0), { width: 0, height: 1 }), /dimensiones/)
})

test('etiqueta por filas sin transponer y respeta los bordes exclusivos', () => {
  const result = initializeLabels({ width: 5, height: 4 }, { x: 3, y: 1, width: 2, height: 3 })
  assert.deepEqual([...result.labels], [
    0,0,0,0,0,
    0,0,0,1,1,
    0,0,0,1,1,
    0,0,0,1,1,
  ])
  assert.equal(result.foregroundCount, 6)
  assert.equal(result.backgroundCount, 14)
})

test('todos los rectángulos válidos de una imagen pequeña tienen área y posición correctas', () => {
  const size = { width: 5, height: 4 }
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
    for (let height = 1; height <= size.height - y; height++) for (let width = 1; width <= size.width - x; width++) {
      if (width * height === size.width * size.height) continue
      const result = initializeLabels(size, { x, y, width, height })
      assert.equal(result.foregroundCount, width * height)
      assert.equal(result.labels.reduce((sum, label) => sum + label, 0), width * height)
      assert.equal(result.foregroundCount + result.backgroundCount, size.width * size.height)
      for (let py = 0; py < size.height; py++) for (let px = 0; px < size.width; px++) {
        assert.equal(result.labels[py * size.width + px], Number(px >= x && px < x + width && py >= y && py < y + height))
      }
    }
  }
})

test('rechaza ROI vacía, fuera de límites, fraccionaria o sin fondo', () => {
  const size = { width: 5, height: 4 }
  for (const roi of [
    { x: 0, y: 0, width: 0, height: 1 },
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 4, y: 0, width: 2, height: 1 },
    { x: 0, y: 3, width: 1, height: 2 },
    { x: 0.5, y: 0, width: 1, height: 1 },
    { x: NaN, y: 0, width: 1, height: 1 },
  ]) assert.throws(() => initializeLabels(size, roi), /ROI/)
  assert.throws(() => initializeLabels(size, { x: 0, y: 0, ...size }), /fondo/)
})

test('conserva una copia de ROI e inicializa arreglos independientes', () => {
  const size = { width: 3, height: 2 }
  const roi = { x: 0, y: 0, width: 1, height: 1 }
  const first = initializeLabels(size, roi)
  const second = initializeLabels(size, roi)
  roi.x = 1
  first.labels[0] = 0
  assert.equal(first.roi.x, 0)
  assert.equal(second.labels[0], 1)
})

test('la vista previa es opaca y binaria sin alterar las etiquetas numéricas', () => {
  const labels = Uint8Array.from([0, 1, 0, 1])
  const size = { width: 2, height: 2 }
  assert.deepEqual([...labelsToRgba(labels, size)], [0,0,0,255, 255,255,255,255, 0,0,0,255, 255,255,255,255])
  assert.deepEqual([...labels], [0, 1, 0, 1])
  assert.throws(() => labelsToRgba(Uint8Array.from([2]), { width: 1, height: 1 }), /etiquetas/)
  assert.throws(() => labelsToRgba(labels, { width: 3, height: 2 }), /dimensiones/)
})
