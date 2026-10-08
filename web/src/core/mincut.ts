export interface WeightedEdges {
  from: Int32Array
  to: Int32Array
  weights: Float64Array
}

const TOLERANCE = 1e-10

// Dinic with an explicit path stack: large ROIs must not depend on JS recursion limits.
export function minimumCut(background: Float64Array, foreground: Float64Array, edges: WeightedEdges) {
  const count = background.length
  if (!count || foreground.length !== count) throw new Error('Debe haber dos costos por nodo.')
  if (edges.from.length !== edges.to.length || edges.from.length !== edges.weights.length) {
    throw new Error('Los enlaces y sus pesos deben tener la misma longitud.')
  }
  const source = count
  const sink = count + 1
  const nodes = count + 2
  const arcs = 4 * count + 2 * edges.weights.length
  const head = new Int32Array(nodes).fill(-1)
  const next = new Int32Array(arcs)
  const target = new Int32Array(arcs)
  const capacity = new Float64Array(arcs)
  let used = 0
  let offset = 0

  function addEdge(u: number, v: number, forward: number, reverse = 0) {
    target[used] = v; capacity[used] = forward; next[used] = head[u]; head[u] = used++
    target[used] = u; capacity[used] = reverse; next[used] = head[v]; head[v] = used++
  }

  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(background[i]) || !Number.isFinite(foreground[i])) {
      throw new Error('Los costos del grafo deben ser finitos.')
    }
    // Removing the same constant from both labels preserves the minimizer, even for negative costs.
    const minimum = Math.min(background[i], foreground[i])
    offset += minimum
    addEdge(source, i, background[i] - minimum)
    addEdge(i, sink, foreground[i] - minimum)
  }
  for (let e = 0; e < edges.weights.length; e++) {
    const u = edges.from[e], v = edges.to[e], weight = edges.weights[e]
    if (u < 0 || v < 0 || u >= count || v >= count || u === v || !Number.isFinite(weight) || weight < 0) {
      throw new Error('El enlace o su capacidad no son válidos.')
    }
    addEdge(u, v, weight, weight)
  }

  const levels = new Int32Array(nodes)
  const queue = new Int32Array(nodes)
  const current = new Int32Array(nodes)
  const path = new Int32Array(nodes)
  const available = new Float64Array(nodes)
  let flow = 0
  while (true) {
    levels.fill(-1)
    levels[source] = 0
    queue[0] = source
    let end = 1
    for (let start = 0; start < end; start++) {
      const u = queue[start]
      for (let e = head[u]; e !== -1; e = next[e]) {
        const v = target[e]
        if (capacity[e] > TOLERANCE && levels[v] < 0) {
          levels[v] = levels[u] + 1
          queue[end++] = v
        }
      }
    }
    if (levels[sink] < 0) break
    current.set(head)
    while (true) {
      let depth = 0
      let u = source
      available[0] = Infinity
      while (u !== sink) {
        let e = current[u]
        while (e !== -1 && (capacity[e] <= TOLERANCE || levels[target[e]] !== levels[u] + 1)) e = next[e]
        current[u] = e
        if (e === -1) {
          if (depth === 0) break
          const incoming = path[--depth]
          u = target[incoming ^ 1]
          current[u] = next[incoming]
        } else {
          path[depth] = e
          available[depth + 1] = Math.min(available[depth], capacity[e])
          depth++
          u = target[e]
        }
      }
      if (u !== sink) break
      const sent = available[depth]
      for (let i = 0; i < depth; i++) {
        capacity[path[i]] -= sent
        capacity[path[i] ^ 1] += sent
      }
      flow += sent
    }
  }
  // Source side is foreground; the final BFS also gives the canonical minimum source set.
  const labels = Uint8Array.from({ length: count }, (_, i) => Number(levels[i] >= 0))
  return { labels, flow, offset, energy: flow + offset }
}

export function cutEnergy(labels: Uint8Array, background: Float64Array, foreground: Float64Array, edges: WeightedEdges) {
  let energy = 0
  for (let i = 0; i < labels.length; i++) energy += labels[i] ? foreground[i] : background[i]
  for (let e = 0; e < edges.weights.length; e++) {
    if (labels[edges.from[e]] !== labels[edges.to[e]]) energy += edges.weights[e]
  }
  return energy
}
