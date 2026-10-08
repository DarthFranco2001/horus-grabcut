import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cutoutToRgba } from '../src/core/cutout.ts'

test('el recorte conserva todas las intensidades, incluido negro opaco, sin cambiar la entrada', () => {
  const pixels = Uint8Array.from({ length: 256 }, (_, i) => i)
  const labels = new Uint8Array(256).fill(1)
  const rgba = cutoutToRgba({ width: 16, height: 16, pixels }, labels)
  assert.equal(rgba.length, 1024)
  for (let i = 0; i < 256; i++) {
    assert.deepEqual([...rgba.slice(i * 4, i * 4 + 4)], [i, i, i, 255])
  }
  rgba.fill(0)
  assert.deepEqual(pixels, Uint8Array.from({ length: 256 }, (_, i) => i))
  assert.ok(labels.every(value => value === 1))
})

test('el fondo y los huecos son transparentes sin desplazar el objeto', () => {
  const image = { width: 3, height: 2, pixels: Uint8Array.of(255, 30, 40, 50, 60, 70) }
  const labels = Uint8Array.of(0, 1, 0, 1, 0, 1)
  assert.deepEqual([...cutoutToRgba(image, labels)], [
    0,0,0,0, 30,30,30,255, 0,0,0,0,
    50,50,50,255, 0,0,0,0, 70,70,70,255,
  ])
  assert.deepEqual([...labels], [0,1,0,1,0,1])
  assert.ok(cutoutToRgba(image, new Uint8Array(6)).every(value => value === 0))
})

test('rechaza máscaras incompatibles y etiquetas no binarias', () => {
  const image = { width: 2, height: 1, pixels: Uint8Array.of(50, 100) }
  assert.throws(() => cutoutToRgba(image, Uint8Array.of(1)), /dimensiones/)
  assert.throws(() => cutoutToRgba({ ...image, pixels: Uint8Array.of(50) }, Uint8Array.of(0, 1)), /dimensiones/)
  assert.throws(() => cutoutToRgba(image, Uint8Array.of(0, 2)), /etiquetas/)
})
