'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAssignment, submitDictation, getSubmissions, getStudentColors, getStudentAvatar, DictationResult, DictationSentence, isFuzzyMatch, Submission } from '@/lib/local-store';
import { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';
import { ArrowLeft, Volume2, CheckCircle2, X, ChevronRight, Headphones, RotateCcw, AlertCircle, Trophy, Star, Clock, XCircle } from 'lucide-react';
import { ExerciseTimer } from '@/components/ui/ExerciseTimer';
import { audioManager } from '@/lib/audio';

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(t: string) {
  return t.trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
}

function computeAccuracy(student: string, correct: string): number {
  const sw = normalizeText(student).split(' ').filter(Boolean);
  const cw = normalizeText(correct).split(' ').filter(Boolean);
  if (!cw.length) return 0;
  let hits = 0;
  cw.forEach((w, i) => { if (i < sw.length && isFuzzyMatch(sw[i], w, 0.85)) hits++; });
  return Math.round((hits / cw.length) * 100);
}

function computeWordDiff(student: string, correct: string) {
  const sw = normalizeText(student).split(' ').filter(Boolean);
  const cw = normalizeText(correct).split(' ').filter(Boolean);
  return cw.map((word, i) => ({ word, ok: i < sw.length && isFuzzyMatch(sw[i], word, 0.85) }));
}

// ── Score penalty: mỗi lần sai trừ điểm ─────────────────────────────────────
// Base score per sentence = 100/sentences.length
// Mỗi lần sai trừ 20% base score của câu đó (tối thiểu 0)

function calcSentenceScore(baseScore: number, wrongAttempts: number): number {
  const penalty = baseScore * 0.2 * wrongAttempts;
  return Math.max(0, Math.round(baseScore - penalty));
}

// ── TTS ──────────────────────────────────────────────────────────────────────
// Removed local speak in favor of audioManager

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  sentences,
  attemptsByIdx,
  submissions,
  onRestart,
}: {
  sentences: DictationSentence[];
  attemptsByIdx: number[];
  submissions: Submission[];
  onRestart: () => void;
}) {
  const baseScore = 100 / sentences.length;
  const totalScore = Math.round(
    sentences.reduce((sum, _, i) => sum + calcSentenceScore(baseScore, attemptsByIdx[i] || 0), 0)
  );

  const grade =
    totalScore >= 90 ? { label: 'Xuất Sắc', color: 'text-emerald-400', icon: '🏆' } :
    totalScore >= 75 ? { label: 'Giỏi', color: 'text-sky-400', icon: '⭐' } :
    totalScore >= 55 ? { label: 'Khá', color: 'text-amber-400', icon: '📚' } :
    { label: 'Cần Cố Gắng', color: 'text-red-400', icon: '💪' };

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in">
      {/* Score Card */}
      <div className="glass-strong rounded-3xl border border-white/10 p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-violet-500/5" />
        <div className="relative">
          <div className="text-5xl mb-3">{grade.icon}</div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kết Quả Bài Dictation</p>
          <p className={`text-7xl font-bold font-heading mb-2 ${grade.color}`}>{totalScore}</p>
          <p className="text-lg text-muted-foreground mb-1">/ 100 điểm</p>
          <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${grade.color.replace('text-', 'bg-').replace('400', '500/10')} ${grade.color.replace('text-', 'border-').replace('400', '500/20')} ${grade.color}`}>
            {grade.label}
          </span>
        </div>
      </div>

      <RaceTrackLeaderboard submissions={submissions} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DictationExercisePage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [studentName, setStudentName] = useState('');

  // Dictation data
  const [sentences, setSentences] = useState<DictationSentence[]>([]);

  // Exercise state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [attemptsByIdx, setAttemptsByIdx] = useState<number[]>([]); // wrong attempts per sentence
  const [completedIdx, setCompletedIdx] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<'wrong' | 'correct' | null>(null);
  const [wrongWords, setWrongWords] = useState<{ word: string; ok: boolean }[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    const session = JSON.parse(localStorage.getItem('et_session') || 'null');
    const name = session?.role === 'student' ? session.username :
      localStorage.getItem('et_current_student') || '';
    setStudentName(name);

    const a = getAssignment(assignmentId);
    if (!a || a.type !== 'dictation') { router.push('/student/assignments'); return; }
    if (a.createdAt && new Date(a.createdAt) > new Date()) {
      router.push('/student/assignments');
      return;
    }
    setAssignment(a);

    // If assignment already has sentences embedded (or safely tucked in the passage field)
    let parsedSentences = a.sentences || a.passage;
    if (typeof parsedSentences === 'string') {
      try { parsedSentences = JSON.parse(parsedSentences); } catch { parsedSentences = []; }
      // FIX DOUBLE STRINGIFY ISSUE FROM GOOGLE SHEETS
      if (typeof parsedSentences === 'string') {
        try { parsedSentences = JSON.parse(parsedSentences); } catch { parsedSentences = []; }
      }
    }
    if (Array.isArray(parsedSentences) && parsedSentences.length > 0) {
      setSentences(parsedSentences);
      setAttemptsByIdx(Array(parsedSentences.length).fill(0));
    }
  }, [assignmentId, router]);

  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const speakCurrent = useCallback(() => {
    const currentSentence = sentences[currentIdx];
    if (!currentSentence) return;
    if (isMounted.current) setIsSpeaking(true);
    
    const nextSentence = sentences[currentIdx + 1];
    const endTime = nextSentence?.startTime;
    
    audioManager.speak(currentSentence.text, speed, currentSentence.audioUrl, currentSentence.startTime, endTime);
    
    setTimeout(() => {
      if (isMounted.current) setIsSpeaking(false);
    }, 3000);
  }, [sentences, currentIdx, speed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' && !showDone) {
        speakCurrent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDone, speakCurrent]);

  useEffect(() => {
    let timer: any;
    if (sentences.length > 0 && !showDone) {
      timer = setTimeout(() => {
        if (isMounted.current) speakCurrent();
      }, 400);
      inputRef.current?.focus();
    }
    return () => clearTimeout(timer);
  }, [currentIdx, sentences.length, showDone, speakCurrent]);

  const handleCheck = () => {
    const sentence = sentences[currentIdx];
    if (!sentence || !input.trim()) return;

    const acc = computeAccuracy(input, sentence.text);
    const diff = computeWordDiff(input, sentence.text);

    if (acc >= 85) {
      // Correct
      setFeedback('correct');
      setWrongWords([]);
      const newCompleted = new Set(completedIdx);
      newCompleted.add(currentIdx);
      setCompletedIdx(newCompleted);

      // Auto advance after short delay
      setTimeout(() => {
        setFeedback(null);
        setInput('');
        setWrongWords([]);
        
        if (newCompleted.size >= sentences.length) {
          // All done — submit dictation then move to shadowing phase
          const results: DictationResult[] = sentences.map((s, i) => ({
            sentenceId: s.id,
            studentText: '',
            accuracy: Math.max(0, 100 - (attemptsByIdx[i] || 0) * 20),
            errors: [],
            replayCount: 0,
          }));
          submitDictation({
            assignmentId,
            studentName,
            results,
            durationMs: Date.now() - startTimeRef.current,
          });
          setShowDone(true);
        } else {
          let nextIdx = currentIdx + 1;
          while (nextIdx < sentences.length && newCompleted.has(nextIdx)) {
            nextIdx++;
          }
          if (nextIdx >= sentences.length) {
            nextIdx = 0;
            while (nextIdx < sentences.length && newCompleted.has(nextIdx)) {
              nextIdx++;
            }
          }
          setCurrentIdx(nextIdx);
        }
      }, 1200);
    } else {
      // Wrong
      setFeedback('wrong');
      setWrongWords(diff);
      setAttemptsByIdx(prev => {
        const u = [...prev];
        u[currentIdx] = (u[currentIdx] || 0) + 1;
        return u;
      });
    }
  };

  const handleRetry = () => {
    setFeedback(null);
    setInput('');
    setWrongWords([]);
    speakCurrent();
    setTimeout(() => {
      if (isMounted.current) inputRef.current?.focus();
    }, 100);
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setInput('');
    setAttemptsByIdx(Array(sentences.length).fill(0));
    setCompletedIdx(new Set());
    setFeedback(null);
    setWrongWords([]);
    setShowDone(false);
  };

  const handleJump = (i: number) => {
    if (showDone) return;
    setCurrentIdx(i);
    setFeedback(null);
    setInput('');
    setWrongWords([]);
    setIsMobileMapOpen(false);
  };

  const progress = sentences.length > 0 ? Math.round((completedIdx.size / sentences.length) * 100) : 0;
  const currentSentence = sentences[currentIdx];

  const getHint = () => {
    const attempts = attemptsByIdx[currentIdx] || 0;
    if (attempts === 0) return null;
    
    const sw = normalizeText(input).split(' ').filter(Boolean);
    const cw = normalizeText(currentSentence.text).split(' ').filter(Boolean);
    const originalWords = currentSentence.text.split(' ').filter(Boolean);
    
    let firstWrongIdx = -1;
    for (let i = 0; i < cw.length; i++) {
      if (i >= sw.length || !isFuzzyMatch(sw[i], cw[i], 0.85)) {
        firstWrongIdx = i;
        break;
      }
    }
    
    if (firstWrongIdx === -1) return null;
    
    const hintWords = originalWords.map((word, i) => {
      if (i < firstWrongIdx) return word;
      if (i === firstWrongIdx) {
        if (attempts === 1) return word[0] + '_'.repeat(Math.max(0, word.length - 1));
        return word;
      }
      return '***';
    });
    
    return hintWords.join(' ');
  };

  const failedPeers = getSubmissions().filter(s => s.assignmentId === assignmentId)
    .filter(sub => {
      if (!sub.dictationResults) return false;
      const r = sub.dictationResults.find(res => res.sentenceId === currentSentence?.id);
      return r && r.accuracy < 100;
    }).map(sub => sub.studentName);
  const uniqueFailedPeers = Array.from(new Set(failedPeers));

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!assignment) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => router.push('/student/assignments')}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Danh Sách Bài Tập
      </button>

      {/* ── Result Screen ── */}
      {showDone ? (
        <ResultScreen
          sentences={sentences}
          attemptsByIdx={attemptsByIdx}
          submissions={getSubmissions().filter(s => s.assignmentId === assignmentId)}
          onRestart={handleRestart}
        />
      ) : sentences.length > 0 ? (
        <>
          {/* Sticky Mobile Status Bar */}
          <div className="sticky top-16 z-40 lg:hidden -mx-4 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Tiến độ:</span>
              <span className="text-xs font-extrabold text-sky-400">{progress}%</span>
              <span className="text-[10px] text-muted-foreground">({completedIdx.size}/{sentences.length} câu)</span>
            </div>
            <div className="flex-1 max-w-[40%] bg-secondary h-1.5 rounded-full overflow-hidden">
              <div className="bg-sky-400 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <button
              onClick={() => setIsMobileMapOpen(true)}
              className="px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs font-bold text-sky-400 active:scale-95 transition-all"
            >
              Sơ đồ câu
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 fade-in items-start">
            <div className="lg:col-span-3 space-y-6 order-first lg:order-last">
            {/* Header */}
            <div className="glass rounded-3xl border border-white/5 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                  <Headphones className="h-6 w-6 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h1 className="text-xl font-bold font-heading gradient-text truncate">
                      {assignment.title}
                    </h1>
                    <ExerciseTimer isRunning={!showDone} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span>Câu {currentIdx + 1} / {sentences.length}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{completedIdx.size} hoàn thành</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Exercise Card */}
            <div className="glass-strong rounded-3xl border border-white/10 p-6 space-y-5">
              {/* Sentence number badge */}
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-400">
                  Câu {currentIdx + 1}
                </span>
              </div>

              {/* Listen Button */}
              <div className="text-center py-4 relative">
                <div className="absolute top-0 right-0">
                  <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-secondary/50 border border-white/10 rounded-lg text-xs py-1 px-2 text-muted-foreground hover:text-foreground outline-none">
                    <option value={0.75}>0.75x</option>
                    <option value={1.0}>1.0x (Chuẩn)</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                  </select>
                </div>
                <button
                  onClick={speakCurrent}
                  disabled={isSpeaking}
                  className={`group relative w-24 h-24 rounded-full border-4 transition-all flex items-center justify-center mx-auto ${
                    isSpeaking
                      ? 'bg-sky-500/20 border-sky-400 animate-pulse'
                      : 'bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-400 hover:scale-105'
                  }`}
                >
                  <Volume2 className={`h-10 w-10 ${isSpeaking ? 'text-sky-300' : 'text-sky-400'}`} />
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full border-4 border-sky-400 animate-ping opacity-30" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground mt-3">
                  {isSpeaking ? 'Đang phát...' : 'Nhấn để nghe'}
                </p>
                <button
                  onClick={speakCurrent}
                  className="mt-2 text-xs text-sky-400/70 hover:text-sky-400 transition-colors flex items-center gap-1 mx-auto"
                >
                  <RotateCcw className="h-3 w-3" /> Nghe lại
                </button>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Gõ câu bạn nghe được
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => {
                    if (feedback !== 'correct') {
                      setInput(e.target.value);
                      if (feedback === 'wrong') { setFeedback(null); setWrongWords([]); }
                    }
                  }}
                  disabled={feedback === 'correct' || completedIdx.has(currentIdx)}
                  onKeyDown={e => { if (e.key === 'Enter' && input.trim() && feedback !== 'correct' && !completedIdx.has(currentIdx)) handleCheck(); }}
                  placeholder="Nghe và gõ câu tiếng Anh vào đây..."
                  className={`input-field w-full text-base transition-all ${
                    feedback === 'correct' ? 'border-emerald-500/50 bg-emerald-500/5' :
                    feedback === 'wrong' ? 'border-red-500/50 bg-red-500/5' :
                    ''
                  }`}
                />
                {uniqueFailedPeers.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap bg-red-500/5 w-fit px-2 py-1 rounded-md border border-red-500/10">
                    <span className="text-[10px] text-red-400/80 uppercase font-semibold">Vài con gà đã ngã xuống:</span>
                    <div className="flex -space-x-1">
                      {uniqueFailedPeers.map(peer => (
                        <div key={peer} title={`${peer} đã làm sai câu này`} className="relative w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center bg-background text-[8px] font-bold shadow-sm z-10 hover:z-20 transition-all hover:scale-110">
                          {getStudentAvatar(peer)}
                          <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-background">
                            <XCircle className="w-2 h-2 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback: Correct */}
              {feedback === 'correct' && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-400 text-sm">Chính xác! 🎉</p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">Chuyển sang câu tiếp theo...</p>
                  </div>
                </div>
              )}

              {/* Feedback: Wrong */}
              {feedback === 'wrong' && (
                <div className="space-y-3 fade-in">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-red-400 text-sm mb-2">Chưa chính xác, thử lại nhé!</p>
                      {wrongWords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {wrongWords.map((w, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              w.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                            }`}>{w.word}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="w-full py-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 font-semibold text-sm hover:bg-sky-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" /> Nghe lại & Thử lại
                  </button>
                </div>
              )}

              {/* Check Button */}
              {feedback === null && !completedIdx.has(currentIdx) && (
                <button
                  onClick={handleCheck}
                  disabled={!input.trim()}
                  className="w-full py-3 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> Kiểm Tra
                </button>
              )}
              {completedIdx.has(currentIdx) && (
                 <div className="space-y-3 fade-in">
                   <div className="w-full py-3 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 border border-emerald-500/20">
                     <CheckCircle2 className="h-4 w-4" /> Đã hoàn thành câu này
                   </div>
                   {currentSentence?.translation && (
                     <div className="p-4 rounded-xl bg-secondary/30 border border-white/5 animate-in slide-in-from-top-2 duration-500">
                       <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Nghĩa tiếng Việt</p>
                       <p className="text-sm text-foreground">{currentSentence.translation}</p>
                     </div>
                   )}
                 </div>
              )}
            </div>

            {/* Hint: current wrong attempts */}
            {attemptsByIdx[currentIdx] >= 1 && feedback !== 'correct' && getHint() && (
              <div className="glass rounded-2xl border border-amber-500/20 p-4 text-center fade-in">
                <p className="text-xs text-amber-400 font-medium">
                  💡 Gợi ý: <span className="font-mono tracking-widest text-sm ml-1">
                    {getHint()}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Sidebar Tracking (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-1 mt-6 lg:mt-0 space-y-6 lg:sticky lg:top-6">
            <div className="glass-strong rounded-3xl border border-white/5 p-6 space-y-6">
              <div>
                <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400" /> Tiến Độ Bài Tập
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Hoàn thành bài tập để đạt điểm tối đa</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6"
                      strokeDasharray={28 * 2 * Math.PI}
                      strokeDashoffset={(28 * 2 * Math.PI) - ((progress / 100) * 28 * 2 * Math.PI)}
                      className="text-sky-400 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{progress}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Đã xong:</span>
                    <span className="font-bold text-emerald-400">{completedIdx.size}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Còn lại:</span>
                    <span className="font-bold text-amber-400">{sentences.length - completedIdx.size}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground/80">Chi tiết các câu</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {sentences.map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleJump(i)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all hover-lift ${
                      completedIdx.has(i) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      i === currentIdx ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50 scale-105' :
                      'bg-secondary/40 text-muted-foreground hover:bg-white/10 hover:text-foreground border border-white/5'
                    }`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <p className="text-xs text-muted-foreground">Phím tắt nhanh:</p>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-secondary/50 border border-white/10 text-xs font-mono text-muted-foreground font-semibold">Ctrl</kbd>
                    <span className="text-xs text-muted-foreground">Phát / Nghe lại câu hiện tại</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sheet for Mobile Sơ đồ câu hỏi */}
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
              isMobileMapOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsMobileMapOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className={`fixed bottom-0 left-0 right-0 glass-strong border-t border-white/10 rounded-t-[2rem] p-6 z-50 lg:hidden transition-all duration-300 ease-out transform ${
            isMobileMapOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
          }`}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400" /> Sơ đồ câu hỏi
                </h3>
                <button 
                  onClick={() => setIsMobileMapOpen(false)} 
                  className="p-1.5 bg-white/5 border border-white/5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="5" className="text-secondary" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="5"
                      strokeDasharray={24 * 2 * Math.PI}
                      strokeDashoffset={(24 * 2 * Math.PI) - ((progress / 100) * 24 * 2 * Math.PI)}
                      className="text-sky-400 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{progress}%</span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Đã xong:</span>
                    <span className="font-bold text-emerald-400">{completedIdx.size}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Còn lại:</span>
                    <span className="font-bold text-amber-400">{sentences.length - completedIdx.size}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chi tiết các câu</p>
                <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                  {sentences.map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleJump(i)}
                      className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-xs font-bold transition-all hover-lift ${
                        completedIdx.has(i) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        i === currentIdx ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 scale-105' :
                        'bg-secondary/40 text-muted-foreground hover:bg-white/10 hover:text-foreground border border-white/5'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <Headphones className="w-10 h-10 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Bài tập này không có câu hỏi Dictation.</p>
        </div>
      )}
    </div>
  );
}
