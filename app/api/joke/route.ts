import { NextRequest, NextResponse } from 'next/server';
import {
  BATCH_SIZE,
  generateFinaleMessage,
  generateGopnikJoke,
  generateGopnikJokes,
} from '@/lib/deepseek';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const excludeParam = request.nextUrl.searchParams.get('exclude') ?? '';
  const context = request.nextUrl.searchParams.get('context') ?? undefined;
  const mode = request.nextUrl.searchParams.get('mode');
  const countParam = request.nextUrl.searchParams.get('count');

  const exclude = excludeParam
    ? excludeParam.split('|').map((s) => s.trim()).filter(Boolean)
    : [];

  if (mode === 'finale') {
    const result = await generateFinaleMessage(context);
    return NextResponse.json(result);
  }

  const count = countParam ? Math.min(20, Math.max(1, Number(countParam))) : 1;

  if (count > 1) {
    const result = await generateGopnikJokes(
      count || BATCH_SIZE,
      exclude,
      context
    );
    return NextResponse.json(result);
  }

  const result = await generateGopnikJoke(exclude, context);
  return NextResponse.json(result);
}
