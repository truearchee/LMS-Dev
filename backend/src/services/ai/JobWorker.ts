// ─────────────────────────────────────────────────────────────────────────────
// JobWorker — spec Section 7
//
// DB-polling MVP worker. Queries PENDING AIJobs on an interval and processes
// them one at a time, with full status lifecycle tracking.
//
// Designed for easy replacement: the job *processing logic* lives in
// processJob(). When upgrading to BullMQ, you wrap processJob() as a
// BullMQ processor — the logic is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { AIProvider, SummarizeOptions, getPromptVersion, prepareTranscriptText } from './AIService.js';
import { env } from '../../lib/env.js';

const POLL_INTERVAL_MS = 10_000; // 10 seconds

export class JobWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly ai: AIProvider,
  ) {}

  /** Start the worker on server boot. */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[JobWorker] Started — polling every 10s for PENDING AI jobs.');
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  /** Graceful shutdown — call on process exit. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
    console.log('[JobWorker] Stopped.');
  }

  // ─── Tick: pick up one PENDING job ─────────────────────────────────────────

  private async tick(): Promise<void> {
    try {
      // Fetch ONE pending job — process serially to avoid race conditions
      const job = await this.prisma.aIJob.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: { transcript: true },
      });

      if (!job) return; // nothing to do

      await this.processJob(job);
    } catch (err) {
      console.error('[JobWorker] Tick error:', err);
    }
  }

  // ─── processJob: the logic that BullMQ would call as a "processor" ──────────

  private async processJob(job: {
    id: string;
    jobType: string;
    summaryType: string;
    transcript: {
      id: string;
      lectureId: string;
      rawContent: string;
      processedContent: string | null;
    };
  }): Promise<void> {
    console.log(`[JobWorker] Processing job ${job.id} (${job.jobType}, summaryType: ${job.summaryType})`);

    // PENDING → PROCESSING
    await this.prisma.aIJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    try {
      // Use processedContent if available and truncate if necessary
      const content = prepareTranscriptText(job.transcript);

      switch (job.jobType) {
        case 'SUMMARIZE':
          await this.handleSummarize(job.id, job.transcript.id, job.transcript.lectureId, content, job.summaryType);
          break;

        case 'EMBED':
          throw new Error('EMBED job type not yet implemented — skipping');

        case 'QUIZ_GENERATE':
          throw new Error('QUIZ_GENERATE job type not yet implemented — skipping');

        default:
          throw new Error(`Unknown jobType: ${job.jobType}`);
      }

      // PROCESSING → DONE
      await this.prisma.aIJob.update({
        where: { id: job.id },
        data: { status: 'DONE', completedAt: new Date() },
      });

      console.log(`[JobWorker] Job ${job.id} completed.`);
    } catch (err: any) {
      // PROCESSING → FAILED — worker continues to next job
      await this.prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: err?.message ?? 'Unknown error',
          completedAt: new Date(),
        },
      });
      console.error(`[JobWorker] Job ${job.id} failed:`, err?.message);
    }
  }

  // ─── Job type handlers ──────────────────────────────────────────────────────

  private async handleSummarize(
    jobId: string,
    transcriptId: string,
    lectureId: string,
    content: string,
    summaryType: string,
  ): Promise<void> {
    const type = (summaryType as 'BRIEF' | 'FULL' | 'BULLET_POINTS') ?? 'BRIEF';
    const promptVersion = getPromptVersion(type);
    const options: SummarizeOptions = { type, promptVersion };
    const summary = await this.ai.summarize(content, options);
    const modelUsed = env.AI_MODEL ?? 'MBZUAI-IFM/K2-Think-v2';

    // Upsert — re-triggering the same type updates the existing record (no duplicates)
    await this.prisma.aISummary.upsert({
      where: {
        lectureId_transcriptId_type: {
          lectureId,
          transcriptId,
          type,
        },
      },
      create: {
        lectureId,
        transcriptId,
        type,
        content: summary,
        modelUsed,
        promptVersion,
      },
      update: {
        content: summary,
        modelUsed,
        promptVersion,
      },
    });
  }
}
