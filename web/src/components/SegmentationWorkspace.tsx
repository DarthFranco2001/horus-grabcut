import { useEffect, useRef, useState } from 'react'
import { Box, Button, RadioButtonGroup, Select, Text } from 'grommet'
import { RoiEditor } from './RoiEditor'
import { readGrayscaleImage, createMaskPreview } from '../browser/imageData'
import { initializeLabels } from '../core/initialization'
import type { InitialLabels } from '../core/initialization'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'
import { validateComponentCount } from '../core/gmm'
import type { AppearanceResult } from '../core/gmm'
import type { IterationResult } from '../core/grabcut'
import type { SegmentationRequest } from '../workers/segmentation.types'
import { MAX_ITERATIONS, startSegmentationJob } from '../browser/segmentationJob'

interface SegmentationWorkspaceProps {
  src: string
  caseId: string
  components: number
  onComponentsChange: (k: number) => void
  iterations: number
  onIterationsChange: (iterations: number) => void
}

interface Initialization {
  result: InitialLabels
  previewUrl: string
}

interface RunProgress {
  completed: number
  total: number
  status: 'running' | 'stopped' | 'complete' | 'failed'
}

const iterationOptions = Array.from({ length: MAX_ITERATIONS }, (_, i) => i + 1)
const componentOptions = Array.from({ length: 10 }, (_, i) => i + 1)

export function SegmentationWorkspace({ src, caseId, components, onComponentsChange, iterations, onIterationsChange }: SegmentationWorkspaceProps) {
  const [roi, setRoi] = useState<Roi | null>(null)
  const [image, setImage] = useState<GrayscaleImage | null>(null)
  const [initialization, setInitialization] = useState<Initialization | null>(null)
  const [view, setView] = useState<'image' | 'mask'>('image')
  const [error, setError] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<AppearanceResult | null>(null)
  const [segmentation, setSegmentation] = useState<(IterationResult & { previewUrl: string }) | null>(null)
  const [busy, setBusy] = useState<'initialize' | 'iterate' | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const jobRef = useRef<ReturnType<typeof startSegmentationJob> | null>(null)

  useEffect(() => () => {
    jobRef.current?.stop()
    jobRef.current = null
  }, [])

  function stopJob() {
    jobRef.current?.stop()
    jobRef.current = null
    setBusy(null)
  }

  function resetCalculation() {
    stopJob()
    setAppearance(null)
    setSegmentation(null)
    setProgress(null)
  }

  function changeComponents(k: number) {
    if (k === components) return
    resetCalculation()
    onComponentsChange(k)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function changeRoi(next: Roi | null) {
    if (roi?.x === next?.x && roi?.y === next?.y
      && roi?.width === next?.width && roi?.height === next?.height) return
    resetCalculation()
    setRoi(next)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function imageReady(element: HTMLImageElement) {
    resetCalculation()
    setInitialization(null)
    setView('image')
    setError(null)
    try {
      setImage(readGrayscaleImage(element))
    } catch (cause) {
      setImage(null)
      setError(cause instanceof Error ? cause.message : 'No se pudieron leer los píxeles.')
    }
  }

  function imageFailed() {
    resetCalculation()
    setImage(null)
    setRoi(null)
    setInitialization(null)
    setView('image')
    setError(null)
  }

  function stopExecution() {
    stopJob()
    setProgress((previous) => previous ? { ...previous, status: 'stopped' } : null)
  }

  function runWorker(request: SegmentationRequest, total = 1) {
    stopJob()
    setError(null)
    setBusy(request.action)
    setProgress(request.action === 'iterate' ? { completed: 0, total, status: 'running' } : null)
    try {
      jobRef.current = startSegmentationJob(
        () => new Worker(new URL('../workers/segmentation.worker.ts', import.meta.url), { type: 'module' }),
        request,
        total,
        {
          onResult(response, completed) {
            if (response.action === 'initialize') setAppearance(response.result)
            else if (request.action === 'iterate') {
              const result = response.result
              const previewUrl = createMaskPreview({ ...request.image, labels: result.labels })
              setSegmentation({ ...result, previewUrl })
              setAppearance(result.appearance)
              setProgress({ completed, total, status: 'running' })
              // Switch once; a user viewing the original can keep that view during later cuts.
              if (completed === 1) setView('mask')
            }
          },
          onComplete() {
            jobRef.current = null
            setBusy(null)
            setProgress((previous) => previous ? { ...previous, status: 'complete' } : null)
          },
          onError(message) {
            jobRef.current = null
            setBusy(null)
            setProgress((previous) => previous ? { ...previous, status: 'failed' } : null)
            setError(message)
          },
        },
      )
    } catch (cause) {
      stopJob()
      setProgress((previous) => previous ? { ...previous, status: 'failed' } : null)
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el cálculo.')
    }
  }

  function initialize() {
    if (!image || !roi || busy) return
    resetCalculation()
    try {
      const result = initializeLabels(image, roi)
      validateComponentCount(components, result.backgroundCount, result.foregroundCount)
      const previewUrl = createMaskPreview(result)
      setInitialization({ result, previewUrl })
      setView('mask')
      runWorker({ action: 'initialize', pixels: image.pixels, labels: result.labels, k: components })
    } catch (cause) {
      setInitialization(null)
      setView('image')
      setError(cause instanceof Error ? cause.message : 'No se pudo inicializar la máscara.')
    }
  }

  function iterate(total = 1) {
    if (!image || !roi || !initialization || !appearance || busy) return
    runWorker({
      action: 'iterate', image, roi, appearance,
      labels: segmentation?.labels ?? initialization.result.labels,
      completed: segmentation?.iteration ?? 0,
    }, total)
  }

  const coversImage = !!(image && roi && roi.width === image.width && roi.height === image.height)

  return (
    <Box gap="small">
      <Box direction="row" align="center" gap="small" wrap>
        <label htmlFor="gmm-components">Gaussianas por clase (K)</label>
        <Box width="xsmall">
          <Select
            id="gmm-components"
            options={componentOptions}
            value={components}
            onChange={({ option }: { option: unknown }) => {
              if (typeof option === 'number' && componentOptions.includes(option)) changeComponents(option)
            }}
          />
        </Box>
      </Box>
      <Box direction="row" align="center" gap="small" wrap>
        <label htmlFor="run-iterations">Máximo de iteraciones</label>
        <Box width="xsmall">
          <Select
            id="run-iterations"
            options={iterationOptions}
            value={iterations}
            disabled={busy !== null}
            onChange={({ option }: { option: unknown }) => {
              if (typeof option === 'number' && iterationOptions.includes(option)) onIterationsChange(option)
            }}
          />
        </Box>
        <Text size="small">Por ejecución; continúa desde la última máscara.</Text>
      </Box>
      <RoiEditor
        src={src}
        caseId={caseId}
        roi={roi}
        onChange={changeRoi}
        onImageReady={imageReady}
        onImageError={imageFailed}
        maskUrl={view === 'mask' ? (segmentation?.previewUrl ?? initialization?.previewUrl) : undefined}
        actions={(
          <>
            <Button
              label={busy === 'initialize' ? 'Inicializando…' : 'Inicializar'}
              primary
              disabled={!image || !roi || coversImage || busy !== null || appearance !== null}
              onClick={initialize}
            />
            <Button
              label="Ejecutar una iteración"
              disabled={!appearance || busy !== null}
              onClick={() => iterate()}
            />
            {busy === 'iterate' ? (
              <Button label="Detener" onClick={stopExecution} />
            ) : (
              <Button
                label="Ejecutar"
                primary={appearance !== null}
                disabled={!appearance || busy !== null}
                onClick={() => iterate(iterations)}
              />
            )}
            {initialization && (
              <RadioButtonGroup
                name="image-view"
                aria-label="Vista de la imagen"
                direction="row"
                gap="small"
                options={[
                  { label: 'Imagen', value: 'image' },
                  { label: segmentation ? 'Segmentación' : 'Máscara inicial', value: 'mask' },
                ]}
                value={view}
                onChange={(event) => setView(event.target.value === 'mask' ? 'mask' : 'image')}
              />
            )}
          </>
        )}
      />
      {busy === 'initialize' && <Text role="status" size="small">Preparando modelos de apariencia…</Text>}
      {progress && (
        <Text role="status" size="small">
          {progress.status === 'running' && `Iteración ${Math.min(progress.completed + 1, progress.total)} de ${progress.total}…`}
          {progress.status === 'complete' && `Ejecución completada: ${progress.completed} de ${progress.total} ${progress.total === 1 ? 'iteración' : 'iteraciones'}.`}
          {progress.status === 'stopped' && `Ejecución detenida: ${progress.completed} de ${progress.total} ${progress.total === 1 ? 'iteración completada' : 'iteraciones completadas'}. Se conserva la última máscara terminada.`}
          {progress.status === 'failed' && `Ejecución interrumpida: ${progress.completed} de ${progress.total} ${progress.total === 1 ? 'iteración completada' : 'iteraciones completadas'}. Se conserva la última máscara terminada.`}
        </Text>
      )}
      {appearance && !segmentation && !busy && <Text role="status" size="small">Modelos de apariencia preparados · K = {appearance.k}.</Text>}
      {error && <Text role="alert" color="status-critical">{error}</Text>}
      {segmentation && (
        <Box gap="xsmall">
          <Text role="status">
            Iteración {segmentation.iteration} · {segmentation.changed.toLocaleString('es-CR')} píxeles cambiaron
            {' · '}Objeto: {segmentation.foregroundCount.toLocaleString('es-CR')} píxeles.
          </Text>
          <Text size="small">Blanco = objeto; negro = fondo. El exterior de la ROI permanece como fondo.</Text>
          {segmentation.foregroundCount === 0 && <Text size="small">No quedó objeto en esta iteración. Prueba otra ROI o cambia K para reiniciar.</Text>}
          {segmentation.changed === 0 && <Text size="small">La máscara no cambió en esta iteración.</Text>}
        </Box>
      )}
      {initialization && !segmentation && (
        <Box gap="xsmall">
          <Text role="status">
            Región candidata: {initialization.result.foregroundCount.toLocaleString('es-CR')} píxeles
            {' · '}Fondo seguro: {initialization.result.backgroundCount.toLocaleString('es-CR')} píxeles
          </Text>
          <Text size="small">
            Máscara inicial: blanco = región candidata; negro = fondo seguro.
            La segmentación aún no se ha calculado.
          </Text>
        </Box>
      )}
    </Box>
  )
}
