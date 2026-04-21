import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('Scanning for duplicate LectureFile records...')

  const files = await prisma.lectureFile.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const seen = new Map<string, string>()
  const toDelete: string[] = []

  for (const file of files) {
    const key = `${file.lectureId}|${file.type}`
    if (seen.has(key)) {
      toDelete.push(file.id)
      console.log(`  Duplicate: id=${file.id} type=${file.type} label=${file.label}`)
    } else {
      seen.set(key, file.id)
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found.')
  } else {
    await prisma.lectureFile.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${toDelete.length} duplicate record(s).`)
  }

  await prisma.$disconnect()
}

cleanup().catch(async err => {
  console.error('Cleanup failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
