import { useState, useEffect } from 'react';
import { VocabCard } from '@/lib/local-store';
import { LayoutGrid, CheckCircle2, Trophy, Sparkles } from 'lucide-react';

interface MatchGameBlockProps {
  vocabCards: VocabCard[];
  gameMatchedIds: string[];
  setGameMatchedIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSpeak: (text: string) => void;
  isSubmitted: boolean;
}

export function MatchGameBlock({ vocabCards, gameMatchedIds, setGameMatchedIds, handleSpeak, isSubmitted }: MatchGameBlockProps) {
  const [gameMatchPairs, setGameMatchPairs] = useState<{ id: string; text: string; type: 'word' | 'meaning'; cardId: string }[]>([]);
  const [gameSelectedIds, setGameSelectedIds] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize pairs only once
  useEffect(() => {
    if (vocabCards.length === 0) return;
    
    if (isInitializing) {
      const pairs: { id: string; text: string; type: 'word' | 'meaning'; cardId: string }[] = [];
      vocabCards.forEach(c => {
        pairs.push({ id: `w_${c.id}`, text: c.word, type: 'word', cardId: c.id });
        pairs.push({ id: `m_${c.id}`, text: c.meaning, type: 'meaning', cardId: c.id });
      });
      setGameMatchPairs(pairs.sort(() => Math.random() - 0.5));
      setIsInitializing(false);
    }
  }, [vocabCards, isInitializing]);

  const handleGameCardClick = (item: { id: string; text: string; type: 'word' | 'meaning'; cardId: string }) => {
    if (gameMatchedIds.includes(item.id) || isSubmitted) return;
    
    if (gameSelectedIds.includes(item.id)) {
      setGameSelectedIds([]);
      return;
    }
    
    const newSelected = [...gameSelectedIds, item.id];
    setGameSelectedIds(newSelected);
    
    if (newSelected.length === 2) {
      const first = gameMatchPairs.find(p => p.id === newSelected[0]);
      const second = gameMatchPairs.find(p => p.id === newSelected[1]);
      
      if (first && second && first.cardId === second.cardId && first.type !== second.type) {
        // MATCH!
        setTimeout(() => {
          setGameMatchedIds(prev => [...prev, first.id, second.id]);
          setGameSelectedIds([]);
          
          // Auto-speak word when matched
          const wordText = first.type === 'word' ? first.text : second.text;
          handleSpeak(wordText);
        }, 400); // Wait a bit to show selection before disappearing
      } else {
        // MISMATCH!
        setTimeout(() => {
          setGameSelectedIds([]);
        }, 600);
      }
    }
  };

  if (isInitializing) return null;

  const isCompleted = gameMatchedIds.length > 0 && gameMatchedIds.length === vocabCards.length * 2;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center gap-3 text-sm text-rose-400 p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-inner">
        <LayoutGrid className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">Tìm và ghép các thẻ tiếng Anh với nghĩa tương ứng. Thẻ sẽ biến mất nếu ghép đúng!</span>
      </div>

      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">
        <span>Tiến độ: {gameMatchedIds.length / 2} / {vocabCards.length} cặp</span>
        <span>{Math.round((gameMatchedIds.length / (vocabCards.length * 2)) * 100)}%</span>
      </div>
      <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden border border-white/5">
        <div 
          className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-500 ease-out" 
          style={{ width: `${(gameMatchedIds.length / (vocabCards.length * 2)) * 100}%` }} 
        />
      </div>

      {isCompleted ? (
        <div className="p-12 text-center border-2 border-emerald-500/30 bg-emerald-500/5 rounded-3xl space-y-6 slide-up glow-success relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent opacity-50 blur-xl"></div>
          
          <div className="relative z-10 w-24 h-24 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <Trophy className="h-12 w-12 text-emerald-400" />
            <Sparkles className="h-6 w-6 text-emerald-300 absolute -top-2 -right-2 animate-pulse" />
          </div>
          
          <div className="relative z-10 space-y-2">
            <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Hoàn Thành Xuất Sắc!</h3>
            <p className="text-base text-emerald-100/70 font-medium">Bạn đã trí nhớ siêu phàm khi ghép toàn bộ {vocabCards.length} cặp từ.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 perspective mt-8">
          {gameMatchPairs.map((item) => {
            const isMatched = gameMatchedIds.includes(item.id);
            const isSelected = gameSelectedIds.includes(item.id);
            const isWord = item.type === 'word';
            
            if (isMatched) {
              return (
                <div key={item.id} className="h-28 md:h-32 scale-out flex items-center justify-center pointer-events-none">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
                </div>
              );
            }

            // Mismatch effect if 2 selected but not matched
            const isMismatching = gameSelectedIds.length === 2 && isSelected;

            return (
              <button
                key={item.id}
                disabled={isSubmitted || gameSelectedIds.length === 2 && !isSelected}
                onClick={() => handleGameCardClick(item)}
                className={`
                  relative h-28 md:h-32 p-4 rounded-2xl border-2 font-bold text-sm sm:text-base flex items-center justify-center text-center transition-all duration-300
                  ${isSelected 
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 scale-[0.96] shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                      : isMismatching
                        ? 'animate-shake border-red-500/50 bg-red-500/10 text-red-400'
                        : isWord 
                          ? 'glass border-white/10 hover:border-rose-400/50 text-foreground hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover-lift' 
                          : 'glass border-white/5 hover:border-amber-400/50 text-muted-foreground hover:text-foreground hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover-lift'
                  }
                `}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
