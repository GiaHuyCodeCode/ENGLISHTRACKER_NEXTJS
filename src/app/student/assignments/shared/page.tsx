'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { importAssignment, Assignment } from '@/lib/local-store';
import { BookOpen } from 'lucide-react';

function SharedAssignmentHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (!dataParam) {
      setError('Đường link không hợp lệ hoặc thiếu dữ liệu bài tập.');
      return;
    }

    try {
      // Decode Base64 string safely handling unicode
      const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(dataParam))));
      const assignment: Assignment = JSON.parse(jsonStr);

      if (!assignment.id || !assignment.title || !assignment.type) {
        throw new Error('Dữ liệu bài tập không đúng định dạng.');
      }

      // Lưu bài tập vào local storage của học viên
      importAssignment(assignment);

      // Chuyển hướng tới trang làm bài tập đó
      router.push(`/student/assignments/${assignment.id}`);
    } catch (e) {
      console.error(e);
      setError('Đường link bị lỗi hoặc dữ liệu bài tập đã bị hỏng.');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center fade-in">
        <div className="p-4 bg-red-500/10 dark:bg-red-500/10 rounded-full mb-4">
          <BookOpen className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-foreground">Lỗi Mở Bài Tập</h1>
        <p className="text-muted-foreground">{error}</p>
        <button 
          onClick={() => router.push('/student')}
          className="mt-6 px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] fade-in">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
      <h2 className="text-xl font-bold font-heading text-foreground">Đang nạp bài tập...</h2>
      <p className="text-muted-foreground text-sm mt-2">Vui lòng đợi giây lát để hệ thống tải giao diện làm bài.</p>
    </div>
  );
}

export default function SharedAssignmentPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"/>
      </div>
    }>
      <SharedAssignmentHandler />
    </Suspense>
  );
}
