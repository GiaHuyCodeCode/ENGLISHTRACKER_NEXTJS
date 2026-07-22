import { useState, useEffect, useRef, useMemo } from 'react';
import { VocabCard, Submission, getStudentAvatar, getStudentColors } from '@/lib/local-store';
import { Volume2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowRight, RotateCcw, TrendingDown, Headphones } from 'lucide-react';

interface DictationBlockProps {
  vocabCards: VocabCard[];
  answers: Record<string, string>;
  attemptsRecord?: Record<string, number>;
  onAnswerChange: (word: string, val: string) => void;
  handleSpeak: (text: string, rate?: number, audioUrl?: string) => void;
  isSubmitted: boolean;
  isRequirementWorkflow?: boolean;
  onFinishDictation?: (score: number, answers: Record<string, string>, attempts?: Record<string, number>) => void;
  hideStudentAnswer?: boolean;
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
  speakMode?: 'before' | 'after';
}

export function DictationBlock({ 
  vocabCards, 
  answers, 
  attemptsRecord,
  onAnswerChange, 
  handleSpeak, 
  isSubmitted,
  isRequirementWorkflow = false,
  onFinishDictation,
  onProgressUpdate,
  allSubmissions,
  speakMode = 'after',
  hideStudentAnswer = false
}: DictationBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, { isCorrect: boolean; show: boolean }>>({});
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // States cho chế độ bắt buộc ôn tập/làm bài sửa lỗi nhiều vòng
  const [currentRound, setCurrentRound] = useState(1);
  const [roundWords, setRoundWords] = useState<VocabCard[]>([]);
  const [roundCorrectWords, setRoundCorrectWords] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);
  const [wrongTimerActive, setWrongTimerActive] = useState(false);

  const [hasCorrectedLocally, setHasCorrectedLocally] = useState<Record<string, boolean>>({});
  const [isWordWrongFirstTime, setIsWordWrongFirstTime] = useState<Record<string, boolean>>({});
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isSpeakerActive, setIsSpeakerActive] = useState(false);
  const wrongTimerRef = useRef<any>(null);

  const wrongCountInRound = roundWords.filter(w => !roundCorrectWords[w.word]).length;

  // Thống kê số học sinh sai theo từng từ (dùng cho trang xem kết quả)
  const dictationRepeatStats = useMemo(() => {
    if (!isSubmitted) return [];

    // Đếm số học sinh sai từng từ từ allSubmissions
    const errorCounts: Record<string, number> = {};
    vocabCards.forEach(c => errorCounts[c.word] = 0);

    const subsToScan = allSubmissions && allSubmissions.length > 0 ? allSubmissions : [];
    subsToScan.forEach(sub => {
      if (sub.assignmentType !== 'vocabulary') return;
      let answersArray: any[] = [];
      if (Array.isArray(sub.vocabAnswers)) {
        answersArray = sub.vocabAnswers;
      } else if (sub.vocabAnswers && typeof sub.vocabAnswers === 'object') {
        answersArray = Object.keys(sub.vocabAnswers).map(k => ({
          word: k, correctAnswer: k,
          isCorrect: ((sub.vocabAnswers as any)[k] || '').trim().toLowerCase() === k.toLowerCase()
        }));
      } else if (Array.isArray((sub as any).details)) {
        answersArray = (sub as any).details;
      }
      answersArray.forEach((ans: any) => {
        const w = ans.word || ans.correctAnswer;
        if (w && !ans.isCorrect && errorCounts[w] !== undefined) errorCounts[w]++;
      });
    });

    // Build final list: include all words, sort by error count desc, then alpha
    return vocabCards
      .map(c => ({
        word: c.word,
        meaning: c.meaning,
        myAnswer: (answers[c.word] || '').trim(),
        isCorrect: (answers[c.word] || '').trim().toLowerCase() === c.word.toLowerCase(),
        myErrors: Math.max(0, (attemptsRecord?.[c.word] || 1) - 1),
        classErrors: errorCounts[c.word] ?? 0,
      }))
      .sort((a, b) => b.classErrors - a.classErrors || a.word.localeCompare(b.word));
  }, [isSubmitted, allSubmissions, vocabCards, answers, attemptsRecord]);

  const classErrorStats = dictationRepeatStats; // keep backward compat alias
  const prevVocabCardsRef = useRef<VocabCard[]>([]);

  // Đồng bộ và RANDOM danh sách từ khi mount/change
  useEffect(() => {
    if (vocabCards.length === 0) return;

    // So sánh shallow/ID để tránh reset tiến trình khi component cha re-render và tạo mới reference mảng vocabCards
    const isSameCards =
      prevVocabCardsRef.current.length === vocabCards.length &&
      prevVocabCardsRef.current.every((c, i) => c.id === vocabCards[i].id);

    if (isSameCards) {
      return;
    }

    prevVocabCardsRef.current = vocabCards;

    // Xáo trộn ngẫu nhiên danh sách từ vựng (không xáo trộn nếu là xem lại bài đã nộp)
    const shuffled = isSubmitted ? [...vocabCards] : [...vocabCards].sort(() => Math.random() - 0.5);
    setRoundWords(shuffled);
    setCurrentIdx(0);
    setCurrentRound(1);
    setRoundCorrectWords({});
    setAttempts({});
    setIsFinished(false);
    setShowEndScreen(false);
    setCalculatedScore(0);
    setFeedback({});
    setShowWrongFeedback(false);
    setWrongTimerActive(false);
    setHasCorrectedLocally({});
    setIsWordWrongFirstTime({});
    isInitialMount.current = true;
  }, [vocabCards, isSubmitted]);

  // Listen to top status bar jump event
  useEffect(() => {
    const handleJump = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetIdx = customEvent.detail?.index;
      if (typeof targetIdx === 'number' && targetIdx >= 0 && targetIdx < vocabCards.length) {
        const targetWord = vocabCards[targetIdx];
        const matchIdx = roundWords.findIndex(w => w.id === targetWord?.id);
        if (matchIdx !== -1) {
          setCurrentIdx(matchIdx);
        }
      }
    };
    window.addEventListener('vocab-jump', handleJump);
    return () => window.removeEventListener('vocab-jump', handleJump);
  }, [vocabCards, roundWords]);

  const currentCard = roundWords[currentIdx];

  // Báo cáo tiến trình lên cha (VocabularyExercise) để vẽ sidebar tracking
  useEffect(() => {
    if (!onProgressUpdate || roundWords.length === 0) return;

    let completed = 0;
    let incorrect = 0;
    let pending = 0;
    const statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'> = {};

    roundWords.forEach((card) => {
      const word = card.word;
      let isCorrect = false;
      let isWrong = false;

      if (isSubmitted) {
        const studentAns = (answers[word] || '').trim();
        isCorrect = studentAns.toLowerCase() === word.toLowerCase();
        isWrong = !isCorrect;
      } else {
        // Nếu đã từng sai ở round này thì luôn tính là sai cho thanh tiến trình
        isWrong = !!isWordWrongFirstTime[word];
        // Chỉ coi là hoàn thành đúng nếu chưa từng sai VÀ hiện tại đã trả lời đúng
        isCorrect = !!(roundCorrectWords[word] || hasCorrectedLocally[word]) && !isWrong;
      }

      let status: 'correct' | 'incorrect' | 'pending' | 'active' = 'pending';
      const isActive = currentCard && card.id === currentCard.id;

      if (isWrong) {
        status = 'incorrect';
        incorrect++;
      } else if (isCorrect) {
        status = 'correct';
        completed++;
      } else if (isActive) {
        status = 'active';
      } else {
        pending++;
      }

      statusMap[card.id] = status;
    });

    onProgressUpdate({
      completed,
      incorrect,
      pending,
      statusMap,
      currentIdx,
      roundWords,
      onJumpToQuestion: (idx: number) => {
        if (isSubmitted || (!wrongTimerActive && !isFinished)) {
          if (idx >= 0 && idx < roundWords.length) {
            setCurrentIdx(idx);
          }
        }
      }
    });
  }, [
    vocabCards,
    roundWords,
    currentCard,
    roundCorrectWords,
    hasCorrectedLocally,
    isWordWrongFirstTime,
    wrongTimerActive,
    isFinished,
    isSubmitted,
    answers,
    onProgressUpdate,
    currentIdx
  ]);

  const isInitialMount = useRef(true);
  
  // Tự động phát âm khi chuyển từ
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished || wrongTimerActive) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Không tự động phát âm khi mới vào bài tập
    }
    if (speakMode === 'before') {
      const timer = setTimeout(() => handleSpeak(currentCard.word, 1.0, currentCard.audioUrl), 300);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, currentCard, isSubmitted, isFinished, handleSpeak, wrongTimerActive, speakMode]);

  // Focus & cuộn mượt ô nhập liệu vào giữa màn hình (tránh lỗi Safari iOS tự cuộn lên top khi bàn phím mở)
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished || wrongTimerActive) return;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [currentIdx, isSubmitted, isFinished, wrongTimerActive, currentCard]);

  // Hotkey Ctrl to play audio manually (only available in 'before' mode)
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished || speakMode !== 'before') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        handleSpeak(currentCard.word, 1.0, currentCard.audioUrl);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isSubmitted, isFinished, handleSpeak, speakMode]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    };
  }, []);

  // Đếm ngược 5 giây ở màn hình hoàn thành
  useEffect(() => {
    if (!isFinished || isSubmitted) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishAndProceed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, isSubmitted]);

  // Window listener cho phím Enter chuyển tiếp / bỏ qua
  useEffect(() => {
    if (isSubmitted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (wrongTimerActive) {
          e.preventDefault();
          if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
          setShowWrongFeedback(false);
          setWrongTimerActive(false);
          if (currentCard) {
            onAnswerChange(currentCard.word, '');
          }
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus({ preventScroll: true });
              inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 50);
          return;
        }
        if (showEndScreen && wrongCountInRound > 0) {
          e.preventDefault();
          startNextRound();
          return;
        }
        if (isFinished) {
          e.preventDefault();
          handleFinishAndProceed();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongTimerActive, showEndScreen, wrongCountInRound, isFinished, currentCard, onAnswerChange, isSubmitted]);

  const handleCheckSpelling = () => {
    if (!currentCard) return;
    if (wrongTimerActive) return;

    const word = currentCard.word;
    const studentAnswer = (answers[word] || '').trim();
    const isCorrect = studentAnswer.toLowerCase() === word.toLowerCase();

    // Tăng số lần thử cho từ này
    setAttempts(prev => ({
      ...prev,
      [word]: (prev[word] || 0) + 1
    }));

    const hasBeenWrong = isWordWrongFirstTime[word];

    if (isCorrect) {
      if (!hasBeenWrong) {
        // Đúng ngay lần đầu tiên trong Round
        setRoundCorrectWords(prev => ({ ...prev, [word]: true }));
      }
      
      setHasCorrectedLocally(prev => ({ ...prev, [word]: true }));
      setFeedback(prev => ({
        ...prev,
        [word]: { isCorrect: true, show: true }
      }));
      handleSpeak(word, 1.0, currentCard.audioUrl);
      
      // Nếu là từ cuối cùng, hiển thị màn hình kết thúc ngay lập tức
      if (currentIdx === roundWords.length - 1) {
        setShowEndScreen(true);
      } else {
        // Tự động qua từ tiếp theo sau 1s
        setTimeout(() => {
          handleGoToNext();
        }, 1000);
      }
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);

      if (!hasBeenWrong) {
        setIsWordWrongFirstTime(prev => ({ ...prev, [word]: true }));
        setRoundCorrectWords(prev => ({ ...prev, [word]: false }));

        if (isRequirementWorkflow) {
          setShowWrongFeedback(true);
          setWrongTimerActive(true);
          if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
          wrongTimerRef.current = setTimeout(() => {
            setShowWrongFeedback(false);
            setWrongTimerActive(false);
            onAnswerChange(word, '');
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.focus({ preventScroll: true });
                inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 50);
          }, 2500);
        } else {
          setFeedback(prev => ({
            ...prev,
            [word]: { isCorrect: false, show: true }
          }));
        }
      } else {
        setFeedback(prev => ({
          ...prev,
          [word]: { isCorrect: false, show: true }
        }));
      }
    }
  };

  const handleGoToNext = () => {
    if (currentIdx < roundWords.length - 1) {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const startNextRound = () => {
    const nextRoundWords = roundWords.filter(w => !roundCorrectWords[w.word]);
    
    nextRoundWords.forEach(w => {
      onAnswerChange(w.word, '');
    });

    setRoundWords(nextRoundWords);
    setCurrentIdx(0);
    setCurrentRound(prev => prev + 1);
    setRoundCorrectWords({});
    setFeedback({});
    setShowEndScreen(false);
    setShowWrongFeedback(false);
    setHasCorrectedLocally({});
    setIsWordWrongFirstTime({});
  };

  const handleFinishAndProceed = () => {
    onFinishDictation?.(calculatedScore, answers, attempts);
  };

  useEffect(() => {
    if (!isSubmitted && showEndScreen && wrongCountInRound === 0 && !isFinished) {
      const N = vocabCards.length;
      let totalAttempts = 0;
      vocabCards.forEach(c => {
        totalAttempts += attempts[c.word] || 1;
      });
      if (totalAttempts < N) totalAttempts = N;

      const score = Math.max(0, Math.round((N / totalAttempts) * 100));
      setCalculatedScore(score);
      setIsFinished(true);
    }
  }, [isSubmitted, showEndScreen, wrongCountInRound, isFinished, vocabCards, attempts]);

  // === REVIEW MODE: Hiển thị toàn bộ đoạn Script + Phát âm ===
  if (isSubmitted) {
    return (
      <div className="space-y-4 w-full slide-up">
        <h3 className="text-base font-bold font-heading mb-3 text-foreground flex items-center gap-2">
          <Headphones className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Luyện Tập Nghe Chép
        </h3>
        <div className="grid gap-4">
          {vocabCards.map((card, idx) => {
            const studentAns = (answers[card.word] || '').trim();
            const totalAttempts = attemptsRecord?.[card.word] || 1;
            const isCorrect = studentAns.toLowerCase() === card.word.toLowerCase() && totalAttempts <= 1;
            return (
              <div key={card.id} className={`rounded-2xl p-4 md:p-5 border flex flex-col md:flex-row gap-4 items-start md:items-center transition-all
                bg-white dark:bg-secondary/30
                ${isCorrect
                  ? 'border-emerald-200 dark:border-emerald-500/20'
                  : 'border-slate-200 dark:border-white/10'
                }
              `}>
                {/* Play Button */}
                <button
                  onClick={() => handleSpeak(card.word, 1.0, card.audioUrl)}
                  className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 hover:bg-[#0071e3] hover:text-white text-[#0071e3] flex items-center justify-center transition-all shadow-sm hover-lift"
                >
                  <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="font-extrabold text-lg md:text-xl text-foreground">{card.word}</span>
                    {card.meaning && (
                      <span className="text-sm md:text-base text-muted-foreground italic truncate">— {card.meaning}</span>
                    )}
                  </div>

                  {/* Correct / Incorrect badge */}
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Đúng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-500/20">
                        <XCircle className="w-3 h-3" /> Sai
                      </span>
                    )}
                  </div>

                  {/* Số lần sai + Đáp án đúng (nếu sai) */}
                  {!hideStudentAnswer && (() => {
                    const totalAttempts = attemptsRecord?.[card.word] || 1;
                    const wrongCount = Math.max(0, totalAttempts - 1);
                    return (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {wrongCount === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/20">
                            ✨ Chính xác ngay lần đầu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-bold border border-red-200 dark:border-red-500/20">
                            🔥 Sai {wrongCount} lần
                          </span>
                        )}
                        {!isCorrect && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold border border-sky-200 dark:border-sky-500/20">
                            → <span className="font-extrabold">{card.word}</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentCard && !isFinished) return null;

  // Finished Screen
  if (!isSubmitted && isFinished) {
    const N = vocabCards.length;
    let totalAttempts = 0;
    vocabCards.forEach(c => {
      totalAttempts += attempts[c.word] || 1;
    });
    return (
      <div className="glass-strong rounded-3xl border border-emerald-500/30 p-8 text-center max-w-xl mx-auto space-y-6 slide-up glow-success">
        <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Hoàn Thành Phần Nghe Chép!</h3>
          <p className="text-sm text-muted-foreground">Bạn đã viết chính xác toàn bộ {N} từ vựng.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-white/5">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Điểm Nghe Chép</span>
            <span className="text-2xl md:text-3xl font-extrabold text-primary">{calculatedScore}đ</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Tổng số lần thử</span>
            <span className="text-2xl md:text-3xl font-extrabold text-foreground">{totalAttempts} lần</span>
          </div>
        </div>

        <button 
          onClick={handleFinishAndProceed}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all flex flex-col items-center justify-center gap-1 hover-lift"
        >
          <span className="flex items-center gap-2">Hoàn Thành Nghe Chép <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} /></span>
          <span className="text-xs text-white/70 font-normal">Nhấn Enter hoặc tự động hoàn thành sau {countdown} giây...</span>
        </button>
      </div>
    );
  }

  // Round Ended (Needs correction round)
  if (!isSubmitted && showEndScreen && wrongCountInRound > 0) {
    return (
      <div className="glass-strong rounded-3xl border border-amber-500/30 p-8 text-center max-w-xl mx-auto space-y-6 slide-up">
        <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 animate-bounce">
          <RotateCcw className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Kết thúc Vòng {currentRound}!</h3>
          <p className="text-sm text-muted-foreground">
            Bạn đã đi qua toàn bộ từ trong vòng này. Có <span className="text-amber-600 dark:text-amber-400 font-bold">{wrongCountInRound} từ</span> chưa chính xác.
          </p>
        </div>

        <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-left text-xs max-h-48 overflow-y-auto space-y-1">
          <span className="text-muted-foreground font-bold block mb-1 uppercase text-[10px]">Danh sách từ cần sửa:</span>
          {roundWords.filter(w => !roundCorrectWords[w.word]).map(w => (
            <div key={w.id} className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="font-semibold text-foreground">{w.word}</span>
              <span className="text-muted-foreground italic text-[11px]">{w.meaning}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={startNextRound}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift shadow-lg"
        >
          Bắt đầu Vòng {currentRound + 1} <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  const currentFeedback = feedback[currentCard.word];

  const failedPeers = allSubmissions?.filter(sub => {
    if (sub.assignmentType !== 'vocabulary') return false;
    let answersArray: any[] = [];
    if (Array.isArray(sub.vocabAnswers)) {
      answersArray = sub.vocabAnswers;
    } else if (sub.vocabAnswers && typeof sub.vocabAnswers === 'object') {
      answersArray = Object.keys(sub.vocabAnswers).map(k => ({
        word: k, correctAnswer: k,
        isCorrect: ((sub.vocabAnswers as any)[k] || '').trim().toLowerCase() === k.toLowerCase()
      }));
    } else if (Array.isArray((sub as any).details)) {
      answersArray = (sub as any).details;
    }
    if (answersArray.length === 0) return false;
    const ans = answersArray.find((a: any) => (a.word || a.correctAnswer) === currentCard.word);
    return ans && !ans.isCorrect;
  }).map(sub => sub.studentName) || [];
  const uniqueFailedPeers = Array.from(new Set(failedPeers));

  return (
    <div className={`space-y-6 max-w-3xl mx-auto w-full slide-up ${shake ? 'animate-shake' : ''} px-1 md:px-0`}>
      {/* Class Statistics Board */}
      {isSubmitted && classErrorStats.length > 0 && (
        <div className="rounded-3xl p-6 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 mb-8 slide-up shadow-sm dark:shadow-none">
          <h3 className="text-lg font-bold font-heading text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5" strokeWidth={1.5} /> Bảng thống kê các từ sai nhiều nhất (Cả lớp)
          </h3>
          <div className="flex flex-wrap gap-3">
            {classErrorStats.map((stat) => (
              <div key={stat.word} className="px-4 py-2 rounded-xl bg-white dark:bg-background/50 border border-red-200 dark:border-red-500/10 flex items-center gap-3 hover:border-red-400 dark:hover:border-red-500/30 transition-colors group cursor-default shadow-xs dark:shadow-none">
                <span className="text-sm font-bold text-foreground group-hover:text-red-600 dark:text-red-400 transition-colors">{stat.word}</span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold tracking-widest">{stat.classErrors} lỗi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Workspace Card */}
      <div className={`rounded-3xl border p-6 md:p-10 flex flex-col items-center justify-center text-center space-y-8 transition-all duration-300 relative
        bg-white dark:bg-secondary/30
        shadow-md dark:shadow-none
        ${shake 
          ? 'animate-shake border-red-300 dark:border-red-500/50' 
          : currentFeedback?.isCorrect 
            ? 'border-emerald-300 dark:border-emerald-500/30 shadow-emerald-50 dark:shadow-none' 
            : 'border-slate-200 dark:border-white/5'
        }`}>

        {/* Play Audio Button (Larger for better tap targets on phone) */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#0071e3]/20 rounded-full blur-xl pulse-dot"></div>
          <button 
            onMouseDown={(e) => {
              e.preventDefault();
              if (!wrongTimerActive) {
                setIsSpeakerActive(true);
                setTimeout(() => setIsSpeakerActive(false), 150);
                handleSpeak(currentCard.word, 1.0, currentCard.audioUrl);
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              if (!wrongTimerActive) {
                setIsSpeakerActive(true);
                setTimeout(() => setIsSpeakerActive(false), 150);
                handleSpeak(currentCard.word, 1.0, currentCard.audioUrl);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
            }}
            disabled={wrongTimerActive}
            className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-md disabled:opacity-50
              ${isSpeakerActive
                ? 'bg-[#0071e3]/30 border-[#0071e3]/50 text-[#0071e3] scale-95 opacity-60 duration-75'
                : 'bg-[#0071e3]/10 border-[#0071e3]/20 hover:bg-[#0071e3] hover:text-white text-[#0071e3] hover-lift'
              }
            `}
          >
            <Volume2 className="h-10 w-10 md:h-12 md:w-12" strokeWidth={1.5} />
          </button>
        </div>

        {/* Meaning Hint */}
        <div className="space-y-1.5 w-full max-w-md">
          {currentCard.synonyms && currentCard.synonyms.length > 0 && (
            <div className="flex justify-center mb-3">
              <div className="flex items-center flex-wrap justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-muted-foreground tracking-widest">Từ Đồng Nghĩa:</span>
                <div className="flex items-center gap-1.5">
                  {currentCard.synonyms.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-200 text-sm font-semibold shadow-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-muted-foreground tracking-widest text-center">Nghĩa tiếng Việt</p>
          <div className="bg-slate-50 dark:bg-white/5 rounded-2xl px-6 py-4 border border-slate-200 dark:border-white/5 text-center">
            <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-foreground leading-relaxed">{currentCard.meaning}</p>
          </div>
        </div>

        {/* Input Area (Larger font/height for virtual keyboard safety) */}
        <div className="w-full max-w-md pt-2 space-y-4">
          <form className="flex gap-3" onSubmit={(e) => {
            e.preventDefault();
            const currentFeedback = feedback[currentCard.word];
            if (currentFeedback?.show && !currentFeedback.isCorrect) {
              setFeedback(prev => ({
                ...prev,
                [currentCard.word]: { isCorrect: false, show: false }
              }));
              onAnswerChange(currentCard.word, '');
            } else {
              handleCheckSpelling();
            }
          }}>
            <input
              ref={inputRef}
              type="text"
              value={answers[currentCard.word] || ''}
              onChange={e => {
                onAnswerChange(currentCard.word, e.target.value);
                if (feedback[currentCard.word]) {
                  setFeedback(prev => ({
                    ...prev,
                    [currentCard.word]: { ...prev[currentCard.word], show: false }
                  }));
                }
              }}
              disabled={isSubmitted || wrongTimerActive}
              enterKeyHint="done"
              placeholder="Nghe và gõ lại từ vựng..."
              className={`input-field flex-1 text-center font-bold tracking-wider text-lg md:text-xl h-14 md:h-16 transition-all rounded-2xl ${
                isSubmitted
                  ? (answers[currentCard.word] || '').trim().toLowerCase() === currentCard.word.toLowerCase()
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5'
                    : 'border-red-400 dark:border-red-500 ring-2 ring-red-500/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/5'
                  : currentFeedback?.isCorrect ? 'border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5' 
                  : (isWordWrongFirstTime[currentCard.word] && !currentFeedback?.isCorrect) ? 'border-red-400 dark:border-red-500 ring-2 ring-red-500/30 text-red-600 dark:text-red-400' 
                  : 'border-slate-200 dark:border-white/10 focus:border-[#0071e3]/60 dark:focus:border-[#0071e3]/50'}`}
            />
            
            {!isSubmitted && !isRequirementWorkflow && (
              <button 
                type="submit"
                className="px-4 md:px-6 h-14 md:h-16 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-foreground hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 font-semibold rounded-2xl text-sm transition-all hover-lift active:scale-[0.97]"
              >
                Kiểm tra
              </button>
            )}
            {!isSubmitted && isRequirementWorkflow && !wrongTimerActive && !currentFeedback?.isCorrect && (
              <button 
                type="submit"
                className="px-4 md:px-6 h-14 md:h-16 bg-[#0071e3] text-white font-bold rounded-2xl text-sm transition-all hover-lift active:scale-[0.97] shadow-md shadow-[#0071e3]/20"
              >
                Kiểm tra
              </button>
            )}
          </form>

          {/* Peer error tracking (Enlarged circles, no label text) */}
          {uniqueFailedPeers.length > 0 && (
            <div className="flex justify-center gap-2 py-1">
              {uniqueFailedPeers.map(peer => {
                const colors = getStudentColors(peer);
                return (
                  <div key={peer} title={`${peer} đã làm sai từ này`} className={`relative w-9 h-9 rounded-full border-2 border-red-500 flex items-center justify-center text-xs font-bold shadow-md z-10 hover:z-20 transition-all hover:scale-110 ${colors.bg} ${colors.text}`}>
                    {getStudentAvatar(peer)}
                  </div>
                );
              })}
            </div>
          )}

          {/* Free Mode Feedback */}
          {!isSubmitted && !isRequirementWorkflow && currentFeedback?.show && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold slide-up ${
              currentFeedback.isCorrect 
                ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 glow-success' 
                : 'bg-red-500/10 dark:bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 glow-error'
            }`}>
              {currentFeedback.isCorrect ? (
                <><CheckCircle2 className="h-5 w-5" strokeWidth={1.5} /> Chính xác! ({currentCard.word})</>
              ) : (
                <><XCircle className="h-5 w-5" strokeWidth={1.5} /> Sai rồi. Đáp án: {currentCard.word}</>
              )}
            </div>
          )}

          {/* Submitted/Review Mode Feedback */}
          {isSubmitted && (
            <div className="w-full space-y-4 pt-4 border-t border-white/5">
              <div className="flex flex-wrap gap-4 text-sm justify-center">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                  Math.max(0, (attemptsRecord[currentCard.word] || 1) - 1) === 0
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/10 dark:bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {Math.max(0, (attemptsRecord[currentCard.word] || 1) - 1) === 0 ? (
                    <><span className="font-bold">✨ Chính xác ngay lần đầu</span></>
                  ) : (
                    <><span className="font-bold">🔥 Sai {Math.max(0, (attemptsRecord[currentCard.word] || 1) - 1)} lần</span></>
                  )}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Đáp án đúng:</span> 
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{currentCard.word}</span>
                </div>
              </div>
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs text-left max-w-md mx-auto text-muted-foreground animate-fade-in">
                {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">🔗 Đồng nghĩa: </span>
                    {Array.isArray(currentCard.synonyms) ? currentCard.synonyms.join(', ') : currentCard.synonyms}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-foreground">💡 Nghĩa của từ: </span>
                  {currentCard.meaning}
                </div>
                {currentCard.example && (
                  <div>
                    <span className="font-semibold text-foreground">📝 Ví dụ: </span>
                    <span className="italic">&quot;{currentCard.example}&quot;</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Required Mode: Wrong feedback (shows correct answer for 2.5s) */}
          {!isSubmitted && isRequirementWorkflow && showWrongFeedback && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 dark:bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 glow-error text-sm font-bold slide-up flex flex-col items-center gap-1.5 animate-pulse">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" strokeWidth={1.5} /> Sai rồi! Hãy ghi nhớ từ đúng dưới đây:
              </div>
              <div className="text-2xl font-extrabold tracking-widest uppercase text-red-700 dark:text-red-400 mt-1">
                {currentCard.word}
              </div>
              <div className="w-full bg-black/10 dark:bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-red-500 h-full animate-countdown"></div>
              </div>
            </div>
          )}

          {/* Required Mode: Repeat prompt for errors */}
          {!isSubmitted && isRequirementWorkflow && !showWrongFeedback && currentFeedback?.show && !currentFeedback.isCorrect && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 dark:bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 glow-error text-sm font-bold slide-up flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" strokeWidth={1.5} /> Vẫn chưa chính xác! Hãy gõ đúng từ:
              </div>
              <div className="text-lg font-extrabold tracking-widest uppercase text-red-700 dark:text-red-400 mt-1">
                {currentCard.word}
              </div>
            </div>
          )}

          {/* Required Mode: Correct success block */}
          {!isSubmitted && isRequirementWorkflow && currentFeedback?.show && currentFeedback.isCorrect && (
            <div className="p-3.5 rounded-xl border bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 glow-success text-sm font-bold slide-up flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 animate-bounce" strokeWidth={1.5} /> Tuyệt vời! Bạn đã gõ chính xác.
            </div>
          )}
        </div>
      </div>

      {/* Free Mode Navigation Controls */}
      {(!isRequirementWorkflow || isSubmitted) && (
        <div className="flex justify-between items-center gap-4">
          <button 
            onClick={() => { setCurrentIdx(prev => Math.max(0, prev - 1)); setFeedback({}); }} 
            disabled={currentIdx === 0} 
            className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift text-slate-700 dark:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} /> Từ trước
          </button>
          <button 
            onClick={() => {
              if (!currentCard) return;
              if (!feedback[currentCard.word]?.show && !hasCorrectedLocally[currentCard.word]) {
                handleCheckSpelling();
                return;
              }
              if (currentIdx === roundWords.length - 1) {
                setShowEndScreen(true);
              } else {
                setCurrentIdx(prev => Math.min(roundWords.length - 1, prev + 1)); 
                setFeedback({});
              }
            }} 
            disabled={currentIdx === roundWords.length - 1 && feedback[currentCard?.word]?.show && currentFeedback?.isCorrect} 
            className="px-5 py-3 rounded-xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-sky-600 dark:text-sky-400 hover:bg-[#0071e3] hover:text-white disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
          >
            {currentIdx === roundWords.length - 1 && feedback[currentCard?.word]?.show ? 'Hoàn thành' : 'Từ tiếp theo'} <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
