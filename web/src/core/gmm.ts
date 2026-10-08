export const DEFAULT_COMPONENTS = 5
export const VARIANCE_REGULARIZATION = 1e-6

type Samples = Uint8Array | Float64Array

export interface Gmm {
  weights: Float64Array
  means: Float64Array
  variances: Float64Array
}

export interface AppearanceModels {
  background: Gmm
  foreground: Gmm
}

export interface AppearanceResult {
  k: number
  initialModels: AppearanceModels
  models: AppearanceModels
  backgroundCosts: Float64Array
  foregroundCosts: Float64Array
}

function validateSamples(samples: Samples) {
  for (const value of samples) {
    if (!Number.isFinite(value) || value < 0 || value > 255) {
      throw new Error('Las intensidades deben ser valores finitos entre 0 y 255.')
    }
  }
}

function validateModel(model: Gmm): number {
  const k = model.weights.length
  if (!k || model.means.length !== k || model.variances.length !== k) {
    throw new Error('Los parámetros del GMM deben tener la misma longitud positiva.')
  }
  let total = 0
  for (let i = 0; i < k; i++) {
    if (!Number.isFinite(model.weights[i]) || model.weights[i] < 0
      || !Number.isFinite(model.means[i]) || !Number.isFinite(model.variances[i])
      || model.variances[i] <= 0) throw new Error('Los parámetros del GMM no son válidos.')
    total += model.weights[i]
  }
  if (Math.abs(total - 1) > 1e-10) throw new Error('Los pesos del GMM deben sumar uno.')
  return k
}

export function validateComponentCount(k: number, backgroundCount: number, foregroundCount: number) {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error('K debe ser un entero positivo.')
  if (backgroundCount < k || foregroundCount < k) {
    throw new Error(`K = ${k} requiere al menos ${k} píxeles en el fondo y en la región candidata. Amplía la ROI o reduce K; deja también suficiente fondo fuera.`)
  }
}

export function initializeGmm(samples: Samples, k = DEFAULT_COMPONENTS): Gmm {
  if (!Number.isSafeInteger(k) || k < 1 || samples.length < k) {
    throw new Error('La inicialización requiere K entero positivo y al menos K muestras.')
  }
  validateSamples(samples)
  const sorted = samples.slice().sort()
  const weights = new Float64Array(k)
  const means = new Float64Array(k)
  const variances = new Float64Array(k)
  const groupSize = Math.floor(sorted.length / k)
  const remainder = sorted.length % k
  let start = 0
  for (let component = 0; component < k; component++) {
    // np.array_split puts one extra sample in each of the first remainder groups.
    const count = groupSize + Number(component < remainder)
    const end = start + count
    let sum = 0
    for (let i = start; i < end; i++) sum += sorted[i]
    const mean = sum / count
    let squared = 0
    for (let i = start; i < end; i++) squared += (sorted[i] - mean) ** 2
    weights[component] = count / sorted.length
    means[component] = mean
    variances[component] = squared / count + VARIANCE_REGULARIZATION
    start = end
  }
  return { weights, means, variances }
}

function costTerms(model: Gmm): Float64Array {
  validateModel(model)
  return model.weights.map((weight, i) => weight === 0
    ? Infinity
    : -Math.log(weight) + 0.5 * Math.log(2 * Math.PI * model.variances[i]))
}

function costAt(value: number, component: number, model: Gmm, terms: Float64Array): number {
  return terms[component] + 0.5 * (value - model.means[component]) ** 2 / model.variances[component]
}

export function componentCosts(value: number, model: Gmm): Float64Array {
  validateSamples(Float64Array.of(value))
  const terms = costTerms(model)
  return terms.map((_, component) => costAt(value, component, model, terms))
}

export function assignComponents(samples: Samples, model: Gmm): Uint32Array {
  validateSamples(samples)
  const terms = costTerms(model)
  const assignments = new Uint32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    let best = 0
    let bestCost = Infinity
    for (let component = 0; component < terms.length; component++) {
      const cost = costAt(samples[i], component, model, terms)
      // A strict comparison preserves NumPy argmin's first-component tie rule.
      if (cost < bestCost) { best = component; bestCost = cost }
    }
    assignments[i] = best
  }
  return assignments
}

export function updateGmm(samples: Samples, assignments: Uint32Array, previous: Gmm): Gmm {
  const k = validateModel(previous)
  validateSamples(samples)
  if (assignments.length !== samples.length) throw new Error('Debe haber una asignación por muestra.')
  const means = previous.means.slice()
  const variances = previous.variances.slice()
  if (samples.length === 0) return { weights: previous.weights.slice(), means, variances }

  const counts = new Float64Array(k)
  const sums = new Float64Array(k)
  const squared = new Float64Array(k)
  for (let i = 0; i < samples.length; i++) {
    const component = assignments[i]
    if (component >= k) throw new Error('La asignación apunta a un componente inexistente.')
    counts[component]++
    sums[component] += samples[i]
  }
  for (let component = 0; component < k; component++) {
    if (counts[component]) means[component] = sums[component] / counts[component]
  }
  for (let i = 0; i < samples.length; i++) {
    const component = assignments[i]
    squared[component] += (samples[i] - means[component]) ** 2
  }
  for (let component = 0; component < k; component++) {
    if (counts[component]) variances[component] = squared[component] / counts[component] + VARIANCE_REGULARIZATION
  }
  // Empty components retain their mean/variance and receive weight zero.
  return { weights: counts.map((count) => count / samples.length), means, variances }
}

export function gmmCosts(samples: Samples, model: Gmm): Float64Array {
  validateSamples(samples)
  const terms = costTerms(model)
  const costs = new Float64Array(samples.length)
  const components = new Float64Array(terms.length)
  for (let i = 0; i < samples.length; i++) {
    let minimum = Infinity
    for (let component = 0; component < terms.length; component++) {
      const cost = costAt(samples[i], component, model, terms)
      components[component] = cost
      minimum = Math.min(minimum, cost)
    }
    if (minimum === Infinity) { costs[i] = Infinity; continue }
    let sum = 0
    for (const cost of components) sum += Math.exp(minimum - cost)
    // Stable negative log-sum-exp; narrow densities can legitimately give negative costs.
    costs[i] = minimum - Math.log(sum)
  }
  return costs
}

export function splitSamples(pixels: Uint8Array, labels: Uint8Array) {
  if (!pixels.length || pixels.length !== labels.length) throw new Error('Debe haber una etiqueta por píxel.')
  let foregroundCount = 0
  for (const label of labels) {
    if (label !== 0 && label !== 1) throw new Error('Las etiquetas deben ser 0 o 1.')
    foregroundCount += label
  }
  const background = new Uint8Array(pixels.length - foregroundCount)
  const foreground = new Uint8Array(foregroundCount)
  let bg = 0
  let fg = 0
  for (let i = 0; i < pixels.length; i++) {
    if (labels[i]) foreground[fg++] = pixels[i]
    else background[bg++] = pixels[i]
  }
  return { background, foreground }
}

export function prepareAppearance(pixels: Uint8Array, labels: Uint8Array, k = DEFAULT_COMPONENTS): AppearanceResult {
  const samples = splitSamples(pixels, labels)
  validateComponentCount(k, samples.background.length, samples.foreground.length)
  const initialModels = {
    background: initializeGmm(samples.background, k),
    foreground: initializeGmm(samples.foreground, k),
  }
  const models = {
    background: updateGmm(samples.background, assignComponents(samples.background, initialModels.background), initialModels.background),
    foreground: updateGmm(samples.foreground, assignComponents(samples.foreground, initialModels.foreground), initialModels.foreground),
  }
  // There are only 256 possible intensities. Evaluate once per intensity, then map each pixel.
  const intensities = Uint8Array.from({ length: 256 }, (_, i) => i)
  const bgLookup = gmmCosts(intensities, models.background)
  const fgLookup = gmmCosts(intensities, models.foreground)
  const backgroundCosts = new Float64Array(pixels.length)
  const foregroundCosts = new Float64Array(pixels.length)
  for (let i = 0; i < pixels.length; i++) {
    backgroundCosts[i] = bgLookup[pixels[i]]
    foregroundCosts[i] = fgLookup[pixels[i]]
  }
  return { k, initialModels, models, backgroundCosts, foregroundCosts }
}
