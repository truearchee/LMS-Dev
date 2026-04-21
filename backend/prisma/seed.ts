import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const adminPw   = await bcrypt.hash('admin123',   BCRYPT_ROUNDS);
  const teacherPw = await bcrypt.hash('teacher123', BCRYPT_ROUNDS);
  const studentPw = await bcrypt.hash('student123', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@mbzuai.ac.ae' },
    update: {},
    create: { name: 'System Admin', email: 'admin@mbzuai.ac.ae', password: adminPw, role: 'ADMIN' },
  });

  const teacher = await prisma.user.upsert({
    where:  { email: 'teacher@mbzuai.ac.ae' },
    update: {},
    create: { name: 'Dr. Anna Ivanova', email: 'teacher@mbzuai.ac.ae', password: teacherPw, role: 'TEACHER' },
  });

  const students = await Promise.all(
    [1, 2, 3, 4, 5].map(n =>
      prisma.user.upsert({
        where:  { email: `student${n}@mbzuai.ac.ae` },
        update: {},
        create: {
          name:     `Student ${n}`,
          email:    `student${n}@mbzuai.ac.ae`,
          password: studentPw,
          role:     'STUDENT',
        },
      }),
    ),
  );

  console.log(`  ✓ Users: ${admin.name}, ${teacher.name}, ${students.map(s => s.name).join(', ')}`);

  // ── 2. Course ────────────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where:  { id: 'calculus-linear-algebra' },
    update: {},
    create: {
      id:          'calculus-linear-algebra',
      title:       'Calculus and Linear Algebra',
      description: 'A rigorous first-year mathematics course covering limits, derivatives, integrals, and matrix algebra.',
      teacherId:   teacher.id,
    },
  });

  console.log(`  ✓ Course: ${course.title}`);

  // ── 3. Enroll all 5 students ─────────────────────────────────────────────────
  for (const student of students) {
    await prisma.enrollment.upsert({
      where:  { userId_courseId: { userId: student.id, courseId: course.id } },
      update: {},
      create: { userId: student.id, courseId: course.id },
    });
  }

  console.log(`  ✓ Enrolled: ${students.length} students`);

  // ── 4. Lectures ──────────────────────────────────────────────────────────────
  // Spring 2026 Schedule: 14 weeks starting Jan 12 (Mon), 2026.
  // Weekly pattern: Mon (Lecture), Tue (Lecture), Wed (Lab).
  const SEMESTER_START = new Date('2026-01-12T09:00:00Z');
  
  const lectureData: any[] = [];
  let orderCursor = 1;
  let lectureCount = 1;
  let labCount = 1;

  for (let week = 1; week <= 14; week++) {
    // Mon - Lecture
    const dMon = new Date(SEMESTER_START);
    dMon.setDate(dMon.getDate() + (week - 1) * 7);
    lectureData.push({
      id: `lec-${orderCursor.toString().padStart(2, '0')}`,
      moduleNumber: week,
      orderIndex: orderCursor++,
      contentType: 'LECTURE',
      scheduledAt: dMon,
      title: `Lecture ${lectureCount}: Topic for Week ${week}`,
      description: `Description for lecture ${lectureCount}.`,
    });
    lectureCount++;

    // Tue - Lecture
    const dTue = new Date(dMon);
    dTue.setDate(dTue.getDate() + 1);
    lectureData.push({
      id: `lec-${orderCursor.toString().padStart(2, '0')}`,
      moduleNumber: week,
      orderIndex: orderCursor++,
      contentType: 'LECTURE',
      scheduledAt: dTue,
      title: `Lecture ${lectureCount}: Extended Topic for Week ${week}`,
      description: `Description for lecture ${lectureCount}.`,
    });
    lectureCount++;

    // Wed - Lab
    const dWed = new Date(dMon);
    dWed.setDate(dWed.getDate() + 2);
    lectureData.push({
      id: `lec-${orderCursor.toString().padStart(2, '0')}`,
      moduleNumber: week,
      orderIndex: orderCursor++,
      contentType: 'LAB',
      scheduledAt: dWed,
      title: `Lab ${labCount}: Exercises for Week ${week}`,
      description: `Lab exercises for week ${week}.`,
    });
    labCount++;
  }

  const lectures: Record<string, { id: string }> = {};
  for (const data of lectureData) {
    const lecture = await prisma.lecture.upsert({
      where:  { id: data.id },
      update: {},
      create: {
        id:              data.id,
        courseId:        course.id,
        title:           data.title,
        description:     data.description,
        moduleNumber:    data.moduleNumber,
        orderIndex:      data.orderIndex,
        contentType:     data.contentType,
        scheduledAt:     data.scheduledAt,
        durationMinutes: data.contentType === 'QUIZ' ? 60 : 90,
      },
    });
    lectures[data.id] = lecture;
  }

  console.log(`  ✓ Lectures: ${lectureData.length} lectures (${lectureData.filter(l => l.contentType === 'LECTURE').length} LECTURE, ${lectureData.filter(l => l.contentType === 'LAB').length} LAB, ${lectureData.filter(l => l.contentType === 'QUIZ').length} QUIZ)`);

  // ── 5. Transcripts ───────────────────────────────────────────────────────────
  const transcript1 = await prisma.transcript.upsert({
    where:  { id: 'transcript-lec-01' },
    update: {},
    create: {
      id:         'transcript-lec-01',
      lectureId:  lectures['lec-01'].id,
      source:     'ZOOM',
      status:     'PENDING',
      rawContent: `Welcome to Lecture 1 on Limits and Continuity. Today we begin with the intuitive notion of a limit: as x approaches a value c, what does f(x) approach? We write this as lim(x→c) f(x) = L. Informally, this means f(x) can be made arbitrarily close to L by taking x sufficiently close to c, without x ever equaling c.

The formal epsilon-delta definition states: for every ε > 0, there exists δ > 0 such that if 0 < |x − c| < δ, then |f(x) − L| < ε. This definition is the cornerstone of rigorous analysis. It removes all ambiguity from the phrase "arbitrarily close" by quantifying it precisely. We worked through several examples, including lim(x→2) (3x − 1) = 5, verifying the definition by choosing δ = ε/3.

A function f is continuous at c if three conditions hold: f(c) is defined, the limit lim(x→c) f(x) exists, and the two are equal. Discontinuities come in three flavours: removable (a hole in the graph that can be patched), jump (left- and right-hand limits exist but differ), and infinite (the function grows without bound). Understanding continuity is essential before we move to derivatives, since differentiability implies continuity — but not the other way around.`,
    },
  });

  const transcript2 = await prisma.transcript.upsert({
    where:  { id: 'transcript-lec-03' },
    update: {},
    create: {
      id:         'transcript-lec-03',
      lectureId:  lectures['lec-04'].id,
      source:     'ZOOM',
      status:     'PENDING',
      rawContent: `In Lecture 3 we push deeper into differentiation. Last time we established the derivative as the limit of the difference quotient: f′(x) = lim(h→0) [f(x+h) − f(x)] / h. Today we examine higher-order derivatives. The second derivative f″(x) measures the rate of change of f′(x) and gives us information about concavity: if f″ > 0, the graph is concave up; if f″ < 0, concave down.

Implicit differentiation lets us find dy/dx when y is defined implicitly by an equation like x² + y² = r². Differentiating both sides with respect to x gives 2x + 2y(dy/dx) = 0, so dy/dx = −x/y. This technique extends to any relation between x and y that is not explicitly solved for y, and it generalises naturally to related rates problems, where two quantities both change with time.

We closed with related rates: a ladder of length 10 m leans against a wall. The base slides away at 0.5 m/s. How fast is the top sliding down when the base is 6 m from the wall? Setting x² + y² = 100 and differentiating implicitly with respect to t gives 2x(dx/dt) + 2y(dy/dt) = 0. At x = 6, y = 8, so dy/dt = −(6 × 0.5)/8 = −0.375 m/s. The negative sign confirms the top is moving downward.`,
    },
  });

  console.log('  ✓ Transcripts: 2 transcripts (Lecture 1, Lecture 3)');

  // ── 6. AIJobs ────────────────────────────────────────────────────────────────
  await prisma.aIJob.upsert({
    where:  { id: 'job-lec-01-summarize' },
    update: {},
    create: { id: 'job-lec-01-summarize', transcriptId: transcript1.id, jobType: 'SUMMARIZE', status: 'PENDING' },
  });

  await prisma.aIJob.upsert({
    where:  { id: 'job-lec-03-summarize' },
    update: {},
    create: { id: 'job-lec-03-summarize', transcriptId: transcript2.id, jobType: 'SUMMARIZE', status: 'PENDING' },
  });

  console.log('  ✓ AIJobs: 2 PENDING summarization jobs');
  console.log('\n✅ Seed complete.');
  console.log('\n📋 Test credentials:');
  console.log('   Admin:    admin@mbzuai.ac.ae    / admin123');
  console.log('   Teacher:  teacher@mbzuai.ac.ae  / teacher123');
  console.log('   Students: student1@mbzuai.ac.ae / student123  (student1–5)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
