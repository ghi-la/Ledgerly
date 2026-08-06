import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is missing. Copy .env.example to .env.local and fill it in.');
}

// Serverless functions are recycled constantly, so the connection is cached on
// the global object to avoid opening a new pool on every invocation.
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalCache = global as unknown as { _mongoose?: Cache };
const cached: Cache = globalCache._mongoose ?? { conn: null, promise: null };
globalCache._mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
