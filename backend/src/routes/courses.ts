import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const coursesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
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
      include: { lectures: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } } }
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
};
