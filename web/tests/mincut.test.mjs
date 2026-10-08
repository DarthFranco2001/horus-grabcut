import assert from 'node:assert/strict'
import { test } from 'node:test'
import { minimumCut, cutEnergy } from '../src/core/mincut.ts'
import { buildSpatialTerms } from '../src/core/spatial.ts'

const edgesOf = (from = [], to = [], weights = []) => ({ from: Int32Array.from(from), to: Int32Array.from(to), weights: Float64Array.from(weights) })
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-8 + 1e-10 * Math.abs(b), `${a} != ${b}`)

test('orientación de terminales, costos negativos y ejemplo del cuaderno', () => {
  assert.deepEqual([...minimumCut(Float64Array.of(-3, 2), Float64Array.of(1, -1), edgesOf()).labels], [0, 1])
  const result = minimumCut(Float64Array.of(0, 2, 5), Float64Array.of(4, 1, 0), edgesOf([0, 1], [1, 2], [1.5, 1.5]))
  assert.deepEqual([...result.labels], [0, 1, 1])
  close(result.energy, 2.5)
  assert.deepEqual([...minimumCut(Float64Array.of(0, 0), Float64Array.of(0, 0), edgesOf([0], [1], [0])).labels], [0, 0])
})

test('corte global mínimo verificado por enumeración exhaustiva de 120 grafos pequeños', () => {
  let seed = 72
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let trial = 0; trial < 120; trial++) {
    const n = 1 + trial % 8
    const bg = Float64Array.from({ length: n }, () => Math.round(random() * 40 - 20) / 4)
    const fg = Float64Array.from({ length: n }, () => Math.round(random() * 40 - 20) / 4)
    const from = [], to = [], weights = []
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (random() < 0.4) {
      from.push(i); to.push(j); weights.push(Math.round(random() * 12) / 4)
    }
    const edges = edgesOf(from, to, weights)
    let optimum = Infinity
    for (let mask = 0; mask < 2 ** n; mask++) {
      const labels = Uint8Array.from({ length: n }, (_, i) => (mask >> i) & 1)
      optimum = Math.min(optimum, cutEnergy(labels, bg, fg, edges))
    }
    const result = minimumCut(bg, fg, edges)
    close(result.energy, optimum)
    close(cutEnergy(result.labels, bg, fg, edges), optimum)
  }
})

test('una cadena larga no depende de la profundidad de recursión', () => {
  const n = 20000
  const bg = new Float64Array(n), fg = new Float64Array(n)
  bg[0] = 3; fg[n - 1] = 3
  const edges = edgesOf(Array.from({ length: n - 1 }, (_, i) => i), Array.from({ length: n - 1 }, (_, i) => i + 1), Array(n - 1).fill(1))
  close(minimumCut(bg, fg, edges).energy, 1)
})

test('ocho vecinos, diagonales únicas, beta global y frontera segura', () => {
  const image = { width: 3, height: 3, pixels: new Uint8Array(9).fill(42) }
  const center = buildSpatialTerms(image, { x: 1, y: 1, width: 1, height: 1 })
  close(center.beta, 0)
  assert.equal(center.edges.weights.length, 0)
  close(center.boundary[0], 4 * 10 + 4 * 10 / Math.SQRT2)
  const corner = buildSpatialTerms(image, { x: 0, y: 0, width: 2, height: 2 })
  assert.equal(corner.edges.weights.length, 6)
  assert.equal(new Set([...corner.edges.from].map((i, e) => [i, corner.edges.to[e]].sort().join(','))).size, 6)
  close(corner.boundary[0], 0)
  const varied = buildSpatialTerms({ width: 3, height: 1, pixels: Uint8Array.of(0, 10, 30) }, { x: 0, y: 0, width: 1, height: 1 })
  close(varied.beta, 1 / 500)
  close(varied.boundary[0], 10 * Math.exp(-0.2))
})

test('rechaza costos y enlaces no válidos', () => {
  const valid = Float64Array.of(1, 2)
  assert.throws(() => minimumCut(valid, Float64Array.of(1), edgesOf()))
  assert.throws(() => minimumCut(valid, Float64Array.of(Infinity, 0), edgesOf()))
  for (const edges of [edgesOf([0], [2], [1]), edgesOf([0], [0], [1]), edgesOf([0], [1], [-1]), edgesOf([0], [1], [NaN]), edgesOf([0], [], [1])]) {
    assert.throws(() => minimumCut(valid, valid, edges))
  }
})
