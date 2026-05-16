// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { EnergyClass } from '@/lib/property-ai/types'

interface DocumentExtractionResult {
  energy_class?: EnergyClass
  area_sqm?: number
  license_number?: string
  legal_description?: string
  missing_docs: string[]
  extraction_confidence: number
  detected_doc_type: 'energy_certificate' | 'floorplan' | 'legal_doc' | 'property_register' | 'unknown'
}

const ENERGY_CLASS_VALUES: EnergyClass[] = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F']

function normalizeEnergyClass(raw: string | undefined): EnergyClass | undefined {
  if (!raw) return undefined
  const normalized = raw.trim().toUpperCase()
  if (ENERGY_CLASS_VALUES.includes(normalized as EnergyClass)) return normalized as EnergyClass
  // Handle common OCR artifacts like "B minus" -> "B-"
  if (normalized === 'B MINUS' || normalized === 'B-MINUS') return 'B-'
  if (normalized === 'A PLUS' || normalized === 'A+PLUS') return 'A+'
  return undefined
}

function detectMissingDocs(
  docType: DocumentExtractionResult['detected_doc_type'],
  result: Partial<DocumentExtractionResult>
): string[] {
  const missing: string[] = []
  if (!result.energy_class) missing.push('energy_certificate')
  if (!result.license_number) missing.push('habitation_license')
  if (!result.area_sqm) missing.push('floorplan')
  if (docType === 'unknown') missing.push('property_register')
  return missing
}

const EXTRACTION_PROMPT = `Analyze this real estate document (PDF, energy certificate, floorplan, or legal document) and return a JSON object with EXACTLY these fields:
{
  "energy_class": "A+|A|B|B-|C|D|E|F|null",
  "area_sqm": number or null,
  "license_number": "string or null",
  "legal_description": "brief legal description or null",
  "detected_doc_type": "energy_certificate|floorplan|legal_doc|property_register|unknown",
  "extraction_confidence": 0.0-1.0
}
Return only the JSON object, no additional text.`

async function callClaudeVisionForDoc(documentUrl: string, prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: documentUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })
  const data = (await resp.json()) as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

class OcrDocumentIntelligence {
  async extractFromDocument(
    documentUrl: string,
    submissionId: string
  ): Promise<DocumentExtractionResult> {
    try {
      const raw = await callClaudeVisionForDoc(documentUrl, EXTRACTION_PROMPT)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn('[OcrDocumentIntelligence] no JSON in response', { submissionId, documentUrl })
        return this.defaultResult()
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        energy_class?: string
        area_sqm?: number | null
        license_number?: string | null
        legal_description?: string | null
        detected_doc_type?: string
        extraction_confidence?: number
      }

      const docType = this.normalizeDocType(parsed.detected_doc_type)

      if (docType === 'unknown') {
        logger.warn('[OcrDocumentIntelligence] unknown document type', { submissionId, documentUrl })
      }

      const partial: Partial<DocumentExtractionResult> = {
        energy_class: normalizeEnergyClass(parsed.energy_class ?? undefined),
        area_sqm: typeof parsed.area_sqm === 'number' ? parsed.area_sqm : undefined,
        license_number: parsed.license_number ?? undefined,
        legal_description: parsed.legal_description ?? undefined,
        detected_doc_type: docType,
        extraction_confidence: typeof parsed.extraction_confidence === 'number'
          ? parsed.extraction_confidence
          : 0.5,
      }

      const missing_docs = detectMissingDocs(docType, partial)

      const result: DocumentExtractionResult = {
        energy_class: partial.energy_class,
        area_sqm: partial.area_sqm,
        license_number: partial.license_number,
        legal_description: partial.legal_description,
        detected_doc_type: docType,
        extraction_confidence: partial.extraction_confidence ?? 0.5,
        missing_docs,
      }

      logger.info('[OcrDocumentIntelligence] extracted', {
        submissionId,
        docType,
        confidence: result.extraction_confidence,
        missingCount: missing_docs.length,
      })

      return result
    } catch (err) {
      logger.error('[OcrDocumentIntelligence] extraction failed', { submissionId, documentUrl, err })
      return this.defaultResult()
    }
  }

  private normalizeDocType(
    raw: string | undefined
  ): DocumentExtractionResult['detected_doc_type'] {
    const valid: DocumentExtractionResult['detected_doc_type'][] = [
      'energy_certificate',
      'floorplan',
      'legal_doc',
      'property_register',
      'unknown',
    ]
    if (raw && valid.includes(raw as DocumentExtractionResult['detected_doc_type'])) {
      return raw as DocumentExtractionResult['detected_doc_type']
    }
    return 'unknown'
  }

  private defaultResult(): DocumentExtractionResult {
    return {
      energy_class: undefined,
      area_sqm: undefined,
      license_number: undefined,
      legal_description: undefined,
      missing_docs: ['energy_certificate', 'habitation_license', 'floorplan', 'property_register'],
      extraction_confidence: 0.3,
      detected_doc_type: 'unknown',
    }
  }
}

export const ocrDocumentIntelligence = new OcrDocumentIntelligence()
