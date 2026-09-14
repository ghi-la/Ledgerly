import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Fire-and-forget endpoint the client pings as early as possible on every
 * page load (see the beforeInteractive script in layout.tsx). Its only job
 * is to trigger connectDB() so a cold serverless instance opens its MongoDB
 * connection while the JS bundle is still downloading/parsing, instead of
 * only starting that handshake once the first real data request fires.
 * Deliberately unauthenticated - see middleware.ts's matcher - since it must
 * work before a session exists (e.g. from the login page) and returns
 * nothing worth protecting.
 */
export const GET = route(async () => {
  await connectDB();
  return NextResponse.json({ ok: true });
});
