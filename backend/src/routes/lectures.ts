import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { StorageService } from '../services/storage/StorageService.js';

// Factory — injects StorageService so the route has no knowledge of the backend
export function makeLectureRoutes(storage: StorageService) {
  return async (fastify: FastifyInstance) => {

    // ── GET /api/v1/lectures/:id ──────────────────────────────────────────────
    // Access: enrolled students, teacher of the course, admin
    fastify.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!request.user) return reply.status(401).send();
      const { userId, role } = request.user;

      const lecture = await prisma.lecture.findUnique({
        where: { id, deletedAt: null },
        include: {
          files:       { orderBy: { createdAt: 'asc' } },
          transcripts: { select: { id: true, source: true, status: true, createdAt: true } },
          aiSummaries: { orderBy: { createdAt:  'desc' }, take: 3 },
        },
      });

      if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

      // Students must be enrolled in the parent course
      if (role === 'STUDENT') {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: lecture.courseId } },
        });
        if (!enrollment?.active) {
          return reply.status(403).send({ error: 'You are not enrolled in this course.' });
        }
      }

      return reply.send({ lecture });
    });

    // ── POST /api/v1/lectures/:id/files ───────────────────────────────────────
    // Access: TEACHER only
    fastify.post(
      '/:id/files',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };

        const lecture = await prisma.lecture.findUnique({ where: { id, deletedAt: null } });
        if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

        const data = await request.file();
        if (!data) return reply.status(400).send({ error: 'No file provided.' });

        // Collect stream into buffer so StorageService can handle it uniformly
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) chunks.push(chunk as Buffer);
        const buffer = Buffer.concat(chunks);

        const url = await storage.upload(buffer, data.filename, data.mimetype);

        // Infer file type from mimetype
        const type =
          data.mimetype === 'application/pdf' ? 'SLIDES'
          : data.mimetype.startsWith('video/') ? 'RECORDING'
          : 'OTHER';

        const file = await prisma.lectureFile.create({
          data: {
            lectureId: id,
            url,
            type,
            label:     data.filename,
            mimeType:  data.mimetype,
            sizeBytes: buffer.byteLength,
          },
        });

        return reply.status(201).send({ file });
      },
    );
  };
}
