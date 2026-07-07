import { useState, useEffect } from 'react';
import { VocabCard, Submission, getStudentAvatar } from '@/lib/local-store';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';

interface TestBlockProps {
  vocabCards: VocabCard[];
  answers: Record<string, string>;
  onAnswerChange: (wordId: string, val: string) => void;
  isSubmitted: boolean;
  onProgressUpdate?: (stats: {
    completed: number;
    incorrect: number;
    pending: number;
    statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'>;
    currentIdx: number;
    roundWords: VocabCard[];
    onJumpToQuestion?: (idx: number) => void;
  }) => void;
  allSubmissions?: Submission[];
}

function generateOptions(correct: VocabCard, allCards: VocabCard[], chosen?: string): string[] {
  const correctWord = correct.word;
  let list = [correctWord];
  
  if (chosen && chosen !== correctWord) {
    list.push(chosen);
  }
  
  // Get other distractors
  const remainingDistractors = allCards
    .filter(c => c.id !== correct.id && c.word !== chosen)
    .sort(() => Math.random() - 0.5)
    .map(c => c.word);
    
  // Add distractors until we have 4 options
  while (list.length < 4 && remainingDistractors.length > 0) {
    const next = remainingDistractors.pop();
    if (next) list.push(next);
  }
  
  // Shuffle options
  return list.sort(() => Math.random() - 0.5);
}

export function TestBlock({ 
  vocabCards, 
  answers, 
  onAnswerChange, 
  isSubmitted,
  onProgressUpdate,
  allSubmissions
}: TestBlockProps) {
  const [shuffledCards, setShuffledCards] = useState<VocabCard[]>([]);
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});
  const [mcRevealed, setMcRevealed] = useState<Record<string, boolean>>({});
  const [currentActiveIdx, setCurrentActiveIdx] = useState<number>(0);

  // Randomize cards order on initialization
  useEffect(() => {
    if (vocabCards.length === 0) return;
    const shuffled = [...vocabCards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setCurrentActiveIdx(0);
    setMcRevealed({});
  }, [vocabCards]);

  // Generate randomized choices based on the shuffled deck
  useEffect(() => {
    if (shuffledCards.length < 1) return;
    const opts: Record<string, string[]> = {};
    shuffledCards.forEach(card => { 
      opts[card.id] = generateOptions(card, shuffledCards, answers[card.id]); 
    });
    setMcOptions(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffledCards]);

  const handleJumpToQuestion = (idx: number) => {
    setCurrentActiveIdx(idx);
    const element = document.getElementById(`test-question-${idx}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSelectOption = (cardId: string, opt: string) => {
    if (mcRevealed[cardId] || isSubmitted) return;
    onAnswerChange(cardId, opt);
    setMcRevealed(prev => ({ ...prev, [cardId]: true }));
    
    // Tự động chuyển câu hỏi tiếp theo sau 1.2s
    const matchIdx = shuffledCards.findIndex(c => c.id === cardId);
    if (matchIdx !== -1 && matchIdx < shuffledCards.length - 1) {
      setTimeout(() => {
        handleJumpToQuestion(matchIdx + 1);
      }, 1200);
    }
  };

  // Lắng nghe phím tắt A/B/C/D hoặc 1/2/3/4 chọn đáp án
  useEffect(() => {
    if (isSubmitted || shuffledCards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const activeCard = shuffledCards[currentActiveIdx];
      if (!activeCard) return;

      if (mcRevealed[activeCard.id]) return;

      const opts = mcOptions[activeCard.id] || [];
      if (opts.length < 4) return;

      let selectedIndex = -1;
      const key = e.key.toLowerCase();
      if (key === '1' || key === 'a') selectedIndex = 0;
      else if (key === '2' || key === 'b') selectedIndex = 1;
      else if (key === '3' || key === 'c') selectedIndex = 2;
      else if (key === '4' || key === 'd') selectedIndex = 3;

      if (selectedIndex >= 0 && selectedIndex < opts.length) {
        e.preventDefault();
        handleSelectOption(activeCard.id, opts[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffledCards, currentActiveIdx, mcOptions, mcRevealed, isSubmitted]);

  // Listen to top status bar jump event
  useEffect(() => {
    const handleJump = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetIdx = customEvent.detail?.index;
      if (typeof targetIdx === 'number' && targetIdx >= 0 && targetIdx < vocabCards.length) {
        const targetWord = vocabCards[targetIdx];
        const matchIdx = shuffledCards.findIndex(c => c.id === targetWord?.id);
        if (matchIdx !== -1) {
          handleJumpToQuestion(matchIdx);
        }
      }
    };
    window.addEventListener('vocab-jump', handleJump);
    return () => window.removeEventListener('vocab-jump', handleJump);
  }, [vocabCards, shuffledCards]);

  // Report progress changes back to parent Sidebar
  useEffect(() => {
    if (!onProgressUpdate || shuffledCards.length === 0) return;

    let completed = 0;
    let incorrect = 0;
    let pending = 0;
    const statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'> = {};

    shuffledCards.forEach((card, idx) => {
      const chosen = answers[card.id];
      const revealed = mcRevealed[card.id] || isSubmitted;

      let status: 'correct' | 'incorrect' | 'pending' | 'active' = 'pending';
      
      if (revealed) {
        if (chosen === card.word) {
          status = 'correct';
          completed++;
        } else {
          status = 'incorrect';
          incorrect++;
        }
      } else if (chosen) {
        status = 'active';
      } else {
        pending++;
      }

      // Highlight the active question
      if (idx === currentActiveIdx && !revealed && !chosen) {
        status = 'active';
      }

      statusMap[card.id] = status;
    });

    onProgressUpdate({
      completed,
      incorrect,
      pending,
      statusMap,
      currentIdx: currentActiveIdx,
      roundWords: shuffledCards,
      onJumpToQuestion: handleJumpToQuestion
    });
  }, [shuffledCards, answers, mcRevealed, isSubmitted, currentActiveIdx, onProgressUpdate]);

  if (shuffledCards.length === 0) return null;

  return (
    <div className="space-y-6 slide-up w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-400 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-none">
        <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex-shrink-0">
          <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
        </div>
        <div>
          <span className="font-bold block text-xs uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-0.5">Trắc Nghiệm</span>
          <span className="font-medium">Đọc thông tin gợi ý và chọn từ tiếng Anh tương ứng trong 4 đáp án.</span>
        </div>
      </div>

      <div className="space-y-6">
        {shuffledCards.map((c, idx) => {
          const chosen = answers[c.id];
          const revealed = mcRevealed[c.id] || isSubmitted;
          const blankedExample = c.example ? c.example.replace(new RegExp(c.word, 'gi'), '___') : '';
          const opts = mcOptions[c.id] || [c.word];

          return (
            <div 
              key={c.id} 
              id={`test-question-${idx}`}
              onClick={() => setCurrentActiveIdx(idx)}
              className={`rounded-3xl border p-6 md:p-8 space-y-6 transition-all duration-300 cursor-pointer
                bg-white dark:bg-secondary/20
                ${idx === currentActiveIdx 
                  ? 'ring-2 ring-[#0071e3]/40 shadow-lg shadow-[#0071e3]/10 border-[#0071e3]/30 dark:border-[#0071e3]/30' 
                  : 'border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none'
                } ${
                revealed 
                  ? (chosen === c.word 
                    ? 'border-emerald-400 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/5 shadow-emerald-100 dark:shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                    : 'border-red-300 dark:border-red-500/50 bg-red-50/80 dark:bg-red-500/5') 
                  : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <span className={`flex-shrink-0 w-9 h-9 rounded-full text-sm font-extrabold border-2 flex items-center justify-center mt-0.5 transition-all ${
                  revealed
                    ? (chosen === c.word 
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-red-500 text-white border-red-500')
                    : idx === currentActiveIdx 
                      ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-md shadow-[#0071e3]/30' 
                      : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-muted-foreground border-slate-200 dark:border-white/10'
                }`}>
                  {revealed ? (chosen === c.word ? <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> : <XCircle className="w-4 h-4" strokeWidth={2.5} />) : idx + 1}
                </span>
                <div className="flex-1 space-y-4 pt-1">
                  {blankedExample ? (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ví dụ ngữ cảnh</p>
                      <p className="text-base italic text-foreground/80 leading-relaxed">&quot;{blankedExample}&quot;</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Câu hỏi</p>
                      <p className="text-base font-semibold text-foreground/80 leading-relaxed">Chọn từ đúng cho &quot;{c.meaning}&quot;</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opts.map((opt, oi) => {
                    let cls = 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/5 text-slate-800 dark:text-foreground hover:text-[#0071e3]';
                    
                    if (revealed) {
                      if (opt === c.word) {
                        cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/50 shadow-sm shadow-emerald-200/50 dark:shadow-none';
                      } else if (opt === chosen && opt !== c.word) {
                        cls = 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 ring-1 ring-red-500/50';
                      } else {
                        cls = 'border-slate-100 dark:border-white/5 bg-transparent dark:bg-secondary/10 text-slate-400 dark:text-muted-foreground/50 opacity-50';
                      }
                    } else if (chosen === opt) {
                      cls = 'border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]/50';
                    }

                  return (
                    <button 
                      key={oi} 
                      disabled={revealed || isSubmitted} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOption(c.id, opt);
                      }} 
                      className={`p-3 md:p-4 rounded-2xl border text-sm md:text-base font-bold transition-all duration-300 text-center sm:text-left flex items-center justify-between group ${cls} ${!revealed && !isSubmitted ? 'hover-lift' : ''}`}
                    >
                      <span className="flex items-center gap-2.5">
                        {!revealed && !isSubmitted && (
                          <span className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 text-xs font-extrabold flex items-center justify-center border border-white/5 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                            {['A', 'B', 'C', 'D'][oi]}
                          </span>
                        )}
                        <span>{opt}</span>
                      </span>
                      {revealed && opt === c.word && <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />}
                      {revealed && opt === chosen && opt !== c.word && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={1.5} />}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="slide-up space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-slate-500 dark:text-muted-foreground">Lựa chọn của bạn:</span> 
                      <span className={`font-bold ${chosen === c.word ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400 line-through'}`}>
                        {chosen || 'Chưa chọn'}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Đáp án đúng:</span> 
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{c.word}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/5 space-y-2 text-xs text-slate-500 dark:text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">💡 Nghĩa của từ: </span>
                      {c.meaning}
                    </div>
                    {c.synonyms && c.synonyms.length > 0 && (
                      <div>
                        <span className="font-semibold text-foreground">🔗 Đồng nghĩa: </span>
                        {Array.isArray(c.synonyms) ? c.synonyms.join(', ') : c.synonyms}
                      </div>
                    )}
                    {c.example && (
                      <div>
                        <span className="font-semibold text-foreground">📝 Ví dụ: </span>
                        <span className="italic">&quot;{c.example}&quot;</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
