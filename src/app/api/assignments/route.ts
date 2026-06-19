import { NextResponse } from 'next/server';
import { USE_MOCK_DB, mockAssignments } from '@/lib/database_mockup';

export const dynamic = 'force-dynamic'; // Ensures this API is not statically cached

export async function GET() {
  if (USE_MOCK_DB) {
    return NextResponse.json(mockAssignments);
  }

  const url = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;
  
  if (!url) {
    return NextResponse.json({ error: 'Missing NEXT_PUBLIC_GAS_WEB_APP_URL' }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}?action=get_assignments`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Next.js specific fetch options to bypass cache
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script responded with status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Lỗi khi fetch dữ liệu từ Google Sheets:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}
