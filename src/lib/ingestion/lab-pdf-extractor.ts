import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export const MarkerSchema = z.object({
  name_en: z.string().min(1),
  name_original: z.string().nullable(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  reference_range_low: z.number().nullable(),
  reference_range_high: z.number().nullable(),
  is_out_of_range: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable(),
})

export const LabExtractionSchema = z.object({
  document_type: z.string(),
  panel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lab_name: z.string().nullable().optional(),
  markers: z.array(MarkerSchema),
})

export type LabExtraction = z.infer<typeof LabExtractionSchema>
export type LabMarker = z.infer<typeof MarkerSchema>

const SYSTEM_PROMPT = `You extract structured blood-panel data from PDFs or images of lab reports.

Rules:
1. Translate marker names, units, and notes from any language (especially Portuguese) to English. Preserve the original text in name_original.
2. Return ONLY JSON matching this exact shape:
{
  "document_type": "lab_report" | "other",
  "panel_date": "YYYY-MM-DD" | null,
  "lab_name": "string" | null,
  "markers": [
    { "name_en": "...", "name_original": "...", "value": number | null, "unit": "...", "reference_range_low": number | null, "reference_range_high": number | null, "is_out_of_range": true/false, "confidence": "high"|"medium"|"low", "notes": "..." | null }
  ]
}
3. Set document_type = "other" if the PDF is not a lab report.
4. Use confidence = "low" when marker name is ambiguous or value is hard to read.
5. is_out_of_range = value outside the reference range. If no range, use false.
6. No commentary outside the JSON.`

export interface ExtractArgs {
  base64: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'
  client?: Anthropic
}

export type ExtractResult =
  | { ok: true; data: LabExtraction }
  | { ok: false; error: string }

function tryParseJSON(raw: string): unknown | undefined {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch { /* fall through */ }
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1))
    } catch { /* fall through */ }
  }
  return undefined
}

export async function extractFromBase64(args: ExtractArgs): Promise<ExtractResult> {
  const client = args.client ?? new Anthropic()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: args.mimeType,
              data: args.base64,
            },
          } as never,
          { type: 'text', text: 'Extract the lab data per the schema.' },
        ],
      },
    ],
  })

  const textBlock = response.content.find(
    (b): b is Extract<(typeof response.content)[number], { type: 'text' }> =>
      b.type === 'text'
  )
  const text = textBlock?.text ?? ''
  const parsed = tryParseJSON(text)
  if (parsed === undefined) {
    console.error(
      '[lab-extractor] failed to parse Haiku output.',
      'stop_reason:', response.stop_reason,
      'text length:', text.length,
      '\nfirst 1000 chars:\n', text.slice(0, 1000),
      '\nlast 500 chars:\n', text.slice(-500),
    )
    if (response.stop_reason === 'max_tokens') {
      return { ok: false, error: 'Lab report too long — extractor ran out of tokens. Try a smaller PDF or contact support.' }
    }
    return { ok: false, error: 'Malformed JSON from extractor' }
  }

  const safe = LabExtractionSchema.safeParse(parsed)
  if (!safe.success) return { ok: false, error: safe.error.message }
  if (safe.data.document_type !== 'lab_report') {
    return { ok: false, error: 'This does not look like a lab report.' }
  }
  if (!safe.data.panel_date) {
    return { ok: false, error: 'Could not extract panel date.' }
  }
  return { ok: true, data: safe.data }
}
