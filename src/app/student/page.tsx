'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getSubmissions, getAssignments, seedIfEmpty, getDailyTrackings,
  getStudentNames, getStudentColors, getStudentAvatar,
  Submission, Assignment, DailyTracking,
  getGamificationProfiles, GamificationProfile, getBadges,
  getVocabularyCards, getStudentVocabProgress, syncAllFromCloud
} from '@/lib/local-store';

import { StudentPerformanceChart } from '@/components/ui/StudentPerformanceChart';
import { Trophy, BookOpen, CheckCircle2, TrendingUp, User, ChevronRight, PenTool, ListChecks, Target, Brain, AlertCircle, Flame, Calendar, Clock, Loader2, RefreshCw, Headphones, FileJson } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

function StudentCard({ name, isSelected, onClick }: { name: string; isSelected: boolean; onClick: () => void }) {
  const c = getStudentColors(name);
  const subs = getSubmissions().filter(s => s.studentName === name);
  const avg = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;
  const profile = getGamificationProfiles().find(p => p.studentName === name);

  return (
    <button onClick={onClick}
      className={`glass hover-lift rounded-2xl p-5 text-left border-2 transition-all w-full ${isSelected ? `${c.border} ${c.bg}` : 'border-border hover:border-primary/30'
        }`}>
      <div className={`w-12 h-12 ${c.bg} ${c.text} border ${c.border} rounded-xl flex items-center justify-center text-lg font-bold mb-3`}>
        {getStudentAvatar(name)}
      </div>
      <p className={`font-semibold text-sm ${isSelected ? c.text : ''}`}>{name}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {avg !== null ? `Điểm TB: ${avg}/100` : 'Chưa làm bài'}
      </p>
    </button>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [trackings, setTrackings] = useState<DailyTracking[]>([]);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [dueVocabCount, setDueVocabCount] = useState<number>(0);
  const [todayVocabCount, setTodayVocabCount] = useState<number>(0);
  const [studyDay, setStudyDay] = useState<number>(1);
  const [dueAssignments, setDueAssignments] = useState<Assignment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const calculateStats = (student: string) => {
    const subs = getSubmissions().filter(s => s.studentName === student);
    const trks = getDailyTrackings().filter(t => t.studentName === student);
    setSubmissions(subs);
    setTrackings(trks);
    setProfile(getGamificationProfiles().find(p => p.studentName === student) || null);

    // Calculate due vocabulary count
    const allCards = getVocabularyCards();
    const studentProgress = getStudentVocabProgress(student);
    const progressMap = new Map<string, any>();
    studentProgress.forEach(p => progressMap.set(p.wordId, p));
    const now = new Date();
    const dueCount = allCards.filter(card => {
      const prog = progressMap.get(card.id);
      if (!prog) return true;
      return new Date(prog.nextReviewDate) <= now;
    }).length;
    setDueVocabCount(dueCount);

    // Calculate words created today
    const todayStr = now.toISOString().split('T')[0];
    const createdToday = allCards.filter(c => c.createdAt && c.createdAt.startsWith(todayStr)).length;
    setTodayVocabCount(createdToday);

    // Calculate Study Day
    const dates = new Set([
      ...subs.map(s => s.submittedAt.split('T')[0]),
      ...trks.map(t => t.submittedAt.split('T')[0])
    ]);
    setStudyDay(Math.max(1, dates.size));

    // Calculate assignments due today (vocabulary type with at least 1 due word)
    const allAssignments = getAssignments().filter(a => {
      if (a.type !== 'vocabulary' || !a.vocabCards || a.vocabCards.length === 0) return false;
      if (!a.createdAt) return true;
      return new Date(a.createdAt) <= now;
    });
    const dueAssigns = allAssignments.filter(assignment => {
      return (assignment.vocabCards || []).some(card => {
        const prog = progressMap.get(card.id);
        if (!prog) return true; // Never reviewed
        return new Date(prog.nextReviewDate) <= now;
      });
    });
    setDueAssignments(dueAssigns);
  };

  const refreshData = async () => {
    setAssignments(getAssignments());
    if (selectedStudent) {
      calculateStats(selectedStudent);
    }

    setIsSyncing(true);
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) {
        const cloudData = await res.json();
        const hasChanges = syncAllFromCloud(cloudData);
        if (hasChanges) {
          setAssignments(getAssignments());
          if (selectedStudent) {
            calculateStats(selectedStudent);
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi đồng bộ dữ liệu:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    seedIfEmpty();
    setAssignments(getAssignments());
    const session = JSON.parse(localStorage.getItem('et_session') || 'null');
    setUser(session);

    if (session?.role === 'student') {
      setSelectedStudent(session.username);
    } else {
      const saved = localStorage.getItem('et_current_student');
      if (saved && getStudentNames().includes(saved)) setSelectedStudent(saved);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    if (user?.role !== 'student') {
      localStorage.setItem('et_current_student', selectedStudent);
    }
    calculateStats(selectedStudent);

    // Sync from cloud once student is resolved
    setIsSyncing(true);
    fetch('/api/assignments')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(cloudData => {
        const hasChanges = syncAllFromCloud(cloudData);
        if (hasChanges) {
          setAssignments(getAssignments());
          calculateStats(selectedStudent);
        }
      })
      .catch(e => console.error('Lỗi khi đồng bộ dữ liệu:', e))
      .finally(() => setIsSyncing(false));
  }, [selectedStudent, user]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m} phút ${s} giây`;
    return `${s} giây`;
  };

  if (!mounted) return null;

  // ── Tính điểm kỹ năng ───────────────────────────────────────────────────────
  const calculateSkills = () => {
    const scores = { Vocab: [] as number[], Grammar: [] as number[], Reading: [] as number[], Listening: [] as number[], Writing: [] as number[] };
    const classScores = { Vocab: [] as number[], Grammar: [] as number[], Reading: [] as number[], Listening: [] as number[], Writing: [] as number[] };

    submissions.forEach(s => {
      if (s.assignmentType === 'vocab_context' || s.assignmentType === 'vocabulary') scores.Vocab.push(s.score);
      else if (s.assignmentType === 'multiple_choice') scores.Grammar.push(s.score);
      else if (s.assignmentType === 'rewrite_vocab') scores.Writing.push(s.score);
      else if (s.assignmentType === 'dictation') scores.Listening.push(s.score);
    });

    trackings.forEach(t => {
      if (t.category === 'Vocabulary') scores.Vocab.push(t.score);
      else if (t.category === 'Grammar') scores.Grammar.push(t.score);
      else if (t.category === 'Reading') scores.Reading.push(t.score);
      else if (t.category === 'Dictation' || t.category === 'Listening') scores.Listening.push(t.score);
      else if (t.category === 'Writing') scores.Writing.push(t.score);
    });

    const allSubmissions = getSubmissions();
    const allTrackings = getDailyTrackings();

    allSubmissions.forEach(s => {
      if (s.assignmentType === 'vocab_context' || s.assignmentType === 'vocabulary') classScores.Vocab.push(s.score);
      else if (s.assignmentType === 'multiple_choice') classScores.Grammar.push(s.score);
      else if (s.assignmentType === 'rewrite_vocab') classScores.Writing.push(s.score);
      else if (s.assignmentType === 'dictation') classScores.Listening.push(s.score);
    });

    allTrackings.forEach(t => {
      if (t.category === 'Vocabulary') classScores.Vocab.push(t.score);
      else if (t.category === 'Grammar') classScores.Grammar.push(t.score);
      else if (t.category === 'Reading') classScores.Reading.push(t.score);
      else if (t.category === 'Dictation' || t.category === 'Listening') classScores.Listening.push(t.score);
      else if (t.category === 'Writing') classScores.Writing.push(t.score);
    });

    const average = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return [
      { subject: 'Từ vựng', A: average(scores.Vocab), B: average(classScores.Vocab), fullMark: 100, key: 'Vocab' },
      { subject: 'Ngữ pháp', A: average(scores.Grammar), B: average(classScores.Grammar), fullMark: 100, key: 'Grammar' },
      { subject: 'Đọc hiểu', A: average(scores.Reading), B: average(classScores.Reading), fullMark: 100, key: 'Reading' },
      { subject: 'Nghe chép', A: average(scores.Listening), B: average(classScores.Listening), fullMark: 100, key: 'Listening' },
      { subject: 'Viết', A: average(scores.Writing), B: average(classScores.Writing), fullMark: 100, key: 'Writing' },
    ];
  };

  const skillData = calculateSkills();
  const sortedSkills = [...skillData].filter(s => s.A > 0).sort((a, b) => a.A - b.A);
  const weakestSkill = sortedSkills.length > 0 ? sortedSkills[0] : null;

  const totalScores = [...submissions.map(s => s.score), ...trackings.map(t => t.score)];
  const avg = totalScores.length ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length) : null;
  const nowVal = new Date();
  const visibleAssignments = assignments.filter(a => {
    if (!a.createdAt) return true;
    return new Date(a.createdAt) <= nowVal;
  });
  const doneIds = new Set(submissions.map(s => s.assignmentId));
  const todo = visibleAssignments.filter(a => !doneIds.has(a.id));

  const totalDurationMs = submissions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  const formatTotalTime = (ms: number) => {
    if (!ms) return '0 phút';
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  // ── Comparison Calculation ────────────────────────────────────────────────
  const allSubmissions = getSubmissions();
  const allTrackings = getDailyTrackings();
  const allScoresList = [...allSubmissions.map(s => s.score), ...allTrackings.map(t => t.score)];
  const classAvg = allScoresList.length ? Math.round(allScoresList.reduce((a, b) => a + b, 0) / allScoresList.length) : null;

  // ── Advanced Analytics Calculation ─────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const progressData = last7Days.map(date => {
    // Student daily score
    const dSubs = submissions.filter(s => s.submittedAt.startsWith(date));
    const dTrks = trackings.filter(t => t.submittedAt.startsWith(date));
    const dScores = [...dSubs.map(s => s.score), ...dTrks.map(t => t.score)];
    const myAvg = dScores.length ? Math.round(dScores.reduce((a, b) => a + b, 0) / dScores.length) : null;

    // Class daily score
    const classSubs = allSubmissions.filter(s => s.submittedAt.startsWith(date));
    const classTrks = allTrackings.filter(t => t.submittedAt.startsWith(date));
    const classScores = [...classSubs.map(s => s.score), ...classTrks.map(t => t.score)];
    const clsAvg = classScores.length ? Math.round(classScores.reduce((a, b) => a + b, 0) / classScores.length) : null;

    return { date: date.slice(5), score: myAvg, classScore: clsAvg };
  });

  const effortData = last7Days.map(date => {
    const count = submissions.filter(s => s.submittedAt.startsWith(date)).length +
      trackings.filter(t => t.submittedAt.startsWith(date)).length;
    return { date: date.slice(5), count };
  });

  const skillFocusData = skillData.map(s => {
    const count = submissions.filter(sub => {
      if (s.key === 'Vocab' && (sub.assignmentType === 'vocab_context' || sub.assignmentType === 'vocabulary')) return true;
      if (s.key === 'Grammar' && sub.assignmentType === 'multiple_choice') return true;
      if (s.key === 'Writing' && sub.assignmentType === 'rewrite_vocab') return true;
      if (s.key === 'Listening' && sub.assignmentType === 'dictation') return true;
      return false;
    }).length + trackings.filter(t => {
      if (s.key === 'Listening' && (t.category === 'Dictation' || t.category === 'Listening')) return true;
      return t.category === s.key;
    }).length;
    return { name: s.subject, value: count, key: s.key };
  }).filter(s => s.value > 0);

  const COLORS = {
    'Vocab': '#a78bfa',   // violet-400
    'Grammar': '#34d399', // emerald-400
    'Reading': '#fbbf24', // amber-400
    'Listening': '#60a5fa',// blue-400
    'Writing': '#f87171'  // red-400
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="fade-in stagger-1">
          <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-2">
            Dashboard Học Viên
            {isSyncing && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {user?.role === 'student' ? 'Tổng quan tiến độ học tập của bạn' : 'Chọn tên học viên để xem tiến độ'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => refreshData()}
            disabled={isSyncing}
            className="p-2 rounded-xl glass hover-lift border border-border text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
            title="Đồng bộ dữ liệu"
          >
            <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Student Picker (Only for Admin) */}
      {user?.role !== 'student' && (
        <div className="fade-in stagger-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Chọn học viên
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {getStudentNames().map(name => (
              <StudentCard key={name} name={name} isSelected={selectedStudent === name} onClick={() => setSelectedStudent(name)} />
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD SECTION */}
      <div className="fade-in stagger-4 space-y-6">
        <h2 className="text-xl font-bold font-heading gradient-text flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Biểu Đồ Thi Đua Học Tập
        </h2>
        <StudentPerformanceChart submissions={getSubmissions()} />
      </div>

      {/* Stats for selected student */}
      {selectedStudent && (() => {
        const studentColors = getStudentColors(selectedStudent);
        const studentAvatar = getStudentAvatar(selectedStudent);
        return (
          <div className="space-y-8 fade-in stagger-3">
            <div className={`glass-strong rounded-3xl border-2 ${studentColors.border} p-6 relative overflow-hidden`}>
              {/* Background glow specific to student */}
              <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${studentColors.bg.replace('bg-', 'from-')}`}></div>

              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 ${studentColors.bg} ${studentColors.text} border-2 ${studentColors.border} rounded-2xl flex items-center justify-center text-3xl font-bold`}>
                    {studentAvatar}
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold font-heading ${studentColors.text}`}>{selectedStudent}</h2>
                    <p className="text-sm text-muted-foreground">{submissions.length} lần nộp bài</p>
                  </div>
                </div>

                {profile && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-xs text-orange-500/80 uppercase font-semibold">Streak</p>
                        <p className="text-sm font-bold text-orange-400">{profile.streakCount} ngày</p>
                      </div>
                    </div>
                    {profile.badges.slice(0, 2).map(b => {
                      const def = getBadges().find(badge => badge.id === b);
                      return def ? (
                        <div key={b} className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${def.color}`} title={def.description}>
                          <span className="text-lg">{def.icon}</span>
                          <div>
                            <p className="text-xs opacity-80 uppercase font-semibold">Huy Hiệu</p>
                            <p className="text-sm font-bold">{def.title}</p>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Điểm Trung Bình', value: avg !== null ? `${avg}đ` : '—', icon: Trophy, color: 'text-amber-400' },
                   { label: 'Đã Hoàn Thành', value: `${submissions.length}/${visibleAssignments.length}`, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Cần Làm', value: todo.length, icon: BookOpen, color: 'text-[#0071e3]' },
                  { label: 'Thời Gian Học', value: formatTotalTime(totalDurationMs), icon: Clock, color: 'text-violet-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="text-center p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center">
                    <Icon className={`h-5 w-5 mb-2 ${color}`} strokeWidth={1.5} />
                    <p className={`text-xl md:text-2xl font-bold font-heading ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-white/10 gap-6 fade-in stagger-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'overview' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
              >
                Tổng Quan
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'analytics' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
              >
                Phân Tích Chuyên Sâu
              </button>
            </div>

            {activeTab === 'overview' ? (
              <>
                {/* Skill Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col items-center">
                    <h3 className="font-semibold font-heading w-full flex items-center gap-2 mb-4">
                      <Brain className="h-5 w-5 text-primary" /> Phân Tích Kỹ Năng
                    </h3>
                    {skillData.some(s => s.A > 0) ? (
                      <div className="w-full h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Kỹ năng" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground w-full h-[250px]">
                        <Brain className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Chưa có đủ dữ liệu</p>
                      </div>
                    )}
                  </div>

                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col">
                    <h3 className="font-semibold font-heading flex items-center gap-2 mb-4 text-amber-400">
                      <AlertCircle className="h-5 w-5" /> Cẩm Nang Học Tập
                    </h3>
                    {weakestSkill ? (
                      <div className="flex-1 space-y-4">
                        <p className="text-sm text-foreground">
                          Dựa trên dữ liệu, kỹ năng <span className="font-bold text-amber-400">{weakestSkill.subject}</span> của bạn hiện đang cần được cải thiện nhất (Điểm trung bình: <span className="font-bold text-amber-400">{weakestSkill.A}</span>).
                        </p>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-sm text-muted-foreground font-medium mb-2">Lời khuyên dành cho bạn:</p>
                          <ul className="text-sm space-y-2 list-disc list-inside text-foreground/80">
                            {weakestSkill.key === 'Vocab' && (
                              <>
                                <li>Làm lại các bài tập "Điền từ vào chỗ trống" để ôn lại ngữ cảnh.</li>
                                <li>Mỗi ngày hãy cố gắng nộp 1 Báo cáo Từ vựng.</li>
                              </>
                            )}
                            {weakestSkill.key === 'Grammar' && (
                              <>
                                <li>Ôn tập kỹ lại các cấu trúc câu đã học trên lớp.</li>
                                <li>Làm thêm các bài Quiz trắc nghiệm ngữ pháp.</li>
                              </>
                            )}
                            {weakestSkill.key === 'Reading' && (
                              <>
                                <li>Đọc ít nhất 1 bài luận ngắn mỗi ngày.</li>
                                <li>Tập trung tìm Keywords khi làm bài thay vì dịch từng chữ.</li>
                              </>
                            )}
                            {weakestSkill.key === 'Listening' && (
                              <>
                                <li>Thực hành chép chính tả (Dictation) hàng ngày.</li>
                                <li>Nghe đi nghe lại các đoạn hội thoại có sẵn script.</li>
                              </>
                            )}
                            {weakestSkill.key === 'Writing' && (
                              <>
                                <li>Luyện viết chuyện chêm sử dụng các từ vựng đã học.</li>
                                <li>Chú ý đến cấu trúc ngữ pháp khi đặt câu.</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                        Hãy làm thêm bài tập để hệ thống đưa ra lời khuyên nhé!
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Comparison */}
                <div className="fade-in stagger-5">
                  <h3 className="font-semibold font-heading text-lg flex items-center gap-2 mb-4 text-emerald-400">
                    <Target className="h-5 w-5" /> So Sánh Cùng Lớp Học
                  </h3>
                  <div className="glass-strong rounded-3xl p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Your Score */}
                      <div className="flex flex-col items-center justify-center p-6 bg-primary/10 border border-primary/20 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2 z-10">Điểm Của Bạn</p>
                        <p className="text-5xl font-bold text-primary font-heading z-10">{avg !== null ? avg : '—'}</p>
                      </div>

                      {/* Class Average */}
                      <div className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2 z-10">Trung Bình Lớp</p>
                        <p className="text-5xl font-bold text-foreground font-heading z-10">{classAvg !== null ? classAvg : '—'}</p>
                      </div>
                    </div>

                    {/* Feedback Message */}
                    {avg !== null && classAvg !== null && (
                      <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${avg >= classAvg
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                        {avg >= classAvg ? <Trophy className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <TrendingUp className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium">
                          {avg > classAvg
                            ? 'Tuyệt vời! Điểm số của bạn đang cao hơn mức trung bình của cả lớp. Hãy tiếp tục duy trì phong độ này nhé!'
                            : avg === classAvg
                              ? 'Tốt lắm! Bạn đang theo kịp mức trung bình của cả lớp. Cố gắng thêm một chút nữa để bứt phá nhé!'
                              : 'Cố lên! Điểm số của bạn đang hơi thấp hơn mức trung bình một chút. Hãy tham khảo "Cẩm Nang Học Tập" phía trên để tìm cách cải thiện kỹ năng yếu nhất nhé.'}
                        </p>
                      </div>
                    )}

                    {/* Detailed Skill Comparison */}
                    {skillData.some(s => s.A > 0 || s.B > 0) && (
                      <div className="mt-6 pt-6 border-t border-white/5">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">So Sánh Từng Kỹ Năng</h4>
                        <div className="w-full h-[220px]">
                          <ResponsiveContainer width="99%" height="100%">
                            <LineChart data={skillData}>
                              <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                              <Legend verticalAlign="top" height={36} />
                              <Line type="monotone" dataKey="A" name="Điểm Của Bạn" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="B" name="Trung Bình Lớp" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: 'hsl(var(--muted-foreground))' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
                  {/* Progress Trend */}
                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col">
                    <h3 className="font-semibold font-heading flex items-center gap-2 mb-6">
                      <TrendingUp className="h-5 w-5 text-emerald-400" /> Tiến Độ Học Tập (7 Ngày)
                    </h3>
                    <div className="w-full h-[250px] min-h-[250px]">
                      <ResponsiveContainer width="99%" height="100%">
                        <LineChart data={progressData}>
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                          <Legend verticalAlign="top" height={36} />
                          <Line type="monotone" dataKey="score" name="Điểm Của Bạn" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="classScore" name="Trung Bình Lớp" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Effort Chart */}
                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col">
                    <h3 className="font-semibold font-heading flex items-center gap-2 mb-6">
                      <Flame className="h-5 w-5 text-orange-400" /> Sự Chăm Chỉ (Số Bài Nộp)
                    </h3>
                    <div className="w-full h-[250px] min-h-[250px]">
                      <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={effortData}>
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                          <Bar dataKey="count" name="Số bài" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Skill Focus Pie Chart */}
                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col md:col-span-2">
                    <h3 className="font-semibold font-heading flex items-center gap-2 mb-2">
                      <Brain className="h-5 w-5 text-violet-400" /> Mức Độ Phân Bổ Kỹ Năng
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">Giúp bạn nhận biết thói quen "học lệch" để điều chỉnh cân bằng hơn.</p>

                    {skillFocusData.length > 0 ? (
                      <div className="w-full h-[300px] min-h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="99%" height="100%">
                          <PieChart>
                            <Pie
                              data={skillFocusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                              labelLine={true}
                            >
                              {skillFocusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.key] || '#8884d8'} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground w-full h-[250px]">
                        <BookOpen className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Chưa có bài làm nào để phân tích thói quen.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Spaced Repetition — Due Assignments Calendar */}
            <div className="glass-strong rounded-3xl border border-white/10 p-6 relative overflow-hidden fade-in stagger-4">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0071e3]/10 via-transparent to-transparent opacity-60"></div>
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold font-heading text-[#0071e3] flex items-center gap-2">
                      <Brain className="h-5 w-5 text-[#0071e3]" strokeWidth={1.5} />
                      Lịch Ôn Tập Hôm Nay
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Có <span className="font-bold text-[#0071e3]">{dueAssignments.length} bài học</span> cần ôn tập •
                      <span className="text-emerald-400 font-semibold ml-1">{dueVocabCount} từ đến hạn</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs font-semibold text-sky-400">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} /> Ngày học thứ {studyDay}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300">
                      <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} /> +{todayVocabCount} từ mới hôm nay
                    </div>
                  </div>
                </div>

                {dueAssignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">Tuyệt vời! Bạn đã ôn tập xong cho hôm nay 🎉</p>
                    <p className="text-xs text-muted-foreground">Quay lại vào ngày mai để tiếp tục.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dueAssignments.map(assignment => {
                      const totalWords = assignment.vocabCards?.length || 0;
                      const dueWordsInAssign = (assignment.vocabCards || []).filter(card => {
                        const prog = getStudentVocabProgress(selectedStudent || '').find(p => p.wordId === card.id);
                        if (!prog) return true;
                        return new Date(prog.nextReviewDate) <= new Date();
                      }).length;
                      return (
                        <button
                          key={assignment.id}
                          onClick={() => router.push(`/student/assignments/${assignment.id}`)}
                          className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/10 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#0071e3]/15 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-5 w-5 text-[#0071e3]" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{assignment.title}</p>
                              <p className="text-xs text-muted-foreground">{totalWords} từ trong bài • <span className="text-amber-400 font-semibold">{dueWordsInAssign} từ đến hạn</span></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-[#0071e3]/15 text-[#0071e3] text-xs font-bold border border-[#0071e3]/20">
                              {totalWords} từ
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0071e3] transition-colors" strokeWidth={1.5} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Daily Tracking CTA */}
            <div className="glass-strong rounded-3xl border border-primary/30 p-6 relative overflow-hidden group hover-lift fade-in stagger-4">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50"></div>
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading text-primary flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Báo Cáo Tiến Độ Hằng Ngày
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chụp ảnh bài học (Vocabulary, Grammar...) và cập nhật điểm số thi đua hôm nay!
                  </p>
                </div>
                <button onClick={() => router.push('/student/tracking')}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all glow-primary w-full sm:w-auto">
                  Nộp Báo Cáo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Recent submissions */}
            {submissions.length > 0 && (
              <div className="fade-in stagger-4">
                <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                  Lịch Sử Bài Làm
                </h2>
                <div className="glass-strong rounded-3xl border border-white/5 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {submissions.slice(0, 5).map(s => {
                      const href = `/student/review/${s.id}`;
                      return (
                        <Link key={s.id} href={href} className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer group w-full">
                          <div className={`p-2 rounded-lg ${
                            s.assignmentType === 'vocab_context' ? 'bg-violet-500/10' :
                            s.assignmentType === 'multiple_choice' ? 'bg-teal-500/10' :
                            s.assignmentType === 'dictation' ? 'bg-sky-500/10' :
                            s.assignmentType === 'vocabulary' ? 'bg-indigo-500/10' :
                            'bg-amber-500/10'
                          }`}>
                            {s.assignmentType === 'vocab_context' ? <BookOpen className="h-4 w-4 text-violet-400" /> :
                             s.assignmentType === 'multiple_choice' ? <ListChecks className="h-4 w-4 text-teal-400" /> :
                             s.assignmentType === 'dictation' ? <Headphones className="h-4 w-4 text-sky-400" /> :
                             s.assignmentType === 'vocabulary' ? <FileJson className="h-4 w-4 text-indigo-400" /> :
                             <PenTool className="h-4 w-4 text-amber-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{s.assignmentTitle}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{new Date(s.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              {s.durationMs && (
                                <span className="text-[10px] text-sky-400 font-medium flex items-center gap-1">
                                  • <Clock className="w-3 h-3" /> {formatDuration(s.durationMs)}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full border text-sm font-bold ${s.score >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : s.score >= 50 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30'
                              }`}>
                              {s.score}/100
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            {todo.length > 0 && (
              <button onClick={() => router.push('/student/assignments')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25 transition-all fade-in stagger-4">
                Xem {todo.length} bài tập đang chờ
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
