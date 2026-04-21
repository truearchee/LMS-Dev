import { parseVtt } from './vttParser.js'
import { cleanTranscriptText, looksLikeVtt } from './textCleaner.js'

export type TranscriptSource = 'ZOOM' | 'MANUAL' | 'UPLOAD'

const MIN_PROCESSED_LENGTH = 100

/**
 * Process raw transcript content into clean text for AI summarization.
 *
 * Processing rules:
 * - source 'ZOOM': VTT parse → text clean
 * - source 'MANUAL' or 'UPLOAD': text clean only
 *   UNLESS content looks like VTT (safety net for misclassified uploads)
 *
 * Never throws — on any error, returns the original rawContent unchanged.
 * This ensures processedContent always has usable text.
 */
export function processTranscript(
  rawContent: string,
  source: TranscriptSource
): string {
  if (!rawContent || !rawContent.trim()) return rawContent

  try {
    let text = rawContent

    const needsVttParsing = source === 'ZOOM' || looksLikeVtt(rawContent)

    if (needsVttParsing) {
      text = parseVtt(rawContent)
    }

    text = cleanTranscriptText(text)

    // Safety net: if processing dramatically reduced the content,
    // it likely indicates a parsing error (e.g. MANUAL text that looked
    // like VTT but wasn't). Return rawContent instead of a near-empty string.
    if (text.length < MIN_PROCESSED_LENGTH && rawContent.length > MIN_PROCESSED_LENGTH) {
      console.warn(
        `[transcriptProcessor] Output too short after processing ` +
        `(${rawContent.length} → ${text.length} chars, source: ${source}). ` +
        `Returning rawContent as fallback.`
      )
      return rawContent
    }

    return text

  } catch (err) {
    // Log the error but never fail the request — rawContent is always usable
    console.error('[transcriptProcessor] Processing failed, using rawContent as fallback:', err)
    return rawContent
  }
}
