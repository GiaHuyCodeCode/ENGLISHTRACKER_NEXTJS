'use client';

import { useState } from 'react';
import { VocabKeyword, VocabAnswerResult, isFuzzyMatch, Submission, getStudentAvatar } from '@/lib/local-store';
import { CheckCircle2, XCircle, Lightbulb, Send, Eye, Check } from 'lucide-react';

interface Props {
  passage: string;
  keywords: VocabKeyword[];
  onSubmit: (answers: { word: string; studentAnswer: string }[], overriddenWords?: string[]) => void;
  isSubmitting?: boolean;
  result?: VocabAnswerResult[];
  score?: number;
  durationMs?: number;
  allSubmissions?: Submission[];
}

export function VocabContextExercise({ passage, keywords, onSubmit, isSubmitting, result, score, durationMs, allSubmissions }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(keywords.map(k => [k.word, ''])),
  );
  const [step, setStep] = useState<'filling' | 'reviewing' | 'finished'>(result ? 'finished' : 'filling');
  const [overrides, setOverrides] = useState<Set<string>>(new Set());

  const isSubmitted = step === 'finished';
  const parts = passage.split(/(\[[^\]]+\])/g);

  const getResult = (word: string) =>
    result?.find(r => r.word.toLowerCase() === word.toLowerCase());

  const handleCheck = () => {
    setStep('reviewing');
  };

  const handleOverride = (word: string) => {
    setOverrides(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit(
      keywords.map(k => ({ word: k.word, studentAnswer: answers[k.word] || '' })),
      Array.from(overrides)
    );
    setStep('finished');
  };

  const filledCount = Object.values(answers).filter(v => v.trim()).length;
  // Calculate preview correct count during reviewing
  const previewCorrectCount = keywords.filter(k => 
    overrides.has(k.word) || isFuzzyMatch(answers[k.word] || '', k.answer)
  ).length;
  const previewScore = keywords.length > 0 ? Math.round((previewCorrectCount / keywords.length) * 100) : 0;

  const correctCount = isSubmitted ? (result?.filter(r => r.isCorrect).length ?? 0) : previewCorrectCount;
  const displayScore = isSubmitted ? score : previewScore;

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
  };

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
            const matchKeyword = keywords.find(k => k.word.toLowerCase() === word.toLowerCase());

            const failedPeers = allSubmissions?.filter(sub => {
              if (!sub.vocabAnswers) return false;
              const ans = sub.vocabAnswers.find(a => a.word.toLowerCase() === word.toLowerCase());
              return ans && !ans.isCorrect;
            }).map(sub => sub.studentName) || [];
            const uniqueFailedPeers = Array.from(new Set(failedPeers));

            return (
              <span key={i} className="inline-flex items-center gap-1.5 mx-1 my-1">
                {/* Keyword badge */}
                <span className="inline-flex items-center gap-1 bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold px-2.5 py-1 rounded-lg text-xs">
                  {word}
                </span>

                {/* Input or result */}
                {step === 'filling' ? (
                  <input
                    type="text"
                    value={answers[word] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [word]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleCheck()}
                    placeholder="nghĩa..."
                    className="input-inline w-24"
                    autoComplete="off"
                  />
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    (isSubmitted ? wordResult?.isCorrect : (overrides.has(word) || isFuzzyMatch(answers[word] || '', matchKeyword?.answer || '')))
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    {(isSubmitted ? wordResult?.isCorrect : (overrides.has(word) || isFuzzyMatch(answers[word] || '', matchKeyword?.answer || '')))
                      ? <CheckCircle2 className="h-3 w-3" />
                      : <XCircle className="h-3 w-3" />}
                    
                    <span>{isSubmitted ? (wordResult?.studentAnswer || '(trống)') : (answers[word] || '(trống)')}</span>
                    
                    {!(isSubmitted ? wordResult?.isCorrect : (overrides.has(word) || isFuzzyMatch(answers[word] || '', matchKeyword?.answer || ''))) && (
                      <span className="text-muted-foreground ml-1 flex items-center gap-1">
                        → <strong className="text-emerald-400">{isSubmitted ? wordResult?.correctAnswer : matchKeyword?.answer}</strong>
                        
                        {!isSubmitted && (
                          <button
                            onClick={() => handleOverride(word)}
                            className="ml-2 p-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            title="Chấp nhận đáp án này (Nghĩa tương tự)"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                )}

                {uniqueFailedPeers.length > 0 && (
                  <span className="inline-flex items-center gap-1 ml-1 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10 align-middle">
                    <span className="text-[9px] text-red-400/80 uppercase font-semibold">Vài con gà đã ngã xuống:</span>
                    <span className="flex -space-x-1">
                      {uniqueFailedPeers.map(peer => (
                        <span key={peer} title={`${peer} đã làm sai từ này`} className="relative w-4 h-4 rounded-full border border-red-500/50 flex items-center justify-center bg-background text-[7px] font-bold shadow-sm z-10 hover:z-20 transition-all hover:scale-110">
                          {getStudentAvatar(peer)}
                          <span className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2 flex items-center justify-center border border-background">
                            <XCircle className="w-1.5 h-1.5 text-white" />
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </p>
      </div>

      {/* Score */}
      {(step === 'reviewing' || isSubmitted) && displayScore !== undefined && (
        <div className={`rounded-2xl p-6 text-center border-2 score-pop ${
          displayScore >= 80 ? 'border-emerald-500/40 bg-emerald-500/8 glow-success' :
          displayScore >= 50 ? 'border-amber-500/40 bg-amber-500/8' :
          'border-red-500/40 bg-red-500/8 glow-error'
        }`}>
          <div className={`text-6xl font-bold font-heading ${
            displayScore >= 80 ? 'text-emerald-400' : displayScore >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {displayScore}
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            ✅ {correctCount}/{keywords.length} từ đúng
            {displayScore >= 80 && ' — Xuất sắc! 🎉'}
            {displayScore >= 50 && displayScore < 80 && ' — Khá tốt! 💪'}
            {displayScore < 50 && ' — Cần cố gắng thêm! 📚'}
          </p>
          {isSubmitted && durationMs && (
            <p className="text-sm font-medium text-foreground/80 mt-1">
              ⏱ Thời gian: {formatDuration(durationMs)}
            </p>
          )}
        </div>
      )}

      {/* Submit / Check */}
      {step === 'filling' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đã điền: {filledCount}/{keywords.length} từ</span>
            {filledCount < keywords.length && <span>Bạn có thể kiểm tra khi chưa điền hết</span>}
          </div>
          <button
            onClick={handleCheck}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 transition-all glow-primary"
          >
            <Eye className="h-4 w-4" />
            Kiểm tra đáp án
          </button>
        </div>
      )}

      {step === 'reviewing' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Nếu bạn thấy nghĩa của mình tương tự, hãy bấm icon ✔️ màu xanh bên cạnh đáp án sai để đánh dấu là đúng nhé.
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Đang cập nhật...' : 'Hoàn tất & Nộp bài'}
          </button>
        </div>
      )}
    </div>
  );
}
