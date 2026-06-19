'use client';

import { useState } from 'react';
import { QuizQuestion, QuizAnswerResult, Submission, getStudentAvatar } from '@/lib/local-store';
import { CheckCircle2, XCircle, Lightbulb, Send } from 'lucide-react';

interface Props {
  questions: QuizQuestion[];
  onSubmit: (answers: { questionId: number; studentAnswer: string }[]) => void;
  isSubmitting?: boolean;
  result?: QuizAnswerResult[];
  score?: number;
  allowHints?: boolean;
  feedback?: string;
  allSubmissions?: Submission[];
}

const LABELS = ['A', 'B', 'C', 'D'];

export function MultipleChoiceExercise({ questions, onSubmit, isSubmitting, result, score, allowHints, feedback, allSubmissions }: Props) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [hintsVisible, setHintsVisible] = useState<Record<number, boolean>>({});
  const isSubmitted = !!result;
  const answered = Object.keys(selected).length;
  const remaining = questions.length - answered;

  const getResult = (qid: number) => result?.find(r => r.questionId === qid);

  const handleSubmit = () => {
    onSubmit(questions.map(q => ({ questionId: q.id, studentAnswer: selected[q.id] || '' })));
  };

  const correctCount = result?.filter(r => r.isCorrect).length ?? 0;

  return (
    <div className="space-y-5">
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

        // Xử lý tìm các học viên đã sai câu này
        const failedPeers = allSubmissions?.filter(sub => {
          if (!sub.quizAnswers) return false;
          const qResult = sub.quizAnswers.find((qa: any) => qa.questionId === q.id);
          return qResult && !qResult.isCorrect;
        }).map(sub => sub.studentName) || [];
        const uniqueFailedPeers = Array.from(new Set(failedPeers));

        return (
          <div key={q.id} className={`glass rounded-2xl border transition-all overflow-hidden ${
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
                  <p className="font-medium text-sm leading-relaxed">
                    {q.question}
                    {q.knowledgeArea && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20 align-middle">
                        {q.knowledgeArea}
                      </span>
                    )}
                  </p>
                  
                  {/* Peer Failure Avatars */}
                  {uniqueFailedPeers.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap bg-red-500/5 w-fit px-2 py-1 rounded-md border border-red-500/10">
                      <span className="text-[10px] text-red-400/80 uppercase font-semibold">Vài con gà đã ngã xuống:</span>
                      <div className="flex -space-x-1">
                        {uniqueFailedPeers.map(peer => (
                          <div key={peer} title={`${peer} đã làm sai câu này`} className="relative w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center bg-background text-[8px] font-bold shadow-sm z-10 hover:z-20 transition-all hover:scale-110">
                            {getStudentAvatar(peer)}
                            <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-background">
                              <XCircle className="w-2 h-2 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {showAnswer && (
                  isCorrect
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                )}
                {!showAnswer && allowHints && q.hint && (
                  <button 
                    onClick={() => setHintsVisible(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                    className="p-1.5 rounded-full hover:bg-amber-500/20 text-amber-500/70 hover:text-amber-400 transition-colors"
                    title="Xem gợi ý"
                  >
                    <Lightbulb className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {!showAnswer && hintsVisible[q.id] && q.hint && (
                <div className="mt-3 ml-10 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <p>{q.hint}</p>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((opt, optIdx) => {
                const label = LABELS[optIdx];
                const isChosen = selected[q.id] === label;
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
                    <span className="leading-tight">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {showAnswer && (
              <div className="mx-5 mb-5 flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  <strong>Giải thích:</strong> {q.explanation}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Submit */}
      {!isSubmitted && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đã trả lời: {answered}/{questions.length}</span>
            {remaining > 0 && <span className="text-amber-400">Còn {remaining} câu chưa chọn</span>}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || answered === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Đang chấm...' : answered < questions.length ? `Nộp bài (${answered}/${questions.length} câu)` : 'Nộp Bài'}
          </button>
        </div>
      )}
    </div>
  );
}
