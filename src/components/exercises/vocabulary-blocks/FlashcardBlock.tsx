import { useState, useEffect } from 'react';
import { VocabCard } from '@/lib/local-store';
import { Volume2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { usePhonetic } from '@/lib/usePhonetic';

interface FlashcardBlockProps {
  vocabCards: VocabCard[];
  handleSpeak: (text: string, rate?: number, audioUrl?: string) => void;
  isSubmitted: boolean;
}

export function FlashcardBlock({ vocabCards, handleSpeak, isSubmitted }: FlashcardBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [slideAnimation, setSlideAnimation] = useState<'slide-out-left' | 'slide-out-right' | 'slide-in-left' | 'slide-in-right' | ''>('');
  
  const currentCard = vocabCards[currentIdx];
  const { phonetic: displayPhonetic, loading: phoneticLoading } = usePhonetic(currentCard?.word, currentCard?.phonetic);

  const handleNext = () => {
    if (animating || currentIdx === vocabCards.length - 1) return;
    setAnimating(true);
    setSlideAnimation('slide-out-left');
    setTimeout(() => {
      setCurrentIdx(prev => prev + 1);
      setIsFlipped(false);
      setSlideAnimation('slide-in-right');
      setTimeout(() => {
        setSlideAnimation('');
        setAnimating(false);
      }, 280);
    }, 280);
  };

  const handlePrev = () => {
    if (animating || currentIdx === 0) return;
    setAnimating(true);
    setSlideAnimation('slide-out-right');
    setTimeout(() => {
      setCurrentIdx(prev => prev - 1);
      setIsFlipped(false);
      setSlideAnimation('slide-in-left');
      setTimeout(() => {
        setSlideAnimation('');
        setAnimating(false);
      }, 280);
    }, 280);
  };

  // Keyboard Navigation
  useEffect(() => {
    if (!currentCard || isSubmitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!animating) setIsFlipped(prev => !prev);
      } else if (e.code === 'ArrowRight' || e.code === 'Enter') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, isSubmitted, currentIdx, animating, vocabCards.length]);

  // Touch Swipe Gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (animating) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (animating || !touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  // Auto-speak on card change
  useEffect(() => {
    if (!currentCard || isSubmitted) return;
    const timer = setTimeout(() => handleSpeak(currentCard.word, 1.0, currentCard.audioUrl), 300);
    return () => clearTimeout(timer);
  }, [currentIdx, currentCard, isSubmitted, handleSpeak]);

  if (!currentCard) return null;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-secondary/30 rounded-xl border border-white/5">
        <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <div>
          Mẹo: Sử dụng phím <kbd className="px-1.5 py-0.5 rounded bg-secondary mx-1 text-foreground border border-border/50 font-bold">Space</kbd> để lật thẻ, <kbd className="px-1.5 py-0.5 rounded bg-secondary mx-1 text-foreground border border-border/50 font-bold">→</kbd> để qua từ tiếp theo. Trên điện thoại, bạn có thể <strong>vuốt màn hình sang trái/phải</strong> để chuyển thẻ.
        </div>
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
        onClick={() => !animating && setIsFlipped(!isFlipped)} 
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`relative h-64 md:h-72 w-full cursor-pointer perspective group ${
          slideAnimation === 'slide-out-left' ? 'animate-slide-out-left' :
          slideAnimation === 'slide-out-right' ? 'animate-slide-out-right' :
          slideAnimation === 'slide-in-left' ? 'animate-slide-in-left' :
          slideAnimation === 'slide-in-right' ? 'animate-slide-in-right' : ''
        }`}
      >
        <div className={`w-full h-full duration-700 preserve-3d relative transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute inset-0 glass-strong rounded-3xl p-8 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl gap-6 group-hover:border-primary/30 transition-colors">
            <div className="absolute top-4 right-4">
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); handleSpeak(currentCard.word, 1.0, currentCard.audioUrl); }} 
                className="p-2.5 rounded-full bg-secondary/50 hover:bg-primary/20 transition-all text-muted-foreground hover:text-primary backdrop-blur-md"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-foreground gradient-text">{currentCard.word}</div>
              {(displayPhonetic || phoneticLoading) && (
                <div className="text-base font-mono text-primary/80">
                  {phoneticLoading ? <span className="animate-pulse">...</span> : displayPhonetic}
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
              <span className="text-xs uppercase tracking-wider font-bold text-violet-600 dark:text-violet-400">Định Nghĩa</span>
              <div className="text-xl md:text-2xl font-medium text-foreground">{currentCard.meaning}</div>
            </div>
            
            {currentCard.synonyms && currentCard.synonyms.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400">Từ Đồng Nghĩa</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {currentCard.synonyms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-teal-500/10 dark:bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {currentCard.example && (
              <div className="space-y-1 pt-4 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">Ví dụ minh họa</span>
                <div className="text-sm md:text-base italic text-muted-foreground leading-relaxed">
                  &quot;{currentCard.example}&quot;
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center gap-4 pt-4">
        <button 
          onClick={handlePrev} 
          disabled={currentIdx === 0 || animating} 
          className="px-5 py-3 rounded-xl border border-border hover:bg-secondary/50 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          <ChevronLeft className="h-4 w-4" /> Trở lại
        </button>
        
        <button 
          onClick={handleNext} 
          disabled={currentIdx === vocabCards.length - 1 || animating} 
          className="px-5 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          Tiếp theo <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

