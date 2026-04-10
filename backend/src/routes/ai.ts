import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AIProvider } from '../services/ai/AIService.js';

export function makeAiRoutes(ai: AIProvider) {
  return async (fastify: FastifyInstance) => {

    // ── GET /api/v1/ai/jobs/:id ───────────────────────────────────────────────
    // TEACHER polls this to check job status + retrieve result when DONE.
    fastify.get(
      '/jobs/:id',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };

        const job = await prisma.aIJob.findUnique({
          where: { id },
          include: {
            transcript: {
              include: {
                aiSummaries: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        });

        if (!job) return reply.status(404).send({ error: 'Job not found.' });

        return reply.send({
          id:           job.id,
          jobType:      job.jobType,
          status:       job.status,
          startedAt:    job.startedAt,
          completedAt:  job.completedAt,
          errorMessage: job.errorMessage,
          result: job.status === 'DONE' ? (job.transcript.aiSummaries[0] ?? null) : null,
        });
      },
    );

    // ── GET /api/v1/ai/summaries/:lectureId ───────────────────────────────────
    // Enrolled users retrieve all AI summaries for a lecture.
    fastify.get(
      '/summaries/:lectureId',
      { preHandler: [requireAuth] },
      async (request, reply) => {
        const { lectureId } = request.params as { lectureId: string };
        if (!request.user) return reply.status(401).send();
        const { userId, role } = request.user;

        const lecture = await prisma.lecture.findUnique({
          where: { id: lectureId, deletedAt: null },
          select: { courseId: true },
        });
        if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

        if (role === 'STUDENT') {
          const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId: lecture.courseId } },
          });
          if (!enrollment?.active) {
            return reply.status(403).send({ error: 'You are not enrolled in this course.' });
          }
        }

        const summaries = await prisma.aISummary.findMany({
          where: { lectureId },
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({ summaries });
      },
    );

    // ── Legacy endpoint — 410 Gone ────────────────────────────────────────────
    fastify.post('/analyze-transcript', async (_request, reply) => {
      return reply.status(410).send({
        error: 'Deprecated. Use POST /api/v1/transcripts/:id/process instead.',
      });
    });
  };
}
