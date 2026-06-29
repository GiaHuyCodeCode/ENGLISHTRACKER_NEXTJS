import { useState, useEffect, useCallback, useRef } from 'react';
import { DictationSentence } from '@/lib/local-store';
import {
  Volume2, Mic, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Eye, Send,
} from 'lucide-react';
import { audioManager } from '@/lib/audio';
import { useSpeechRecognition } from './useSpeechRecognition';
import { usePhonetic } from '@/lib/usePhonetic';

let globalAudioCtx: AudioContext | null = null;
function getGlobalAudioContext() {
  if (!globalAudioCtx) {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  return globalAudioCtx;
}

// ── Real-time waveform from microphone via Web Audio API ─────────────────────
function useWaveform(stream: MediaStream | null): number[] {
  const [bars, setBars] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) {
      setBars([0, 0, 0, 0, 0, 0, 0]);
      return;
    }
    const ctx = getGlobalAudioContext();
    if (!ctx) return;
    // Ensure AudioContext is running (some browsers suspend it if created outside click handler)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const BAR_COUNT = 7;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
        // fftSize 256 -> 128 bins. At 44.1kHz, each bin is ~172Hz.
        // Map bars to voice frequencies: bins 2 (344Hz) to 20 (3.4kHz)
        const binIndex = 2 + i * 3;
        const value = data[binIndex] || 0;
        // Boost sensitivity by dividing by 180 instead of 255
        return Math.min(1, value / 180);
      });
      setBars(newBars);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      setBars([0, 0, 0, 0, 0, 0, 0]);
      source.disconnect();
    };
  }, [stream]);

  return bars;
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

export interface SentenceShadowingResult {
  sentenceId: string | number; // UUID string cho Shadowing mới, number cho legacy
  recognized: string;
  accuracy: number;
  attempts: number;
}

interface Props {
  sentences: DictationSentence[];
  onComplete: (results: SentenceShadowingResult[]) => void;
  onSkip?: () => void;
}

interface SentenceResult {
  recognized: string;
  accuracy: number;
  wordDiff: { word: string; ok: boolean }[];
  userAudioUrl?: string;
}

export function SentenceShadowingBlock({ sentences, onComplete, onSkip }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'result'>('ready');
  const [results, setResults] = useState<Record<string, SentenceResult>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isTextRevealed, setIsTextRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isRecording, setIsRecording] = useState(false);
  // User-selectable max recording duration (seconds)
  const [autoStopDuration, setAutoStopDuration] = useState(4);

  const phaseRef = useRef(phase);
  const attemptsRef = useRef(attempts);
  const currentIdxRef = useRef(currentIdx);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  // Tracks whether a recording session is still active (used in async continuations)
  const recordingActiveRef = useRef(false);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [waveformStream, setWaveformStream] = useState<MediaStream | null>(null);
  const waveformBars = useWaveform(waveformStream);

  const currentSentenceRef = useRef(sentences[0]);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  const { isListening: srListening, isSupported, start: startSR, stop: stopSR } = useSpeechRecognition('en-US');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const currentSentence = sentences[currentIdx];
  useEffect(() => { currentSentenceRef.current = currentSentence; }, [currentSentence]);

  const { phonetic: displayPhonetic, loading: phoneticLoading } = usePhonetic(currentSentence?.text, currentSentence?.phonetic);

  const handleSpeak = useCallback((text: string, audioUrl?: string, customStart?: number) => {
    const start = customStart ?? currentSentence.startTime;
    const nextSentence = sentences[currentIdxRef.current + 1];
    const endTime = nextSentence?.startTime;
    
    audioManager.speak(text, speed, audioUrl, start, endTime);
  }, [speed, sentences, currentSentence]);

  const releaseMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    setWaveformStream(null);
  }, []);

  useEffect(() => {
    setCurrentIdx(0);
    setPhase('ready');
    setResults({});
    setAttempts({});
    setIsFinished(false);
    setIsTextRevealed(false);
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, [sentences]);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      releaseMicStream();
    };
  }, [releaseMicStream]);

  useEffect(() => {
    if (!currentSentence || isFinished) return;
    setPhase('ready');
    setIsTextRevealed(false);
  }, [currentIdx, isFinished, currentSentence]);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const handleRecordStart = async () => {
    if (!currentSentenceRef.current || phaseRef.current === 'recording' || !isSupported) return;

    // Unlock AudioContext synchronously inside click handler for Safari
    const ctx = getGlobalAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    releaseMicStream();

    setPhase('recording');
    setIsRecording(true);
    recordingActiveRef.current = true;

    startSR((transcript, confidence) => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      recordingActiveRef.current = false;
      setIsRecording(false);

      const targetText = currentSentenceRef.current.text;
      const sentenceId = currentSentenceRef.current.id;

      const recWords = normalize(transcript).split(' ').filter(Boolean);
      const tgtWords = normalize(targetText).split(' ').filter(Boolean);

      let hits = 0;
      const wordDiff = targetText.trim().split(/\s+/).map((w, i) => {
        const ok = i < recWords.length ? fuzzyOk(recWords[i], normalize(w)) : false;
        if (ok) hits++;
        return { word: w, ok };
      });

      const acc = transcript.trim() === '' ? 0 : (tgtWords.length ? Math.round((hits / tgtWords.length) * 100) : 0);
      const count = (attemptsRef.current[sentenceId] || 0) + 1;

      // Guard: ensure saveResult is only called once even if both the
      // MediaRecorder.onstop path and the fallback path fire concurrently.
      let resultSaved = false;
      const saveResult = (audioUrl?: string) => {
        if (resultSaved) return;
        resultSaved = true;
        setResults(prev => ({ ...prev, [sentenceId]: { recognized: transcript, accuracy: acc, wordDiff, userAudioUrl: audioUrl } }));
        setAttempts(prev => ({ ...prev, [sentenceId]: count }));
        setIsTextRevealed(true);

        if (!transcript) setShake(true);
        setPhase('result');
      };

      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        mr.onstop = () => {
          micStreamRef.current?.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
          mediaRecorderRef.current = null;
          const audioBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          const url = URL.createObjectURL(audioBlob);
          saveResult(url);
        };
        mr.stop();
      } else {
        releaseMicStream();
        saveResult(undefined);
      }
    });

    autoStopTimerRef.current = setTimeout(() => {
      autoStopTimerRef.current = null;
      if (recordingActiveRef.current) {
        recordingActiveRef.current = false;
        stopSR();
        setIsRecording(false);
        setWaveformStream(null);
      }
    }, autoStopDuration * 1000);

    const iosDevice = typeof window !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (!iosDevice) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!recordingActiveRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        micStreamRef.current = stream;
        setWaveformStream(stream);
        const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mimeTypeRef.current = mimeType;
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.start();
      } catch (err) {
        console.warn('[SentenceShadowing] getUserMedia failed — SR-only mode:', err);
      }
    }
  };

  const handleRecordStop = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (recordingActiveRef.current) {
      recordingActiveRef.current = false;
      stopSR();
      setIsRecording(false);
      setWaveformStream(null);
    }
  }, [stopSR]);

  const toggleRecord = useCallback(() => {
    if (recordingActiveRef.current) {
      handleRecordStop();
    } else {
      handleRecordStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRecordStop]);

  const goToNext = useCallback(() => {
    if (phase === 'recording') return;
    if (currentIdx < sentences.length - 1) {
      setCurrentIdx(prev => prev + 1);
      handleSpeak(sentences[currentIdx + 1].text, sentences[currentIdx + 1].audioUrl);
    } else {
      setIsFinished(true);
    }
  }, [currentIdx, phase, handleSpeak, sentences]);

  const goToPrev = useCallback(() => {
    if (phase === 'recording' || currentIdx === 0) return;
    setCurrentIdx(prev => prev - 1);
    handleSpeak(sentences[currentIdx - 1].text, sentences[currentIdx - 1].audioUrl);
  }, [currentIdx, phase, handleSpeak, sentences]);

  useEffect(() => {
    if (isFinished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault();
        toggleRecord();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'Control') {
        handleSpeak(currentSentence.text, currentSentence.audioUrl);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, goToNext, goToPrev, handleSpeak, currentSentence, toggleRecord]);

  if (isFinished) {
    const finalResults: SentenceShadowingResult[] = sentences.map(s => ({
      sentenceId: s.id,
      recognized: results[s.id]?.recognized || '',
      accuracy: results[s.id]?.accuracy ?? 0,
      attempts: attempts[s.id] || 0,
    }));
    const overallScore = Math.round(
      sentences.reduce((sum, s) => sum + (results[s.id]?.accuracy ?? 0), 0) / sentences.length,
    );
    const masteredCount = sentences.filter(s => (results[s.id]?.accuracy ?? 0) >= 80).length;

    return (
      <div className="glass-strong rounded-3xl border border-emerald-500/30 p-8 text-center max-w-xl mx-auto space-y-6 slide-up glow-success">
        <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
          <Mic className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-bold font-heading">Shadowing Hoàn Thành!</h3>
          <p className="text-sm text-muted-foreground">Bạn đã luyện phát âm {sentences.length} câu.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-white/5">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Độ Chính Xác</span>
            <span className={`text-3xl font-extrabold ${overallScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : overallScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {overallScore}%
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">Đạt Chuẩn ≥80%</span>
            <span className="text-3xl font-extrabold text-foreground">{masteredCount}/{sentences.length}</span>
          </div>
        </div>

        <button
          onClick={() => onComplete(finalResults)}
          className="w-full py-4 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift"
        >
          <Send className="w-5 h-5" strokeWidth={1.5} />
          Lưu Kết Quả & Xem Điểm
        </button>
      </div>
    );
  }

  if (!currentSentence) return null;

  const currentResult = results[currentSentence.id];
  const isCorrect = currentResult && currentResult.accuracy >= 80;
  const isClose   = currentResult && currentResult.accuracy >= 50 && currentResult.accuracy < 80;

  return (
    <div className={`space-y-6 max-w-3xl mx-auto w-full slide-up px-1 md:px-0 ${shake ? 'animate-shake' : ''}`}>
      {!isSupported && (
        <div className="p-4 rounded-xl bg-red-500/10 dark:bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm text-center">
          Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome/Edge trên máy tính hoặc cho phép quyền truy cập Microphone.
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
          <span>Câu {currentIdx + 1} / {sentences.length}</span>
          <span className="text-emerald-600 dark:text-emerald-400">{Object.keys(results).length} đã luyện</span>
        </div>
        <div className="w-full bg-secondary/40 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${(currentIdx / sentences.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={`glass-strong rounded-3xl border p-6 md:p-8 flex flex-col items-center text-center space-y-6 transition-all duration-300 ${
        isCorrect    ? 'border-emerald-500/30' :
        isClose      ? 'border-amber-500/30'   :
        currentResult ? 'border-red-500/30'    : 'border-white/5'
      }`}>

        <div className="relative w-full flex justify-center py-4">
          <div className="absolute top-0 right-0 flex flex-col items-end gap-1">
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-secondary/50 border border-black/10 dark:border-white/10 rounded-lg text-xs py-1 px-2 text-muted-foreground hover:text-foreground outline-none">
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x (Chuẩn)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
            <select value={autoStopDuration} onChange={e => setAutoStopDuration(Number(e.target.value))} className="bg-secondary/50 border border-black/10 dark:border-white/10 rounded-lg text-xs py-1 px-2 text-muted-foreground hover:text-foreground outline-none">
              <option value={4}>Tự dừng: 4s</option>
              <option value={6}>Tự dừng: 6s</option>
              <option value={8}>Tự dừng: 8s</option>
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/15 rounded-full blur-xl" />
            <button
              onClick={() => handleSpeak(currentSentence.text, currentSentence.audioUrl)}
              disabled={isRecording || phase === 'recording'}
              className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all shadow-md hover-lift disabled:opacity-50 mx-auto"
            >
              <Volume2 className="h-10 w-10 md:h-12 md:w-12" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="w-full space-y-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Câu cần shadowing
          </p>

          {(isTextRevealed || phase === 'result') ? (
            currentResult ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1">
                  {currentResult.wordDiff.map((w, i) => (
                    <span
                      key={i}
                      className={`text-lg md:text-xl font-semibold ${
                        w.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400 line-through decoration-red-400/60'
                      }`}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
                {(displayPhonetic || phoneticLoading) && (
                  <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400/80">
                    {phoneticLoading ? <span className="animate-pulse">...</span> : displayPhonetic}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                  {currentSentence.text}
                </p>
                {(displayPhonetic || phoneticLoading) && (
                  <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400/80">
                    {phoneticLoading ? <span className="animate-pulse">...</span> : displayPhonetic}
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="relative flex items-center justify-center gap-3">
              <div className="space-y-1 select-none blur-sm pointer-events-none">
                <p className="text-base text-muted-foreground italic">
                  {currentSentence.text}
                </p>
                {(displayPhonetic || phoneticLoading) && (
                  <p className="text-xs font-mono text-muted-foreground/60">
                    {phoneticLoading ? <span className="animate-pulse">...</span> : displayPhonetic}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsTextRevealed(true)}
                className="absolute right-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400/70 hover:text-emerald-600 dark:text-emerald-400 transition-colors bg-background/80 px-2 py-1 rounded-lg"
              >
                <Eye className="w-3.5 h-3.5" /> Hiện
              </button>
            </div>
          )}
        </div>

        <div className="w-full max-w-lg space-y-4">
          <button
            onClick={toggleRecord}
            disabled={!isSupported || (phase === 'recording' && !isRecording)}
            className={`w-full h-16 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 ${
              isRecording
                ? 'bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-400 scale-95 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : 'bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover-lift'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
              <>
                {/* Real-time waveform bars from microphone */}
                <div className="flex items-end gap-[3px]" style={{ height: 26 }}>
                  {waveformBars.map((amplitude, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-red-400 rounded-full transition-none"
                      style={{
                        height: `${Math.max(0.08, amplitude) * 100}%`,
                        transformOrigin: 'bottom',
                        transition: 'height 60ms linear',
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
                  <span className="ml-2 text-[10px] opacity-50 font-normal">Space</span>
                </span>
              </>
            )}
          </button>

          {phase === 'result' && currentResult && (
            <div className={`p-4 rounded-2xl border flex flex-col items-start gap-2 slide-up text-left ${
              isCorrect ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 glow-success' :
              isClose   ? 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30' :
                          'bg-red-500/10 dark:bg-red-500/10 border-red-500/30 glow-error'
            }`}>
              <div className="flex items-center gap-2 w-full text-sm font-bold">
                {isCorrect ? (
                  <><CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.5} /><span className="text-emerald-600 dark:text-emerald-400">Xuất sắc!</span></>
                ) : isClose ? (
                  <span className="text-amber-600 dark:text-amber-400">Gần đúng —</span>
                ) : (
                  <><XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" strokeWidth={1.5} /><span className="text-red-600 dark:text-red-400">Cần luyện thêm</span></>
                )}
                <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-extrabold ${
                  isCorrect ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                  isClose   ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                              'bg-red-500/20 text-red-700 dark:text-red-300'
                }`}>
                  {currentResult.accuracy}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Bạn nói:{' '}
                <span className="font-semibold text-foreground italic">
                  &ldquo;{currentResult.recognized || '(không nhận diện được)'}&rdquo;
                </span>
              </p>
              {currentResult.userAudioUrl && (
                <audio 
                  controls 
                  src={currentResult.userAudioUrl!} 
                  className="h-8 w-full max-w-[240px] mt-2 outline-none" 
                  title="Nghe lại giọng của bạn"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground/60">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-black/10 dark:border-white/10 font-mono font-bold text-[10px] text-muted-foreground">Ctrl</kbd>
          <span>Nghe lại</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-black/10 dark:border-white/10 font-mono font-bold text-[10px] text-muted-foreground">Space</kbd>
          <span>Ghi âm</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 rounded bg-secondary border border-black/10 dark:border-white/10 font-mono font-bold text-[10px] text-muted-foreground">←</kbd>
          <kbd className="px-2 py-1 rounded bg-secondary border border-black/10 dark:border-white/10 font-mono font-bold text-[10px] text-muted-foreground">→</kbd>
          <span>Chuyển câu</span>
        </div>
      </div>

      <div className="flex justify-between items-center gap-4">
        <button
          onClick={goToPrev}
          disabled={currentIdx === 0 || phase === 'recording'}
          className="px-5 py-3 rounded-xl border border-white/5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Câu trước
        </button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Bỏ qua →
          </button>
        )}

        <button
          onClick={goToNext}
          disabled={phase === 'recording'}
          className="px-5 py-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-30 transition-all flex items-center gap-2 text-sm font-semibold hover-lift"
        >
          {currentIdx === sentences.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
