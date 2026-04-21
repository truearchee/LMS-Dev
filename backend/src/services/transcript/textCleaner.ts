/**
 * Cleans transcript text for AI processing.
 *
 * Conservative approach:
 * - Only removes clear standalone hesitation sounds (um, uh, hmm, er, ah)
 * - Does NOT remove "like", "you know", "right", "well" — too many
 *   legitimate uses in academic speech ("the limit, right, approaches...")
 * - Does NOT reformat punctuation — academic transcripts may contain
 *   abbreviations (e.g., i.e., cf.) that punctuation rewrites would corrupt
 */

const FILLER_WORDS: readonly string[] = [
  'um', 'umm',
  'uh', 'uhh',
  'hmm', 'hm',
  'er', 'erm',
  'ah', 'ahh',
]

const FILLER_REGEX = new RegExp(
  `\\b(${FILLER_WORDS.join('|')})\\b,?`,
  'gi'
)

export function looksLikeVtt(text: string): boolean {
  return (
    text.trimStart().startsWith('WEBVTT') ||
    /^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/m.test(text)
  )
}

export function cleanTranscriptText(text: string): string {
  if (!text || !text.trim()) return ''

  let cleaned = text

  // 1. Remove filler words (standalone hesitation markers only)
  cleaned = cleaned.replace(FILLER_REGEX, '')

  // 2. Collapse multiple consecutive spaces into one
  cleaned = cleaned.replace(/ {2,}/g, ' ')

  // 3. Remove spaces before punctuation
  cleaned = cleaned.replace(/ ([,;!?])/g, '$1')

  // 4. Normalize line endings — collapse 3+ newlines to double newline
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // 5. Trim whitespace from each line, remove blank-only lines
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')

  return cleaned.trim()
}
