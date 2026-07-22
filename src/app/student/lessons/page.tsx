'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAssignments, Assignment } from '@/lib/local-store';
import { ArrowLeft, BookOpen, FileText, ChevronRight, Calendar, FolderOpen, Layers } from 'lucide-react';
import { FilePdf } from '@/components/ui/FilePdf';

export default function LessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Assignment[]>([]);

  useEffect(() => {
    const now = new Date();
    const all = getAssignments().filter(a => {
      if (a.type !== 'vocabulary' && a.type !== 'grammar' && !a.pdfUrl && !a.passage) return false;
      if (!a.createdAt) return true;
      return new Date(a.createdAt) <= now;
    });
    setLessons(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Dashboard Học Viên
        </button>
      </div>

      <div className="fade-in">
        <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-2">
          <FolderOpen className="h-7 w-7 text-[#0071e3]" strokeWidth={1.5} />
          Thư Mục Bài Học & Tài Liệu
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Các bài học từ vựng và tài liệu lý thuyết PDF đã tạo. Nhấn vào bài để học và ôn tập.
        </p>
      </div>

      {lessons.length === 0 ? (
        <div className="glass p-16 text-center border border-white/5 rounded-3xl flex flex-col items-center gap-4">
          <Layers className="h-12 w-12 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">Chưa có bài học hoặc tài liệu nào.</p>
          <p className="text-xs text-muted-foreground/70">Giáo viên cần tạo bài tập hoặc tải tài liệu PDF trước.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {lessons.map(lesson => {
            const isPdfGrammar = lesson.type === 'grammar' || !!lesson.pdfUrl || (!lesson.vocabCards?.length && !!lesson.passage);
            const isVocab = (lesson.vocabCards?.length || 0) > 0;

            return (
              <div
                key={lesson.id}
                className="glass hover-lift p-5 rounded-3xl border border-white/5 flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl flex-shrink-0 ${isPdfGrammar ? 'bg-fuchsia-500/10' : 'bg-[#0071e3]/10'}`}>
                    {isPdfGrammar ? (
                      <FilePdf className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400" strokeWidth={1.5} />
                    ) : (
                      <BookOpen className="h-6 w-6 text-[#0071e3]" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-[#0071e3] transition-colors">
                        {lesson.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isPdfGrammar ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20' : 'bg-[#0071e3]/15 text-[#0071e3] border border-[#0071e3]/20'}`}>
                        {isPdfGrammar ? 'PDF Ngữ pháp' : 'Từ vựng'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isPdfGrammar ? 'Lý thuyết PDF' : `${lesson.vocabCards?.length || 0} từ vựng`}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground/70">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {new Date(lesson.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Word preview chips for vocab */}
                {isVocab && lesson.vocabCards && lesson.vocabCards.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.vocabCards.slice(0, 5).map((card, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#0071e3]/10 text-sky-600 dark:text-sky-400 text-xs font-semibold border border-[#0071e3]/15">
                        {card.word}
                      </span>
                    ))}
                    {lesson.vocabCards.length > 5 && (
                      <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-muted-foreground text-xs font-semibold border border-white/5">
                        +{lesson.vocabCards.length - 5} từ
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      if (isPdfGrammar && !isVocab) {
                        router.push(`/student/assignments/${lesson.id}`);
                      } else {
                        router.push(`/student/lessons/${lesson.id}`);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      isPdfGrammar && !isVocab
                        ? 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20'
                        : 'bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-sky-600 dark:text-sky-400 border-[#0071e3]/20'
                    }`}
                  >
                    {isPdfGrammar && !isVocab ? (
                      <FilePdf className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <BookOpen className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    {isPdfGrammar && !isVocab ? 'Xem Tài Liệu PDF' : 'Xem Chi Tiết & Ôn Tập'}
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
