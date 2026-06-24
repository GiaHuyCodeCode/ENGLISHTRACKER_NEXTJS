'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { toLocalDateString } from '@/lib/utils';
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

  // Spaced Repetition states
  const [totalLearnedCount, setTotalLearnedCount] = useState<number>(0);
  const [masteredCount, setMasteredCount] = useState<number>(0);
  const [averageRetention, setAverageRetention] = useState<number>(100);
  const [dueVocabList, setDueVocabList] = useState<{ id: string; word: string; meaning: string; stage: number; overdueDays: number }[]>([]);
  const [forgettingCurveData, setForgettingCurveData] = useState<any[]>([]);
  const [srActiveSubTab, setSrActiveSubTab] = useState<'assignments' | 'words'>('assignments');

  const calculateStats = useCallback((student: string) => {
    const subs = getSubmissions().filter(s => s.studentName === student);
    const trks = getDailyTrackings().filter(t => t.studentName === student);
    setSubmissions(subs);
    setTrackings(trks);
    setProfile(getGamificationProfiles().find(p => p.studentName === student) || null);

    const allCards = getVocabularyCards();
    const studentProgress = getStudentVocabProgress(student);
    const progressMap = new Map<string, any>();
    studentProgress.forEach(p => progressMap.set(p.wordId, p));
    const cardMap = new Map<string, any>();
    allCards.forEach(c => cardMap.set(c.id, c));
    const now = new Date();
    const nowTime = now.getTime();

    // Calculate due vocabulary count
    const dueCount = allCards.filter(card => {
      const prog = progressMap.get(card.id);
      if (!prog) return true;
      return new Date(prog.nextReviewDate) <= now;
    }).length;
    setDueVocabCount(dueCount);

    // Calculate words created today
    const todayStr = toLocalDateString(now);
    const createdToday = allCards.filter(c => c.createdAt && toLocalDateString(c.createdAt) === todayStr).length;
    setTodayVocabCount(createdToday);

    // Calculate Study Day
    const dates = new Set([
      ...subs.map(s => toLocalDateString(s.submittedAt)),
      ...trks.map(t => toLocalDateString(t.submittedAt))
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

    // 1. Total learned cards
    setTotalLearnedCount(studentProgress.length);

    // 2. Mastered count (Stage >= 5)
    const mastered = studentProgress.filter(p => p.stage >= 5).length;
    setMasteredCount(mastered);

    // 3. Current retention & Due Vocab List
    let totalRetention = 0;
    const dueList: typeof dueVocabList = [];

    studentProgress.forEach(p => {
      const card = cardMap.get(p.wordId);
      if (!card) return;

      const lastRev = p.lastReviewed ? new Date(p.lastReviewed) : new Date(p.nextReviewDate); // fallback
      const elapsedDays = Math.max(0, (nowTime - lastRev.getTime()) / (24 * 60 * 60 * 1000));
      const S = p.interval || 1; // half life in days
      const retention = 100 * Math.pow(0.9, elapsedDays / S);
      totalRetention += retention;

      const nextRev = new Date(p.nextReviewDate);
      if (nextRev <= now) {
        const overdueDays = Math.max(0, Math.floor((nowTime - nextRev.getTime()) / (24 * 60 * 60 * 1000)));
        dueList.push({
          id: card.id,
          word: card.word,
          meaning: card.meaning,
          stage: p.stage,
          overdueDays
        });
      }
    });

    const avgRet = studentProgress.length ? Math.round(totalRetention / studentProgress.length) : 100;
    setAverageRetention(avgRet);
    setDueVocabList(dueList.sort((a, b) => b.overdueDays - a.overdueDays));

    // 4. Forgetting Curve Prediction (Next 10 Days)
    const curvePoints = Array.from({ length: 11 }, (_, i) => {
      if (studentProgress.length === 0) {
        // Demo curve values: decay from 100% to 30%
        const demoValues = [100, 80, 70, 60, 52, 46, 41, 37, 34, 32, 30];
        return {
          day: i === 0 ? 'Hôm nay' : `+${i} ngày`,
          'Độ nhớ': demoValues[i],
          'Ngưỡng ôn tập': 90
        };
      }

      let dailyTotalRet = 0;
      studentProgress.forEach(p => {
        const lastRev = p.lastReviewed ? new Date(p.lastReviewed) : new Date(p.nextReviewDate);
        const elapsedDays = Math.max(0, (nowTime - lastRev.getTime()) / (24 * 60 * 60 * 1000)) + i; // add offset day
        const S = p.interval || 1;
        const retention = 100 * Math.pow(0.9, elapsedDays / S);
        dailyTotalRet += retention;
      });
      const avgDailyRet = Math.round(dailyTotalRet / studentProgress.length);
      return {
        day: i === 0 ? 'Hôm nay' : `+${i} ngày`,
        'Độ nhớ': avgDailyRet,
        'Ngưỡng ôn tập': 90
      };
    });
    setForgettingCurveData(curvePoints);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const assignmentMap = new Map<string, Assignment>();
    assignments.forEach(a => assignmentMap.set(a.id, a));

    submissions.forEach(s => {
      const a = assignmentMap.get(s.assignmentId);
      const skill = a?.skill || 'Vocab';
      if (skill === 'Vocab') scores.Vocab.push(s.score);
      else if (skill === 'Grammar') scores.Grammar.push(s.score);
      else if (skill === 'Reading') scores.Reading.push(s.score);
      else if (skill === 'Listening') scores.Listening.push(s.score);
      else if (skill === 'Writing') scores.Writing.push(s.score);
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
      const a = assignmentMap.get(s.assignmentId);
      const skill = a?.skill || 'Vocab';
      if (skill === 'Vocab') classScores.Vocab.push(s.score);
      else if (skill === 'Grammar') classScores.Grammar.push(s.score);
      else if (skill === 'Reading') classScores.Reading.push(s.score);
      else if (skill === 'Listening') classScores.Listening.push(s.score);
      else if (skill === 'Writing') classScores.Writing.push(s.score);
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
    return toLocalDateString(d);
  });

  const progressData = last7Days.map(date => {
    // Student daily score
    const dSubs = submissions.filter(s => toLocalDateString(s.submittedAt) === date);
    const dTrks = trackings.filter(t => toLocalDateString(t.submittedAt) === date);
    const dScores = [...dSubs.map(s => s.score), ...dTrks.map(t => t.score)];
    const myAvg = dScores.length ? Math.round(dScores.reduce((a, b) => a + b, 0) / dScores.length) : null;

    // Class daily score
    const classSubs = allSubmissions.filter(s => toLocalDateString(s.submittedAt) === date);
    const classTrks = allTrackings.filter(t => toLocalDateString(t.submittedAt) === date);
    const classScores = [...classSubs.map(s => s.score), ...classTrks.map(t => t.score)];
    const clsAvg = classScores.length ? Math.round(classScores.reduce((a, b) => a + b, 0) / classScores.length) : null;

    return { date: date.slice(5), score: myAvg, classScore: clsAvg };
  });

  const effortData = last7Days.map(date => {
    const count = submissions.filter(s => s.submittedAt.startsWith(date)).length +
      trackings.filter(t => t.submittedAt.startsWith(date)).length;
    return { date: date.slice(5), count };
  });

  const assignmentMapForFocus = new Map<string, Assignment>();
  assignments.forEach(a => assignmentMapForFocus.set(a.id, a));

  const skillFocusData = skillData.map(s => {
    const count = submissions.filter(sub => {
      const a = assignmentMapForFocus.get(sub.assignmentId);
      const skill = a?.skill || 'Vocab';
      return skill === s.key;
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
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={skillData}>
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
                                <li>Làm lại các bài tập &quot;Điền từ vào chỗ trống&quot; để ôn lại ngữ cảnh.</li>
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
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            minTickGap={15}
                            tickFormatter={(val, idx) => {
                              if (idx === 0 || idx === progressData.length - 1) {
                                const parts = val.split('-');
                                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                              }
                              return '•';
                            }}
                          />
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
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            minTickGap={15}
                            tickFormatter={(val, idx) => {
                              if (idx === 0 || idx === effortData.length - 1) {
                                const parts = val.split('-');
                                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                              }
                              return '•';
                            }}
                          />
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
                    <p className="text-sm text-muted-foreground mb-6">Giúp bạn nhận biết thói quen &quot;học lệch&quot; để điều chỉnh cân bằng hơn.</p>

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

            {/* Spaced Repetition — Due Assignments Calendar & Forgetting Curve */}
            <div className="glass-strong rounded-3xl border border-white/10 p-6 relative overflow-hidden fade-in stagger-4 space-y-6">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0071e3]/5 via-transparent to-transparent opacity-60"></div>
              
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-xl font-bold font-heading text-[#0071e3] flex items-center gap-2">
                    <Brain className="h-5 w-5 text-[#0071e3]" strokeWidth={1.5} />
                    Hệ Thống Ôn Tập Lặp Lại Ngắt Quãng (Spaced Repetition)
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tối ưu hóa khả năng ghi nhớ dài hạn dựa trên thuật toán Ebbinghaus.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs font-semibold text-sky-400">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} /> Ngày học thứ {studyDay}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300">
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} /> +{todayVocabCount} từ mới hôm nay
                  </div>
                </div>
              </div>

              {/* SR Statistics Grid */}
              <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Tổng từ đang học</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-bold font-heading text-white">{totalLearnedCount}</span>
                    <span className="text-xs text-muted-foreground">từ</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0071e3]/5 border border-[#0071e3]/10 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Từ cần ôn hôm nay</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-bold font-heading text-[#0071e3]">{dueVocabCount}</span>
                    <span className="text-xs text-muted-foreground">từ</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Đã thuộc (Stage 5+)</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-bold font-heading text-emerald-400">{masteredCount}</span>
                    <span className="text-xs text-muted-foreground">từ</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/10 flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Trí nhớ hiện tại</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className={`text-2xl font-bold font-heading ${
                      averageRetention >= 90 ? 'text-emerald-400' :
                      averageRetention >= 75 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>{averageRetention}%</span>
                    <span className="text-xs text-muted-foreground">trung bình</span>
                  </div>
                </div>
              </div>

              {/* Details and Forgetting Curve Chart */}
              <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Repetition list */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <button
                      onClick={() => setSrActiveSubTab('assignments')}
                      className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all ${
                        srActiveSubTab === 'assignments'
                          ? 'border-[#0071e3] text-[#0071e3]'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Bài tập cần ôn ({dueAssignments.length})
                    </button>
                    <button
                      onClick={() => setSrActiveSubTab('words')}
                      className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all ${
                        srActiveSubTab === 'words'
                          ? 'border-[#0071e3] text-[#0071e3]'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Từ vựng cần ôn ({dueVocabList.length})
                    </button>
                  </div>

                  {srActiveSubTab === 'assignments' ? (
                    dueAssignments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        </div>
                        <p className="text-sm font-semibold text-emerald-400">Không có bài tập nào cần ôn!</p>
                        <p className="text-xs text-muted-foreground">Mọi bài tập từ vựng đều được ghi nhớ tốt.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
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
                              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/10 transition-all text-left group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#0071e3]/15 flex items-center justify-center flex-shrink-0">
                                  <BookOpen className="h-4.5 w-4.5 text-[#0071e3]" strokeWidth={1.5} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-xs text-foreground truncate">{assignment.title}</p>
                                  <p className="text-[11px] text-muted-foreground">{totalWords} từ • <span className="text-amber-400 font-semibold">{dueWordsInAssign} từ đến hạn</span></p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="px-2 py-0.5 rounded bg-[#0071e3]/15 text-[#0071e3] text-[10px] font-bold border border-[#0071e3]/20">
                                  Ôn ngay
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0071e3] transition-colors" strokeWidth={1.5} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    dueVocabList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        </div>
                        <p className="text-sm font-semibold text-emerald-400">Không có từ vựng riêng lẻ nào trễ hạn!</p>
                        <p className="text-xs text-muted-foreground">Tất cả từ vựng đều được ghi nhớ an toàn.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {dueVocabList.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">{item.word}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.meaning}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                item.stage >= 5 ? 'bg-emerald-500/15 text-emerald-400' :
                                item.stage >= 3 ? 'bg-[#0071e3]/15 text-sky-400' :
                                'bg-amber-500/15 text-amber-400'
                              }`}>
                                Stage {item.stage}
                              </span>
                              {item.overdueDays > 0 ? (
                                <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                                  Trễ {item.overdueDays} ngày
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                                  Đến hạn
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Right Side: Forgetting Curve Chart */}
                <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#0071e3]" />
                      Đường Cong Quên Lãng (Ebbinghaus)
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Dự báo độ nhớ từ vựng giảm theo thời gian nếu không ôn tập.
                    </p>
                  </div>
                  
                  <div className="h-[180px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forgettingCurveData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <XAxis 
                          dataKey="day" 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(17, 17, 17, 0.95)', 
                            borderColor: 'rgba(255, 255, 255, 0.1)', 
                            borderRadius: '12px',
                            fontSize: '11px'
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Độ nhớ" 
                          stroke="#0071e3" 
                          strokeWidth={2.5} 
                          dot={{ r: 3, stroke: '#0071e3', strokeWidth: 1.5, fill: '#0a0a0a' }}
                          activeDot={{ r: 5 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Ngưỡng ôn tập" 
                          stroke="#ef4444" 
                          strokeDasharray="4 4" 
                          strokeWidth={1.2} 
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-black/20 p-2 rounded-lg">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0071e3]"></span>
                      <span>Độ nhớ (% retention)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-none border-b border-dashed border-[#ef4444] inline-block"></span>
                      <span>Ngưỡng cần ôn (90%)</span>
                    </div>
                  </div>
                </div>

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
