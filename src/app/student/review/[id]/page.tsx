'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAssignment, getSubmissions, seedIfEmpty,
  Assignment, Submission
} from '@/lib/local-store';
import { VocabContextExercise } from '@/components/exercises/VocabContextExercise';
import { MultipleChoiceExercise } from '@/components/exercises/MultipleChoiceExercise';
import { RewriteVocabExercise } from '@/components/exercises/RewriteVocabExercise';
import { VocabularyExercise } from '@/components/exercises/VocabularyExercise';
import { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';
import { ArrowLeft, Clock, CheckCircle2, Trophy, HelpCircle, Star, X } from 'lucide-react';
import Link from 'next/link';

export default function StudentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    const allSubs = getSubmissions();
    const foundSub = allSubs.find(s => s.id === id);
    if (!foundSub) {
      setIsLoading(false);
      return;
    }

    const parseJsonSafely = (val: any) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
      }
      return val;
    };

    const parsedSub: Submission = { ...foundSub };
    if (parsedSub.details) {
      const parsedDetails = parseJsonSafely(parsedSub.details);
      if (parsedSub.assignmentType === 'multiple_choice') {
        parsedSub.quizAnswers = parsedDetails;
      } else if (parsedSub.assignmentType === 'vocab_context' || parsedSub.assignmentType === 'vocabulary') {
        parsedSub.vocabAnswers = parsedDetails;
      } else if (parsedSub.assignmentType === 'rewrite_vocab') {
        parsedSub.rewriteAnswers = parsedDetails;
      }
    } else {
      if (parsedSub.rewriteAnswers) parsedSub.rewriteAnswers = parseJsonSafely(parsedSub.rewriteAnswers);
      if (parsedSub.quizAnswers) parsedSub.quizAnswers = parseJsonSafely(parsedSub.quizAnswers);
      if (parsedSub.vocabAnswers) parsedSub.vocabAnswers = parseJsonSafely(parsedSub.vocabAnswers);
    }

    setSubmission(parsedSub);

    const a = getAssignment(parsedSub.assignmentId);
    if (a) {
      const parsedAss: Assignment = { ...a };
      if (parsedAss.keywords) parsedAss.keywords = parseJsonSafely(parsedAss.keywords);
      if (parsedAss.questions) parsedAss.questions = parseJsonSafely(parsedAss.questions);
      if (parsedAss.vocabCards) parsedAss.vocabCards = parseJsonSafely(parsedAss.vocabCards);
      if (parsedAss.sentences) parsedAss.sentences = parseJsonSafely(parsedAss.sentences);
      setAssignment(parsedAss);
    }
    setIsLoading(false);
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-3 w-full max-w-lg">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!submission || !assignment) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-heading">Không tìm thấy bài làm</h2>
        <p className="text-sm text-muted-foreground">Bài làm của bạn không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
        <button
          onClick={() => router.push('/student')}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
        >
          Quay lại Dashboard
        </button>
      </div>
    );
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getQuestionMap = () => {
    if (assignment.type === 'multiple_choice' && assignment.questions) {
      return assignment.questions.map((q, idx) => {
        const ans = submission.quizAnswers?.find(r => String(r.questionId) === String(q.id));
        const isCorrect = ans ? ans.isCorrect : false;
        return {
          id: `mc-question-${idx}`,
          label: `${idx + 1}`,
          isCorrect,
          title: `Câu ${idx + 1}: ${isCorrect ? 'Đúng' : 'Sai'}`,
          onClick: () => {
            const el = document.getElementById(`mc-question-${idx}`);
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY - 24;
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }
        };
      });
    }

    if (assignment.type === 'vocabulary' && assignment.vocabCards) {
      return assignment.vocabCards.map((c, idx) => {
        let answersList: any[] = [];
        if (Array.isArray(submission.vocabAnswers)) {
          answersList = submission.vocabAnswers;
        } else if (submission.vocabAnswers && typeof submission.vocabAnswers === 'object') {
          answersList = Object.keys(submission.vocabAnswers).map(key => ({
            word: key,
            correctAnswer: key,
            studentAnswer: (submission.vocabAnswers as any)[key],
            isCorrect: typeof (submission.vocabAnswers as any)[key] === 'string'
              ? ((submission.vocabAnswers as any)[key] || '').trim().toLowerCase() === key.toLowerCase()
              : false
          }));
        } else if (Array.isArray((submission as any).details)) {
          answersList = (submission as any).details;
        }

        const ans = answersList.find((r: any) => {
          const w = r?.word || r?.correctAnswer;
          return w && c.word && w.toLowerCase() === c.word.toLowerCase();
        });
        const isCorrect = ans ? ans.isCorrect : false;
        return {
          id: `vocab-word-${idx}`,
          label: `${idx + 1}`,
          isCorrect,
          title: `${c.word}: ${isCorrect ? 'Đúng' : 'Sai'}`,
          onClick: () => {
            window.dispatchEvent(new CustomEvent('vocab-jump', { detail: { index: idx } }));
            const el = document.getElementById('vocab-exercise-container');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
      });
    }

    if (assignment.type === 'vocab_context' && assignment.keywords) {
      return assignment.keywords.map((k, idx) => {
        let answersList: any[] = [];
        if (Array.isArray(submission.vocabAnswers)) {
          answersList = submission.vocabAnswers;
        } else if (submission.vocabAnswers && typeof submission.vocabAnswers === 'object') {
          answersList = Object.keys(submission.vocabAnswers).map(key => ({
            word: key,
            correctAnswer: key,
            studentAnswer: (submission.vocabAnswers as any)[key],
            isCorrect: typeof (submission.vocabAnswers as any)[key] === 'string'
              ? ((submission.vocabAnswers as any)[key] || '').trim().toLowerCase() === key.toLowerCase()
              : false
          }));
        } else if (Array.isArray((submission as any).details)) {
          answersList = (submission as any).details;
        }

        const ans = answersList.find((r: any) => {
          const w = r?.word || r?.correctAnswer;
          return w && k.word && w.toLowerCase() === k.word.toLowerCase();
        });
        const isCorrect = ans ? ans.isCorrect : false;
        return {
          id: `ctx-word-${k.word.toLowerCase()}`,
          label: `${idx + 1}`,
          isCorrect,
          title: `${k.word}: ${isCorrect ? 'Đúng' : 'Sai'}`,
          onClick: () => {
            const el = document.getElementById(`ctx-word-${k.word.toLowerCase()}`);
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY - 24;
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }
        };
      });
    }

    if (assignment.type === 'rewrite_vocab' && assignment.keywords) {
      return assignment.keywords.map((k, idx) => {
        const isCorrect = submission.rewriteAnswers?.foundKeywords?.includes(k.word) || false;
        return {
          id: `rw-keyword-${k.word.toLowerCase()}`,
          label: `${idx + 1}`,
          isCorrect,
          title: `${k.word}: ${isCorrect ? 'Đã dùng' : 'Chưa dùng'}`,
          onClick: () => {
            const el = document.getElementById(`rw-keyword-${k.word.toLowerCase()}`);
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY - 24;
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }
        };
      });
    }

    return [];
  };

  const questionMap = getQuestionMap();

  // Fallback: nếu vocabAnswers là Record<string,string> thay vì array,
  // hoặc nếu questionMap trả về toàn bộ sai dù điểm > 0,
  // thì tính correctCount từ answers gốc
  let correctCount = questionMap.filter(q => q.isCorrect).length;
  let totalCount = questionMap.length;

  if (
    (assignment.type === 'vocabulary' || assignment.type === 'vocab_context') &&
    correctCount === 0 && submission.score > 0 &&
    totalCount > 0
  ) {
    // Thử tính lại từ vocabAnswers dạng object
    const rawAnswers = submission.vocabAnswers as any;
    if (rawAnswers && !Array.isArray(rawAnswers) && typeof rawAnswers === 'object') {
      const words = assignment.type === 'vocabulary'
        ? (assignment.vocabCards || []).map((c: any) => c.word)
        : (assignment.keywords || []).map((k: any) => k.word);
      correctCount = words.filter((w: string) => {
        const ans = rawAnswers[w] || '';
        return ans.trim().toLowerCase() === w.toLowerCase();
      }).length;
    }
  }

  return (
    <>
      {/* Mobile Sticky Question Map Bar */}
      {questionMap.length > 0 && assignment.type !== 'vocabulary' && (
        <div className="sticky top-16 z-40 lg:hidden -mx-4 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Đối chiếu đáp án:</span>
            <span className="text-xs font-extrabold text-emerald-400">{correctCount} đúng</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-extrabold text-red-400">{totalCount - correctCount} sai</span>
          </div>
          <button
            onClick={() => setIsMobileMapOpen(true)}
            className="px-3 py-1.5 bg-[#0071e3]/10 border border-[#0071e3]/20 rounded-xl text-xs font-bold text-[#0071e3] active:scale-95 transition-all"
          >
            Xem sơ đồ câu
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Back to history header */}
      <div className="flex items-center gap-4">
        <Link
          href="/student"
          className="p-2 rounded-xl border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <div>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wider">
            Xem Lại Kết Quả (Đọc duy nhất)
          </span>
          <h1 className="text-xl font-bold font-heading gradient-text mt-1">{assignment.title}</h1>
        </div>
      </div>

      {/* Premium Sticky Status Bar */}
      <div className="glass-strong rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl flex items-center justify-between gap-8 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-heading border-2 flex-shrink-0 ${
            submission.score >= 80 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 glow-success' :
            submission.score >= 50 ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' :
            'border-red-500/40 bg-red-500/10 text-red-400 glow-error'
          }`}>
            <div className="text-center">
              <span className="text-2xl font-black">{submission.score}</span>
              <span className="text-[10px] block opacity-70">điểm</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{submission.studentName}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{new Date(submission.submittedAt).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-sky-400" /> {formatDuration(submission.durationMs)}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> {correctCount}/{totalCount} câu đúng</span>
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            submission.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            submission.score >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {submission.score >= 80 ? 'Xuất sắc 🏆' : submission.score >= 50 ? 'Đạt yêu cầu 💪' : 'Cần ôn tập 📚'}
          </span>
        </div>
      </div>

      {/* Main Grid Layout: Left Sidebar + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sticky Sidebar: Sơ đồ câu hỏi (Desktop Only) */}
        {questionMap.length > 0 && assignment.type !== 'vocabulary' && (
          <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-4 z-30 space-y-4 self-start">
            <div className="glass-strong rounded-3xl border border-white/10 p-5 md:p-6 shadow-xl space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                <span>Sơ đồ câu hỏi</span>
                <span className={submission.score >= 80 ? 'text-emerald-400' : submission.score >= 50 ? 'text-amber-400' : 'text-red-400'}>
                  {submission.score >= 80 ? 'Đạt 🏆' : submission.score >= 50 ? 'Khá 💪' : 'Yếu 📚'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {questionMap.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={q.onClick}
                    title={q.title}
                    className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center border transition-all hover:scale-110 active:scale-95 ${
                      q.isCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30 glow-error'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Exercise Content Area - Read only mode */}
        <div id="vocab-exercise-container" className={`${questionMap.length > 0 && assignment.type !== 'vocabulary' ? 'lg:col-span-3' : 'lg:col-span-4'} w-full space-y-6 order-first lg:order-last`}>
          {/* Teacher feedback panel if available */}
          {submission.feedback && (
            <div className="glass rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5 space-y-2">
              <p className="text-xs uppercase font-bold tracking-widest text-amber-400 flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Nhận xét từ giáo viên
              </p>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed pl-1">
                {submission.feedback}
              </p>
            </div>
          )}

          {assignment.type === 'vocab_context' && assignment.passage && assignment.keywords && (
            <div className="glass rounded-3xl border border-white/5 p-6 md:p-8">
              <VocabContextExercise
                passage={assignment.passage}
                keywords={assignment.keywords}
                onSubmit={() => {}}
                isSubmitting={false}
                result={submission.vocabAnswers}
                score={submission.score}
                durationMs={submission.durationMs}
              />
            </div>
          )}

          {assignment.type === 'multiple_choice' && assignment.questions && (
            <div className="glass rounded-3xl border border-white/5 p-6 md:p-8">
              <MultipleChoiceExercise
                questions={assignment.questions}
                onSubmit={() => {}}
                isSubmitting={false}
                result={submission.quizAnswers}
                score={submission.score}
                durationMs={submission.durationMs}
                hideSidebar={true}
              />
            </div>
          )}

          {assignment.type === 'rewrite_vocab' && assignment.keywords && (
            <div className="glass rounded-3xl border border-white/5 p-6 md:p-8">
              <RewriteVocabExercise
                passage={assignment.passage || 'Viết một đoạn văn ngắn (chuyện chêm) bằng tiếng Việt, có sử dụng các từ khóa tiếng Anh dưới đây.'}
                keywords={assignment.keywords}
                onSubmit={() => {}}
                isSubmitting={false}
                result={submission.rewriteAnswers}
                score={submission.score}
                durationMs={submission.durationMs}
              />
            </div>
          )}

          {assignment.type === 'vocabulary' && assignment.vocabCards && (
            <VocabularyExercise
              vocabCards={assignment.vocabCards}
              onSubmit={() => {}}
              isSubmitting={false}
              result={submission.vocabAnswers}
              score={submission.score}
              durationMs={submission.durationMs}
              initialMode="dictation"
              isRequirementWorkflow={true}
            />
          )}

          {/* Standings Leaderboard */}
          <RaceTrackLeaderboard submissions={getSubmissions().filter(s => s.assignmentId === assignment.id)} />
        </div>
      </div>
    </div>

    {/* Bottom Sheet for Mobile Sơ đồ câu hỏi */}
    {questionMap.length > 0 && assignment.type !== 'vocabulary' && (
      <>
        {/* Backdrop */}
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
            isMobileMapOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMobileMapOpen(false)}
        />
        
        {/* Drawer Panel */}
        <div className={`fixed bottom-0 left-0 right-0 glass-strong border-t border-white/10 rounded-t-[2rem] p-6 z-50 lg:hidden transition-transform duration-300 ease-out transform ${
          isMobileMapOpen ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" /> Sơ đồ câu hỏi đối chiếu
              </h3>
              <button 
                onClick={() => setIsMobileMapOpen(false)} 
                className="p-1.5 bg-white/5 border border-white/5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress Summary and Circular-style Ring */}
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
              <div>
                <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground font-heading">Kết quả đạt được</h4>
                <p className="text-xl font-black mt-1 text-white">{submission.score} Điểm</p>
              </div>
              <div className="text-right text-xs space-y-1">
                <div className="text-emerald-400 font-bold">✓ {correctCount} câu đúng</div>
                <div className="text-red-400 font-bold">✗ {totalCount - correctCount} câu sai</div>
              </div>
            </div>

            {/* Grid map */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chi tiết các câu</p>
              <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                {questionMap.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      q.onClick();
                      setIsMobileMapOpen(false);
                    }}
                    title={q.title}
                    className={`w-10 h-10 mx-auto rounded-xl text-xs font-bold flex items-center justify-center border transition-all active:scale-95 ${
                      q.isCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )}
  </>
  );
}
