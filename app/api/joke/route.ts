import { NextRequest, NextResponse } from 'next/server';
import { generateGopnikJoke } from '@/lib/deepseek';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const excludeParam = request.nextUrl.searchParams.get('exclude') ?? '';
  const context = request.nextUrl.searchParams.get('context') ?? undefined;

  const exclude = excludeParam
    ? excludeParam.split('|').map((s) => s.trim()).filter(Boolean)
    : [];

  const result = await generateGopnikJoke(exclude, context);

  return NextResponse.json(result);
}
