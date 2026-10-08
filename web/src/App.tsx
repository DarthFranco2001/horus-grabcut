import { useState } from 'react'
import { Box, Grommet, Heading, Paragraph, Text } from 'grommet'
import type { ThemeType } from 'grommet'

import { CaseSelector } from './components/CaseSelector'
import { SegmentationWorkspace } from './components/SegmentationWorkspace'
import { cases } from './data/cases'

const theme: ThemeType = {
  global: {
    colors: {
      brand: '#2563eb',
      background: '#f8fafc',
      text: '#0f172a',
    },
    font: {
      family: 'system-ui, sans-serif',
      size: '16px',
      height: '24px',
    },
  },
}

const caseOptions = cases.map((imageCase) => imageCase.id)

const initialCaseId =
  cases.find((imageCase) => imageCase.id === 'VS-SEG-018')?.id ??
  cases[0]?.id ??
  ''

export default function App() {
  const [caseId, setCaseId] = useState(initialCaseId)

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

            <Paragraph margin="none" fill>
              Explora la segmentación de imágenes paso a paso.
            </Paragraph>
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

            <Heading level={2} margin="none">
              Caso {caseId}
            </Heading>

            <Text>
              {cases.length} casos disponibles ·{' '}
              {selectedCase.annotationPath
                ? 'Anotación de referencia disponible'
                : 'Sin anotación de referencia'}
            </Text>

            <SegmentationWorkspace
              key={caseId}
              src={imageUrl}
              caseId={caseId}
            />
          </Box>
        </Box>
      </Box>
    </Grommet>
  )
}
