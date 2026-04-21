/**
 * Parses a WebVTT string and extracts clean spoken text.
 *
 * Removes: WEBVTT header, NOTE/STYLE/REGION blocks,
 * cue sequence numbers, timestamp lines, inline HTML tags.
 *
 * Does NOT remove speaker labels — too risky to distinguish
 * "Prof Smith: text" from "Definition: text" in academic content.
 *
 * Never throws on malformed input — returns whatever text can be extracted.
 */
export function parseVtt(rawVtt: string): string {
  if (!rawVtt || !rawVtt.trim()) return ''

  const lines = rawVtt.split(/\r?\n/)
  const textLines: string[] = []
  let inSkipBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines (used as cue block separators in VTT)
    if (!trimmed) {
      inSkipBlock = false
      continue
    }

    // Skip NOTE, STYLE, REGION blocks (continue until next empty line)
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) {
      inSkipBlock = true
      continue
    }
    if (inSkipBlock) continue

    // Skip WEBVTT file header (first line)
    if (trimmed === 'WEBVTT' || trimmed.startsWith('WEBVTT ')) continue

    // Skip cue sequence numbers (pure integer on its own line)
    if (/^\d+$/.test(trimmed)) continue

    // Skip timestamp lines
    // HH:MM:SS.mmm --> HH:MM:SS.mmm (with optional cue settings after)
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed)) continue
    // MM:SS.mmm --> MM:SS.mmm (short format)
    if (/^\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed)) continue

    // Strip inline HTML tags sometimes present in cue payloads
    // e.g. <c.colorwhite>, <b>, <i>, <ruby>
    const text = trimmed.replace(/<[^>]+>/g, '').trim()

    if (text) textLines.push(text)
  }

  // Join with spaces — VTT cues are typically short phrases
  // Deliberate: we lose paragraph structure but produce cleaner AI input
  return textLines.join(' ').trim()
}
