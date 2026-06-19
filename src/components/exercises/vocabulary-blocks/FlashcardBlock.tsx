import { useState, useEffect } from 'react';
import { VocabCard } from '@/lib/local-store';
import { Volume2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface FlashcardBlockProps {
  vocabCards: VocabCard[];
  handleSpeak: (text: string) => void;
  isSubmitted: boolean;
}

export function FlashcardBlock({ vocabCards, handleSpeak, isSubmitted }: FlashcardBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const currentCard = vocabCards[currentIdx];

  // Keyboard Navigation
  useEffect(() => {
    if (!currentCard || isSubmitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.code === 'ArrowRight' || e.code === 'Enter') {
        setCurrentIdx(prev => Math.min(vocabCards.length - 1, prev + 1));
        setIsFlipped(false);
      } else if (e.code === 'ArrowLeft') {
        setCurrentIdx(prev => Math.max(0, prev - 1));
        setIsFlipped(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isSubmitted, vocabCards.length]);

  // Auto-speak on card change
  useEffect(() => {
    if (!currentCard || isSubmitted) return;
    const timer = setTimeout(() => handleSpeak(currentCard.word), 300);
    return () => clearTimeout(timer);
  }, [currentIdx, currentCard, isSubmitted, handleSpeak]);

  if (!currentCard) return null;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-secondary/30 rounded-xl border border-white/5">
        <AlertCircle className="h-4 w-4 text-violet-400 flex-shrink-0" />
        Mẹo: Sử dụng phím <kbd className="px-1.5 py-0.5 rounded bg-secondary mx-1 text-foreground border border-border/50">Space</kbd> để lật thẻ, <kbd className="px-1.5 py-0.5 rounded bg-secondary mx-1 text-foreground border border-border/50">→</kbd> để qua từ tiếp theo.
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Thẻ {currentIdx + 1} / {vocabCards.length}</span>
          <span>{Math.round(((currentIdx + 1) / vocabCards.length) * 100)}%</span>
        </div>
        <div className="w-full bg-secondary/30 h-1.5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-out" 
            style={{ width: `${((currentIdx + 1) / vocabCards.length) * 100}%` }} 
          />
        </div>
      </div>

      {/* 3D Flashcard */}
      <div 
        onClick={() => setIsFlipped(!isFlipped)} 
        className="relative h-72 w-full cursor-pointer perspective group"
      >
        <div className={`w-full h-full duration-700 preserve-3d relative transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute inset-0 glass-strong rounded-3xl p-8 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl gap-6 group-hover:border-primary/30 transition-colors">
            <div className="absolute top-4 right-4">
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); handleSpeak(currentCard.word); }} 
                className="p-2.5 rounded-full bg-secondary/50 hover:bg-primary/20 transition-all text-muted-foreground hover:text-primary backdrop-blur-md"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-foreground gradient-text">{currentCard.word}</div>
              {currentCard.phonetic && (
                <div className="text-base font-mono text-primary/80">
                  {currentCard.phonetic}
                </div>
              )}
            </div>
            
            <div className="absolute bottom-6 text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
              <span className="w-8 h-[1px] bg-border"></span>
              Click để lật
              <span className="w-8 h-[1px] bg-border"></span>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 glass-strong rounded-3xl p-8 flex flex-col justify-center rotate-y-180 backface-hidden shadow-2xl space-y-6 group-hover:border-primary/30 transition-colors">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider font-bold text-violet-400">Định Nghĩa</span>
              <div className="text-xl md:text-2xl font-medium text-foreground">{currentCard.meaning}</div>
            </div>
            
            {currentCard.synonyms && currentCard.synonyms.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-teal-400">Từ Đồng Nghĩa</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {currentCard.synonyms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {currentCard.example && (
              <div className="space-y-1 pt-4 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">Ví dụ minh họa</span>
                <div className="text-sm md:text-base italic text-muted-foreground leading-relaxed">
                  "{currentCard.example}"
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center gap-4 pt-4">
        <button 
          onClick={() => { setCurrentIdx(prev => Math.max(0, prev - 1)); setIsFlipped(false); }} 
          disabled={currentIdx === 0} 
          className="px-5 py-3 rounded-xl border border-border hover:bg-secondary/50 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          <ChevronLeft className="h-4 w-4" /> Trở lại
        </button>
        
        <button 
          onClick={() => { setCurrentIdx(prev => Math.min(vocabCards.length - 1, prev + 1)); setIsFlipped(false); }} 
          disabled={currentIdx === vocabCards.length - 1} 
          className="px-5 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          Tiếp theo <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
