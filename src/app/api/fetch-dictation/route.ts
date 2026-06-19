import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Fetch & parse transcript from DailyDictation.com (or similar sites).
 * POST { url: string }
 * Returns { sentences: { id, text }[], title?, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EnglishTrackingBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Không thể tải trang (HTTP ${res.status})` }, { status: 502 });
    }

    const html = await res.text();

    // ── DailyDictation parser ─────────────────────────────────────────────────
    if (url.includes('dailydictation.com')) {
      const sentences = parseDailyDictation(html);
      const title = extractTitle(html);
      if (sentences.length > 0) {
        return NextResponse.json({ sentences, title });
      }
    }

    // ── Generic: try to extract sentences from common patterns ────────────────
    const genericSentences = parseGeneric(html);
    const title = extractTitle(html);
    if (genericSentences.length > 0) {
      return NextResponse.json({ sentences: genericSentences, title });
    }

    return NextResponse.json({
      error: 'Không thể tự động đọc transcript từ trang này. Vui lòng nhập thủ công.',
      title: extractTitle(html),
    });

  } catch (err: any) {
    console.error('[fetch-dictation]', err);
    if (err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Trang web phản hồi quá chậm (>8s). Vui lòng nhập thủ công.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Lỗi kết nối: ' + err.message }, { status: 500 });
  }
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].replace(/\s*[-|–]\s*.*$/, '').trim() : '';
}

function parseDailyDictation(html: string): { id: number; text: string; startTime: number }[] {
  const results: { id: number; text: string; startTime: number }[] = [];

  // DailyDictation stores sentences in data attributes or span tags
  // Pattern 1: data-sentence or data-text attributes
  const dataPattern = /data-(?:sentence|text|content)="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = dataPattern.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1]).trim();
    if (text && text.length > 5 && /[a-zA-Z]/.test(text)) {
      results.push({ id: results.length + 1, text, startTime: results.length * 5 });
    }
  }
  if (results.length > 0) return results;

  // Pattern 2: <p class="sentence"> or similar
  const pPattern = /<(?:p|span|div)[^>]*class="[^"]*(?:sentence|transcript|text|line)[^"]*"[^>]*>([^<]{10,300})<\/(?:p|span|div)>/gi;
  while ((m = pPattern.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1]).trim();
    if (text && /[a-zA-Z]/.test(text)) {
      results.push({ id: results.length + 1, text, startTime: results.length * 5 });
    }
  }
  if (results.length > 0) return results;

  // Pattern 3: JSON in script tags (common in SPA frameworks)
  const jsonPattern = /"(?:sentence|text|transcript)"\s*:\s*"([^"\\]{10,300})"/g;
  const seen = new Set<string>();
  while ((m = jsonPattern.exec(html)) !== null) {
    const text = m[1].trim();
    if (text && /[a-zA-Z]/.test(text) && !seen.has(text)) {
      seen.add(text);
      results.push({ id: results.length + 1, text, startTime: results.length * 5 });
    }
  }

  return results;
}

function parseGeneric(html: string): { id: number; text: string; startTime: number }[] {
  const results: { id: number; text: string; startTime: number }[] = [];
  // Look for numbered/bulleted sentences
  const pattern = /(?:<li[^>]*>|<p[^>]*>)\s*([A-Z][a-zA-Z\s,.'!?-]{20,200}[.!?])\s*(?:<\/li>|<\/p>)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = pattern.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1]).trim();
    if (!seen.has(text)) {
      seen.add(text);
      results.push({ id: results.length + 1, text, startTime: results.length * 5 });
    }
    if (results.length >= 20) break;
  }
  return results;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}
