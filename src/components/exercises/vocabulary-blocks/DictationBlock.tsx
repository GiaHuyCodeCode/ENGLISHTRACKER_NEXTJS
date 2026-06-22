import { useState, useEffect, useRef, useMemo } from 'react';
import { VocabCard, Submission, getStudentAvatar } from '@/lib/local-store';
import { Volume2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowRight, RotateCcw, TrendingDown, Headphones } from 'lucide-react';

interface DictationBlockProps {
  vocabCards: VocabCard[];
  answers: Record<string, string>;
  attemptsRecord?: Record<string, number>;
  onAnswerChange: (word: string, val: string) => void;
  handleSpeak: (text: string) => void;
  isSubmitted: boolean;
  isRequirementWorkflow?: boolean;
  onFinishDictation?: (score: number, answers: Record<string, string>, attempts?: Record<string, number>) => void;
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
  speakMode = 'after'
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

  // Đồng bộ và RANDOM danh sách từ khi mount/change
  useEffect(() => {
    if (vocabCards.length === 0) return;
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
    if (!onProgressUpdate || vocabCards.length === 0) return;

    let completed = 0;
    let incorrect = 0;
    let pending = 0;
    const statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'> = {};

    vocabCards.forEach((card) => {
      const word = card.word;
      let isCorrect = false;
      let isWrong = false;

      if (isSubmitted) {
        const studentAns = (answers[word] || '').trim();
        isCorrect = studentAns.toLowerCase() === word.toLowerCase();
        isWrong = !isCorrect;
      } else {
        isCorrect = !!(roundCorrectWords[word] || hasCorrectedLocally[word]);
        isWrong = !!(isWordWrongFirstTime[word] && !isCorrect);
      }

      let status: 'correct' | 'incorrect' | 'pending' | 'active' = 'pending';
      const isActive = currentCard && card.id === currentCard.id;

      if (isCorrect) {
        status = 'correct';
        completed++;
      } else if (isActive) {
        status = 'active';
      } else if (isWrong) {
        status = 'incorrect';
        incorrect++;
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
      currentIdx: vocabCards.findIndex(c => c.id === currentCard?.id),
      roundWords: vocabCards,
      onJumpToQuestion: (idx: number) => {
        if (isSubmitted || (!wrongTimerActive && !isFinished)) {
          const targetCard = vocabCards[idx];
          const roundIdx = roundWords.findIndex(c => c.id === targetCard?.id);
          if (roundIdx !== -1) {
            setCurrentIdx(roundIdx);
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
    onProgressUpdate
  ]);

  // Tự động phát âm khi chuyển từ
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished || wrongTimerActive) return;
    if (speakMode === 'before') {
      const timer = setTimeout(() => handleSpeak(currentCard.word), 300);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, currentCard, isSubmitted, isFinished, handleSpeak, wrongTimerActive, speakMode]);

  // Removed isRoundEnded useEffect since it is now explicitly handled in handleCheckSpelling

  // Hotkey Ctrl to play audio manually (only available in 'before' mode)
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished || speakMode !== 'before') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        handleSpeak(currentCard.word);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isSubmitted, isFinished, handleSpeak, speakMode]);

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
      handleSpeak(word);
      
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
          setTimeout(() => {
            setShowWrongFeedback(false);
            setWrongTimerActive(false);
            onAnswerChange(word, '');
            setTimeout(() => inputRef.current?.focus(), 50);
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

  const wrongCountInRound = roundWords.filter(w => !roundCorrectWords[w.word]).length;

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
      <div className="space-y-4 max-w-4xl mx-auto w-full slide-up">
        <h3 className="text-lg font-bold font-heading mb-4 text-foreground flex items-center gap-2">
          <Headphones className="w-5 h-5 text-sky-400" /> Script Nghe Chép & Phát Âm
        </h3>
        <div className="grid gap-3">
          {vocabCards.map((card, idx) => {
            const studentAns = (answers[card.word] || '').trim();
            const isCorrect = studentAns.toLowerCase() === card.word.toLowerCase();
            return (
              <div key={card.id} className="glass-strong rounded-2xl p-4 md:p-5 border border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center">
                {/* Play Button */}
                <button 
                  onClick={() => handleSpeak(card.word)}
                  className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 hover:bg-[#0071e3] hover:text-white text-[#0071e3] flex items-center justify-center transition-all shadow-sm hover-lift"
                >
                  <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="font-extrabold text-lg md:text-xl text-foreground">{card.word}</span>
                    <span className="text-sm md:text-base text-muted-foreground italic truncate">- {card.meaning}</span>
                  </div>
                  
                  {/* Answers */}
                  <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm mt-2 bg-black/20 p-2 rounded-xl w-fit">
                    <span className="text-muted-foreground uppercase font-bold text-[10px] md:text-xs tracking-widest">Lựa chọn:</span>
                    <span className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400 line-through'}`}>
                      {studentAns || 'Chưa điền'}
                    </span>
                    {!isCorrect && (
                      <>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="text-emerald-400 font-extrabold">{card.word}</span>
                      </>
                    )}
                  </div>
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
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Hoàn Thành Phần Nghe Chép!</h3>
          <p className="text-sm text-muted-foreground">Bạn đã viết chính xác toàn bộ {N} từ vựng.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-white/5 p-5 rounded-2xl border border-white/5">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Điểm Nghe Chép</span>
            <span className="text-2xl md:text-3xl font-extrabold text-primary">{calculatedScore}đ</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Tổng số lần thử</span>
            <span className="text-2xl md:text-3xl font-extrabold text-foreground">{totalAttempts} lần</span>
          </div>
        </div>

        {isRequirementWorkflow ? (
          <button 
            onClick={handleFinishAndProceed}
            className="w-full py-4 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift"
          >
            Tiếp tục sang phần Trắc Nghiệm <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : (
          <button 
            onClick={handleFinishAndProceed}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift"
          >
            Hoàn Thành Nghe Chép <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    );
  }

  // Round Ended (Needs correction round)
  if (!isSubmitted && showEndScreen && wrongCountInRound > 0) {
    return (
      <div className="glass-strong rounded-3xl border border-amber-500/30 p-8 text-center max-w-xl mx-auto space-y-6 slide-up">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 animate-bounce">
          <RotateCcw className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Kết thúc Vòng {currentRound}!</h3>
          <p className="text-sm text-muted-foreground">
            Bạn đã đi qua toàn bộ từ trong vòng này. Có <span className="text-amber-400 font-bold">{wrongCountInRound} từ</span> chưa chính xác.
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
        <div className="glass-strong rounded-3xl p-6 border border-red-500/20 bg-red-500/5 mb-8 slide-up">
          <h3 className="text-lg font-bold font-heading text-red-400 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5" strokeWidth={1.5} /> Bảng thống kê các từ sai nhiều nhất (Cả lớp)
          </h3>
          <div className="flex flex-wrap gap-3">
            {classErrorStats.map((stat) => (
              <div key={stat.word} className="px-4 py-2 rounded-xl bg-background/50 border border-red-500/10 flex items-center gap-3 hover:border-red-500/30 transition-colors group cursor-default">
                <span className="text-sm font-bold text-foreground group-hover:text-red-400 transition-colors">{stat.word}</span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold tracking-widest">{stat.classErrors} lỗi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Workspace Card */}
      <div className={`glass-strong rounded-3xl border p-6 md:p-10 flex flex-col items-center justify-center text-center space-y-8 transition-all duration-300 relative ${shake ? 'animate-shake border-red-500/50' : currentFeedback?.isCorrect ? 'border-emerald-500/30' : 'border-white/5'}`}>

        {/* Play Audio Button (Larger for better tap targets on phone) */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#0071e3]/20 rounded-full blur-xl pulse-dot"></div>
          <button 
            onClick={() => handleSpeak(currentCard.word)} 
            disabled={wrongTimerActive}
            className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 hover:bg-[#0071e3] hover:text-white text-[#0071e3] flex items-center justify-center transition-all shadow-md hover-lift disabled:opacity-50"
          >
            <Volume2 className="h-10 w-10 md:h-12 md:w-12" strokeWidth={1.5} />
          </button>
        </div>

        {/* Meaning Hint */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nghĩa tiếng Việt</p>
          <p className="text-lg md:text-xl font-bold text-foreground leading-relaxed">{currentCard.meaning}</p>
        </div>

        {/* Input Area (Larger font/height for virtual keyboard safety) */}
        <div className="w-full max-w-md pt-2 space-y-4">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={answers[currentCard.word] || ''}
              onChange={e => onAnswerChange(currentCard.word, e.target.value)}
              disabled={isSubmitted || wrongTimerActive}
              onKeyDown={e => e.key === 'Enter' && handleCheckSpelling()}
              placeholder="Nghe và gõ lại từ vựng..."
              className={`input-field flex-1 text-center font-bold tracking-wider text-lg md:text-xl h-14 md:h-16 transition-all ${
                isSubmitted
                  ? (answers[currentCard.word] || '').trim().toLowerCase() === currentCard.word.toLowerCase()
                    ? 'border-emerald-500 ring-1 ring-emerald-500/50 text-emerald-400 bg-emerald-500/5'
                    : 'border-red-500 ring-1 ring-red-500/50 text-red-400 bg-red-500/5'
                  : currentFeedback?.isCorrect ? 'border-emerald-500 ring-1 ring-emerald-500/50 text-emerald-400' 
                  : (isWordWrongFirstTime[currentCard.word] && !currentFeedback?.isCorrect) ? 'border-red-500 ring-1 ring-red-500/50 text-red-400' 
                  : ''}`}
              autoFocus
            />
            
            {uniqueFailedPeers.length > 0 && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 flex-wrap bg-red-500/5 w-fit px-2 py-1 rounded-md border border-red-500/10 whitespace-nowrap">
                <span className="text-[10px] text-red-400/80 uppercase font-semibold">Các bạn đã sai:</span>
                <div className="flex -space-x-1">
                  {uniqueFailedPeers.map(peer => (
                    <div key={peer} title={`${peer} đã làm sai từ này`} className="relative w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center bg-background text-[8px] font-bold shadow-sm z-10 hover:z-20 transition-all hover:scale-110">
                      {getStudentAvatar(peer)}
                      <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-background">
                        <XCircle className="w-2 h-2 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!isSubmitted && !isRequirementWorkflow && (
              <button 
                onClick={handleCheckSpelling} 
                className="px-4 md:px-6 h-14 md:h-16 bg-white/5 text-foreground hover:bg-white/10 font-semibold rounded-xl text-sm transition-all hover-lift"
              >
                Kiểm tra
              </button>
            )}
            {!isSubmitted && isRequirementWorkflow && !wrongTimerActive && !currentFeedback?.isCorrect && (
              <button 
                onClick={handleCheckSpelling} 
                className="px-4 md:px-6 h-14 md:h-16 bg-[#0071e3] text-white font-bold rounded-xl text-sm transition-all hover-lift"
              >
                Kiểm tra
              </button>
            )}
          </div>

          {/* Free Mode Feedback */}
          {!isSubmitted && !isRequirementWorkflow && currentFeedback?.show && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold slide-up ${
              currentFeedback.isCorrect 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 glow-success' 
                : 'bg-red-500/10 border-red-500/30 text-red-400 glow-error'
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-muted-foreground">Lựa chọn của bạn:</span> 
                  <span className={`font-bold ${(answers[currentCard.word] || '').trim().toLowerCase() === currentCard.word.toLowerCase() ? 'text-emerald-400' : 'text-red-400 line-through'}`}>
                    {answers[currentCard.word] || 'Chưa điền'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400 font-medium">Đáp án đúng:</span> 
                  <span className="font-bold text-emerald-300">{currentCard.word}</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs text-left max-w-md mx-auto text-muted-foreground animate-fade-in">
                <div>
                  <span className="font-semibold text-foreground">💡 Nghĩa của từ: </span>
                  {currentCard.meaning}
                </div>
                {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">🔗 Đồng nghĩa: </span>
                    {Array.isArray(currentCard.synonyms) ? currentCard.synonyms.join(', ') : currentCard.synonyms}
                  </div>
                )}
                {currentCard.example && (
                  <div>
                    <span className="font-semibold text-foreground">📝 Ví dụ: </span>
                    <span className="italic">"{currentCard.example}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Required Mode: Wrong feedback (shows correct answer for 2.5s) */}
          {!isSubmitted && isRequirementWorkflow && showWrongFeedback && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 glow-error text-sm font-bold slide-up flex flex-col items-center gap-1.5 animate-pulse">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" strokeWidth={1.5} /> Sai rồi! Hãy ghi nhớ từ đúng dưới đây:
              </div>
              <div className="text-2xl font-extrabold tracking-widest uppercase text-white mt-1">
                {currentCard.word}
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-red-500 h-full animate-countdown"></div>
              </div>
            </div>
          )}

          {/* Required Mode: Repeat prompt for errors */}
          {!isSubmitted && isRequirementWorkflow && !showWrongFeedback && currentFeedback?.show && !currentFeedback.isCorrect && (
            <div className="p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 glow-error text-sm font-bold slide-up flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" strokeWidth={1.5} /> Vẫn chưa chính xác! Hãy gõ đúng từ:
              </div>
              <div className="text-lg font-extrabold tracking-widest uppercase text-white mt-1">
                {currentCard.word}
              </div>
            </div>
          )}

          {/* Required Mode: Correct success block */}
          {!isSubmitted && isRequirementWorkflow && currentFeedback?.show && currentFeedback.isCorrect && (
            <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 glow-success text-sm font-bold slide-up flex items-center justify-center gap-2">
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
            className="px-5 py-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Từ trước
          </button>
          <button 
            onClick={() => { setCurrentIdx(prev => Math.min(vocabCards.length - 1, prev + 1)); setFeedback({}); }} 
            disabled={currentIdx === vocabCards.length - 1} 
            className="px-5 py-3 rounded-xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-sky-400 hover:bg-[#0071e3] hover:text-white disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
          >
            Từ tiếp theo <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
