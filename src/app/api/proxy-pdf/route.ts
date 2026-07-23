import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url');

    if (!targetUrl || targetUrl === 'undefined' || targetUrl === 'null' || targetUrl.startsWith('[object')) {
      return NextResponse.json({ error: 'Invalid or missing url query parameter' }, { status: 400 });
    }

    // Nếu url là dạng Data URL (base64)
    if (targetUrl.startsWith('data:')) {
      const commaIdx = targetUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = targetUrl.substring(0, commaIdx);
        const mimeMatch = header.match(/data:(.*?);/);
        const contentType = mimeMatch ? mimeMatch[1] : 'application/pdf';
        const base64Data = targetUrl.substring(commaIdx + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        return new Response(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    if (!targetUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    let fileId: string | null = null;
    // Nếu url là dạng Google Drive view link, chuyển thành dạng direct download link
    if (targetUrl.includes('drive.google.com/file/d/')) {
      const match = targetUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        fileId = match[1];
        targetUrl = `https://drive.google.com/uc?export=download&confirm=no_antivirus&id=${fileId}`;
      }
    } else if (targetUrl.includes('drive.google.com/open?id=')) {
      const match = targetUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        fileId = match[1];
        targetUrl = `https://drive.google.com/uc?export=download&confirm=no_antivirus&id=${fileId}`;
      }
    } else if (targetUrl.includes('drive.google.com/uc?') && !targetUrl.includes('confirm=no_antivirus')) {
      targetUrl += '&confirm=no_antivirus';
    }

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });
    } catch (primaryErr) {
      if (fileId) {
        // Thử URL Google Drive fallback 1
        const fallbackUrl = `https://lh3.googleusercontent.com/u/0/d/${fileId}`;
        res = await fetch(fallbackUrl, { method: 'GET', redirect: 'follow' });
      } else {
        throw primaryErr;
      }
    }

    if (!res.ok && fileId) {
      // Retry với fallback URL thứ 2 nếu status là non-200
      const fallbackUrl2 = `https://drive.google.com/uc?id=${fileId}&export=download`;
      const resFallback = await fetch(fallbackUrl2, { method: 'GET', redirect: 'follow' });
      if (resFallback.ok) {
        res = resFallback;
      }
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch PDF from target URL. Status: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'application/pdf';
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('Error proxying PDF request:', error);
    return NextResponse.json({ error: error.message || 'Failed to proxy PDF' }, { status: 500 });
  }
}

