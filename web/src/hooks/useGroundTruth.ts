import { useEffect, useState } from 'react'
import type { ImageSize } from '../core/roi'
import type { GroundTruth } from '../core/evaluation'
import { loadGroundTruth } from '../browser/groundTruth'

type ReferenceState =
  | { status: 'absent' | 'waiting' | 'loading' }
  | { status: 'ready'; data: GroundTruth }
  | { status: 'error'; message: string }

export function useGroundTruth(url: string | null, size: ImageSize | null) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<{ key: string; state: ReferenceState } | null>(null)
  const width = size?.width, height = size?.height
  const key = JSON.stringify([url, width, height, attempt])
  useEffect(() => {
    if (!url || !width || !height) return
    const controller = new AbortController()
    loadGroundTruth(url, { width, height }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ key, state: { status: 'ready', data } })
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) setSettled({ key, state: {
          status: 'error',
          message: cause instanceof Error ? cause.message : 'No se pudo leer la referencia.',
        } })
      },
    )
    return () => controller.abort()
  }, [url, width, height, key])

  const state: ReferenceState = !url ? { status: 'absent' }
    : !size ? { status: 'waiting' }
      : settled?.key === key ? settled.state : { status: 'loading' }
  return { state, retry: () => setAttempt((previous) => previous + 1) }
}
