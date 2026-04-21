import { parseVtt } from './vttParser.js'
import { cleanTranscriptText, looksLikeVtt } from './textCleaner.js'
import { processTranscript } from './transcriptProcessor.js'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

function suite(name: string): void {
  console.log(`\n${name}`)
}

suite('parseVtt — basic VTT stripping')

const basicVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello, this is a lecture about derivatives.

2
00:00:04.500 --> 00:00:08.000
A derivative measures the rate of change.`

const basicParsed = parseVtt(basicVtt)
assert(!basicParsed.includes('WEBVTT'), 'WEBVTT header removed')
assert(!/\d{2}:\d{2}:\d{2}/.test(basicParsed), 'Timestamps removed')
assert(!basicParsed.includes('-->'), 'Arrow removed')
assert(basicParsed.includes('Hello, this is a lecture'), 'First cue text preserved')
assert(basicParsed.includes('derivative measures'), 'Second cue text preserved')

suite('parseVtt — Zoom format with sequence numbers')

const zoomVtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
Good morning everyone.

2
00:00:03.500 --> 00:00:07.000
Today we cover the epsilon-delta definition.`

const zoomParsed = parseVtt(zoomVtt)
assert(!zoomParsed.includes('00:00'), 'Zoom timestamps removed')
assert(zoomParsed.includes('Good morning'), 'First cue preserved')
assert(zoomParsed.includes('epsilon-delta'), 'Second cue preserved')

suite('parseVtt — inline HTML tags in cues')

const htmlVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<c.colorwhite><b>The derivative</b></c> is fundamental.`

const htmlParsed = parseVtt(htmlVtt)
assert(!htmlParsed.includes('<c'), 'HTML tags removed')
assert(!htmlParsed.includes('</b>'), 'Closing tags removed')
assert(htmlParsed.includes('The derivative'), 'Text content preserved after tag removal')

suite('parseVtt — NOTE blocks skipped')

const noteVtt = `WEBVTT

NOTE
This is a production note
that spans multiple lines

1
00:00:01.000 --> 00:00:04.000
Actual lecture content here.`

const noteParsed = parseVtt(noteVtt)
assert(!noteParsed.includes('production note'), 'NOTE block skipped')
assert(noteParsed.includes('Actual lecture content'), 'Content after NOTE preserved')

suite('parseVtt — edge cases')

assert(parseVtt('') === '', 'Empty string returns empty string')
assert(typeof parseVtt('Not a VTT file at all') === 'string', 'Non-VTT input returns string without throwing')
const nonVttResult = parseVtt('This is just regular text without timestamps.')
assert(nonVttResult.includes('regular text'), 'Non-VTT text passes through mostly intact')

suite('cleanTranscriptText — filler word removal')

const withFillers = 'The um derivative is uh the rate of change.'
const cleanedFillers = cleanTranscriptText(withFillers)
assert(!/\bum\b/.test(cleanedFillers), 'Standalone "um" removed')
assert(!/\buh\b/.test(cleanedFillers), 'Standalone "uh" removed')
assert(cleanedFillers.includes('derivative'), 'Content word "derivative" preserved')
assert(cleanedFillers.includes('rate of change'), 'Content phrase preserved')

suite('cleanTranscriptText — abbreviations not corrupted')

const withAbbreviations = 'Refer to, e.g., the textbook. See also i.e. chapter 3.'
const cleanedAbbr = cleanTranscriptText(withAbbreviations)
assert(cleanedAbbr.includes('e.g.'), 'e.g. abbreviation not corrupted')
assert(cleanedAbbr.includes('i.e.'), 'i.e. abbreviation not corrupted')

suite('cleanTranscriptText — whitespace normalization')

const withExtraSpaces = 'The  derivative   of  x  squared   is  2x.'
const cleanedSpaces = cleanTranscriptText(withExtraSpaces)
assert(!cleanedSpaces.includes('  '), 'Multiple spaces collapsed to single space')

suite('looksLikeVtt')

assert(looksLikeVtt('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nText.'), 'Standard VTT detected')
assert(looksLikeVtt('00:00:01.000 --> 00:00:04.000\nText.'), 'VTT without header detected')
assert(!looksLikeVtt('This text has --> in it for some reason.'), 'Plain text with --> not detected as VTT')
assert(!looksLikeVtt('Regular academic text about calculus.'), 'Regular text not detected as VTT')

suite('processTranscript — source: ZOOM')

const zoomTranscript = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
The limit, um, of x squared as x approaches 3 is 9.`

const processedZoom = processTranscript(zoomTranscript, 'ZOOM')
assert(!processedZoom.includes('WEBVTT'), 'ZOOM: VTT header stripped')
assert(!/\d{2}:\d{2}:\d{2}/.test(processedZoom), 'ZOOM: timestamps stripped')
assert(!/\bum\b/.test(processedZoom), 'ZOOM: filler words removed')
assert(processedZoom.includes('limit'), 'ZOOM: content preserved')

suite('processTranscript — source: MANUAL')

const manualText = 'Today we discuss uh the fundamental theorem of calculus.'
const processedManual = processTranscript(manualText, 'MANUAL')
assert(!/\buh\b/.test(processedManual), 'MANUAL: filler words removed')
assert(processedManual.includes('fundamental theorem'), 'MANUAL: content preserved')
assert(!processedManual.includes('WEBVTT'), 'MANUAL: no VTT processing applied to plain text')

suite('processTranscript — safety net')

// If source is MANUAL but content looks like VTT, still parse as VTT
const misclassifiedVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Misclassified transcript content.`

const processedMisclassified = processTranscript(misclassifiedVtt, 'MANUAL')
assert(!processedMisclassified.includes('WEBVTT'), 'Misclassified MANUAL VTT still gets VTT parsing')
assert(processedMisclassified.includes('Misclassified transcript'), 'Content preserved after misclassified parsing')

suite('processTranscript — never throws')

try {
  const result = processTranscript('', 'ZOOM')
  assert(typeof result === 'string', 'Empty input returns string without throwing')
} catch {
  assert(false, 'processTranscript threw on empty input')
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('Some tests failed — fix before proceeding.')
  process.exit(1)
}
console.log('All tests passed ✓')
