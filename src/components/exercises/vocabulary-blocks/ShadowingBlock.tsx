import { useState, useEffect, useCallback, useRef } from 'react';
import { VocabCard } from '@/lib/local-store';
import {
  Volume2, Mic, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, RotateCcw, AlertCircle,
} from 'lucide-react';
import { useSpeechRecognition } from './useSpeechRecognition';

interface ShadowingWordResult {
  recognized: string;
  accuracy: number;
}

interface ShadowingBlockProps {
  vocabCards: VocabCard[];
  handleSpeak: (text: string, rate?: number) => void;
  isSubmitted: boolean;
  onShadowingResult?: (word: string, result: { recognized: string; accuracy: number; attempts: number }) => void;
  onProgressUpdate?: (stats: {
    completed: number;
    incorrect: number;
    pending: number;
    statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'>;
    currentIdx: number;
    roundWords: VocabCard[];
    onJumpToQuestion?: (idx: number) => void;
  }) => void;
}

// Levenshtein-based accuracy (0–100), mirrors isFuzzyMatch threshold logic
function calcAccuracy(recognized: string, target: string): number {
  const a = recognized.trim().toLowerCase();
  const b = target.trim().toLowerCase();
  if (!a) return 0;
  if (a === b) return 100;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return Math.round((1 - dp[m][n] / Math.max(m, n)) * 100);
}

export function ShadowingBlock({
  vocabCards,
  handleSpeak,
  isSubmitted,
  onShadowingResult,
  onProgressUpdate,
}: ShadowingBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'result'>('ready');
  const [wordResults, setWordResults] = useState<Record<string, ShadowingWordResult>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [shake, setShake] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  // Refs to avoid stale closures inside start() callbacks
  const phaseRef = useRef(phase);
  const attemptsRef = useRef(attempts);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);

  const { isListening, isSupported, error: speechError, start, stop } = useSpeechRecognition();
  const currentCard = vocabCards[currentIdx];

  // Reset when vocab list changes (new assignment)
  useEffect(() => {
    setCurrentIdx(0);
    setPhase('ready');
    setWordResults({});
    setAttempts({});
    setIsFinished(false);
  }, [vocabCards]);

  // Auto-play TTS when card changes
  useEffect(() => {
    if (!currentCard || isSubmitted || isFinished) return;
    setPhase('ready');
    const t = setTimeout(() => handleSpeak(currentCard.word, speed), 400);
    return () => clearTimeout(t);
  }, [currentIdx, isSubmitted, isFinished, handleSpeak, currentCard, speed]);

  // Report progress to sidebar
  useEffect(() => {
    if (!onProgressUpdate || vocabCards.length === 0) return;

    let completed = 0, incorrect = 0, pending = 0;
    const statusMap: Record<string, 'correct' | 'incorrect' | 'pending' | 'active'> = {};

    vocabCards.forEach((card) => {
      const result = wordResults[card.word];
      const isActive = currentCard?.id === card.id && !isFinished;
      let status: 'correct' | 'incorrect' | 'pending' | 'active' = 'pending';

      if (result !== undefined) {
        if (result.accuracy >= 80) { status = 'correct'; completed++; }
        else                        { status = 'incorrect'; incorrect++; }
      } else if (isActive) {
        status = 'active';
      } else {
        pending++;
      }
      statusMap[card.id] = status;
    });

    onProgressUpdate({
      completed, incorrect, pending, statusMap,
      currentIdx,
      roundWords: vocabCards,
      onJumpToQuestion: (idx) => {
        if (phaseRef.current !== 'recording') {
          setCurrentIdx(idx);
          setPhase('ready');
        }
      },
    });
  }, [vocabCards, wordResults, currentCard, currentIdx, isFinished, onProgressUpdate]);

  const handleRecord = useCallback(() => {
    if (!currentCard) return;
    if (isListening) { stop(); return; }
    if (phase !== 'ready' && phase !== 'result') return;

    const word = currentCard.word;
    setPhase('recording');

    start((transcript, _confidence) => {
      const acc = calcAccuracy(transcript, word);
      const count = (attemptsRef.current[word] || 0) + 1;

      setWordResults(prev => ({ ...prev, [word]: { recognized: transcript, accuracy: acc } }));
      setAttempts(prev => ({ ...prev, [word]: count }));
      onShadowingResult?.(word, { recognized: transcript, accuracy: acc, attempts: count });

      if (!transcript) setShake(true);
      setPhase('result');
    });
  }, [currentCard, isListening, phase, start, stop, onShadowingResult]);

  useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 400);
      return () => clearTimeout(t);
    }
  }, [shake]);

  const goToNext = useCallback(() => {
    if (phase === 'recording') return;
    if (currentIdx < vocabCards.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setPhase('ready');
    } else {
      setIsFinished(true);
    }
  }, [currentIdx, vocabCards.length, phase]);

  const goToPrev = useCallback(() => {
    if (phase === 'recording' || currentIdx === 0) return;
    setCurrentIdx(prev => prev - 1);
    setPhase('ready');
  }, [currentIdx, phase]);

  const handleRetry = useCallback(() => {
    setCurrentIdx(0);
    setPhase('ready');
    setIsFinished(false);
  }, []);

  // Keyboard: Space = record, arrows = navigate
  useEffect(() => {
    if (isSubmitted) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault();
        if (!isFinished) handleRecord();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (!isFinished) goToNext();
      } else if (e.key === 'ArrowLeft') {
        if (!isFinished) goToPrev();
      } else if (e.key === 'Control' && !isFinished && currentCard) {
        handleSpeak(currentCard.word, speed);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSubmitted, isFinished, handleRecord, goToNext, goToPrev, currentCard, handleSpeak, speed]);

  // ── FINISHED SCREEN ──────────────────────────────────────────────────────
  if (isFinished) {
    const masteredCount = vocabCards.filter(c => (wordResults[c.word]?.accuracy ?? 0) >= 80).length;
    const overallScore = Math.round(
      vocabCards.reduce((sum, c) => sum + (wordResults[c.word]?.accuracy ?? 0), 0) / vocabCards.length,
    );

    return (
      <div className="glass-strong rounded-3xl border border-emerald-500/30 p-8 text-center max-w-xl mx-auto space-y-6 slide-up glow-success">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
          <Mic className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Hoàn Thành Shadowing!</h3>
          <p className="text-sm text-muted-foreground">Bạn đã luyện phát âm {vocabCards.length} từ vựng.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-white/5 p-5 rounded-2xl border border-white/5">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Độ Chính Xác</span>
            <span className={`text-3xl font-extrabold ${overallScore >= 80 ? 'text-emerald-400' : overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {overallScore}%
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Đạt Chuẩn ≥80%</span>
            <span className="text-3xl font-extrabold text-foreground">{masteredCount}/{vocabCards.length}</span>
          </div>
        </div>

        <button
          onClick={handleRetry}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift"
        >
          <RotateCcw className="w-5 h-5" strokeWidth={1.5} /> Luyện Lại Từ Đầu
        </button>
      </div>
    );
  }

  if (!currentCard) return null;

  // ── MAIN EXERCISE ─────────────────────────────────────────────────────────
  const currentResult = wordResults[currentCard.word];
  const isCorrect = currentResult && currentResult.accuracy >= 80;
  const isClose   = currentResult && currentResult.accuracy >= 50 && currentResult.accuracy < 80;

  return (
    <div className={`space-y-6 max-w-3xl mx-auto w-full slide-up px-1 md:px-0 ${shake ? 'animate-shake' : ''}`}>

      {/* Browser compatibility warning */}
      {!isSupported && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-amber-200">
            Trình duyệt chưa hỗ trợ nhận diện giọng nói.
            Hãy dùng <strong>Chrome</strong> hoặc <strong>Edge</strong> để dùng tính năng Shadowing.
          </p>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
          <span>Từ {currentIdx + 1} / {vocabCards.length}</span>
          <span className="text-emerald-400">{Object.keys(wordResults).length} đã luyện</span>
        </div>
        <div className="w-full bg-secondary/40 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${(currentIdx / vocabCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className={`glass-strong rounded-3xl border p-6 md:p-10 flex flex-col items-center text-center space-y-8 transition-all duration-300 ${
        isCorrect    ? 'border-emerald-500/30' :
        isClose      ? 'border-amber-500/30'   :
        currentResult ? 'border-red-500/30'    : 'border-white/5'
      }`}>

        {/* TTS play button */}
        <div className="relative w-full flex justify-center py-4">
          <div className="absolute top-0 right-0">
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-secondary/50 border border-white/10 rounded-lg text-xs py-1 px-2 text-muted-foreground hover:text-foreground outline-none">
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x (Chuẩn)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/15 rounded-full blur-xl" />
            <button
              onClick={() => handleSpeak(currentCard.word, speed)}
              disabled={isListening}
              className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400 flex items-center justify-center transition-all shadow-md hover-lift disabled:opacity-50 mx-auto"
            >
              <Volume2 className="h-10 w-10 md:h-12 md:w-12" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Word info */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nghĩa tiếng Việt</p>
          <p className="text-xl md:text-2xl font-bold text-foreground">{currentCard.meaning}</p>
          {currentCard.phonetic && (
            <p className="text-base font-mono text-emerald-400/80">{currentCard.phonetic}</p>
          )}
          <p className="text-2xl md:text-3xl font-extrabold tracking-wide text-foreground">{currentCard.word}</p>
        </div>

        {/* Recording zone */}
        <div className="w-full max-w-md space-y-4">
          <button
            onClick={handleRecord}
            disabled={!isSupported}
            className={`w-full h-16 md:h-20 rounded-2xl font-bold text-sm transition-all hover-lift flex items-center justify-center gap-3 ${
              isListening
                ? 'bg-red-500/15 border border-red-500/40 text-red-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isListening ? (
              <>
                {/* Animated waveform bars */}
                <div className="flex items-end gap-[3px]" style={{ height: 28 }}>
                  {[0.4, 0.75, 1, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-red-400 rounded-full"
                      style={{
                        height: `${h * 100}%`,
                        transformOrigin: 'bottom',
                        animation: `waveformBar 0.5s ease-in-out ${i * 0.07}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <span>Đang nghe… (nhấn để dừng)</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" strokeWidth={1.5} />
                <span>
                  {phase === 'result' ? 'Thử Lại' : 'Nhấn & Shadow'}
                  <span className="ml-2 text-[10px] opacity-50 font-normal">Space</span>
                </span>
              </>
            )}
          </button>

          {/* Result feedback */}
          {phase === 'result' && currentResult !== undefined && (
            <div className={`p-4 rounded-2xl border flex flex-col items-center gap-2 slide-up ${
              isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 glow-success' :
              isClose   ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-red-500/10 border-red-500/30 glow-error'
            }`}>
              <div className="flex items-center gap-2 w-full text-sm font-bold">
                {isCorrect ? (
                  <><CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" strokeWidth={1.5} /><span className="text-emerald-400">Xuất sắc!</span></>
                ) : isClose ? (
                  <span className="text-amber-400">Gần đúng —</span>
                ) : (
                  <><XCircle className="h-5 w-5 text-red-400 shrink-0" strokeWidth={1.5} /><span className="text-red-400">Cần luyện thêm</span></>
                )}
                <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-extrabold ${
                  isCorrect ? 'bg-emerald-500/20 text-emerald-300' :
                  isClose   ? 'bg-amber-500/20 text-amber-300' :
                              'bg-red-500/20 text-red-300'
                }`}>
                  {currentResult.accuracy}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground w-full text-left">
                Bạn nói:{' '}
                <span className="font-semibold text-foreground italic">
                  &ldquo;{currentResult.recognized || '(không nhận diện được)'}&rdquo;
                </span>
              </p>
              {!isCorrect && (
                <p className="text-xs text-muted-foreground w-full text-left">
                  Đáp án:{' '}
                  <span className="font-bold text-foreground">{currentCard.word}</span>
                </p>
              )}
            </div>
          )}

          {speechError && (
            <p className="text-xs text-red-400 text-center">
              {speechError === 'not-allowed'
                ? 'Cần cấp quyền microphone cho trình duyệt.'
                : `Lỗi nhận diện: ${speechError}`}
            </p>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="hidden md:flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground/60">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-white/10 font-mono font-bold text-[10px] text-muted-foreground">Ctrl</kbd>
          <span>Nghe lại</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-white/10 font-mono font-bold text-[10px] text-muted-foreground">Space</kbd>
          <span>Ghi âm</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-white/10 font-mono font-bold text-[10px] text-muted-foreground">←</kbd>
          <kbd className="px-2 py-1 rounded bg-secondary border border-white/10 font-mono font-bold text-[10px] text-muted-foreground">→</kbd>
          <span>Chuyển từ</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center gap-4">
        <button
          onClick={goToPrev}
          disabled={currentIdx === 0 || phase === 'recording'}
          className="px-5 py-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Từ trước
        </button>
        <button
          onClick={goToNext}
          disabled={phase === 'recording'}
          className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          {currentIdx === vocabCards.length - 1 ? 'Hoàn thành' : 'Từ tiếp theo'}
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
