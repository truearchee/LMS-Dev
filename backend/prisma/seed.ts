import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Users ───────────────────────────────────────────────────────────────
  const adminPw   = await bcrypt.hash('admin123!',   BCRYPT_ROUNDS);
  const teacherPw = await bcrypt.hash('teacher123!', BCRYPT_ROUNDS);
  const studentPw = await bcrypt.hash('student123!', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@lms.dev' },
    update: {},
    create: { name: 'System Admin', email: 'admin@lms.dev', password: adminPw, role: 'ADMIN' },
  });

  const teacher = await prisma.user.upsert({
    where:  { email: 'teacher@lms.dev' },
    update: {},
    create: { name: 'Dr. Anna Ivanova', email: 'teacher@lms.dev', password: teacherPw, role: 'TEACHER' },
  });

  const student1 = await prisma.user.upsert({
    where:  { email: 'artur@lms.dev' },
    update: {},
    create: { name: 'Artur Leontev', email: 'artur@lms.dev', password: studentPw, role: 'STUDENT' },
  });

  const student2 = await prisma.user.upsert({
    where:  { email: 'maria@lms.dev' },
    update: {},
    create: { name: 'Maria Petrova', email: 'maria@lms.dev', password: studentPw, role: 'STUDENT' },
  });

  console.log(`  ✓ Users: ${admin.name}, ${teacher.name}, ${student1.name}, ${student2.name}`);

  // ── 2. Course ──────────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where:  { id: 'calculus-101' },
    update: {},
    create: {
      id:          'calculus-101',
      title:       'Calculus & Linear Algebra',
      description: 'A rigorous first-year mathematics course covering limits, derivatives, integrals, and matrix algebra.',
      teacherId:   teacher.id,
    },
  });

  console.log(`  ✓ Course: ${course.title}`);

  // ── 3. Enroll students ─────────────────────────────────────────────────────
  await prisma.enrollment.upsert({
    where:  { userId_courseId: { userId: student1.id, courseId: course.id } },
    update: {},
    create: { userId: student1.id, courseId: course.id },
  });

  await prisma.enrollment.upsert({
    where:  { userId_courseId: { userId: student2.id, courseId: course.id } },
    update: {},
    create: { userId: student2.id, courseId: course.id },
  });

  console.log(`  ✓ Enrolled: ${student1.name}, ${student2.name}`);

  // ── 4. Lectures ────────────────────────────────────────────────────────────
  const lecture1 = await prisma.lecture.upsert({
    where:  { id: 'lecture-limits-001' },
    update: {},
    create: {
      id:              'lecture-limits-001',
      courseId:        course.id,
      title:           'Lecture 1: Limits and Continuity',
      description:     'Introduction to the epsilon-delta definition of limits. Covers one-sided limits and continuity.',
      moduleNumber:    1,
      orderIndex:      1,
      durationMinutes: 90,
    },
  });

  const lecture2 = await prisma.lecture.upsert({
    where:  { id: 'lecture-derivatives-002' },
    update: {},
    create: {
      id:              'lecture-derivatives-002',
      courseId:        course.id,
      title:           'Lecture 2: Derivatives and Differentiation Rules',
      description:     'Power rule, product rule, quotient rule, and chain rule with worked examples.',
      moduleNumber:    1,
      orderIndex:      2,
      durationMinutes: 90,
    },
  });

  console.log(`  ✓ Lectures: ${lecture1.title}, ${lecture2.title}`);

  // ── Lecture files ──────────────────────────────────────────────────────────
  await prisma.lectureFile.upsert({
    where:  { id: 'file-l1-slides' },
    update: {},
    create: {
      id:        'file-l1-slides',
      lectureId: lecture1.id,
      type:      'SLIDES',
      label:     'Lecture 1 – Slides.pdf',
      url:       'http://localhost:3001/uploads/placeholder-l1-slides.pdf',
      mimeType:  'application/pdf',
    },
  });

  await prisma.lectureFile.upsert({
    where:  { id: 'file-l2-slides' },
    update: {},
    create: {
      id:        'file-l2-slides',
      lectureId: lecture2.id,
      type:      'SLIDES',
      label:     'Lecture 2 – Slides.pdf',
      url:       'http://localhost:3001/uploads/placeholder-l2-slides.pdf',
      mimeType:  'application/pdf',
    },
  });

  console.log('  ✓ Lecture files: 2 placeholder PDFs');

  // ── 5. Transcripts + AIJobs ────────────────────────────────────────────────
  const transcript1 = await prisma.transcript.upsert({
    where:  { id: 'transcript-l1' },
    update: {},
    create: {
      id:         'transcript-l1',
      lectureId:  lecture1.id,
      source:     'ZOOM',
      rawContent: `Welcome everyone to Lecture 1 on Limits and Continuity. Today we'll begin with the intuitive notion of a limit. 
As x approaches a value c, what does f(x) approach? We write this as: lim(x→c) f(x) = L.
The formal epsilon-delta definition states that for every ε > 0 there exists δ > 0 such that if 0 < |x - c| < δ then |f(x) - L| < ε.
A function is continuous at c if the limit exists, equals f(c), and f(c) is defined.
Common pitfalls include confusing the limit value with the function value and handling removable discontinuities.`,
      status:     'PENDING',
    },
  });

  const transcript2 = await prisma.transcript.upsert({
    where:  { id: 'transcript-l2' },
    update: {},
    create: {
      id:         'transcript-l2',
      lectureId:  lecture2.id,
      source:     'ZOOM',
      rawContent: `Lecture 2 covers the rules of differentiation. The derivative of f(x) is defined as the limit of (f(x+h)-f(x))/h as h→0.
Power Rule: d/dx[xⁿ] = n·xⁿ⁻¹. Product Rule: d/dx[uv] = u'v + uv'. Quotient Rule: d/dx[u/v] = (u'v - uv')/v².
The Chain Rule handles composite functions: d/dx[f(g(x))] = f'(g(x))·g'(x).
Examples worked: derivative of x³, sin(x²), and (x²+1)/(x−3).`,
      status:     'PENDING',
    },
  });

  console.log('  ✓ Transcripts: 2 Zoom transcripts');

  // One PENDING AIJob per transcript to exercise the worker on next boot
  await prisma.aIJob.upsert({
    where:  { id: 'job-l1-summarize' },
    update: {},
    create: {
      id:           'job-l1-summarize',
      transcriptId: transcript1.id,
      jobType:      'SUMMARIZE',
      status:       'PENDING',
    },
  });

  await prisma.aIJob.upsert({
    where:  { id: 'job-l2-summarize' },
    update: {},
    create: {
      id:           'job-l2-summarize',
      transcriptId: transcript2.id,
      jobType:      'SUMMARIZE',
      status:       'PENDING',
    },
  });

  console.log('  ✓ AIJobs: 2 PENDING summarization jobs (worker will pick up on next boot)');
  console.log('\n✅ Seed complete.');
  console.log('\n📋 Test credentials:');
  console.log('   Admin:   admin@lms.dev   / admin123!');
  console.log('   Teacher: teacher@lms.dev / teacher123!');
  console.log('   Student: artur@lms.dev   / student123!');
  console.log('   Student: maria@lms.dev   / student123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
