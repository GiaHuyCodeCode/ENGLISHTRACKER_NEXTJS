'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAssignments, getSubmissions, seedIfEmpty, syncAllFromCloud, autoSyncAllSpacedRepetition,
  Assignment, Submission, getStudentNames, getStudentColors, getStudentAvatar,
  getVocabularyCards, getVocabProgressList, getAssignmentNextReviewDate,
} from '@/lib/local-store';
import {
  BookOpen, ListChecks, ChevronRight, CheckCircle2,
  Clock, Trophy, User, LogOut, PenTool, Loader2, RefreshCw, Headphones, FileJson, FileText, Mic
} from 'lucide-react';
import { FilePdf } from '@/components/ui/FilePdf';

function ScorePill({ score }: { score: number }) {
  const cls = score >= 80 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : score >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
    : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${cls}`}>{score}/100</span>
  );
}

// ── Student Picker ──────────────────────────────────────────────────────────

function StudentPicker({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center shadow-xl glow-primary">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-heading gradient-text">Chào mừng!</h1>
          <p className="text-muted-foreground text-sm">Bạn là ai? Chọn tên để vào học.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {getStudentNames().map(name => {
            const colors = getStudentColors(name);
            const initials = getStudentAvatar(name);
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className={`group glass hover-lift rounded-2xl p-5 text-left border transition-all hover:border-primary/40`}
              >
                <div className={`w-12 h-12 ${colors.bg} ${colors.text} border ${colors.border} rounded-xl flex items-center justify-center text-lg font-bold mb-3`}>
                  {initials}
                </div>
                <p className="font-semibold text-sm">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 group-hover:text-primary transition-colors">
                  Vào học <ChevronRight className="h-3 w-3" />
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

/** Đọc số câu dictation từ cả `sentences` (array) lẫn `passage` (JSON string) */
function getDictationCount(a: Assignment): number {
  // Ưu tiên: nếu có field sentences là array hợp lệ
  if (a.sentences && Array.isArray(a.sentences) && a.sentences.length > 0) {
    return a.sentences.length;
  }
  // Fallback: parse từ passage (lưu dưới dạng JSON string)
  if (!a.passage) return 0;
  let parsed: unknown = a.passage;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return 0; }
    // Double-encoded trường hợp lưu 2 lần JSON.stringify
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return 0; }
    }
  }
  return Array.isArray(parsed) ? parsed.length : 0;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('et_current_student');
      if (saved && getStudentNames().includes(saved)) return saved;
    }
    return null;
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshData = async () => {
    // 1. Lấy dữ liệu local
    setAssignments(getAssignments());
    setMounted(true);

    // 2. Fetch từ server
    setIsSyncing(true);
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) {
        const cloudData = await res.json();
        const hasChanges = syncAllFromCloud(cloudData);
        if (hasChanges) {
          setAssignments(getAssignments());
          if (studentName) {
            setSubmissions(getSubmissions().filter(s => s.studentName === studentName));
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi đồng bộ bài tập:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    seedIfEmpty();
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!studentName) return;
    localStorage.setItem('et_current_student', studentName);
    setSubmissions(getSubmissions().filter(s => s.studentName === studentName));
  }, [studentName]);

  if (!mounted) return null;
  if (!studentName) return <StudentPicker onSelect={setStudentName} />;

  const colors = getStudentColors(studentName);
  const initials = getStudentAvatar(studentName);
  const myAvgScore = submissions.filter(s => s.id && Number(s.durationMs) > 0).length
    ? Math.round(submissions.filter(s => s.id && Number(s.durationMs) > 0).reduce((s, x) => s + x.score, 0) / submissions.filter(s => s.id && Number(s.durationMs) > 0).length)
    : null;

  const getSubmission = (id: string) => submissions.find(s => s.id && s.assignmentId === id);

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m} phút ${s} giây`;
    return `${s} giây`;
  };

  const now = new Date();
  const visibleAssignments = assignments.filter(a => {
    if (a.isHidden === true) return false;
    if (a.type === 'repetition') {
      if (!a.createdAt) return true;
      return new Date(a.createdAt) <= now;
    }
    if (!a.createdAt) return true;
    return new Date(a.createdAt) <= now;
  });

  const getLocalDateString = (dateInput: string | Date) => {
    const d = new Date(dateInput);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  const todayLocalStr = getLocalDateString(new Date());

  const done = visibleAssignments.filter(a => {
    const sub = getSubmission(a.id);
    if (!sub) return false;
    // Ẩn các bài tập do hệ thống tự đồng bộ (không có thời gian làm bài)
    if (!sub.durationMs || Number(sub.durationMs) === 0) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    const subA = getSubmission(a.id);
    const subB = getSubmission(b.id);
    if (!subA || !subB) return 0;
    return new Date(subB.submittedAt).getTime() - new Date(subA.submittedAt).getTime();
  });
  const todo = visibleAssignments.filter(a => a.type !== 'repetition' && !getSubmission(a.id)).sort((a, b) => {
    const dateA = a.createdAt ? getLocalDateString(a.createdAt) : '';
    const dateB = b.createdAt ? getLocalDateString(b.createdAt) : '';

    const isTodayA = dateA === todayLocalStr;
    const isTodayB = dateB === todayLocalStr;

    if (isTodayA && !isTodayB) return -1;
    if (!isTodayA && isTodayB) return 1;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const pendingRepetitions = visibleAssignments.filter(a => a.type === 'repetition' && !getSubmission(a.id)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const allAssignments = getAssignments();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 ${colors.bg} ${colors.text} border-2 ${colors.border} rounded-2xl flex items-center justify-center text-xl font-bold`}>
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text flex items-center gap-2">
              Xin chào, {studentName}!
              {isSyncing && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {todo.length + pendingRepetitions.length > 0 ? `${todo.length + pendingRepetitions.length} bài tập đang chờ bạn` : 'Bạn đã hoàn thành tất cả! 🎉'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => { setIsSyncing(true); refreshData(); }} disabled={isSyncing} className="p-2 rounded-xl glass hover-lift border border-border text-muted-foreground hover:text-primary transition-all disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setStudentName(null); localStorage.removeItem('et_current_student'); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Đổi học viên
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Đã hoàn thành', value: done.length, color: 'text-teal-600 dark:text-teal-400', bg: 'border-white/5' },
          { label: 'Điểm Trung Bình', value: myAvgScore !== null ? `${myAvgScore}đ` : '—', color: 'text-[#0071e3]', bg: 'border-white/5' },
          { label: 'Chờ làm', value: todo.length + pendingRepetitions.length, color: 'text-amber-600 dark:text-amber-400', bg: 'border-white/5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`glass rounded-2xl p-5 border ${bg}`}>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Assignments */}
      {(todo.length > 0 || pendingRepetitions.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Bài Tập Chờ Làm
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs border border-amber-500/30">
              {todo.length + pendingRepetitions.length}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            
            {/* Spaced Repetition Assignment Cards - Pending (Red) */}
            {pendingRepetitions.map(assignment => (
              <Link key={assignment.id} href={`/student/vocabulary?assignId=${assignment.id}&srs=true`}>
                <div className="group glass hover-lift rounded-2xl p-5 border border-red-500/30 hover:border-red-500/60 transition-all cursor-pointer h-full flex flex-col justify-between bg-red-500/5">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-red-500/20">
                        <BookOpen className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-lg font-semibold bg-red-500/10 text-red-600 dark:text-red-400">
                        Spaced Repetition
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm leading-snug mb-2 transition-colors group-hover:text-red-600 dark:group-hover:text-red-400">
                      {assignment.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {assignment.vocabCards?.length || 0} từ vựng • Cần ôn lại ngay hôm nay
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all text-red-600 dark:text-red-400">
                    Bắt đầu ôn tập <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}



            {/* Regular assignments */}
            {todo.map(a => {
              const isShadowing = a.type === 'shadowing';
              const isDictation = a.type === 'dictation';
              const href = isShadowing ? `/student/shadowing/${a.id}`
                : isDictation ? `/student/dictation/${a.id}`
                : `/student/assignments/${a.id}`;
              return (
                <Link key={a.id} href={href}>
                  <div className={`group glass hover-lift rounded-2xl p-5 border transition-all cursor-pointer h-full flex flex-col justify-between ${
                    isShadowing ? 'border-emerald-500/15 hover:border-emerald-500/40' : 'border-white/5 hover:border-primary/40'
                  }`}>
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className={`p-3 rounded-xl ${
                          a.type === 'vocab_context' ? 'bg-violet-500/15' :
                          a.type === 'multiple_choice' ? 'bg-teal-500/15' :
                          a.type === 'dictation' ? 'bg-sky-500/15' :
                          a.type === 'vocabulary' ? 'bg-indigo-500/15' :
                          a.type === 'shadowing' ? 'bg-emerald-500/15' :
                          a.type === 'grammar' ? 'bg-fuchsia-500/15' :
                          'bg-amber-500/15'
                        }`}>
                          {a.type === 'vocab_context' ? <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" /> :
                           a.type === 'multiple_choice' ? <ListChecks className="h-5 w-5 text-teal-600 dark:text-teal-400" /> :
                           a.type === 'dictation' ? <Headphones className="h-5 w-5 text-sky-600 dark:text-sky-400" /> :
                           a.type === 'vocabulary' ? <FileJson className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> :
                           a.type === 'shadowing' ? <Mic className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> :
                           a.type === 'grammar' ? <FilePdf className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" /> :
                           <PenTool className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                        </div>
                        <span className={`text-[11px] px-2 py-1 rounded-lg font-semibold ${
                          a.type === 'vocab_context' ? 'bg-violet-500/10 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' :
                          a.type === 'multiple_choice' ? 'bg-teal-500/10 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' :
                          a.type === 'dictation' ? 'bg-sky-500/10 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' :
                          a.type === 'vocabulary' ? 'bg-indigo-500/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                          a.type === 'shadowing' ? 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          a.type === 'grammar' ? 'bg-fuchsia-500/10 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' :
                          'bg-amber-500/10 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {a.type === 'vocab_context' ? 'Vocab' :
                           a.type === 'multiple_choice' ? 'Quiz' :
                           a.type === 'dictation' ? 'Dictation' :
                           a.type === 'vocabulary' ? 'Học Từ' :
                           a.type === 'shadowing' ? 'Shadowing' :
                           a.type === 'grammar' ? 'Tài Liệu' : 'Viết'}
                        </span>
                      </div>
                      <h3 className={`font-semibold text-sm leading-snug mb-2 transition-colors ${
                        isShadowing ? 'group-hover:text-emerald-600 dark:text-emerald-400' : 'group-hover:text-primary'
                      }`}>{a.title}</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        {a.type === 'vocab_context' ? `${a.keywords?.length || 0} từ khóa` :
                         a.type === 'multiple_choice' ? `${a.questions?.length || 0} câu hỏi` :
                         a.type === 'dictation' ? `${getDictationCount(a)} câu • Nghe & gõ lại` :
                         a.type === 'vocabulary' ? `${a.vocabCards?.length || 0} từ • Học & Kiểm tra` :
                         a.type === 'repetition' ? `${a.vocabCards?.length || 0} từ • Nghe chép ôn tập` :
                         a.type === 'shadowing' ? `${getDictationCount(a)} câu • Nghe & nhắc lại` :
                         a.type === 'grammar' ? (a.linkedAssignmentId ? 'Lý thuyết ngữ pháp • Có bài trắc nghiệm liên kết' : 'Lý thuyết ngữ pháp • Đọc & học tập') :
                         `${a.keywords?.length || 0} từ khóa cần dùng`}
                        {a.type !== 'repetition' && a.createdAt && ` • Ngày giao: ${new Date(a.createdAt).toLocaleDateString('vi-VN')}`}
                        {a.type === 'repetition' && (() => {
                          const nr = getAssignmentNextReviewDate(a.id, studentName);
                          return nr ? ` • Ngày ôn: ${new Date(nr).toLocaleDateString('vi-VN')}` : '';
                        })()}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all ${
                      isShadowing ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'
                    }`}>
                      Bắt đầu <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}

          </div>
        </section>
      )}

      {/* Completed */}
      {(done.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Đã Hoàn Thành
          </h2>
          <div className="glass rounded-2xl border border-white/5 overflow-hidden">
            <div className="divide-y divide-white/5">
              {/* Regular completed assignments */}
              {done.map(a => {
                const sub = getSubmission(a.id)!;
                if (a.type === 'repetition') {
                  const href = sub ? `/student/review/${sub.id}` : `/student/assignments/${a.id}`;
                  return (
                    <Link key={a.id} href={href} className="flex items-center gap-4 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border-l-4 border-emerald-500 transition-colors cursor-pointer group">
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-600 max-w-[65%] sm:max-w-none">{a.title}</p>
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 leading-none">
                            <span className="hidden sm:inline">Spaced Repetition</span>
                            <span className="sm:hidden">SRS</span>
                          </span>
                        </div>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 flex items-center gap-2">
                          <span>{new Date(sub.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          {sub.durationMs ? (
                            <span className="text-[10px] font-medium flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              • <Clock className="w-3 h-3" /> {formatDuration(sub.durationMs)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ScorePill score={sub.score} />
                        <ChevronRight className="h-4 w-4 text-emerald-600/50 group-hover:translate-x-0.5 transition-all group-hover:text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </Link>
                  );
                }
                const isShadowing = a.type === 'shadowing';
                const href = isShadowing ? `/student/shadowing/${a.id}`
                  : sub ? `/student/review/${sub.id}`
                  : `/student/assignments/${a.id}`;
                return (
                  <Link key={a.id} href={href} className="flex items-center gap-4 px-6 py-4 hover:bg-black/5 dark:bg-white/5 transition-colors cursor-pointer group">
                    <div className={`p-2 rounded-lg ${
                      a.type === 'vocab_context' ? 'bg-violet-500/10 dark:bg-violet-500/10' :
                      a.type === 'multiple_choice' ? 'bg-teal-500/10 dark:bg-teal-500/10' :
                      a.type === 'dictation' ? 'bg-sky-500/10 dark:bg-sky-500/10' :
                      a.type === 'vocabulary' ? 'bg-indigo-500/10 dark:bg-indigo-500/10' :
                      a.type === 'shadowing' ? 'bg-emerald-500/10 dark:bg-emerald-500/10' :
                      a.type === 'grammar' ? 'bg-fuchsia-500/10 dark:bg-fuchsia-500/10' :
                      'bg-amber-500/10 dark:bg-amber-500/10'
                    }`}>
                      {a.type === 'vocab_context' ? <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" /> :
                       a.type === 'multiple_choice' ? <ListChecks className="h-4 w-4 text-teal-600 dark:text-teal-400" /> :
                       a.type === 'dictation' ? <Headphones className="h-4 w-4 text-sky-600 dark:text-sky-400" /> :
                       a.type === 'vocabulary' ? <FileJson className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                       a.type === 'shadowing' ? <Mic className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> :
                       a.type === 'grammar' ? <FilePdf className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" /> :
                       <PenTool className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate transition-colors ${isShadowing ? 'group-hover:text-emerald-600 dark:text-emerald-400' : 'group-hover:text-primary'}`}>{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{new Date(sub.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        {sub.durationMs ? (
                          <span className={`text-[10px] font-medium flex items-center gap-1 ${isShadowing ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`}>
                            • <Clock className="w-3 h-3" /> {formatDuration(sub.durationMs)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScorePill score={sub.score} />
                      <ChevronRight className={`h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-all ${isShadowing ? 'group-hover:text-emerald-600 dark:text-emerald-400' : 'group-hover:text-primary'}`} />
                    </div>
                  </Link>
                );
              })}

            </div>
          </div>
        </section>
      )}

      {assignments.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">Giáo viên chưa tạo bài tập nào.</p>
        </div>
      )}
    </div>
  );
}
