import type { GrayscaleImage } from './image'
import type { Roi } from './roi'
import type { AppearanceResult } from './gmm'
import { refineAppearance } from './gmm.ts'
import { buildSpatialTerms } from './spatial.ts'
import { cutEnergy, minimumCut } from './mincut.ts'

export interface IterationResult {
  labels: Uint8Array
  appearance: AppearanceResult
  iteration: number
  changed: number
  foregroundCount: number
  energyBefore: number
  energyAfter: number
  beta: number
  gamma: number
}

export function iterateGrabcut(image: GrayscaleImage, roi: Roi, previous: Uint8Array, prepared: AppearanceResult, completed: number): IterationResult {
  if (!Number.isSafeInteger(completed) || completed < 0) throw new Error('El número de iteraciones no es válido.')
  const spatial = buildSpatialTerms(image, roi)
  if (previous.length !== image.pixels.length) throw new Error('Debe haber una etiqueta por píxel.')
  for (let i = 0; i < previous.length; i++) {
    const x = i % image.width, y = Math.floor(i / image.width)
    const inside = x >= roi.x && x < roi.x + roi.width && y >= roi.y && y < roi.y + roi.height
    if (previous[i] > 1 || (!inside && previous[i] !== 0)) throw new Error('Las etiquetas deben ser binarias y el exterior debe ser fondo.')
  }
  // Initialization already performed the first hard assignment/refit. Do not apply it twice.
  const appearance = completed === 0 ? prepared : refineAppearance(image.pixels, previous, prepared)
  if (appearance.backgroundCosts.length !== previous.length || appearance.foregroundCosts.length !== previous.length) {
    throw new Error('Los costos no coinciden con los píxeles.')
  }
  const background = new Float64Array(spatial.pixelIds.length)
  const foreground = new Float64Array(spatial.pixelIds.length)
  const before = new Uint8Array(spatial.pixelIds.length)
  for (let i = 0; i < spatial.pixelIds.length; i++) {
    const pixel = spatial.pixelIds[i]
    background[i] = appearance.backgroundCosts[pixel]
    foreground[i] = appearance.foregroundCosts[pixel] + spatial.boundary[i]
    before[i] = previous[pixel]
  }
  const cut = minimumCut(background, foreground, spatial.edges)
  const labels = new Uint8Array(previous.length)
  let changed = 0
  let foregroundCount = 0
  for (let i = 0; i < spatial.pixelIds.length; i++) {
    labels[spatial.pixelIds[i]] = cut.labels[i]
    foregroundCount += cut.labels[i]
    changed += Number(cut.labels[i] !== before[i])
  }
  return {
    labels, appearance, iteration: completed + 1, changed, foregroundCount,
    energyBefore: cutEnergy(before, background, foreground, spatial.edges),
    energyAfter: cut.energy, beta: spatial.beta, gamma: spatial.gamma,
  }
}
