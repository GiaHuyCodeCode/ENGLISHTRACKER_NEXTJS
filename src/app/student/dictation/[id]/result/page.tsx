'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { getAssignment, getSubmissions, DictationResult } from '@/lib/local-store';
import {
  ArrowLeft, Trophy, CheckCircle2, AlertCircle, Brain,
  TrendingUp, RotateCcw, Headphones, ExternalLink, Sparkles, Clock
} from 'lucide-react';

interface AiFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  tips: string[];
  encouragement: string;
  source?: string;
}

export default function DictationResultPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const assignmentId = params?.id as string;
  const submissionId = searchParams?.get('sid');

  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const a = getAssignment(assignmentId);
    if (!a) { router.push('/student'); return; }
    setAssignment(a);

    const allSubs = getSubmissions();
    const sub = allSubs.find(s => s.id === submissionId && s.assignmentId === assignmentId);
    if (sub) setSubmission(sub);
  }, [assignmentId, submissionId]);

  useEffect(() => {
    if (!submission || !assignment) return;
    fetchAiFeedback();
  }, [submission, assignment]);

  const fetchAiFeedback = async () => {
    if (!submission?.dictationResults?.length) return;
    setAiLoading(true);
    setAiError('');
    try {
      const sentences = submission.dictationResults.map((r: DictationResult, i: number) => ({
        sentenceId: r.sentenceId,
        correct: assignment.sentences?.[i]?.text || '',
        studentText: r.studentText,
        accuracy: r.accuracy,
        errors: r.errors,
      }));

      const res = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: submission.studentName,
          assignmentTitle: assignment.title,
          sentences,
          overallScore: submission.score,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiFeedback(data);
    } catch (err: any) {
      setAiError('Không thể tải nhận xét AI lúc này.');
    } finally {
      setAiLoading(false);
    }
  };

  if (!submission || !assignment) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const results: DictationResult[] = submission.dictationResults || [];
  const score = submission.score;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = score >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/student/assignments')}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Danh Sách Bài Tập
        </button>
        <button onClick={() => router.push(`/student/dictation/${assignmentId}`)}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/50 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Làm Lại
        </button>
      </div>

      {/* Title */}
      <div className="fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Headphones className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text">Kết Quả Dictation</h1>
            <p className="text-sm text-muted-foreground">{assignment.title}</p>
          </div>
        </div>
      </div>

      {/* Score card */}
      <div className={`glass-strong rounded-3xl border p-8 text-center ${scoreBg} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-primary to-transparent" />
        <div className="relative space-y-2">
          <div className={`text-7xl font-extrabold font-heading ${scoreColor}`}>{score}</div>
          <div className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">/ 100 điểm</div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${scoreBg} ${scoreColor} mt-2`}>
            {score >= 80 ? <><Trophy className="h-4 w-4" /> Xuất Sắc!</>
             : score >= 50 ? <><TrendingUp className="h-4 w-4" /> Khá Tốt</>
             : <><AlertCircle className="h-4 w-4" /> Cần Luyện Thêm</>}
          <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
            {results.length} câu · {submission.studentName} {submission.durationMs && <>· <Clock className="h-3.5 w-3.5" /> {formatDuration(submission.durationMs)}</>}
          </p>
        </div>
      </div>

      {/* AI Feedback */}
      <div className="glass-strong rounded-3xl border border-violet-500/20 p-6 space-y-4">
        <h2 className="font-bold font-heading text-lg flex items-center gap-2 text-violet-400">
          <Brain className="h-5 w-5" /> Nhận Xét Từ AI
          {aiFeedback?.source && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {aiFeedback.source === 'rule_based' || aiFeedback.source === 'fallback' ? 'Phân tích tự động' : `Gemini (${aiFeedback.source})`}
            </span>
          )}
        </h2>

        {aiLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-secondary/60 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
            ))}
            <p className="text-xs text-muted-foreground">Đang phân tích bài làm...</p>
          </div>
        )}

        {aiError && !aiLoading && (
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {aiError}
          </p>
        )}

        {aiFeedback && !aiLoading && (
          <div className="space-y-4 fade-in">
            <p className="text-sm leading-relaxed text-foreground/90">{aiFeedback.summary}</p>

            {aiFeedback.strengths?.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 space-y-2">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">✅ Điểm Mạnh</p>
                <ul className="space-y-1.5">
                  {aiFeedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2"><span className="text-emerald-400 shrink-0">•</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiFeedback.improvements?.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 space-y-2">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">⚡ Cần Cải Thiện</p>
                <ul className="space-y-1.5">
                  {aiFeedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2"><span className="text-amber-400 shrink-0">•</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiFeedback.tips?.length > 0 && (
              <div className="p-4 rounded-2xl bg-sky-500/8 border border-sky-500/20 space-y-2">
                <p className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Mẹo Luyện Tập
                </p>
                <ul className="space-y-1.5">
                  {aiFeedback.tips.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2"><span className="text-sky-400 shrink-0">{i + 1}.</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiFeedback.encouragement && (
              <p className="text-sm text-center font-semibold text-violet-300 italic">"{aiFeedback.encouragement}"</p>
            )}
          </div>
        )}
      </div>

      {/* Per-sentence breakdown */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-sky-400" /> Chi Tiết Từng Câu
        </h2>
        {results.map((r, i) => {
          const original = assignment.sentences?.[i]?.text || '';
          const acc = r.accuracy;
          const accColor = acc >= 80 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-red-400';
          const accBg = acc >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : acc >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

          return (
            <div key={i} className={`glass rounded-2xl border p-4 space-y-3 ${accBg}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase">Câu {i + 1}</span>
                <span className={`text-sm font-bold ${accColor}`}>{acc}%</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground/60">Bản gốc: </span>
                <span className="italic">"{original}"</span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-foreground/60">Bạn viết: </span>
                <span className={`italic ${acc >= 80 ? 'text-emerald-300' : 'text-foreground/80'}`}>"{r.studentText || '(bỏ trống)'}"</span>
              </div>
              {r.errors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.errors.map((err, j) => (
                    <span key={j} className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/20 text-red-300 text-xs">{err}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Source link */}
      {assignment.sourceUrl && (
        <a href={assignment.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl glass border border-sky-500/20 text-sky-400 text-sm font-semibold hover:bg-sky-500/10 transition-colors">
          <ExternalLink className="h-4 w-4" /> Quay Lại Trang Bài Gốc
        </a>
      )}
    </div>
  );
}
