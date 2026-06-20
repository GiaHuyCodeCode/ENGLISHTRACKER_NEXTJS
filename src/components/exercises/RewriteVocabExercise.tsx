'use client';

import { useState, useEffect } from 'react';
import { VocabKeyword, RewriteAnswerResult } from '@/lib/local-store';
import { CheckCircle2, XCircle, Lightbulb, Send, PenTool } from 'lucide-react';

interface Props {
  passage: string;
  keywords: VocabKeyword[];
  onSubmit: (studentText: string) => void;
  isSubmitting?: boolean;
  result?: RewriteAnswerResult;
  score?: number;
  durationMs?: number;
}

export function RewriteVocabExercise({ passage, keywords, onSubmit, isSubmitting, result, score, durationMs }: Props) {
  const [text, setText] = useState('');
  const [usedKeywords, setUsedKeywords] = useState<Set<string>>(new Set());
  const isSubmitted = !!result;

  useEffect(() => {
    if (isSubmitted) return;
    const lowerText = text.toLowerCase();
    const used = new Set<string>();
    keywords.forEach(k => {
      if (lowerText.includes(k.word.toLowerCase())) {
        used.add(k.word);
      }
    });
    setUsedKeywords(used);
  }, [text, keywords, isSubmitted]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
  };

  const getResultIcon = (word: string) => {
    if (!result) return null;
    const isFound = result.foundKeywords.includes(word);
    return isFound ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />;
  };

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
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-300">
          <strong>Hướng dẫn:</strong> {passage}
        </p>
      </div>

      {/* Required Keywords List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
          <PenTool className="h-4 w-4" /> Từ khóa yêu cầu ({isSubmitted ? result?.foundKeywords.length : usedKeywords.size}/{keywords.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {keywords.map((k, i) => {
            const isUsed = isSubmitted 
              ? result?.foundKeywords.includes(k.word)
              : usedKeywords.has(k.word);
            
            const isMissing = isSubmitted && result?.missingKeywords.includes(k.word);

            return (
              <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                isUsed 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : isMissing
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-secondary text-muted-foreground border-border'
              }`}>
                {isSubmitted && getResultIcon(k.word)}
                {!isSubmitted && isUsed && <CheckCircle2 className="h-3.5 w-3.5" />}
                {k.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Text Area */}
      <div className="glass-strong rounded-2xl p-4">
        {isSubmitted ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Bài làm của bạn:</h3>
            <p className="text-sm leading-loose whitespace-pre-wrap">{result.studentText}</p>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Bắt đầu viết câu chuyện của bạn tại đây..."
            className="w-full h-48 bg-transparent border-none resize-none focus:outline-none text-sm leading-relaxed"
          />
        )}
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
            ✅ Đã dùng {result?.foundKeywords.length}/{keywords.length} từ khóa
            {score >= 80 && ' — Rất sáng tạo! 🎉'}
            {score >= 50 && score < 80 && ' — Khá tốt! 💪'}
            {score < 50 && ' — Cần cố gắng dùng nhiều từ hơn! 📚'}
          </p>
          {durationMs && (
            <p className="text-sm font-medium text-foreground/80 mt-1">
              ⏱ Thời gian: {formatDuration(durationMs)}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      {!isSubmitted && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !text.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? 'Đang chấm...' : 'Nộp Bài'}
        </button>
      )}
    </div>
  );
}
