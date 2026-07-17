import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { filename, base64Data } = await request.json();

    if (!base64Data) {
      return NextResponse.json({ error: 'Missing base64Data' }, { status: 400 });
    }

    const gasUrl = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;
    if (!gasUrl) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_GAS_WEB_APP_URL env variable' }, { status: 500 });
    }

    // Gửi server-to-server tới GAS Web App
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upload_pdf_to_drive',
        filename: filename || 'document.pdf',
        base64Data: base64Data
      }),
    });

    if (!gasResponse.ok) {
      throw new Error(`GAS responded with status: ${gasResponse.status}`);
    }

    const resText = await gasResponse.text();
    try {
      const resData = JSON.parse(resText);
      return NextResponse.json(resData);
    } catch (e: any) {
      throw new Error(`GAS returned non-JSON content. Response: ${resText.substring(0, 200)}`);
    }
  } catch (error: any) {
    console.error('Error proxying upload to GAS Drive:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload to Google Drive via proxy' }, { status: 500 });
  }
}
