'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getAssignment, submitSentenceShadowing, getStudentSubmission,
  DictationSentence,
} from '@/lib/local-store';
import { ArrowLeft, Mic, CheckCircle2, RotateCcw, Trophy, Star } from 'lucide-react';
import { SentenceShadowingBlock, SentenceShadowingResult } from '@/components/exercises/vocabulary-blocks/SentenceShadowingBlock';

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  results,
  sentences,
}: {
  results: SentenceShadowingResult[];
  sentences: DictationSentence[];
}) {
  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / results.length)
    : 0;
  const masteredCount = results.filter(r => r.accuracy >= 80).length;

  const grade =
    overallScore >= 90 ? { label: 'Xuất Sắc', color: 'text-emerald-400', icon: '🏆' } :
    overallScore >= 75 ? { label: 'Giỏi', color: 'text-sky-400', icon: '⭐' } :
    overallScore >= 55 ? { label: 'Khá', color: 'text-amber-400', icon: '📚' } :
    { label: 'Cần Cố Gắng', color: 'text-red-400', icon: '💪' };

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      {/* Score card */}
      <div className="glass-strong rounded-3xl border border-white/10 p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-sky-500/5" />
        <div className="relative space-y-3">
          <div className="text-5xl">{grade.icon}</div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Kết Quả Shadowing
          </p>
          <p className={`text-7xl font-bold font-heading ${grade.color}`}>{overallScore}</p>
          <p className="text-lg text-muted-foreground">/ 100 điểm</p>
          <span className={`inline-block text-sm font-bold px-4 py-1.5 rounded-full border ${grade.color.replace('text-', 'bg-').replace('400', '500/10')} ${grade.color.replace('text-', 'border-').replace('400', '500/20')} ${grade.color}`}>
            {grade.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-2xl border border-white/5 p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Đạt Chuẩn ≥80%</p>
          <p className="text-3xl font-extrabold text-emerald-400">{masteredCount}<span className="text-muted-foreground text-lg font-normal">/{sentences.length}</span></p>
        </div>
        <div className="glass rounded-2xl border border-white/5 p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Tổng Câu</p>
          <p className="text-3xl font-extrabold text-foreground">{sentences.length}</p>
        </div>
      </div>

      {/* Per-sentence breakdown */}
      <div className="glass-strong rounded-3xl border border-white/5 p-5 space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" /> Chi Tiết Từng Câu
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {sentences.map((s, i) => {
            const r = results.find(r => r.sentenceId === s.id);
            const acc = r?.accuracy ?? 0;
            const isCorrect = acc >= 80;
            const isClose = acc >= 50 && acc < 80;
            return (
              <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' :
                isClose   ? 'bg-amber-500/5 border-amber-500/20' :
                            'bg-red-500/5 border-red-500/20'
              }`}>
                <span className={`shrink-0 font-bold text-xs mt-0.5 ${
                  isCorrect ? 'text-emerald-400' : isClose ? 'text-amber-400' : 'text-red-400'
                }`}>
                  C{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/80 text-xs leading-relaxed">{s.text}</p>
                  {r?.recognized && (
                    <p className="text-muted-foreground text-[11px] mt-0.5 italic">
                      Bạn nói: &ldquo;{r.recognized}&rdquo;
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                  isCorrect ? 'bg-emerald-500/20 text-emerald-300' :
                  isClose   ? 'bg-amber-500/20 text-amber-300' :
                              'bg-red-500/20 text-red-300'
                }`}>
                  {acc}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <a
        href="/student/assignments"
        className="w-full py-4 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-2xl transition-all flex items-center justify-center gap-2 hover-lift block text-center"
      >
        <ArrowLeft className="w-5 h-5" strokeWidth={1.5} /> Về Danh Sách Bài Tập
      </a>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShadowingExercisePage() {
  const router = useRouter();
  const params = useParams();
  const dictationId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [sentences, setSentences] = useState<DictationSentence[]>([]);
  const [studentName, setStudentName] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [finalResults, setFinalResults] = useState<SentenceShadowingResult[]>([]);
  const startTimeRef = useRef(Date.now());

  const [shadowingAssignmentId, setShadowingAssignmentId] = useState('');

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('et_session') || 'null');
    const name = session?.role === 'student' ? session.username :
      localStorage.getItem('et_current_student') || '';
    setStudentName(name);

    const a = getAssignment(dictationId);
    if (!a || (a.type !== 'dictation' && a.type !== 'shadowing')) {
      router.push('/student/assignments');
      return;
    }
    if (a.createdAt && new Date(a.createdAt) > new Date()) {
      router.push('/student/assignments');
      return;
    }
    setAssignment(a);

    // Standalone shadowing uses its own id; dictation-derived uses 'shadowing_'+id
    setShadowingAssignmentId(a.type === 'shadowing' ? dictationId : `shadowing_${dictationId}`);

    let parsed = a.sentences || a.passage;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = []; }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = []; }
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      setSentences(parsed);
    }

    startTimeRef.current = Date.now();
  }, [dictationId, router]);

  const handleComplete = useCallback((results: SentenceShadowingResult[]) => {
    if (studentName && assignment) {
      const title = assignment.type === 'shadowing'
        ? assignment.title
        : `Shadowing: ${assignment.title}`;
      submitSentenceShadowing({
        assignmentId: shadowingAssignmentId,
        assignmentTitle: title,
        studentName,
        results,
        durationMs: Date.now() - startTimeRef.current,
      });
    }
    setFinalResults(results);
    setShowDone(true);
  }, [shadowingAssignmentId, assignment, studentName]);



  if (!assignment) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/student/assignments')}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Danh Sách Bài Tập
      </button>

      {/* Header */}
      <div className="glass rounded-3xl border border-emerald-500/20 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Mic className="h-6 w-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded-md">
                Shadowing
              </span>
            </div>
            <h1 className="text-lg font-bold font-heading gradient-text truncate">
              {assignment.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sentences.length} câu • Nghe và nhắc lại để luyện phát âm
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {showDone ? (
        <ResultScreen
          results={finalResults}
          sentences={sentences}
        />
      ) : sentences.length > 0 ? (
        <SentenceShadowingBlock
          sentences={sentences}
          onComplete={handleComplete}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <Mic className="w-10 h-10 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Bài tập này không có câu hỏi Shadowing.</p>
        </div>
      )}
    </div>
  );
}
