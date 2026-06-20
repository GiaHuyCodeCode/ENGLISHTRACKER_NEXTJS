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

function generateOptions(correct: VocabCard, allCards: VocabCard[]): string[] {
  const distractors = allCards
    .filter(c => c.id !== correct.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(c => c.word);
  return [...distractors, correct.word].sort(() => Math.random() - 0.5);
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
      opts[card.id] = generateOptions(card, shuffledCards); 
    });
    setMcOptions(opts);
  }, [shuffledCards]);

  const handleJumpToQuestion = (idx: number) => {
    setCurrentActiveIdx(idx);
    const element = document.getElementById(`test-question-${idx}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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
      <div className="flex items-center gap-3 text-sm text-amber-400 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-inner">
        <FileText className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
        <span className="font-medium">Đọc thông tin gợi ý và chọn từ tiếng Anh tương ứng trong 4 đáp án.</span>
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
              className={`glass rounded-3xl border p-6 md:p-8 space-y-6 transition-all duration-300 ${
                idx === currentActiveIdx ? 'ring-1 ring-[#0071e3]/30' : ''
              } ${
                revealed 
                  ? (chosen === c.word ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-red-500/50 bg-red-500/5') 
                  : 'border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-bold border flex items-center justify-center mt-1 transition-all ${
                  idx === currentActiveIdx 
                    ? 'bg-[#0071e3] text-white border-[#0071e3]' 
                    : 'bg-white/5 text-muted-foreground border-white/5'
                }`}>
                  {idx + 1}
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
                      <p className="text-base font-semibold text-foreground/80 leading-relaxed">Chọn từ đúng cho "{c.meaning}"</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 md:pl-12">
                {opts.map((opt, oi) => {
                  let cls = 'border-white/10 bg-white/5 hover:border-primary/50 hover:bg-primary/10 text-foreground';
                  
                  if (revealed) {
                    if (opt === c.word) {
                      cls = 'border-emerald-500 bg-emerald-500/20 text-emerald-400 glow-success ring-1 ring-emerald-500/50';
                    } else if (opt === chosen && opt !== c.word) {
                      cls = 'border-red-500 bg-red-500/20 text-red-400 glow-error ring-1 ring-red-500/50';
                    } else {
                      cls = 'border-white/5 bg-secondary/10 text-muted-foreground/50 opacity-60';
                    }
                  } else if (chosen === opt) {
                    cls = 'border-primary bg-primary/20 text-primary ring-1 ring-primary/50';
                  }

                  return (
                    <button 
                      key={oi} 
                      disabled={revealed || isSubmitted} 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnswerChange(c.id, opt);
                        setMcRevealed(prev => ({ ...prev, [c.id]: true }));
                      }} 
                      className={`p-4 rounded-2xl border text-base font-bold transition-all duration-300 text-center sm:text-left flex items-center justify-between group ${cls} ${!revealed && !isSubmitted ? 'hover-lift' : ''}`}
                    >
                      <span>{opt}</span>
                      {revealed && opt === c.word && <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />}
                      {revealed && opt === chosen && opt !== c.word && <XCircle className="h-5 w-5 text-red-400" strokeWidth={1.5} />}
                    </button>
                  );
                })}
              </div>

              {revealed && chosen !== c.word && (
                <div className="pl-0 md:pl-12 slide-up space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                    <span className="text-red-400 font-medium">Đáp án đúng:</span> 
                    <span className="font-bold font-mono text-foreground">{c.word}</span>
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
