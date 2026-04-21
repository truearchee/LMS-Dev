import { PrismaClient } from '@prisma/client'
import { processTranscript, type TranscriptSource } from '../src/services/transcript/transcriptProcessor.js'

const prisma = new PrismaClient()

async function backfill() {
  console.log('Starting transcript backfill...')

  const unprocessed = await prisma.transcript.findMany({
    where: { processedContent: null },
    select: {
      id: true,
      rawContent: true,
      source: true,
      lectureId: true,
    },
  })

  console.log(`Found ${unprocessed.length} transcript(s) with no processedContent`)

  if (unprocessed.length === 0) {
    console.log('Nothing to backfill.')
    await prisma.$disconnect()
    return
  }

  let successCount = 0
  let failCount = 0

  for (const transcript of unprocessed) {
    try {
      const source = (transcript.source ?? 'MANUAL') as TranscriptSource
      const processedContent = processTranscript(transcript.rawContent, source)

      await prisma.transcript.update({
        where: { id: transcript.id },
        data: {
          processedContent,
          status: 'DONE',  // Match valid status value from schema.prisma
        },
      })

      const reduction = Math.round(
        ((transcript.rawContent.length - processedContent.length) / Math.max(1, transcript.rawContent.length)) * 100
      )
      console.log(
        `✓ ${transcript.id} — ${transcript.rawContent.length} → ${processedContent.length} chars (${reduction}% reduction)`
      )
      successCount++

    } catch (err) {
      console.error(`✗ ${transcript.id} — failed:`, err)
      failCount++
      // Continue to next transcript — don't abort the whole backfill
    }
  }

  console.log(`\nBackfill complete: ${successCount} succeeded, ${failCount} failed`)

  // Always disconnect, even if some records failed
  await prisma.$disconnect()
}

backfill().catch(async err => {
  console.error('Fatal backfill error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
