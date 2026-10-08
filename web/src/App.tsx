import { useState } from 'react'
import { Box, Grommet, Heading } from 'grommet'
import type { ThemeType } from 'grommet'

import { CaseSelector } from './components/CaseSelector'
import { SegmentationWorkspace } from './components/SegmentationWorkspace'
import { cases } from './data/cases'
import { DEFAULT_COMPONENTS } from './core/gmm'
import { DEFAULT_ITERATIONS } from './browser/segmentationJob'

const theme: ThemeType = {
  global: {
    colors: {
      brand: '#22d3ee',
      focus: '#22d3ee',
      control: '#22d3ee',
      selected: '#22d3ee',
      background: '#f8fafc',
      text: '#0f172a',
    },
    active: { background: 'brand', color: 'text' },
    selected: { background: 'brand', color: 'text' },
    control: { border: { color: 'brand' } },
    focus: { border: { color: 'brand' } },
    font: {
      family: 'system-ui, sans-serif',
      size: '16px',
      height: '24px',
    },
  },
  select: { icons: { color: 'brand' } },
}

const caseOptions = cases.map((imageCase) => imageCase.id)

const initialCaseId =
  cases.find((imageCase) => imageCase.id === 'VS-SEG-001')?.id ??
  cases[0]?.id ??
  ''

export default function App() {
  const [caseId, setCaseId] = useState(initialCaseId)
  const [components, setComponents] = useState(DEFAULT_COMPONENTS)
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS)

  function selectCase(nextCaseId: string) {
    if (nextCaseId === caseId) return
    setCaseId(nextCaseId)
  }

  const selectedCase = cases.find((imageCase) => imageCase.id === caseId)

  if (!selectedCase) {
    return <p role="alert">No hay un caso disponible para mostrar.</p>
  }

  const imageUrl = `${import.meta.env.BASE_URL}${selectedCase.imagePath}`

  return (
    <Grommet theme={theme} full>
      <Box
        as="main"
        background="background"
        height={{ min: '100vh' }}
        pad="medium"
      >
        <Box
          width={{ max: '1100px' }}
          alignSelf="center"
          fill="horizontal"
          gap="medium"
        >
          <Box as="header" gap="small">
            <Heading level={1} margin="none">
              Laboratorio GrabCut
            </Heading>
          </Box>

          <Box
            as="section"
            background="white"
            round="small"
            border
            pad="medium"
            gap="medium"
          >
            <CaseSelector
              options={caseOptions}
              value={caseId}
              onChange={selectCase}
            />

            <SegmentationWorkspace
              key={caseId}
              src={imageUrl}
              annotationUrl={selectedCase.annotationPath ? `${import.meta.env.BASE_URL}${selectedCase.annotationPath}` : null}
              caseId={caseId}
              components={components}
              onComponentsChange={setComponents}
              iterations={iterations}
              onIterationsChange={setIterations}
            />
          </Box>
        </Box>
      </Box>
    </Grommet>
  )
}
