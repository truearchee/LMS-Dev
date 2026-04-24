import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AIProvider } from '../services/ai/AIService.js';

function generateRecapTitle(
  lectures: Array<{ title: string; scheduledAt: Date | null; orderIndex: number }>
): string {
  const sorted = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex)
  const first  = sorted[0]
  const last   = sorted[sorted.length - 1]

  if (first.scheduledAt && last.scheduledAt) {
    const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `Study Guide: ${fmt(new Date(first.scheduledAt))} – ${fmt(new Date(last.scheduledAt))}`
  }
  return `Study Guide: ${lectures.length} Lecture${lectures.length !== 1 ? 's' : ''}`
}

export function makeCoursesRoutes(ai: AIProvider) {
  return async (server: FastifyInstance) => {
    // GET /api/v1/courses - any authenticated user
  // STUDENT: returns only enrolled courses; TEACHER/ADMIN: returns all courses
  server.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.user) return reply.status(401).send();
    const { userId, role } = request.user;

    if (role === 'STUDENT') {
      const courses = await prisma.course.findMany({
        where: {
          deletedAt: null,
          enrollments: { some: { userId, active: true } },
        },
        include: { teacher: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ courses });
    }

    // TEACHER / ADMIN — return all non-deleted courses
    const courses = await prisma.course.findMany({
      where: { deletedAt: null },
      include: { teacher: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ courses });
  });

  // POST /api/v1/courses - TEACHER, ADMIN
  server.post('/', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { title, description } = request.body as { title: string, description?: string };

    if (!title) return reply.status(400).send({ error: 'Title is required' });
    if (!request.user?.userId) return reply.status(401).send();

    const course = await prisma.course.create({
      data: { title, description, teacherId: request.user.userId }
    });

    return reply.status(201).send({ course });
  });

  // GET /api/v1/courses/:id - Enrolled users
  server.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!request.user) return reply.status(401).send();
    const { userId, role } = request.user;

    if (role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: id } }
      });
      if (!enrollment || !enrollment.active) {
        return reply.status(403).send({ error: 'You are not enrolled in this course.' });
      }
    }

    const course = await prisma.course.findUnique({
      where: { id, deletedAt: null },
      include: {
        lectures: {
          where: { deletedAt: null },
          orderBy: [
            { moduleNumber: 'asc' },
            { orderIndex: 'asc' },
          ],
          select: {
            id: true,
            title: true,
            description: true,
            moduleNumber: true,
            orderIndex: true,
            contentType: true,
            scheduledAt: true,
            teacherNote: true,
            isLocked: true,
            durationMinutes: true,
            createdAt: true,
            updatedAt: true,
            courseId: true,
          },
        },
      },
    });

    if (!course) return reply.status(404).send({ error: 'Course not found' });
    return reply.send({ course });
  });

  // ── POST /api/v1/courses/:id/lectures ────────────────────────────────────────
  // TEACHER creates a new lecture under a course
  server.post('/:id/lectures', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { id: courseId } = request.params as { id: string };
    const { title, description, moduleNumber, orderIndex, durationMinutes } =
      request.body as {
        title: string;
        description?: string;
        moduleNumber?: number;
        orderIndex: number;
        durationMinutes?: number;
      };

    if (!title) return reply.status(400).send({ error: 'title is required.' });

    const course = await prisma.course.findUnique({ where: { id: courseId, deletedAt: null } });
    if (!course) return reply.status(404).send({ error: 'Course not found.' });

    const lecture = await prisma.lecture.create({
      data: { courseId, title, description, moduleNumber, orderIndex: orderIndex ?? 1, durationMinutes },
    });

    return reply.status(201).send({ lecture });
  });

  // ── POST /api/v1/courses/:id/enroll ──────────────────────────────────────────
  // TEACHER or ADMIN enrolls a user in a course
  server.post('/:id/enroll', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { id: courseId } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    if (!userId) return reply.status(400).send({ error: 'userId is required.' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'User not found.' });

    const course = await prisma.course.findUnique({ where: { id: courseId, deletedAt: null } });
    if (!course) return reply.status(404).send({ error: 'Course not found.' });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return reply.status(409).send({ error: 'User is already enrolled in this course.' });

    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId },
    });

    return reply.status(201).send({ enrollment });
  });

  // ── POST /api/v1/courses/:id/generate-recap ────────────────────────────────
  server.post('/:id/generate-recap', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { id: courseId } = request.params as { id: string };
    const { lectureIds } = request.body as { lectureIds: string[] };

    if (!Array.isArray(lectureIds) || lectureIds.length < 2 || lectureIds.length > 20) {
      return reply.status(400).send({ error: 'lectureIds must be an array of 2 to 20 strings.' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId, deletedAt: null } });
    if (!course) return reply.status(404).send({ error: 'Course not found.' });

    const lectures = await prisma.lecture.findMany({
      where: { id: { in: lectureIds }, courseId, deletedAt: null },
      include: { aiSummaries: { where: { type: 'BRIEF' } } }
    });

    if (lectures.length !== lectureIds.length) {
      return reply.status(400).send({ error: 'One or more lectures not found in this course.' });
    }

    const missingSummaries = lectures.filter(l => l.aiSummaries.length === 0);
    if (missingSummaries.length > 0) {
      return reply.status(400).send({ error: `Lectures without BRIEF summaries: ${missingSummaries.map(l => l.title).join(', ')}` });
    }

    const recapTitle = generateRecapTitle(lectures);
    const summaryInputs = lectures.map(l => ({
      lectureTitle: l.title,
      orderIndex: l.orderIndex,
      summaryContent: l.aiSummaries[0].content
    }));

    let recapContent: string;
    try {
      // PRODUCTION NOTE: This is a synchronous AI call.
      // Our architecture uses ECS Fargate + ALB. ALB idle timeout defaults to 60s and must be configured to 130s before deployment.
      // Long-term fix: move to async job queue.
      recapContent = await Promise.race([
        ai.generateRecap(summaryInputs, course.title),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 120_000))
      ]);
    } catch (err: any) {
      if (err?.message === 'AI_TIMEOUT') {
        return reply.status(503).send({ error: { message: 'Recap generation timed out. Try fewer lectures.', code: 'AI_TIMEOUT' } });
      }
      return reply.status(502).send({ error: { message: `AI Error: ${err?.message}`, code: 'AI_ERROR' } });
    }

    const recap = await prisma.courseRecap.create({
      data: {
        courseId,
        title: recapTitle,
        content: recapContent,
        lectureCount: lectures.length,
        modelUsed: process.env.AI_MODEL ?? 'unknown',
        promptVersion: 'recap-generate.v1',
        lectures: {
          connect: lectureIds.map(id => ({ id }))
        }
      },
      include: { lectures: { select: { id: true } } }
    });

    return reply.status(201).send({ recap });
  });

  // ── GET /api/v1/courses/:id/recaps ─────────────────────────────────────────
  server.get('/:id/recaps', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id: courseId } = request.params as { id: string };

    const recaps = await prisma.courseRecap.findMany({
      where: { courseId },
      select: {
        id: true,
        courseId: true,
        title: true,
        lectureCount: true,
        modelUsed: true,
        promptVersion: true,
        createdAt: true,
        lectures: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ recaps });
  });

  // ── GET /api/v1/courses/:id/recaps/:recapId ────────────────────────────────
  server.get('/:id/recaps/:recapId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id: courseId, recapId } = request.params as { id: string; recapId: string };

    const recap = await prisma.courseRecap.findFirst({
      where: { id: recapId, courseId },
      include: { lectures: { select: { id: true } } }
    });

    if (!recap) return reply.status(404).send({ error: 'Recap not found.' });
    return reply.send({ recap });
  });

  // ── DELETE /api/v1/courses/:id/recaps/:recapId ─────────────────────────────
  server.delete('/:id/recaps/:recapId', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { id: courseId, recapId } = request.params as { id: string; recapId: string };

    const recap = await prisma.courseRecap.findFirst({ where: { id: recapId, courseId } });
    if (!recap) return reply.status(404).send({ error: 'Recap not found.' });

    await prisma.courseRecap.delete({ where: { id: recapId } });
  });
};
}
