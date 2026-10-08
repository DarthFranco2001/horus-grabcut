import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRoi, imagePoint, moveRoi, resizeRoi } from '../src/core/roi.ts'

const size = { width: 448, height: 448 }

test('normaliza las cuatro direcciones de arrastre', () => {
  for (const [start, end] of [
    [{ x: 100, y: 80 }, { x: 200, y: 180 }],
    [{ x: 200, y: 180 }, { x: 100, y: 80 }],
    [{ x: 100, y: 180 }, { x: 200, y: 80 }],
    [{ x: 200, y: 80 }, { x: 100, y: 180 }],
  ]) assert.deepEqual(createRoi(start, end, size), { x: 100, y: 80, width: 100, height: 100 })
})

test('limita al borde exclusivo de la imagen y redondea a píxeles', () => {
  assert.deepEqual(createRoi({ x: -30, y: 20.6 }, { x: 900, y: 500 }, size),
    { x: 0, y: 21, width: 448, height: 427 })
})

test('rechaza clics, líneas y entradas inválidas', () => {
  assert.equal(createRoi({ x: 10, y: 10 }, { x: 10, y: 30 }, size), null)
  assert.equal(createRoi({ x: 10, y: 10 }, { x: 30, y: 10 }, size), null)
  assert.equal(createRoi({ x: 10, y: 10 }, { x: 10, y: 10 }, size), null)
  assert.equal(createRoi({ x: NaN, y: 0 }, { x: 30, y: 30 }, size), null)
})

test('convierte coordenadas de un visor reducido y desplazado', () => {
  assert.deepEqual(imagePoint({ x: 150, y: 90 },
    { left: 100, top: 40, width: 224, height: 224 }, size), { x: 100, y: 100 })
  assert.equal(imagePoint({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, size), null)
})

test('mueve sin cambiar el tamaño y limita ambos extremos', () => {
  const roi = { x: 100, y: 80, width: 100, height: 120 }
  assert.deepEqual(moveRoi(roi, { x: -500, y: 500 }, size), { x: 0, y: 328, width: 100, height: 120 })
  assert.deepEqual(moveRoi(roi, { x: 500, y: -500 }, size), { x: 348, y: 0, width: 100, height: 120 })
})

test('redimensiona manteniendo la esquina opuesta', () => {
  const roi = { x: 100, y: 80, width: 100, height: 120 }
  assert.deepEqual(resizeRoi(roi, 'nw', { x: 50, y: 40 }, size), { x: 50, y: 40, width: 150, height: 160 })
  assert.deepEqual(resizeRoi(roi, 'ne', { x: 300, y: 40 }, size), { x: 100, y: 40, width: 200, height: 160 })
  assert.deepEqual(resizeRoi(roi, 'sw', { x: 50, y: 300 }, size), { x: 50, y: 80, width: 150, height: 220 })
  assert.deepEqual(resizeRoi(roi, 'se', { x: 300, y: 300 }, size), { x: 100, y: 80, width: 200, height: 220 })
})

test('permite cruzar la esquina opuesta sin producir dimensiones negativas', () => {
  assert.deepEqual(resizeRoi({ x: 100, y: 80, width: 100, height: 120 }, 'nw', { x: 230, y: 240 }, size),
    { x: 200, y: 200, width: 30, height: 40 })
})
