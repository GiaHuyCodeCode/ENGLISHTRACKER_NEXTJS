import { useState, useEffect, useRef } from 'react';
import { VocabCard } from '@/lib/local-store';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Search } from 'lucide-react';

interface SynonymBlockProps {
  vocabCards: VocabCard[];
  answers: Record<string, string>;
  onAnswerChange: (word: string, val: string) => void;
  handleSpeak: (text: string, rate?: number, audioUrl?: string) => void;
  isSubmitted: boolean;
}

export function SynonymBlock({ vocabCards, answers, onAnswerChange, handleSpeak, isSubmitted }: SynonymBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, { isCorrect: boolean; show: boolean }>>({});
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const currentCard = vocabCards[currentIdx];

  // Focus & cuộn mượt ô nhập liệu vào giữa màn hình (tránh lỗi Safari iOS tự cuộn lên top khi bàn phím mở)
  useEffect(() => {
    if (!currentCard || isSubmitted) return;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [currentIdx, isSubmitted, currentCard]);

  const handleCheckSpelling = () => {
    if (!currentCard) return;
    const word = currentCard.word;
    const studentAnswer = (answers[word] || '').trim();
    const isCorrect = studentAnswer.toLowerCase() === word.toLowerCase();
    
    setFeedback(prev => ({
      ...prev,
      [word]: { isCorrect, show: true }
    }));
    
    if (isCorrect) {
      handleSpeak(word, 1.0, currentCard.audioUrl);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  if (!currentCard) return null;

  const currentFeedback = feedback[currentCard.word];
  const hasSynonyms = currentCard.synonyms && currentCard.synonyms.length > 0;

  return (
    <div className="space-y-8 slide-up max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Từ {currentIdx + 1} / {vocabCards.length}</span>
          <span>{Math.round(((currentIdx + 1) / vocabCards.length) * 100)}%</span>
        </div>
        <div className="w-full bg-secondary/30 h-1.5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-out" 
            style={{ width: `${((currentIdx + 1) / vocabCards.length) * 100}%` }} 
          />
        </div>
      </div>

      <div className={`glass-strong rounded-3xl border p-8 flex flex-col items-center justify-center text-center space-y-8 transition-all duration-300 ${shake ? 'animate-shake border-red-500/50' : currentFeedback?.isCorrect ? 'border-emerald-500/30' : 'border-border'}`}>
        
        {/* Icon Header */}
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 dark:bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-lg">
          <Search className="h-8 w-8" />
        </div>

        {/* Synonyms Display */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tìm từ tiếng Anh tương đương</h3>
          
          {hasSynonyms ? (
            <div className="flex flex-wrap justify-center gap-3">
              {currentCard.synonyms!.map(s => (
                <span key={s} className="px-4 py-2 bg-violet-500/10 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold text-lg rounded-xl border border-violet-500/20 shadow-sm">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400/90 text-sm italic">
              Từ này không có dữ liệu từ đồng nghĩa. <br/>
              <span className="font-semibold not-italic">Gợi ý nghĩa tiếng Việt: {currentCard.meaning}</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="w-full max-w-md pt-4 space-y-4">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={answers[currentCard.word] || ''}
              onChange={e => onAnswerChange(currentCard.word, e.target.value)}
              disabled={isSubmitted}
              onKeyDown={e => e.key === 'Enter' && handleCheckSpelling()}
              placeholder="Nhập từ vựng gốc..."
              className={`input-field flex-1 text-center font-bold tracking-widest text-lg h-14 ${currentFeedback?.isCorrect ? 'border-emerald-500 ring-1 ring-emerald-500/50 text-emerald-600 dark:text-emerald-400' : ''}`}
            />
            {!isSubmitted && (
              <button 
                onClick={handleCheckSpelling} 
                className="px-6 h-14 bg-secondary text-foreground hover:bg-violet-600 hover:text-white font-semibold rounded-xl text-sm transition-all hover-lift"
              >
                Kiểm tra
              </button>
            )}
          </div>

          {/* Feedback */}
          {currentFeedback?.show && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold slide-up ${
              currentFeedback.isCorrect 
                ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 glow-success' 
                : 'bg-red-500/10 dark:bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 glow-error'
            }`}>
              {currentFeedback.isCorrect ? (
                <><CheckCircle2 className="h-5 w-5" /> Chính xác! ({currentCard.word})</>
              ) : (
                <><XCircle className="h-5 w-5" /> Sai rồi. Đáp án: {currentCard.word}</>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center gap-4">
        <button 
          onClick={() => { setCurrentIdx(prev => Math.max(0, prev - 1)); setFeedback({}); }} 
          disabled={currentIdx === 0} 
          className="px-5 py-3 rounded-xl border border-border hover:bg-secondary/50 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          <ChevronLeft className="h-4 w-4" /> Từ trước
        </button>
        <button 
          onClick={() => { setCurrentIdx(prev => Math.min(vocabCards.length - 1, prev + 1)); setFeedback({}); }} 
          disabled={currentIdx === vocabCards.length - 1} 
          className="px-5 py-3 rounded-xl bg-violet-500/10 dark:bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white disabled:opacity-30 disabled:hover:bg-violet-500/10 dark:bg-violet-500/10 disabled:hover:text-violet-600 dark:text-violet-400 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          Từ tiếp theo <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
