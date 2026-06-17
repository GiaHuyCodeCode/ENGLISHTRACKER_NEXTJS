import { Submission } from './local-store';

/**
 * Gửi dữ liệu bài làm lên Google Sheets thông qua Google Apps Script Web App.
 * URL của Web App được cấu hình trong file .env.local (NEXT_PUBLIC_GAS_WEB_APP_URL)
 */
export async function syncSubmissionToSheet(submission: any): Promise<void> {
  const url = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;

  if (!url) {
    console.warn('⚠️ Google Sheets Sync: Missing NEXT_PUBLIC_GAS_WEB_APP_URL. Dữ liệu chưa được gửi lên Sheets.');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Cần thiết để tránh lỗi CORS khi gửi request từ localhost lên Google Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    // Vì dùng mode 'no-cors', response trả về luôn là 'opaque', chúng ta không thể đọc JSON response.
    // Tuy nhiên, nếu không bắn lỗi network, request đã được gửi đi.
    console.log('✅ Đã đẩy dữ liệu lên Google Sheets thành công (nền).', submission.studentName);
  } catch (error) {
    console.error('❌ Lỗi khi gửi dữ liệu lên Google Sheets:', error);
  }
}

/**
 * Gửi đề bài mới lên Google Sheets thông qua Google Apps Script Web App.
 */
export async function syncAssignmentToSheet(assignment: any): Promise<void> {
  const url = process.env.NEXT_PUBLIC_GAS_WEB_APP_URL;

  if (!url) {
    console.warn('⚠️ Google Sheets Sync: Missing NEXT_PUBLIC_GAS_WEB_APP_URL.');
    return;
  }

  try {
    const payload = { ...assignment, action: 'add_assignment' };
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('✅ Đã đẩy bài tập lên Google Sheets thành công (nền).', assignment.title);
  } catch (error) {
    console.error('❌ Lỗi khi đẩy bài tập lên Google Sheets:', error);
  }
}
