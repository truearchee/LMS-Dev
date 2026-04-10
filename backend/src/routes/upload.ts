import { FastifyInstance } from 'fastify';
import { pipeline } from 'stream/promises';
import { Writable } from 'stream';
import { StorageService } from '../services/storage/StorageService.js';

// The route receives the StorageService via dependency injection.
// It has no knowledge of which backend (local, S3, R2) is active.
export async function uploadRoutes(
  fastify: FastifyInstance,
  opts: { storage: StorageService },
) {
  fastify.post('/', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Stream multipart data into a buffer
    const chunks: Buffer[] = [];
    const collector = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });
    await pipeline(data.file, collector);
    const buffer = Buffer.concat(chunks);

    const url = await opts.storage.upload(
      buffer,
      data.filename,
      data.mimetype,
    );

    return reply.send({ message: 'File uploaded successfully', url });
  });
}
