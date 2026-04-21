/**
 * Strips VTT timestamps, cue numbers, WEBVTT header, and empty lines.
 * Handles both HH:MM:SS.mmm and MM:SS.mmm timestamp formats.
 * Returns clean spoken text only.
 */
export function stripVttTimestamps(content: string): string {
  return content
    .split('\n')
    .filter(line => {
      const t = line.trim()
      if (!t) return false
      if (t === 'WEBVTT') return false
      if (/^\d+$/.test(t)) return false // cue sequence numbers
      // HH:MM:SS.mmm --> HH:MM:SS.mmm (with optional cue settings after)
      if (/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(t)) return false
      // MM:SS.mmm --> MM:SS.mmm (short format)
      if (/^\d{2}:\d{2}[.,]\d{3}\s*-->/.test(t)) return false
      // NOTE / STYLE / REGION blocks
      if (/^(NOTE|STYLE|REGION)\b/.test(t)) return false
      return true
    })
    .join('\n')
    .trim()
}
