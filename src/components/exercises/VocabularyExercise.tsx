'use client';

import { useState, useEffect, useCallback } from 'react';
import { VocabCard, VocabAnswerResult, Submission } from '@/lib/local-store';
import { Send, BookOpen, Layers, FileText, Headphones, LayoutGrid, ArrowRight, CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, Star, X, Mic } from 'lucide-react';

import { FlashcardBlock } from './vocabulary-blocks/FlashcardBlock';
import { SynonymBlock } from './vocabulary-blocks/SynonymBlock';
import { DictationBlock } from './vocabulary-blocks/DictationBlock';
import { TestBlock } from './vocabulary-blocks/TestBlock';
import { MatchGameBlock } from './vocabulary-blocks/MatchGameBlock';
import { ShadowingBlock } from './vocabulary-blocks/ShadowingBlock';
import { audioManager } from '@/lib/audio';

interface Props {
  vocabCards: VocabCard[];
  onSubmit: (answers: { word: string; studentAnswer: string; isCorrect: boolean }[], score?: number, dictationScore?: number) => void;
  isSubmitting?: boolean;
  result?: VocabAnswerResult[];
  score?: number;
  durationMs?: number;
  initialMode?: 'flashcard' | 'synonym' | 'dictation' | 'test' | 'game_match';
  isRequirementWorkflow?: boolean;
  hideTabs?: boolean;
  allSubmissions?: Submission[];
  isPracticeOnly?: boolean;
  onRetry?: () => void;
  onTabChange?: (mode: string) => void;
}

export type ActiveMode = 'flashcard' | 'synonym' | 'dictation' | 'test' | 'game_match' | 'shadowing';

export function VocabularyExercise({ 
  vocabCards, 
  onSubmit, 
  isSubmitting, 
  result, 
  score, 
  durationMs,
  initialMode = 'flashcard',
  isRequirementWorkflow = false,
  hideTabs = false,
  allSubmissions,
  isPracticeOnly = false,
  onRetry,
  onTabChange
}: Props) {
  const [activeMode, setActiveMode] = useState<ActiveMode>(
    isRequirementWorkflow ? 'dictation' : initialMode
  );
  
  // States cho luồng ôn tập lần lượt
  const [dictationScore, setDictationScore] = useState<number | null>(null);
  const [isDictationFinished, setIsDictationFinished] = useState(false);
  
  // Shared states for different modes
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({}); // for dictation
  const [synonymAnswers, setSynonymAnswers] = useState<Record<string, string>>({}); // for synonym
  const [mcAnswers, setMcAnswers] = useState<Record<string, string>>({}); // for test
  const [gameMatchedIds, setGameMatchedIds] = useState<string[]>([]); // for game match
  const [dictationAttempts, setDictationAttempts] = useState<Record<string, number>>({});
  const [shadowingResults, setShadowingResults] = useState<Record<string, { recognized: string; accuracy: number; attempts: number }>>({});

  // State nhận từ block con (Dictation hoặc Test) để cập nhật bảng Tracking Sidebar
  const [progressStats, setProgressStats] = useState<{
    completed: number;
    incorrect: number;
    pending: number;
    statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'>;
    currentIdx: number;
    roundWords: VocabCard[];
    onJumpToQuestion?: (idx: number) => void;
  } | null>(null);

  // Thêm state cho chế độ nghe trước/sau
  const [speakMode, setSpeakMode] = useState<'before' | 'after'>('after');
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);

  const isSubmitted = !!result;

  useEffect(() => {
    if (!result) {
      setMcAnswers({});
      setTextAnswers({});
      setSynonymAnswers({});
      setGameMatchedIds([]);
      setDictationAttempts({});
      setIsDictationFinished(false);
      setDictationScore(null);
      setProgressStats(null);
      setShadowingResults({});
      if (isRequirementWorkflow) setActiveMode('dictation');
    }
  }, [result, isRequirementWorkflow]);

  useEffect(() => {
    if (!isRequirementWorkflow) {
      setMcAnswers({});
      setTextAnswers({});
      setSynonymAnswers({});
      setGameMatchedIds([]);
      setDictationAttempts({});
      setIsDictationFinished(false);
      setDictationScore(null);
      setProgressStats(null);
    }
  }, [activeMode, isRequirementWorkflow]);

  // Đồng bộ khi đổi workflow
  useEffect(() => {
    if (isRequirementWorkflow) {
      setActiveMode('dictation');
      setIsDictationFinished(false);
      setDictationScore(null);
      setProgressStats(null);
    }
  }, [isRequirementWorkflow]);

  const handleSpeak = useCallback((text: string, rate: number = 1.0, audioUrl?: string) => {
    audioManager.speak(text, rate, audioUrl);
  }, []);

  const handleTextAnswerChange = (word: string, val: string) => {
    if (isSubmitted && (activeMode === 'dictation' || activeMode === 'test')) return;
    setTextAnswers(prev => ({ ...prev, [word]: val }));
  };

  const handleSynonymAnswerChange = (word: string, val: string) => {
    setSynonymAnswers(prev => ({ ...prev, [word]: val }));
  };

  const handleMcAnswerChange = (wordId: string, val: string) => {
    if (isSubmitted && (activeMode === 'dictation' || activeMode === 'test')) return;
    setMcAnswers(prev => ({ ...prev, [wordId]: val }));
  };

  const calculateScore = useCallback(() => {
    if (isRequirementWorkflow) {
      let testCorrect = 0;
      vocabCards.forEach(c => { if (mcAnswers[c.id] === c.word) testCorrect++; });
      const testScore = Math.round((testCorrect / vocabCards.length) * 100);
      return Math.round(((dictationScore || 0) + testScore) / 2);
    }

    if (activeMode === 'test') {
      let correct = 0;
      vocabCards.forEach(c => { if (mcAnswers[c.id] === c.word) correct++; });
      return Math.round((correct / vocabCards.length) * 100);
    }
    if (activeMode === 'game_match') {
      return Math.round((gameMatchedIds.length / (vocabCards.length * 2)) * 100);
    }
    if (activeMode === 'flashcard') return 100;

    if (activeMode === 'shadowing') {
      if (vocabCards.length === 0) return 0;
      const total = vocabCards.reduce((sum, c) => sum + (shadowingResults[c.word]?.accuracy ?? 0), 0);
      return Math.round(total / vocabCards.length);
    }

    let correct = 0;
    vocabCards.forEach(c => {
      if ((textAnswers[c.word] || '').trim().toLowerCase() === c.word.toLowerCase()) correct++;
    });
    return Math.round((correct / vocabCards.length) * 100);
  }, [isRequirementWorkflow, vocabCards, mcAnswers, dictationScore, activeMode, gameMatchedIds.length, textAnswers, shadowingResults]);

  const handleSubmitAll = useCallback(() => {
    const finalAnswers = vocabCards.map(c => {
      let studentAnswer = '';
      let isCorrect = false;

      if (isRequirementWorkflow || activeMode === 'test') {
        studentAnswer = mcAnswers[c.id] || '';
        isCorrect = studentAnswer.toLowerCase() === c.word.toLowerCase();
      } else if (activeMode === 'game_match') {
        const isMatched = gameMatchedIds.includes(`w_${c.id}`);
        studentAnswer = isMatched ? 'Matched' : 'Unmatched';
        isCorrect = isMatched;
      } else if (activeMode === 'flashcard') {
        studentAnswer = 'Viewed';
        isCorrect = true;
      } else if (activeMode === 'synonym') {
        studentAnswer = (synonymAnswers[c.word] || '').trim();
        isCorrect = studentAnswer.toLowerCase() === c.word.toLowerCase();
      } else if (activeMode === 'shadowing') {
        const sr = shadowingResults[c.word];
        studentAnswer = sr?.recognized || '';
        isCorrect = (sr?.accuracy ?? 0) >= 80;
      } else {
        studentAnswer = (textAnswers[c.word] || '').trim();
        isCorrect = studentAnswer.toLowerCase() === c.word.toLowerCase();
      }

      return { 
        word: c.word, 
        studentAnswer, 
        isCorrect,
        attempts: dictationAttempts[c.word]
      };
    });

    const finalScore = calculateScore();
    onSubmit(finalAnswers, finalScore, dictationScore ?? undefined);
  }, [vocabCards, isRequirementWorkflow, activeMode, mcAnswers, gameMatchedIds, synonymAnswers, textAnswers, shadowingResults, dictationAttempts, calculateScore, onSubmit, dictationScore]);

  const handleDictationFinished = (score: number, dictationAnswers: Record<string, string>, attempts?: Record<string, number>) => {
    setDictationScore(score);
    setIsDictationFinished(true);
    setTextAnswers(dictationAnswers);
    if (attempts) setDictationAttempts(attempts);
    setActiveMode('test');
    setProgressStats(null); // Reset progress để block test cập nhật
  };

  // Lắng nghe phím Enter để nộp bài tự động khi hoàn thành trắc nghiệm
  useEffect(() => {
    if (isSubmitted || activeMode !== 'test') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        const answeredCount = Object.keys(mcAnswers).length;
        const totalCount = vocabCards.length;

        if (answeredCount === totalCount && totalCount > 0) {
          e.preventDefault();
          handleSubmitAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mcAnswers, vocabCards.length, activeMode, isSubmitted, handleSubmitAll]);

  // Pre-fill answers if already submitted
  useEffect(() => {
    if (result) {
      const prefilledAnswers: Record<string, string> = {};
      const prefilledMcAnswers: Record<string, string> = {};
      const prefilledAttempts: Record<string, number> = {};
      
      let resArray: any[] = [];
      if (Array.isArray(result)) {
        resArray = result;
      } else if (result && typeof result === 'object') {
        resArray = Object.keys(result).map(key => ({
          word: key,
          correctAnswer: key,
          studentAnswer: (result as any)[key],
          attempts: 1,
          isCorrect: typeof (result as any)[key] === 'string' 
            ? (result as any)[key].trim().toLowerCase() === key.toLowerCase()
            : false
        }));
      }

      resArray.forEach(r => {
        const w = r?.word || (r as any)?.correctAnswer;
        if (!w) return;
        
        prefilledAnswers[w] = r.studentAnswer;
        if (r.attempts !== undefined) {
          prefilledAttempts[w] = r.attempts;
        }
        
        const card = vocabCards.find(c => c.word.toLowerCase() === w.toLowerCase());
        if (card) {
          prefilledMcAnswers[card.id] = r.studentAnswer;
        }
      });
      setTextAnswers(prefilledAnswers);
      setMcAnswers(prefilledMcAnswers);
      setDictationAttempts(prefilledAttempts);
      
      if (initialMode === 'flashcard' && !isRequirementWorkflow) {
        setActiveMode('test');
      }
    }
  }, [result, vocabCards, initialMode, isRequirementWorkflow]);

  const handleShadowingResult = useCallback(
    (word: string, result: { recognized: string; accuracy: number; attempts: number }) => {
      setShadowingResults(prev => ({ ...prev, [word]: result }));
    },
    [],
  );

  // Handler callback nhận dữ liệu tiến độ từ block con
  const handleProgressUpdate = useCallback((stats: any) => {
    setProgressStats(stats);
  }, []);

  const totalWordsCount = vocabCards.length;
  const isTrackingAvailable = progressStats && totalWordsCount > 0;
  const progressPercentage = isTrackingAvailable
    ? Math.round(((progressStats.completed + progressStats.incorrect) / totalWordsCount) * 100)
    : 0;

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
  };

  const isPracticeMode = activeMode === 'flashcard' || activeMode === 'synonym' || activeMode === 'game_match';
  const showScoreBanner = isSubmitted && score !== undefined && !isPracticeMode;



  return (
    <div className="space-y-6 fade-in w-full">
      {/* Result Score */}
      {showScoreBanner && (
        <div className={`rounded-3xl p-8 text-center border-2 score-pop relative overflow-hidden ${
          score >= 80 ? 'border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/10 glow-success' :
          score >= 50 ? 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/10' :
          'border-red-500/40 bg-red-500/10 dark:bg-red-500/10'
        }`}>
          <div className="absolute inset-0 bg-dot-pattern opacity-30"></div>
          <div className="relative z-10">
            <div className={`text-5xl md:text-7xl font-extrabold font-heading tracking-tighter ${
              score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {score}<span className="text-xl md:text-3xl text-muted-foreground/80 font-medium">/100</span>
            </div>
            <p className="text-sm md:text-base text-foreground/90 mt-3 font-medium">
              ✅ Đã hoàn thành {isPracticeOnly ? 'luyện tập' : 'bài học'} • Điểm số: {score}đ
              {durationMs && ` • Thời gian: ${formatDuration(durationMs)}`}
            </p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="mt-4 px-6 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-all flex items-center gap-2 mx-auto text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Làm Lại Lần Nữa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Workflow Header Progress */}
      {isRequirementWorkflow && !isSubmitted && (
        <div className="flex items-center justify-center gap-3 bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${activeMode === 'dictation' ? 'text-[#0071e3]' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isDictationFinished ? 'bg-emerald-500 text-black' : activeMode === 'dictation' ? 'bg-[#0071e3] text-white' : 'bg-black/5 dark:bg-white/5 text-muted-foreground'}`}>
              {isDictationFinished ? '✓' : '1'}
            </span>
            Phần 1: Nghe Chép
          </div>
          <div className="w-12 h-px bg-white/10"></div>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${activeMode === 'test' ? 'text-[#0071e3]' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeMode === 'test' ? 'bg-[#0071e3] text-white' : 'bg-black/5 dark:bg-white/5 text-muted-foreground'}`}>
              2
            </span>
            Phần 2: Trắc Nghiệm
          </div>
        </div>
      )}

      {/* Exercise Mode Selection Tabs (Apple segmented control styled) */}
      {!hideTabs && !isRequirementWorkflow && (
        <div className="grid grid-cols-3 md:grid-cols-6 bg-black/5 dark:bg-white/5 border border-white/5 p-1 rounded-2xl gap-1 md:gap-1.5 w-full max-w-4xl mx-auto mb-8 select-none">
          <button 
            onClick={() => { setActiveMode('flashcard'); setProgressStats(null); onTabChange?.('flashcard'); }} 
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'flashcard' ? 'bg-[#0071e3] text-white shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <Layers className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Flashcard
          </button>
          <button 
            onClick={() => { setActiveMode('synonym'); setProgressStats(null); onTabChange?.('synonym'); }} 
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'synonym' ? 'bg-violet-600 text-white shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <BookOpen className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Đồng Nghĩa
          </button>
          <button 
            onClick={() => { setActiveMode('test'); setProgressStats(null); onTabChange?.('test'); }} 
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'test' ? 'bg-amber-500 text-black shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <FileText className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Trắc Nghiệm
          </button>
          <button 
            onClick={() => { setActiveMode('dictation'); setProgressStats(null); onTabChange?.('dictation'); }} 
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'dictation' ? 'bg-sky-500 text-white shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <Headphones className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Nghe Chép
          </button>
          <button
            onClick={() => { setActiveMode('game_match'); setProgressStats(null); onTabChange?.('game_match'); }}
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'game_match' ? 'bg-rose-500 text-white shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <LayoutGrid className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Nối Từ
          </button>
          <button
            onClick={() => { setActiveMode('shadowing'); setProgressStats(null); onTabChange?.('shadowing'); }}
            className={`flex flex-col items-center justify-center gap-1 md:gap-1.5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${activeMode === 'shadowing' ? 'bg-emerald-500 text-white shadow-lg scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
          >
            <Mic className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} /> Shadowing
          </button>
        </div>
      )}

      {/* Sticky Mobile Status Bar */}
      {!isSubmitted && isTrackingAvailable && progressStats && (
        <div className="sticky top-16 z-40 lg:hidden -mx-4 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Tiến độ:</span>
            <span className="text-xs font-extrabold text-[#0071e3]">{progressPercentage}%</span>
            <span className="text-[10px] text-muted-foreground">({progressStats.completed + progressStats.incorrect}/{totalWordsCount})</span>
          </div>
          <div className="flex-1 max-w-[40%] bg-secondary h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#0071e3] h-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
          </div>
          <button
            onClick={() => setIsMobileMapOpen(true)}
            className="px-3 py-1.5 bg-[#0071e3]/10 border border-[#0071e3]/20 rounded-xl text-xs font-bold text-[#0071e3] active:scale-95 transition-all"
          >
            Sơ đồ
          </button>
        </div>
      )}

      {/* Main Workspace Layout (2 Columns on Desktop) */}
      <div className={`grid grid-cols-1 ${isSubmitted ? '' : 'lg:grid-cols-4'} gap-6 items-start`}>
        
        {/* LEFT COLUMN (Desktop Only): Real-time Apple Activity Tracking Sidebar */}
        {!isSubmitted && (
          <aside className="hidden lg:block lg:col-span-1 space-y-4">
          
          {/* Tracking Sidebar Panel */}
          {isTrackingAvailable ? (
            <div className="glass-strong rounded-3xl border border-white/5 p-5 space-y-6 lg:sticky lg:top-6 shadow-2xl">
              
              {/* Progress Summary and Circular-style Ring */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Tiến độ bài làm</h4>
                  <p className="text-2xl font-black font-heading mt-1 text-white">{progressPercentage}%</p>
                </div>
                {/* Circular ring path */}
                <div className="relative w-14 h-14">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/5"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#0071e3] transition-all duration-500 ease-out"
                      strokeWidth="3.5"
                      strokeDasharray={`${progressPercentage}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                    {progressStats.completed + progressStats.incorrect}/{totalWordsCount}
                  </div>
                </div>
              </div>

              {/* Progress Statistics Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Đã xong</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 leading-none">{progressStats.completed}</span>
                </div>
                <div className="bg-red-500/10 dark:bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] uppercase font-bold text-red-600 dark:text-red-400 block mb-0.5">Sai/Lỗi</span>
                  <span className="text-lg font-black text-red-700 dark:text-red-300 leading-none">{progressStats.incorrect}</span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-0.5">Chưa làm</span>
                  <span className="text-lg font-black text-muted-foreground leading-none">{progressStats.pending}</span>
                </div>
              </div>

              {/* Sơ đồ câu hỏi trong chế độ xem lại hoặc tự học */}
              {(isSubmitted || !isRequirementWorkflow) && (activeMode === 'dictation' || activeMode === 'test' || activeMode === 'shadowing') && (
                <div className="space-y-2.5 pt-4 border-t border-white/5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Sơ đồ câu hỏi</p>
                  <div className="grid grid-cols-5 gap-2">
                    {progressStats.roundWords.map((card, idx) => {
                      const status = progressStats.statusMap[card.id] || 'pending';
                      const isActive = idx === progressStats.currentIdx;
                      
                      let bgCls = 'bg-black/5 dark:bg-white/5 text-muted-foreground border-white/5';
                      if (status === 'correct') {
                        bgCls = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
                      } else if (status === 'incorrect') {
                        bgCls = 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/30 glow-error';
                      } else if (status === 'active' || isActive) {
                        bgCls = 'bg-[#0071e3]/20 text-[#0071e3] border-[#0071e3] scale-110';
                      }

                      return (
                        <button
                          key={card.id}
                          onClick={() => progressStats.onJumpToQuestion?.(idx)}
                          title={card.word}
                          className={`w-full aspect-square flex items-center justify-center text-xs font-bold rounded-lg border transition-all duration-300 ${bgCls} ${isActive ? 'ring-1 ring-[#0071e3]' : ''}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chế độ nghe Dictation (thay cho Speed Settings) */}
              {activeMode === 'dictation' && (
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5"><Headphones className="h-3 w-3" /> Tùy chọn nghe</p>
                  <select value={speakMode} onChange={e => setSpeakMode(e.target.value as 'before' | 'after')} className="w-full bg-secondary/50 border border-black/10 dark:border-white/10 rounded-lg text-xs py-2 px-3 text-muted-foreground hover:text-foreground outline-none transition-colors">
                    <option value="after">Nghe sau khi kiểm tra (Mặc định)</option>
                    <option value="before">Nghe trước khi gõ</option>
                  </select>
                </div>
              )}

            </div>
          ) : (
            // Fallback information card when tracking is not active (like in flashcards or matching game)
            <div className="glass-strong rounded-3xl border border-white/5 p-5 space-y-4 shadow-xl">
              <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Chế độ học</h4>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl text-sky-600 dark:text-sky-400">
                  {activeMode === 'flashcard' ? <Layers className="w-5 h-5" strokeWidth={1.5} /> :
                   activeMode === 'synonym' ? <BookOpen className="w-5 h-5" strokeWidth={1.5} /> :
                   activeMode === 'game_match' ? <LayoutGrid className="w-5 h-5" strokeWidth={1.5} /> :
                   activeMode === 'shadowing' ? <Mic className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} /> :
                   <HelpCircle className="w-5 h-5" strokeWidth={1.5} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {activeMode === 'flashcard' ? 'Lướt Flashcard' :
                     activeMode === 'synonym' ? 'Ôn từ đồng nghĩa' :
                     activeMode === 'game_match' ? 'Game ghép đôi từ' :
                     activeMode === 'shadowing' ? 'Luyện phát âm Shadowing' : 'Đang tải...'}
                  </p>
                  <p className="text-xs text-muted-foreground">Tổng cộng {totalWordsCount} từ vựng</p>
                </div>
              </div>

              {/* Chế độ nghe Dictation (thay cho Speed Settings) */}
              {activeMode === 'dictation' && (
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5"><Headphones className="h-3 w-3" /> Tùy chọn nghe</p>
                  <select value={speakMode} onChange={e => setSpeakMode(e.target.value as 'before' | 'after')} className="w-full bg-secondary/50 border border-black/10 dark:border-white/10 rounded-lg text-xs py-2 px-3 text-muted-foreground hover:text-foreground outline-none transition-colors">
                    <option value="after">Nghe sau khi kiểm tra (Mặc định)</option>
                    <option value="before">Nghe trước khi gõ</option>
                  </select>
                </div>
              )}
            </div>
          )}

        </aside>
        )}

        {/* RIGHT COLUMN (Desktop): Main Exercise Area (Spacious & Clean) */}
        <div className={`${isSubmitted ? 'lg:col-span-4' : 'lg:col-span-3'} order-first lg:order-last space-y-6`}>
          <div className="w-full">
            {isSubmitted ? (
              <DictationBlock 
                vocabCards={vocabCards} 
                answers={textAnswers} 
                attemptsRecord={dictationAttempts}
                onAnswerChange={handleTextAnswerChange} 
                handleSpeak={handleSpeak} 
                isSubmitted={isSubmitted}
                isRequirementWorkflow={isRequirementWorkflow}
                onFinishDictation={handleDictationFinished}
                onProgressUpdate={handleProgressUpdate}
                allSubmissions={allSubmissions}
                speakMode={speakMode}
              />
            ) : (
              <>
                {activeMode === 'flashcard' && (
                  <FlashcardBlock vocabCards={vocabCards} handleSpeak={handleSpeak} isSubmitted={false} />
                )}
                
                {activeMode === 'synonym' && (
                  <SynonymBlock vocabCards={vocabCards} answers={synonymAnswers} onAnswerChange={handleSynonymAnswerChange} handleSpeak={handleSpeak} isSubmitted={false} />
                )}
                
                {activeMode === 'dictation' && (
                  <DictationBlock 
                    vocabCards={vocabCards} 
                    answers={textAnswers} 
                    attemptsRecord={dictationAttempts}
                    onAnswerChange={handleTextAnswerChange} 
                    handleSpeak={handleSpeak} 
                    isSubmitted={isSubmitted}
                    isRequirementWorkflow={isRequirementWorkflow}
                    onFinishDictation={handleDictationFinished}
                    onProgressUpdate={handleProgressUpdate}
                    allSubmissions={allSubmissions}
                    speakMode={speakMode}
                  />
                )}
                
                {activeMode === 'test' && (
                  <TestBlock 
                    vocabCards={vocabCards} 
                    answers={mcAnswers} 
                    onAnswerChange={handleMcAnswerChange} 
                    isSubmitted={isSubmitted}
                    onProgressUpdate={handleProgressUpdate}
                    allSubmissions={allSubmissions}
                  />
                )}

                {activeMode === 'game_match' && (
                  <MatchGameBlock vocabCards={vocabCards} gameMatchedIds={gameMatchedIds} setGameMatchedIds={setGameMatchedIds} handleSpeak={handleSpeak} isSubmitted={false} />
                )}

                {activeMode === 'shadowing' && (
                  <ShadowingBlock
                    vocabCards={vocabCards}
                    handleSpeak={handleSpeak}
                    isSubmitted={false}
                    onShadowingResult={handleShadowingResult}
                    onProgressUpdate={handleProgressUpdate}
                  />
                )}
              </>
            )}
          </div>

          {/* Submit Section (Chỉ hiển thị khi làm bài tự do, hoặc khi ở phần trắc nghiệm trong chế độ bắt buộc) */}
          {!isSubmitted && (!isRequirementWorkflow || (isRequirementWorkflow && activeMode === 'test')) && (
            <div className="pt-6 border-t border-white/5 space-y-4 max-w-3xl mx-auto w-full">
              <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">
                <span>
                  {activeMode === 'test' ? `Đã trả lời: ${Object.keys(mcAnswers).length} / ${vocabCards.length}` :
                   activeMode === 'shadowing' ? `Đã shadow: ${Object.keys(shadowingResults).length} / ${vocabCards.length}` :
                   `Đã điền: ${vocabCards.filter(c => (textAnswers[c.word] || '').trim()).length} / ${vocabCards.length}`}
                </span>
                <span className={calculateScore() >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
                  {isRequirementWorkflow 
                    ? `Điểm trung bình dự kiến: ${calculateScore()}% (Nghe: ${dictationScore}đ)`
                    : `Dự kiến: ${calculateScore()}%`}
                </span>
              </div>
              <button
                onClick={handleSubmitAll}
                disabled={isSubmitting || (isRequirementWorkflow && Object.keys(mcAnswers).length < vocabCards.length)}
                className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-2xl bg-[#0071e3] text-white font-bold text-sm hover:bg-[#0071e3]/90 disabled:opacity-40 transition-all hover-lift"
              >
                <Send className="h-5 w-5" strokeWidth={1.5} />
                {isSubmitting ? 'Đang chấm...' : isPracticeOnly ? 'Hoàn Thành Luyện Tập' : 'Hoàn Thành & Lưu Điểm'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Bottom Sheet for Mobile Sơ đồ câu hỏi */}
      {!isSubmitted && isTrackingAvailable && progressStats && (
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
              isMobileMapOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsMobileMapOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className={`fixed bottom-0 left-0 right-0 glass-strong border-t border-black/10 dark:border-white/10 rounded-t-[2rem] p-6 z-50 lg:hidden transition-all duration-300 ease-out transform ${
            isMobileMapOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
          }`}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" /> Sơ đồ câu hỏi từ vựng
                </h3>
                <button 
                  onClick={() => setIsMobileMapOpen(false)} 
                  className="p-1.5 bg-black/5 dark:bg-white/5 border border-white/5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress Summary and Circular-style Ring */}
              <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-white/5">
                <div>
                  <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Tiến độ bài làm</h4>
                  <p className="text-xl font-black font-heading mt-1 text-white">{progressPercentage}%</p>
                </div>
                {/* Circular ring path */}
                <div className="relative w-14 h-14">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/5"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#0071e3] transition-all duration-500 ease-out"
                      strokeWidth="3.5"
                      strokeDasharray={`${progressPercentage}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                    {progressStats.completed + progressStats.incorrect}/{totalWordsCount}
                  </div>
                </div>
              </div>

              {/* Progress Statistics Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Đã xong</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-300 leading-none">{progressStats.completed}</span>
                </div>
                <div className="bg-red-500/10 dark:bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase font-bold text-red-600 dark:text-red-400 block mb-0.5">Sai/Lỗi</span>
                  <span className="text-base font-black text-red-700 dark:text-red-300 leading-none">{progressStats.incorrect}</span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-0.5">Chưa làm</span>
                  <span className="text-base font-black text-muted-foreground leading-none">{progressStats.pending}</span>
                </div>
              </div>

              {/* Sơ đồ câu hỏi trong chế độ xem lại hoặc tự học */}
              {(isSubmitted || !isRequirementWorkflow) && (activeMode === 'dictation' || activeMode === 'test' || activeMode === 'shadowing') && (
                <div className="space-y-2.5 pt-4 border-t border-white/5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Chi tiết câu hỏi</p>
                  <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                    {progressStats.roundWords.map((card, idx) => {
                      const status = progressStats.statusMap[card.id] || 'pending';
                      const isActive = idx === progressStats.currentIdx;
                      
                      let bgCls = 'bg-black/5 dark:bg-white/5 text-muted-foreground border-white/5';
                      if (status === 'correct') {
                        bgCls = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
                      } else if (status === 'incorrect') {
                        bgCls = 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/30 glow-error';
                      } else if (status === 'active' || isActive) {
                        bgCls = 'bg-[#0071e3]/20 text-[#0071e3] border-[#0071e3] scale-110';
                      }

                      return (
                        <button
                          key={card.id}
                          onClick={() => {
                            progressStats.onJumpToQuestion?.(idx);
                            setIsMobileMapOpen(false);
                          }}
                          title={card.word}
                          className={`w-10 h-10 mx-auto flex items-center justify-center text-xs font-bold rounded-xl border transition-all duration-300 ${bgCls} ${isActive ? 'ring-1 ring-[#0071e3]' : ''}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chế độ nghe Dictation */}
              {activeMode === 'dictation' && (
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5"><Headphones className="h-3 w-3" /> Tùy chọn nghe</p>
                  <select value={speakMode} onChange={e => setSpeakMode(e.target.value as 'before' | 'after')} className="w-full bg-[#2c2c2e] border border-black/10 dark:border-white/10 rounded-xl text-xs py-2.5 px-3 text-muted-foreground hover:text-foreground outline-none transition-colors">
                    <option value="after">Nghe sau khi kiểm tra (Mặc định)</option>
                    <option value="before">Nghe trước khi gõ</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
