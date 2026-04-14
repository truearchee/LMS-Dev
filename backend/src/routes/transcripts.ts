import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const transcriptRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // ── POST /api/v1/transcripts ───────────────────────────────────────────────
  // TEACHER uploads a raw transcript (text) and links it to a lecture.
  fastify.post(
    '/',
    { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
    async (request, reply) => {
      const { lectureId, rawContent, source } = request.body as {
        lectureId: string;
        rawContent: string;
        source?: string;
      };

      if (!lectureId || !rawContent) {
        return reply.status(400).send({ error: 'lectureId and rawContent are required.' });
      }

      const lecture = await prisma.lecture.findUnique({ where: { id: lectureId, deletedAt: null } });
      if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

      const validSources = ['ZOOM', 'MANUAL', 'UPLOAD'];
      const normalizedSource = (source ?? 'MANUAL').toUpperCase();
      if (!validSources.includes(normalizedSource)) {
        return reply.status(400).send({ error: `source must be one of: ${validSources.join(', ')}` });
      }

      const transcript = await prisma.transcript.create({
        data: {
          lectureId,
          rawContent,
          source: normalizedSource,
          status: 'PENDING',
        },
      });

      return reply.status(201).send({ transcript });
    },
  );

  // ── POST /api/v1/transcripts/:id/process ──────────────────────────────────
  // TEACHER queues an async AI summarization job. Returns 202 immediately.
  fastify.post(
    '/:id/process',
    { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const transcript = await prisma.transcript.findUnique({ where: { id } });
      if (!transcript) return reply.status(404).send({ error: 'Transcript not found.' });

      // Accept optional summaryType from the request body
      const { summaryType = 'BRIEF' } = (request.body as { summaryType?: string } | null) ?? {};

      // Validate summaryType against allowed values
      const validTypes = ['BRIEF', 'FULL', 'BULLET_POINTS'];
      const type = validTypes.includes(summaryType) ? summaryType : 'BRIEF';

      const job = await prisma.aIJob.create({
        data: {
          transcriptId: transcript.id,
          jobType: 'SUMMARIZE',
          summaryType: type,
          status: 'PENDING',
        },
      });

      await prisma.transcript.update({
        where: { id },
        data: { status: 'PROCESSING' },
      });

      return reply.status(202).send({
        message: 'Processing enqueued.',
        jobId: job.id,
        summaryType: type,
        pollUrl: `/api/v1/ai/jobs/${job.id}`,
      });
    },
  );
};
