import { NextRequest, NextResponse } from 'next/server';
import { generateFinaleMessage, generateGopnikJoke } from '@/lib/deepseek';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const excludeParam = request.nextUrl.searchParams.get('exclude') ?? '';
  const context = request.nextUrl.searchParams.get('context') ?? undefined;
  const mode = request.nextUrl.searchParams.get('mode');

  const exclude = excludeParam
    ? excludeParam.split('|').map((s) => s.trim()).filter(Boolean)
    : [];

  const result =
    mode === 'finale'
      ? await generateFinaleMessage(context)
      : await generateGopnikJoke(exclude, context);

  return NextResponse.json(result);
}
