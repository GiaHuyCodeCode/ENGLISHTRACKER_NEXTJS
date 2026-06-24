import { useState, useEffect, useCallback, useRef } from 'react';
import { VocabCard } from '@/lib/local-store';
import {
  Volume2, Mic, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, RotateCcw, AlertCircle,
} from 'lucide-react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { usePhonetic } from '@/lib/usePhonetic';

interface ShadowingWordResult {
  recognized: string;
  accuracy: number;
  wordDiff?: { word: string; ok: boolean }[];
  audioBlobUrl?: string;
}

interface ShadowingBlockProps {
  vocabCards: VocabCard[];
  handleSpeak: (text: string, rate?: number, audioUrl?: string) => void;
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

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyOk(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? true : 1 - levenshtein(a, b) / maxLen >= 0.8;
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
  const currentIdxRef = useRef(currentIdx);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentCard = vocabCards[currentIdx];
  const { phonetic: displayPhonetic, loading: phoneticLoading } = usePhonetic(currentCard?.word, currentCard?.phonetic);

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
    const t = setTimeout(() => handleSpeak(currentCard.word, speed, currentCard.audioUrl), 400);
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

  const handleRecordStart = async () => {
    if (!currentCard) return;
    if (phase !== 'ready' && phase !== 'result') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Mock scoring logic using API
        setPhase('recording'); // Wait for API
        const word = currentCard.word;
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');
          formData.append('word', word);

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (data.error) throw new Error(data.error);

          const acc = data.accuracy;
          const transcript = data.recognized;
          const count = (attemptsRef.current[word] || 0) + 1;

          const recWords = normalize(transcript).split(' ').filter(Boolean);
          const wordDiff = word.trim().split(/\s+/).map((w, i) => {
            const ok = i < recWords.length ? fuzzyOk(recWords[i], normalize(w)) : false;
            return { word: w, ok };
          });

          setWordResults(prev => ({ ...prev, [word]: { recognized: transcript, accuracy: acc, audioBlobUrl: audioUrl, wordDiff } }));
          setAttempts(prev => ({ ...prev, [word]: count }));
          onShadowingResult?.(word, { recognized: transcript, accuracy: acc, attempts: count });

          const isSuccess = acc >= 80;
          if (isSuccess) {
            setTimeout(() => {
              if (currentIdxRef.current < vocabCards.length - 1) {
                setCurrentIdx(prev => prev + 1);
                setPhase('ready');
              } else {
                setIsFinished(true);
              }
            }, 2000);
          }
        } catch (error) {
          console.error('Transcription failed:', error);
          setShake(true);
          setPhase('result');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied', err);
      alert('Không thể truy cập microphone. Vui lòng cấp quyền.');
    }
  };

  const handleRecordStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecord = useCallback(() => {
    if (isRecording) {
      handleRecordStop();
    } else {
      handleRecordStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

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
    // Keep currentIdx in ref for the setTimeout
    currentIdxRef.current = currentIdx;
    
    if (isSubmitted) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault();
        toggleRecord();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (!isFinished) goToNext();
      } else if (e.key === 'ArrowLeft') {
        if (!isFinished) goToPrev();
      } else if (e.key === 'Control' && !isFinished && currentCard) {
        handleSpeak(currentCard.word, speed, currentCard.audioUrl);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted, isFinished, goToNext, goToPrev, currentCard, handleSpeak, speed, toggleRecord, currentIdx]);

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
              onClick={() => handleSpeak(currentCard.word, speed, currentCard.audioUrl)}
              disabled={isRecording}
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
          {(displayPhonetic || phoneticLoading) && (
            <p className="text-base font-mono text-emerald-400/80">
              {phoneticLoading ? <span className="animate-pulse">...</span> : displayPhonetic}
            </p>
          )}
          <p className="text-2xl md:text-3xl font-extrabold tracking-wide text-foreground">{currentCard.word}</p>
        </div>

        {/* Recording zone */}
        <div className="w-full max-w-md space-y-4">
          <button
            onClick={toggleRecord}
            disabled={phase === 'recording' && !isRecording}
            className={`w-full h-16 md:h-20 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 select-none ${
              isRecording
                ? 'bg-red-500/15 border border-red-500/40 text-red-400 scale-95 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover-lift'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
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
                <span>Đang thu... (chạm để dừng)</span>
              </>
            ) : phase === 'recording' ? (
              <>
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Đang chấm điểm bằng AI...</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" strokeWidth={1.5} />
                <span>
                  {phase === 'result' ? 'Chạm để thử lại' : 'Chạm để ghi âm'}
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
              <div className="flex flex-col items-center gap-2 w-full mt-2">
                <p className="text-xs text-muted-foreground w-full text-left">Chi tiết phát âm:</p>
                <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1 py-1">
                  {currentResult.wordDiff?.map((w, i) => (
                    <span
                      key={i}
                      className={`text-lg md:text-xl font-semibold ${
                        w.ok ? 'text-emerald-400' : 'text-red-400 line-through decoration-red-400/60'
                      }`}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
                {!isCorrect && (
                  <p className="text-xs text-muted-foreground w-full text-left mt-2">
                    Nhận diện AI:{' '}
                    <span className="font-semibold text-foreground italic">
                      &ldquo;{currentResult.recognized || '(không nhận diện được)'}&rdquo;
                    </span>
                  </p>
                )}
              </div>
              {currentResult.audioBlobUrl && (
                <button
                  onClick={() => new Audio(currentResult.audioBlobUrl!).play()}
                  className="mt-2 w-full py-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 font-semibold rounded-lg text-xs hover:bg-sky-500/20 transition-all flex justify-center items-center gap-2"
                >
                  <Volume2 className="w-3 h-3" /> Nghe lại giọng của tôi
                </button>
              )}
            </div>
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
