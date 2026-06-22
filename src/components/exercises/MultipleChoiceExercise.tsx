'use client';

import { useState } from 'react';
import { QuizQuestion, QuizAnswerResult, Submission, getStudentAvatar } from '@/lib/local-store';
import { CheckCircle2, XCircle, Send } from 'lucide-react';
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
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const isSubmitted = !!result;
  const answered = Object.keys(selected).length;
  const remaining = questions.length - answered;

  const getResult = (qid: number) => result?.find(r => String(r.questionId) === String(qid));

  const cleanOptionText = (opt: string, label: string) => {
    if (!opt) return '';
    const trimmed = opt.trim();
    const regex = new RegExp(`^${label}\\s*([\\.\\-\\/\\):])\\s*`, 'i');
    return trimmed.replace(regex, '');
  };

  const handleSubmit = () => {
    onSubmit(questions.map(q => ({ questionId: q.id, studentAnswer: selected[q.id] || '' })));
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
    <div className={hideSidebar ? "space-y-5" : "grid grid-cols-1 lg:grid-cols-4 gap-6 items-start"}>
      {/* Left Sidebar */}
      {!hideSidebar && (
        <div className="lg:col-span-1 sticky top-4 z-30 space-y-4 self-start">
          {!isSubmitted && (
            <div className="glass-strong rounded-3xl border border-white/10 p-5 shadow-xl">
              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-3 text-center">Thời gian làm bài</div>
              <ExerciseTimer isRunning={true} className="w-full justify-center py-3 text-lg font-bold" />
            </div>
          )}
          <div className="glass-strong rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
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
                  btnClass = isCorrect ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40';
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
                {isSubmitting ? 'Đang chấm...' : answered < questions.length ? `Nộp bài (${answered}/${questions.length})` : 'Nộp Bài'}
              </button>
              {remaining > 0 && (
                <p className="text-[10.5px] text-amber-400 text-center mt-2.5 font-semibold">
                  Còn {remaining} câu chưa làm
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right Content */}
      <div className={hideSidebar ? "space-y-5" : "lg:col-span-3 space-y-5 w-full"}>
      {/* Score banner */}
      {isSubmitted && score !== undefined && (
        <div className={`rounded-2xl p-5 text-center border-2 score-pop ${
          score >= 80 ? 'border-emerald-500/40 bg-emerald-500/8 glow-success' :
          score >= 50 ? 'border-amber-500/40 bg-amber-500/8' :
          'border-red-500/40 bg-red-500/8'
        }`}>
          <div className={`text-5xl font-bold font-heading ${
            score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
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
          <div key={q.id} id={`mc-question-${idx}`} className={`glass rounded-2xl border transition-all overflow-hidden ${
            showAnswer
              ? isCorrect
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-red-500/30 bg-red-500/5'
              : 'border-border hover:border-primary/30'
          }`}>
            {/* Question */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border ${
                  showAnswer
                    ? isCorrect
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-secondary text-muted-foreground border-border'
                }`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {q.knowledgeArea && (
                    <div className="mb-1.5">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md">
                        {q.knowledgeArea}
                      </span>
                    </div>
                  )}
                  {uniqueFailedPeersForQuestion.length > 0 && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10 align-middle">
                        <span className="text-[9px] text-red-400/80 uppercase font-semibold">Vài con gà đã ngã xuống:</span>
                        <span className="flex -space-x-1">
                          {uniqueFailedPeersForQuestion.map(peer => (
                            <span key={peer || 'unknown'} title={`${peer} đã làm sai câu này`} className="relative w-4 h-4 rounded-full border border-red-500/50 flex items-center justify-center bg-background text-[7px] font-bold shadow-sm z-10 hover:z-20 transition-all hover:scale-110">
                              {getStudentAvatar(peer || 'Unknown')}
                              <span className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2 flex items-center justify-center border border-background">
                                <XCircle className="w-1.5 h-1.5 text-white" />
                              </span>
                            </span>
                          ))}
                        </span>
                      </span>
                    </div>
                  )}
                  <p className="font-medium text-sm leading-relaxed">
                    {q.question}
                  </p>
                  {/* Nội dung gợi ý — chỉ hiện khi học sinh đã click icon 💡 */}
                  {allowHints && q.hint && !showAnswer && revealedHints.has(q.id) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <span className="flex-shrink-0">💡</span>
                      <span>{q.hint}</span>
                    </div>
                  )}
                </div>
                {showAnswer && (
                  isCorrect
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                )}
                {/* Icon gợi ý — chỉ hiện khi giáo viên bật allowHints và câu có hint và chưa chọn */}
                {allowHints && q.hint && !showAnswer && (
                  <button
                    onClick={() => setRevealedHints(prev => {
                      const next = new Set(prev);
                      if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                      return next;
                    })}
                    title={revealedHints.has(q.id) ? 'Ẩn gợi ý' : 'Xem gợi ý'}
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95 border ${
                      revealedHints.has(q.id)
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:border-amber-500/40 hover:text-amber-400'
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
                if (showAnswer && isCorrectOpt) cls = 'border-2 border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold cursor-default';
                if (showAnswer && isChosen && !isCorrectOpt) cls = 'border-2 border-red-500 bg-red-500/10 text-red-400 line-through cursor-default';
                if (showAnswer && !isChosen && !isCorrectOpt) cls = 'border border-border/30 text-muted-foreground/50 cursor-default';

                return (
                  <button
                    key={optIdx}
                    onClick={() => !showAnswer && setSelected(prev => ({ ...prev, [q.id]: label }))}
                    disabled={showAnswer}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all ${cls}`}
                  >
                    <span className="w-6 h-6 rounded-full border-current border flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                      {label}
                    </span>
                    <span className="leading-tight">{cleanOptionText(opt, label)}</span>
                  </button>
                );
              })}
            </div>

            {showAnswer && (
              <div className="mx-5 mb-5 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Đáp án đúng: </span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {q.answer.toUpperCase()}. {cleanOptionText(q.options[LABELS.indexOf(q.answer.toUpperCase())] || '', q.answer.toUpperCase())}
                  </span>
                </div>
                {q.explanation && (
                  <div className="pt-2 border-t border-white/5 text-muted-foreground">
                    <span className="font-semibold text-foreground">📝 Giải thích: </span>
                    {q.explanation}
                  </div>
                )}
                {q.hint && (
                  <div className="pt-2 border-t border-white/5">
                    <span className="font-semibold text-amber-400">💡 Gợi ý: </span>
                    <span className="text-muted-foreground">{q.hint}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
