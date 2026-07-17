import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url');

    if (!targetUrl || targetUrl === 'undefined' || targetUrl === 'null' || targetUrl.startsWith('[object') || !targetUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid or missing url query parameter' }, { status: 400 });
    }

    // Nếu url là dạng Google Drive view link, chuyển nó thành dạng direct download link để fetch được file
    // Ví dụ: https://drive.google.com/file/d/FILE_ID/view -> https://drive.google.com/uc?export=download&id=FILE_ID
    if (targetUrl.includes('drive.google.com/file/d/')) {
      const match = targetUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    } else if (targetUrl.includes('drive.google.com/open?id=')) {
      const match = targetUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    const res = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch PDF from target URL. Status: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'application/pdf';
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
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
