import type { GrayscaleImage } from './image'
import type { Roi } from './roi'
import { initializeLabels } from './initialization.ts'
import type { WeightedEdges } from './mincut'

// The notebook selects 10 after comparing gamma values. Keep the same baseline.
export const DEFAULT_GAMMA = 10

export function buildSpatialTerms(image: GrayscaleImage, roi: Roi, gamma = DEFAULT_GAMMA) {
  const initial = initializeLabels(image, roi)
  const { width, height, pixels } = image
  if (pixels.length !== initial.labels.length) throw new Error('Los píxeles no coinciden con las dimensiones.')
  if (!Number.isFinite(gamma) || gamma < 0) throw new Error('Gamma debe ser finito y no negativo.')
  const directions = [[1, 0, 1], [0, 1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2]]
  let squaredSum = 0
  let pairs = 0

  function visitPairs(visit: (i: number, j: number, distance: number) => void) {
    for (const [dx, dy, distance] of directions) {
      for (let y = 0; y < height - dy; y++) {
        for (let x = Math.max(0, -dx); x < width - Math.max(0, dx); x++) {
          const i = y * width + x
          visit(i, i + dy * width + dx, distance)
        }
      }
    }
  }
  // Beta uses the whole image, including the fixed background, exactly as in the notebook.
  visitPairs((i, j) => { squaredSum += (pixels[i] - pixels[j]) ** 2; pairs++ })
  const beta = squaredSum > 0 ? pairs / (2 * squaredSum) : 0
  const ids = new Int32Array(pixels.length).fill(-1)
  const pixelIds = new Int32Array(initial.foregroundCount)
  let local = 0
  for (let i = 0; i < pixels.length; i++) if (initial.labels[i]) { ids[i] = local; pixelIds[local++] = i }
  const count = (roi.width - 1) * roi.height + roi.width * (roi.height - 1) + 2 * (roi.width - 1) * (roi.height - 1)
  const edges: WeightedEdges = { from: new Int32Array(count), to: new Int32Array(count), weights: new Float64Array(count) }
  const boundary = new Float64Array(local)
  let edge = 0
  visitPairs((i, j, distance) => {
    const a = ids[i], b = ids[j]
    if (a < 0 && b < 0) return
    const weight = gamma * Math.exp(-beta * (pixels[i] - pixels[j]) ** 2) / distance
    if (a >= 0 && b >= 0) {
      edges.from[edge] = a; edges.to[edge] = b; edges.weights[edge++] = weight
    } else {
      // The outside endpoint is fixed BG, so crossing the ROI penalizes the inside FG label.
      boundary[a >= 0 ? a : b] += weight
    }
  })
  return { beta, gamma, edges, boundary, pixelIds }
}
