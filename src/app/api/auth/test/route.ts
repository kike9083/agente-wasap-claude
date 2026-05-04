import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.set('test-cookie', 'hello', { path: '/' });
  return NextResponse.json({ ok: true });
}
