'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAssignments, getSubmissions, seedIfEmpty,
  Assignment, Submission, STUDENT_NAMES, STUDENT_COLORS, STUDENT_AVATARS,
} from '@/lib/local-store';
import {
  BookOpen, ListChecks, ChevronRight, CheckCircle2,
  Clock, Trophy, User, LogOut, PenTool
} from 'lucide-react';

function ScorePill({ score }: { score: number }) {
  const cls = score >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : score >= 50 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${cls}`}>{score}/100</span>
  );
}

// ── Student Picker ──────────────────────────────────────────────────────────

function StudentPicker({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center shadow-xl glow-primary">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-heading gradient-text">Chào mừng!</h1>
          <p className="text-muted-foreground text-sm">Bạn là ai? Chọn tên để vào học.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STUDENT_NAMES.map(name => {
            const colors = STUDENT_COLORS[name];
            const initials = STUDENT_AVATARS[name];
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StudentAssignmentsPage() {
  const [studentName, setStudentName] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    const saved = localStorage.getItem('et_current_student');
    if (saved && STUDENT_NAMES.includes(saved)) setStudentName(saved);
    setAssignments(getAssignments());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!studentName) return;
    localStorage.setItem('et_current_student', studentName);
    setSubmissions(getSubmissions().filter(s => s.studentName === studentName));
  }, [studentName]);

  if (!mounted) return null;
  if (!studentName) return <StudentPicker onSelect={setStudentName} />;

  const colors = STUDENT_COLORS[studentName];
  const initials = STUDENT_AVATARS[studentName];
  const myAvgScore = submissions.length
    ? Math.round(submissions.reduce((s, x) => s + x.score, 0) / submissions.length)
    : null;

  const getSubmission = (id: string) => submissions.find(s => s.assignmentId === id);

  const done = assignments.filter(a => getSubmission(a.id));
  const todo = assignments.filter(a => !getSubmission(a.id));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 ${colors.bg} ${colors.text} border-2 ${colors.border} rounded-2xl flex items-center justify-center text-xl font-bold`}>
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text">Xin chào, {studentName}!</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {todo.length > 0 ? `${todo.length} bài tập đang chờ bạn` : 'Bạn đã hoàn thành tất cả! 🎉'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setStudentName(null); localStorage.removeItem('et_current_student'); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-slate-800/50"
        >
          <LogOut className="h-4 w-4" />
          Đổi học viên
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Đã hoàn thành', value: done.length, total: assignments.length, color: 'text-teal-400', bg: 'border-teal-500/20' },
          { label: 'Điểm Trung Bình', value: myAvgScore !== null ? `${myAvgScore}đ` : '—', color: 'text-violet-400', bg: 'border-violet-500/20' },
          { label: 'Chờ làm', value: todo.length, color: 'text-amber-400', bg: 'border-amber-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`glass rounded-2xl p-5 border ${bg}`}>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Assignments */}
      {todo.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Bài Tập Chờ Làm
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs border border-amber-500/30">{todo.length}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {todo.map(a => (
              <Link key={a.id} href={`/student/assignments/${a.id}`}>
                <div className="group glass hover-lift rounded-2xl p-5 border border-border hover:border-primary/40 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${
                      a.type === 'vocab_context' ? 'bg-violet-500/15' : 
                      a.type === 'multiple_choice' ? 'bg-teal-500/15' :
                      'bg-amber-500/15'
                    }`}>
                      {a.type === 'vocab_context' ? <BookOpen className="h-5 w-5 text-violet-400" /> : 
                       a.type === 'multiple_choice' ? <ListChecks className="h-5 w-5 text-teal-400" /> :
                       <PenTool className="h-5 w-5 text-amber-400" />}
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-lg font-semibold ${
                      a.type === 'vocab_context' ? 'bg-violet-500/10 text-violet-400' : 
                      a.type === 'multiple_choice' ? 'bg-teal-500/10 text-teal-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {a.type === 'vocab_context' ? 'Vocab' : 
                       a.type === 'multiple_choice' ? 'Quiz' : 'Viết'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-primary transition-colors">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {a.type === 'vocab_context' ? `${a.keywords?.length || 0} từ khóa` : 
                     a.type === 'multiple_choice' ? `${a.questions?.length || 0} câu hỏi` :
                     `${a.keywords?.length || 0} từ khóa cần dùng`}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                    Bắt đầu <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Đã Hoàn Thành
          </h2>
          <div className="glass rounded-2xl border border-border overflow-hidden">
            <div className="divide-y divide-border/30">
              {done.map(a => {
                const sub = getSubmission(a.id)!;
                return (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors">
                    <div className={`p-2 rounded-lg ${
                      a.type === 'vocab_context' ? 'bg-violet-500/10' : 
                      a.type === 'multiple_choice' ? 'bg-teal-500/10' :
                      'bg-amber-500/10'
                    }`}>
                      {a.type === 'vocab_context' ? <BookOpen className="h-4 w-4 text-violet-400" /> : 
                       a.type === 'multiple_choice' ? <ListChecks className="h-4 w-4 text-teal-400" /> :
                       <PenTool className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <ScorePill score={sub.score} />
                  </div>
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
