'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QuizQuestion, QuizAnswerResult, Submission, getStudentAvatar, getStudentColors } from '@/lib/local-store';
import { CheckCircle2, XCircle, Send, Star, X, ArrowLeft } from 'lucide-react';
import { ExerciseTimer } from '@/components/ui/ExerciseTimer';

interface Props {
  questions: QuizQuestion[];
  onSubmit: (answers: { questionId: number; studentAnswer: string }[]) => void;
  isSubmitting?: boolean;
  result?: QuizAnswerResult[];
  score?: number;
  durationMs?: number;
  allowHints?: boolean;
  feedback?: string;
  allSubmissions?: Submission[];
  hideSidebar?: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'];

export function MultipleChoiceExercise({ questions, onSubmit, isSubmitting, result, score, durationMs, feedback, allSubmissions, allowHints, hideSidebar }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  // Tự động reveal hint khi người dùng đã chọn đáp án cho câu đó
  useEffect(() => {
    if (!allowHints) return;
    setRevealedHints(prev => {
      const next = new Set(prev);
      let changed = false;
      questions.forEach(q => {
        if (q.hint && selected[q.id] && !next.has(q.id)) {
          next.add(q.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selected, allowHints, questions]);

  const isSubmitted = !!result;
  const answered = Object.keys(selected).length;
  const remaining = questions.length - answered;

  useEffect(() => {
    if (isSubmitted || isSubmitting) {
      setAutoSubmitCountdown(null);
      return;
    }
    if (remaining === 0 && questions.length > 0) {
      setAutoSubmitCountdown(10);
    } else {
      setAutoSubmitCountdown(null);
    }
  }, [remaining, isSubmitted, isSubmitting, questions.length]);

  const handleSubmit = useCallback(() => {
    onSubmit(questions.map(q => ({ questionId: q.id, studentAnswer: selected[q.id] || '' })));
  }, [onSubmit, questions, selected]);

  useEffect(() => {
    if (autoSubmitCountdown === null || autoSubmitCountdown <= 0) return;
    const timer = setTimeout(() => {
      if (autoSubmitCountdown === 1) {
        handleSubmit();
        setAutoSubmitCountdown(null);
      } else {
        setAutoSubmitCountdown(prev => prev ? prev - 1 : null);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoSubmitCountdown, handleSubmit]);

  const getResult = (qid: number) => result?.find(r => String(r.questionId) === String(qid));

  const cleanOptionText = (opt: string, label: string) => {
    if (!opt) return '';
    const trimmed = opt.trim();
    const regex = new RegExp(`^${label}\\s*([\\.\\-\\/\\):])\\s*`, 'i');
    return trimmed.replace(regex, '');
  };


  const correctCount = result?.filter(r => r.isCorrect).length ?? 0;

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
  };

  return (
    <>
      {/* Sticky Mobile Status Bar */}
      {!hideSidebar && (
        <div className="sticky top-16 z-40 lg:hidden mb-4 bg-background/85 dark:bg-black/65 border border-black/10 dark:border-white/5 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg">
          <button
            onClick={() => router.push('/student/assignments')}
            className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tiến độ</span>
              <span className="text-xs font-extrabold text-primary">{answered}/{questions.length}</span>
            </div>
            {!isSubmitted && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Thời gian:</span>
                <ExerciseTimer isRunning={true} className="!p-0 !bg-transparent text-[10px] font-bold text-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all duration-500" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>

          <button
            onClick={() => setIsMobileMapOpen(true)}
            className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary active:scale-95 transition-all shrink-0"
          >
            Sơ đồ
          </button>
        </div>
      )}

      <div className={hideSidebar ? "space-y-5" : "grid grid-cols-1 lg:grid-cols-4 gap-6 items-start"}>
        {/* Left Sidebar (Desktop Only) */}
        {!hideSidebar && (
          <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-4 z-30 space-y-4 self-start">
            {!isSubmitted && (
              <div className="glass-strong rounded-3xl border border-black/10 dark:border-white/10 p-5 shadow-xl">
                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-3 text-center">Thời gian làm bài</div>
                <ExerciseTimer isRunning={true} className="w-full justify-center py-3 text-lg font-bold" />
              </div>
            )}
            <div className="glass-strong rounded-3xl border border-black/10 dark:border-white/10 p-5 shadow-xl space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                <span>Sơ đồ câu hỏi</span>
                <span>{answered}/{questions.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = !!selected[q.id];
                  const qResult = getResult(q.id);
                  const isCorrect = qResult?.isCorrect;

                  let btnClass = 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80';
                  if (isSubmitted) {
                    btnClass = isCorrect ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40';
                  } else if (isAnswered) {
                    btnClass = 'bg-primary/20 text-primary border-primary/40';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const el = document.getElementById(`mc-question-${idx}`);
                        if (el) {
                          const y = el.getBoundingClientRect().top + window.scrollY - 24;
                          window.scrollTo({ top: y, behavior: 'smooth' });
                        }
                      }}
                      className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center border transition-all hover:scale-110 active:scale-95 ${btnClass}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button in Sidebar */}
            {!isSubmitted && (
              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || answered === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary shadow-xl"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? 'Đang chấm...' : answered < questions.length ? `Nộp bài (${answered}/${questions.length})` : (autoSubmitCountdown !== null ? `Tự động nộp sau ${autoSubmitCountdown}s` : 'Hoàn Thành & Nộp Bài')}
                </button>
                {remaining > 0 && (
                  <p className="text-[10.5px] text-amber-600 dark:text-amber-400 text-center mt-2.5 font-semibold">
                    Còn {remaining} câu chưa làm
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Content */}
        <div className={hideSidebar ? "space-y-5" : "lg:col-span-3 space-y-5 w-full order-first lg:order-last"}>
          {/* Score banner */}
          {isSubmitted && score !== undefined && (
            <div className={`rounded-2xl p-5 text-center border-2 score-pop ${score >= 80 ? 'border-emerald-500/40 bg-emerald-500/8 glow-success' :
                score >= 50 ? 'border-amber-500/40 bg-amber-500/8' :
                  'border-red-500/40 bg-red-500/8'
              }`}>
              <div className={`text-5xl font-bold font-heading ${score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}>
                {score}<span className="text-xl text-muted-foreground">/100</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ✅ {correctCount}/{result?.length} câu đúng
                {score >= 80 && ' — Tuyệt vời! 🏆'}{score >= 50 && score < 80 && ' — Khá! 💪'}{score < 50 && ' — Cần ôn lại! 📚'}
              </p>
              {durationMs && (
                <p className="text-sm font-medium text-foreground/80 mt-1">
                  ⏱ Thời gian: {formatDuration(durationMs)}
                </p>
              )}
              {feedback && (
                <div className="mt-4 p-4 text-left bg-background/50 rounded-xl border border-border/50 text-sm">
                  {feedback.split('\n').map((line, i) => (
                    <p key={i} className={i === 0 ? "font-semibold mb-2 text-foreground" : "text-muted-foreground ml-2"}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Questions */}
          {questions.map((q, idx) => {
            const qResult = getResult(q.id);
            const hasAnsweredLocal = !!selected[q.id];
            const localIsCorrect = selected[q.id] === q.answer;
            const isCorrect = isSubmitted ? qResult?.isCorrect : localIsCorrect;
            const showAnswer = isSubmitted || hasAnsweredLocal;

            const failedPeersForQuestion = allSubmissions?.filter(sub => {
              const answersArray = sub.quizAnswers || (sub as any).details;
              if (!answersArray) return false;
              const ans = answersArray.find((a: any) => String(a.questionId) === String(q.id));
              return ans && !ans.isCorrect;
            }).map(sub => sub.studentName) || [];
            const uniqueFailedPeersForQuestion = Array.from(new Set(failedPeersForQuestion));

            return (
              <div key={q.id} id={`mc-question-${idx}`} className={`glass rounded-2xl border transition-all overflow-hidden ${showAnswer
                  ? isCorrect
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                  : 'border-border hover:border-primary/30'
                }`}>
                {/* Question */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border ${showAnswer
                        ? isCorrect
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40'
                        : 'bg-secondary text-muted-foreground border-border'
                      }`}>{idx + 1}</span>

                    <div className="flex-1 min-w-0">
                      {/* Tags */}
                      {(q.knowledgeArea || uniqueFailedPeersForQuestion.length > 0) && (
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {q.knowledgeArea && (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/10 border border-teal-500/20 rounded-md">
                              {q.knowledgeArea}
                            </span>
                          )}
                          {uniqueFailedPeersForQuestion.length > 0 && (
                            <div className="flex gap-1.5 py-0.5">
                              {uniqueFailedPeersForQuestion.map(peer => {
                                const colors = getStudentColors(peer || 'Unknown');
                                return (
                                  <div key={peer || 'unknown'} title={`${peer} đã làm sai câu này`}
                                    className={`relative w-7 h-7 rounded-full border-2 border-red-500 flex items-center justify-center text-[9px] font-bold shadow-md z-10 hover:z-20 transition-all hover:scale-110 ${colors.bg} ${colors.text}`}>
                                    {getStudentAvatar(peer || 'Unknown')}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Hint — hiện dưới dạng bài tập và trên câu hỏi khi hiển thị kết quả HOẶC khi được kích hoạt gợi ý trước đó */}
                      {((showAnswer && q.hint) || (allowHints && q.hint && !showAnswer && revealedHints.has(q.id))) && (
                        <div className="mb-3 text-xs text-amber-600 dark:text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 max-w-xl animate-in fade-in duration-300">
                          <span className="flex-shrink-0">💡</span>
                          <span><span className="font-semibold text-foreground">Gợi ý:</span> {q.hint}</span>
                        </div>
                      )}

                      {/* Câu hỏi */}
                      <p className="font-medium text-sm leading-relaxed select-text">
                        {q.question}
                      </p>

                      {/* Translate — hiện dưới câu hỏi CHỈ SAU KHI đã trả lời */}
                      {showAnswer && q.translation && (
                        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'hsl(150 10% 58%)' }}>
                          🇻🇳 {q.translation}
                        </p>
                      )}
                    </div>

                    {/* Trạng thái đúng/sai */}
                    {showAnswer && (
                      isCorrect
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}

                    {/* Nút hint 💡 — vị trí cũ */}
                    {allowHints && q.hint && !showAnswer && (
                      <button
                        onClick={() => setRevealedHints(prev => {
                          const next = new Set(prev);
                          if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                          return next;
                        })}
                        title={revealedHints.has(q.id) ? 'Ẩn gợi ý' : 'Xem gợi ý'}
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95 border ${revealedHints.has(q.id)
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                            : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-muted-foreground hover:border-amber-500/40 hover:text-amber-600 dark:text-amber-400'
                          }`}
                      >
                        💡
                      </button>
                    )}
                  </div>
                </div>

                {/* Options */}
                <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => {
                    const label = LABELS[optIdx];
                    const isChosen = isSubmitted
                      ? String(qResult?.studentAnswer).trim().toUpperCase() === String(label).trim().toUpperCase()
                      : selected[q.id] === label;
                    const isCorrectOpt = showAnswer && q.answer.toUpperCase() === label;

                    let cls = 'border border-border/60 text-foreground/70 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground cursor-pointer';
                    if (!showAnswer && isChosen) cls = 'border-2 border-primary bg-primary/15 text-primary font-semibold cursor-pointer';
                    if (showAnswer && isCorrectOpt) cls = 'border-2 border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold cursor-default';
                    if (showAnswer && isChosen && !isCorrectOpt) cls = 'border-2 border-red-500 bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-400 line-through cursor-default';
                    if (showAnswer && !isChosen && !isCorrectOpt) cls = 'border border-border/30 text-muted-foreground/50 cursor-default';

                    return (
                      <button
                        key={optIdx}
                        onClick={() => !showAnswer && setSelected(prev => ({ ...prev, [q.id]: label }))}
                        disabled={showAnswer}
                        className={`allow-dictionary flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all ${cls}`}
                      >
                        <span className="w-6 h-6 rounded-full border-current border flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          {label}
                        </span>
                        <span className="leading-tight">{cleanOptionText(opt, label)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Phần dưới: đáp án đúng + giải thích ── */}
                {showAnswer && (
                  <div className="mx-5 mb-5 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3 text-xs animate-in fade-in duration-300">
                    {/* 1. Đáp án đúng */}
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">Đáp án đúng:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/10 px-2 py-0.5 rounded leading-relaxed">
                        {q.answer.toUpperCase()}. {cleanOptionText(q.options[LABELS.indexOf(q.answer.toUpperCase())] || '', q.answer.toUpperCase())}
                      </span>
                    </div>
                    {/* 2. Giải thích — nếu có */}
                    {q.explanation && (
                      <div className="pt-2 border-t border-black/10 dark:border-white/10 text-muted-foreground leading-relaxed flex items-start gap-1.5">
                        <span className="flex-shrink-0">📝</span>
                        <span><span className="font-semibold text-foreground">Giải thích đáp án:</span> {q.explanation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Submit Section (Mobile Only or Always visible at bottom) */}
          {!isSubmitted && (
            <div className="pt-6 border-t border-white/5 space-y-4 max-w-3xl mx-auto w-full lg:hidden">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || answered === 0}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary shadow-xl"
              >
                <Send className="h-5 w-5" />
                {isSubmitting ? 'Đang chấm...' : answered < questions.length ? `Nộp bài (${answered}/${questions.length})` : (autoSubmitCountdown !== null ? `Tự động nộp sau ${autoSubmitCountdown}s` : 'Hoàn Thành & Nộp Bài')}
              </button>
              {remaining > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-semibold">
                  Còn {remaining} câu chưa làm
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sheet for Mobile Sơ đồ câu hỏi */}
      {!hideSidebar && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isMobileMapOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            onClick={() => setIsMobileMapOpen(false)}
          />

          {/* Drawer Panel */}
          <div className={`fixed bottom-0 left-0 right-0 glass-strong border-t border-black/10 dark:border-white/10 rounded-t-[2rem] p-6 z-50 lg:hidden transition-all duration-300 ease-out transform ${isMobileMapOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
            }`}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" /> Sơ đồ câu hỏi trắc nghiệm
                </h3>
                <button
                  onClick={() => setIsMobileMapOpen(false)}
                  className="p-1.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress and Timer Details */}
              <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-secondary" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                        strokeDasharray={16 * 2 * Math.PI}
                        strokeDashoffset={(16 * 2 * Math.PI) - ((answered / questions.length) * 16 * 2 * Math.PI)}
                        className="text-primary transition-all duration-500 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {answered}/{questions.length}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Đã hoàn thành</h4>
                    <p className="text-sm font-black text-white mt-0.5">{Math.round((answered / questions.length) * 100)}%</p>
                  </div>
                </div>

                {!isSubmitted && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Thời gian</span>
                    <ExerciseTimer isRunning={true} className="!p-0 !bg-transparent text-sm font-bold text-foreground mt-0.5" />
                  </div>
                )}
              </div>

              {/* Question Grid */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Danh sách các câu</p>
                <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                  {questions.map((q, idx) => {
                    const isAnswered = !!selected[q.id];
                    const qResult = getResult(q.id);
                    const isCorrect = qResult?.isCorrect;

                    let btnClass = 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80';
                    if (isSubmitted) {
                      btnClass = isCorrect ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40';
                    } else if (isAnswered) {
                      btnClass = 'bg-primary/20 text-primary border-primary/40';
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          const el = document.getElementById(`mc-question-${idx}`);
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 80;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                            setIsMobileMapOpen(false);
                          }
                        }}
                        className={`w-10 h-10 mx-auto rounded-xl text-xs font-bold flex items-center justify-center border transition-all active:scale-95 ${btnClass}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit / Remaining Information inside Sheet */}
              {!isSubmitted && (
                <div className="pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      handleSubmit();
                      setIsMobileMapOpen(false);
                    }}
                    disabled={isSubmitting || answered === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all shadow-lg"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'Đang chấm...' : answered < questions.length ? `Nộp bài (${answered}/${questions.length})` : (autoSubmitCountdown !== null ? `Tự động nộp sau ${autoSubmitCountdown}s` : 'Nộp Bài')}
                  </button>
                  {remaining > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center mt-2 font-semibold">
                      Còn {remaining} câu chưa làm
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
