'use client';

import { useState } from 'react';
import { VocabKeyword, VocabAnswerResult } from '@/lib/local-store';
import { CheckCircle2, XCircle, Lightbulb, Send } from 'lucide-react';

interface Props {
  passage: string;
  keywords: VocabKeyword[];
  onSubmit: (answers: { word: string; studentAnswer: string }[]) => void;
  isSubmitting?: boolean;
  result?: VocabAnswerResult[];
  score?: number;
}

export function VocabContextExercise({ passage, keywords, onSubmit, isSubmitting, result, score }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(keywords.map(k => [k.word, ''])),
  );

  const isSubmitted = !!result;
  const parts = passage.split(/(\[[^\]]+\])/g);

  const getResult = (word: string) =>
    result?.find(r => r.word.toLowerCase() === word.toLowerCase());

  const handleSubmit = () => {
    onSubmit(keywords.map(k => ({ word: k.word, studentAnswer: answers[k.word] || '' })));
  };

  const filledCount = Object.values(answers).filter(v => v.trim()).length;
  const correctCount = result?.filter(r => r.isCorrect).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Instruction */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <Lightbulb className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-violet-300">
          Đọc đoạn văn bên dưới. Điền <strong>nghĩa tiếng Việt</strong> cho các từ tiếng Anh được highlight vào ô ngay cạnh mỗi từ.
        </p>
      </div>

      {/* Passage */}
      <div className="glass-strong rounded-2xl p-6">
        <p className="leading-10 text-sm">
          {parts.map((part, i) => {
            const match = part.match(/^\[(.+)\]$/);
            if (!match) return <span key={i} className="text-foreground/90">{part}</span>;

            const word = match[1];
            const wordResult = getResult(word);

            return (
              <span key={i} className="inline-flex items-center gap-1.5 mx-1 my-1">
                {/* Keyword badge */}
                <span className="inline-flex items-center gap-1 bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold px-2.5 py-1 rounded-lg text-xs">
                  {word}
                </span>

                {/* Input or result */}
                {!isSubmitted ? (
                  <input
                    type="text"
                    value={answers[word] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [word]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="nghĩa..."
                    className="input-inline w-24"
                    autoComplete="off"
                  />
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    wordResult?.isCorrect
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    {wordResult?.isCorrect
                      ? <CheckCircle2 className="h-3 w-3" />
                      : <XCircle className="h-3 w-3" />}
                    <span>{wordResult?.studentAnswer || '(trống)'}</span>
                    {!wordResult?.isCorrect && (
                      <span className="text-muted-foreground ml-1">
                        → <strong className="text-emerald-400">{wordResult?.correctAnswer}</strong>
                      </span>
                    )}
                  </span>
                )}
              </span>
            );
          })}
        </p>
      </div>

      {/* Score */}
      {isSubmitted && score !== undefined && (
        <div className={`rounded-2xl p-6 text-center border-2 score-pop ${
          score >= 80 ? 'border-emerald-500/40 bg-emerald-500/8 glow-success' :
          score >= 50 ? 'border-amber-500/40 bg-amber-500/8' :
          'border-red-500/40 bg-red-500/8 glow-error'
        }`}>
          <div className={`text-6xl font-bold font-heading ${
            score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {score}
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            ✅ {correctCount}/{result?.length} từ đúng
            {score >= 80 && ' — Xuất sắc! 🎉'}
            {score >= 50 && score < 80 && ' — Khá tốt! 💪'}
            {score < 50 && ' — Cần cố gắng thêm! 📚'}
          </p>
        </div>
      )}

      {/* Submit */}
      {!isSubmitted && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đã điền: {filledCount}/{keywords.length} từ</span>
            {filledCount < keywords.length && <span>Bạn có thể nộp khi chưa điền hết</span>}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Đang chấm...' : 'Nộp Bài'}
          </button>
        </div>
      )}
    </div>
  );
}
