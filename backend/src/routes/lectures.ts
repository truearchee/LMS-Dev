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
          aiSummaries: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, type: true, content: true, modelUsed: true, promptVersion: true, createdAt: true,
            },
          },
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

    // ── POST /api/v1/lectures/:id/files/register ──────────────────────────────
    // JSON body — TEACHER registers an already-uploaded file URL.
    // Must be registered BEFORE /:id/files to avoid Fastify route conflict.
    fastify.post(
      '/:id/files/register',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const { type, label, url, mimeType, sizeBytes } = request.body as {
          type: string;
          label?: string;
          url: string;
          mimeType?: string;
          sizeBytes?: number;
        };

        if (!url)  return reply.status(400).send({ error: 'url is required.' });
        if (!type) return reply.status(400).send({ error: 'type is required.' });

        const lecture = await prisma.lecture.findUnique({ where: { id, deletedAt: null } });
        if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

        const file = await prisma.lectureFile.upsert({
          where: {
            lectureId_type: {
              lectureId: id,
              type,
            },
          },
          create: { lectureId: id, url, type, label, mimeType, sizeBytes },
          update: { url, label, mimeType, sizeBytes },
        });

        return reply.status(201).send({ file });
      },
    );

    // ── POST /api/v1/lectures/:id/files ───────────────────────────────────────
    // Multipart upload — TEACHER uploads a binary file directly
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

        const file = await prisma.lectureFile.upsert({
          where: {
            lectureId_type: {
              lectureId: id,
              type,
            },
          },
          create: {
            lectureId: id,
            url,
            type,
            label:     data.filename,
            mimeType:  data.mimetype,
            sizeBytes: buffer.byteLength,
          },
          update: {
            url,
            label:     data.filename,
            mimeType:  data.mimetype,
            sizeBytes: buffer.byteLength,
          },
        });

        return reply.status(201).send({ file });
      },
    );
    // ── PATCH /api/v1/lectures/:id/note ─────────────────────────────────────
    // Access: TEACHER/ADMIN
    fastify.patch<{
      Params: { id: string }
      Body: { teacherNote: string }
    }>(
      '/:id/note',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params;
        const { teacherNote } = request.body;

        const lecture = await prisma.lecture.update({
          where: { id },
          data: { teacherNote },
        });

        return reply.send({ message: 'Note updated successfully', lecture });
      }
    );

    // ── DELETE /api/v1/lectures/:id/files/:fileId ───────────────────────────
    // Access: TEACHER/ADMIN
    fastify.delete<{
      Params: { id: string; fileId: string }
    }>(
      '/:id/files/:fileId',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id: lectureId, fileId } = request.params;

        const file = await prisma.lectureFile.findFirst({
          where: { id: fileId, lectureId },
        });

        if (!file) {
          return reply.status(404).send({ error: { message: 'File not found' } });
        }

        await prisma.lectureFile.delete({ where: { id: fileId } });
        return reply.status(204).send();
      }
    );
  };
}
