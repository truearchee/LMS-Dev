/**
 * ingest-lecture.ts
 * One-time script to load real academic content into the LMS database.
 * Run with: npm run ingest (from backend/)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { prisma } from '../src/lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  apiBase: 'http://localhost:3001',
  teacher: {
    email:    'teacher@lms.dev',
    password: 'teacher123!',
  },
  studentEmail: 'artur@lms.dev',
  files: {
    slides:     path.join(__dirname, 'seed-data/slides.pdf'),
    recording:  path.join(__dirname, 'seed-data/lecture.mp4'),
    transcript: path.join(__dirname, 'seed-data/transcript.vtt'),
  },
  lecture: {
    title:           'Lecture 1 — Introduction',
    moduleNumber:    1,
    orderIndex:      1,
    durationMinutes: 90,
  },
  course: {
    title:       'Calculus and Linear Algebra',
    description: 'MBZUAI pilot course — Week 1 real content',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api<T = any>(
  method: string,
  path: string,
  token: string | null,
  body?: object,
): Promise<T> {
  // POST/PUT with no body must still send {} to satisfy Fastify's content-type check
  const hasBody = method !== 'GET' && method !== 'DELETE';
  const bodyPayload = hasBody ? JSON.stringify(body ?? {}) : undefined;

  const res = await fetch(`${CONFIG.apiBase}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: bodyPayload,
  });

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }

  if (!res.ok) {
    throw new Error(`[${method} ${path}] HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

async function uploadFile(filePath: string, token: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'video/mp4';

  // Use native fetch + FormData (Node 18+)
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`${CONFIG.apiBase}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData as any,
  });

  const json: any = await res.json();
  if (!res.ok) throw new Error(`Upload failed: ${JSON.stringify(json)}`);
  return json.url as string;
}

function stripVtt(raw: string): string {
  return raw
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Remove VTT header
      if (trimmed === 'WEBVTT') return false;
      // Remove timestamp lines like 00:01:23.456 --> 00:01:27.890
      if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(trimmed)) return false;
      // Remove pure numeric cue identifiers
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function pollJob(jobId: string, token: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job: any = await api('GET', `/api/v1/ai/jobs/${jobId}`, token);
    console.log(`  [poll] status: ${job.status}`);

    if (job.status === 'DONE') {
      const preview = job.result?.content?.slice(0, 300) ?? '(no content)';
      console.log(`\n  ✅ AI Summary preview:\n  "${preview}"\n`);
      return;
    }
    if (job.status === 'FAILED') {
      console.error(`  ❌ Job failed: ${job.errorMessage}`);
      process.exit(1);
    }

    await new Promise(r => setTimeout(r, 3_000));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs / 1000}s`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  LMS Real Content Ingestion Script');
  console.log('══════════════════════════════════════════════\n');

  // ── Step 1: Authenticate ────────────────────────────────────────────────────
  console.log('Step 1 — Authenticating as teacher...');
  const authRes: any = await api('POST', '/api/v1/auth/login', null, CONFIG.teacher);
  const token: string = authRes.accessToken;
  console.log('  ✓ Authenticated. Token received.\n');

  // ── Step 2: Create Course ───────────────────────────────────────────────────
  console.log('Step 2 — Creating course...');
  const courseRes: any = await api('POST', '/api/v1/courses', token, CONFIG.course);
  const courseId: string = courseRes.course.id;
  console.log(`  ✓ Course created. COURSE_ID: ${courseId}\n`);

  // ── Step 3: Create Lecture ──────────────────────────────────────────────────
  console.log('Step 3 — Creating lecture...');
  const lectureRes: any = await api(
    'POST',
    `/api/v1/courses/${courseId}/lectures`,
    token,
    CONFIG.lecture,
  );
  const lectureId: string = lectureRes.lecture.id;
  console.log(`  ✓ Lecture created. LECTURE_ID: ${lectureId}\n`);

  // ── Step 4: Enroll student ──────────────────────────────────────────────────
  console.log('Step 4 — Enrolling student artur@lms.dev...');
  const student = await prisma.user.findUnique({ where: { email: CONFIG.studentEmail } });
  if (!student) {
    console.error(`  ❌ Student "${CONFIG.studentEmail}" not found in DB. Run seed first.`);
    process.exit(1);
  }
  try {
    await api('POST', `/api/v1/courses/${courseId}/enroll`, token, { userId: student.id });
    console.log(`  ✓ Enrolled ${CONFIG.studentEmail} (userId: ${student.id})\n`);
  } catch (e: any) {
    if (e.message.includes('409')) {
      console.log('  ⚠ Already enrolled — skipping.\n');
    } else throw e;
  }

  // ── Step 5: Upload Slides ───────────────────────────────────────────────────
  console.log('Step 5 — Uploading slides.pdf...');
  const slidesUrl = await uploadFile(CONFIG.files.slides, token);
  console.log(`  ✓ Slides uploaded. URL: ${slidesUrl}`);

  const slidesFile: any = await api(
    'POST',
    `/api/v1/lectures/${lectureId}/files/register`,
    token,
    { type: 'SLIDES', label: 'Lecture 1 — Slides', url: slidesUrl, mimeType: 'application/pdf' },
  );
  console.log(`  ✓ Slides registered. FILE_ID: ${slidesFile.file.id}\n`);

  // ── Step 6: Upload Recording ────────────────────────────────────────────────
  console.log('Step 6 — Uploading lecture.mp4...');
  const mp4SizeBytes = fs.statSync(CONFIG.files.recording).size;
  const MP4_THRESHOLD = 400 * 1024 * 1024; // 400 MB
  let recordingUrl: string;

  if (mp4SizeBytes < MP4_THRESHOLD) {
    console.log(`  File size: ${(mp4SizeBytes / 1024 / 1024).toFixed(1)} MB — uploading via API...`);
    recordingUrl = await uploadFile(CONFIG.files.recording, token);
    console.log(`  ✓ Recording uploaded. URL: ${recordingUrl}`);
  } else {
    console.log(`  File size: ${(mp4SizeBytes / 1024 / 1024).toFixed(1)} MB — over limit, copying directly...`);
    const dest = path.join(__dirname, '../uploads/lecture.mp4');
    fs.copyFileSync(CONFIG.files.recording, dest);
    recordingUrl = 'http://localhost:3001/uploads/lecture.mp4';
    console.log(`  ✓ Recording copied. URL: ${recordingUrl}`);
  }

  const recordingFile: any = await api(
    'POST',
    `/api/v1/lectures/${lectureId}/files/register`,
    token,
    { type: 'RECORDING', label: 'Lecture 1 — Recording', url: recordingUrl, mimeType: 'video/mp4', sizeBytes: mp4SizeBytes },
  );
  console.log(`  ✓ Recording registered. FILE_ID: ${recordingFile.file.id}\n`);

  // ── Step 7: Ingest Transcript ───────────────────────────────────────────────
  console.log('Step 7 — Ingesting transcript.vtt...');
  const rawVtt = fs.readFileSync(CONFIG.files.transcript, 'utf-8');
  const cleanedText = stripVtt(rawVtt);
  console.log(`  Stripped VTT → ${cleanedText.length} characters of spoken text.`);

  const transcriptRes: any = await api('POST', '/api/v1/transcripts', token, {
    lectureId,
    rawContent: cleanedText,
    source: 'ZOOM',
  });
  const transcriptId: string = transcriptRes.transcript.id;
  console.log(`  ✓ Transcript created. TRANSCRIPT_ID: ${transcriptId}\n`);

  // ── Step 8: Trigger AI Summary + Poll ───────────────────────────────────────
  console.log('Step 8 — Triggering AI summarization job...');
  const processRes: any = await api('POST', `/api/v1/transcripts/${transcriptId}/process`, token);
  const jobId: string = processRes.jobId;
  console.log(`  ✓ Job enqueued. JOB_ID: ${jobId}`);
  console.log('  Polling every 3s (timeout: 60s)...');
  await pollJob(jobId, token);

  // ── Final Report ─────────────────────────────────────────────────────────────
  const summary = await prisma.aISummary.findFirst({ where: { transcriptId } });
  console.log('\n══════════════════════════════════════════════');
  console.log('  INGEST COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`COURSE_ID:      ${courseId}`);
  console.log(`LECTURE_ID:     ${lectureId}`);
  console.log(`TRANSCRIPT_ID:  ${transcriptId}`);
  console.log(`JOB_ID:         ${jobId}`);
  console.log(`SUMMARY_ID:     ${summary?.id ?? '(not found)'}`);
  console.log(`Slides URL:     ${slidesUrl}`);
  console.log(`Recording URL:  ${recordingUrl}`);
  console.log(`Enrollment:     yes`);
  console.log(`AI Summary preview (first 300 chars):`);
  console.log(`  "${summary?.content?.slice(0, 300) ?? '(none)'}"`);
  console.log('══════════════════════════════════════════════\n');
}

main()
  .catch(err => { console.error('\n❌ INGEST FAILED:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
