'use client';

import { useEffect, useState } from 'react';
import {
  getAssignments, getSubmissions, getDailyTrackings, deleteAssignment,
  updateSubmissionScore, updateTrackingScore, deleteSubmission, deleteTracking, clearAllData,
  Assignment, Submission, DailyTracking, getStudentNames, getStudentColors, getStudentAvatar,
  seedIfEmpty, getGamificationProfiles, getBadges, GamificationProfile, importAssignment, updateAssignment, syncAllFromCloud, createStudent
} from '@/lib/local-store';
import { 
  Users, BookOpen, Clock, Target, Edit2, Save, X, XCircle,
  Trophy, CheckCircle2, TrendingUp, ListChecks, PenTool, TrendingDown, Minus, PlusCircle, Trash2, Flame, Share2, Lightbulb, Settings, Loader2, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { 
  LineChart, Line, BarChart, Bar, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell
} from 'recharts';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {score}đ
    </span>
  );
}

function StudentAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const colors = getStudentColors(name);
  const initials = getStudentAvatar(name);
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClass} ${colors.bg} ${colors.text} border ${colors.border} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}



export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [trackings, setTrackings] = useState<DailyTracking[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshData = async () => {
    // 1. Lấy dữ liệu local trước để hiển thị nhanh
    setAssignments(getAssignments());
    setSubmissions(getSubmissions());
    setTrackings(getDailyTrackings());

    // 2. Fetch từ server ngầm
    setIsSyncing(true);
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) {
        const cloudData = await res.json();
        const hasChanges = syncAllFromCloud(cloudData);
        if (hasChanges) {
          setAssignments(getAssignments());
          setSubmissions(getSubmissions());
          setTrackings(getDailyTrackings());
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
    refreshData();
  }, []);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, action: () => void, title: string, message: string } | null>(null);
  const [addStudentDialog, setAddStudentDialog] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', color: '#3B82F6' });

  const handleAddStudent = () => {
    if (!newStudent.name.trim()) return alert('Vui lòng nhập tên học viên!');
    try {
      createStudent(newStudent.name.trim(), newStudent.color);
      setAddStudentDialog(false);
      setNewStudent({ name: '', color: '#3B82F6' });
      refreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa bài tập',
      message: 'Bạn có chắc chắn muốn xóa bài tập này không?',
      action: () => {
        deleteAssignment(id);
        refreshData();
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleHint = (a: Assignment) => {
    updateAssignment(a.id, { allowHints: !a.allowHints });
    refreshData();
  };

  const handleShareAssignment = (assignment: Assignment) => {
    try {
      const dataStr = JSON.stringify(assignment);
      const base64Data = encodeURIComponent(btoa(unescape(encodeURIComponent(dataStr))));
      const shareUrl = `${window.location.origin}/student/assignments/shared?data=${base64Data}`;
      
      navigator.clipboard.writeText(shareUrl)
        .then(() => window.alert('Đã copy Link giao bài tập vào Clipboard! Hãy gửi link này cho học viên.'))
        .catch(() => {
          window.prompt('Trình duyệt không hỗ trợ tự động copy. Vui lòng copy thủ công link bên dưới:', shareUrl);
        });
    } catch (e) {
      window.alert('Lỗi khi tạo link chia sẻ.');
    }
  };

  const handleClearAllData = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa toàn bộ dữ liệu',
      message: 'CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu (bao gồm bài tập, bài nộp, và điểm số)? Hành động này không thể hoàn tác!',
      action: () => {
        clearAllData();
        refreshData();
        setConfirmDialog(null);
        // Optional: show a success toast here
      }
    });
  };

  // ── Time Travel Filter ─────────────────────────────────────────────────────
  const endOfDay = selectedDate + 'T23:59:59.999Z';
  const filteredSubmissions = submissions.filter(s => s.submittedAt <= endOfDay);
  const filteredTrackings = trackings.filter(t => t.submittedAt <= endOfDay);
  const filteredAssignments = assignments.filter(a => a.createdAt ? a.createdAt <= endOfDay : true);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalStudents = getStudentNames().length;
  const totalAssignments = filteredAssignments.length;
  const avgScore = filteredSubmissions.length
    ? Math.round(filteredSubmissions.reduce((s, x) => s + x.score, 0) / filteredSubmissions.length)
    : 0;
  const completedToday = filteredSubmissions.filter(
    s => s.submittedAt.startsWith(selectedDate),
  ).length;

  // ── Per-student stats ──────────────────────────────────────────────────────
  const profiles = getGamificationProfiles();
  const studentStats = getStudentNames().map(name => {
    const subs = filteredSubmissions.filter(s => s.studentName === name);
    const trks = filteredTrackings.filter(t => t.studentName === name);
    const profile = profiles.find(p => p.studentName === name);
    
    // Tổng hợp điểm từ cả bài tập và tracking
    const totalScore = subs.reduce((s, x) => s + x.score, 0) + trks.reduce((s, x) => s + x.score, 0);
    const totalCount = subs.length + trks.length;
    
    const avg = totalCount ? Math.round(totalScore / totalCount) : null;
    const trend = subs.length >= 2 ? (subs[0].score > subs[1].score ? 'up' : subs[0].score < subs[1].score ? 'down' : 'same') : 'same';
    
    return { name, avg, submissionCount: subs.length, trackingCount: trks.length, trend, profile };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  // ── Recent activities (mix submissions and trackings) ──────────────────────
  const recentActivities = [
    ...filteredSubmissions.map(s => ({ ...s, isTracking: false })),
    ...filteredTrackings.map(t => ({ ...t, isTracking: true }))
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
   .slice(0, 8);

  // ── Analytics Data ─────────────────────────────────────────────────────────
  const todayActivities = [
    ...filteredSubmissions.filter(s => s.submittedAt.startsWith(selectedDate)),
    ...filteredTrackings.filter(t => t.submittedAt.startsWith(selectedDate))
  ];
  
  // 1. Star of the Day
  const studentTodayScores: Record<string, { total: number, count: number }> = {};
  todayActivities.forEach(act => {
    const sName = act.studentName;
    if (!studentTodayScores[sName]) studentTodayScores[sName] = { total: 0, count: 0 };
    studentTodayScores[sName].total += act.score;
    studentTodayScores[sName].count += 1;
  });
  let starOfTheDay: { name: string, avg: number, count: number } | null = null;
  let maxScore = -1;
  for (const [name, data] of Object.entries(studentTodayScores)) {
    const avg = Math.round(data.total / data.count);
    if (avg > maxScore) {
      maxScore = avg;
      starOfTheDay = { name, avg, count: data.count };
    }
  }

  // 2. Time Distribution
  const timeDist = { 'Sáng (6-12h)': 0, 'Chiều (12-18h)': 0, 'Tối (18-24h)': 0, 'Đêm (0-6h)': 0 };
  [...filteredSubmissions, ...filteredTrackings].forEach(act => {
    const hour = new Date(act.submittedAt).getHours();
    if (hour >= 6 && hour < 12) timeDist['Sáng (6-12h)']++;
    else if (hour >= 12 && hour < 18) timeDist['Chiều (12-18h)']++;
    else if (hour >= 18) timeDist['Tối (18-24h)']++;
    else timeDist['Đêm (0-6h)']++;
  });
  const timeDistributionData = Object.entries(timeDist).map(([time, count]) => ({ time, count }));

  // 3. Class Trend (Line Chart)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const classTrendData = last7Days.map(date => {
    const dSubs = submissions.filter(s => s.submittedAt.startsWith(date));
    const dTrks = trackings.filter(t => t.submittedAt.startsWith(date));
    
    const scores = { Vocab: [] as number[], Grammar: [] as number[], Reading: [] as number[], Listening: [] as number[], Writing: [] as number[] };
    dSubs.forEach(s => {
      if (s.assignmentType === 'vocab_context') scores.Vocab.push(s.score);
      else if (s.assignmentType === 'multiple_choice') scores.Grammar.push(s.score);
      else if (s.assignmentType === 'rewrite_vocab') scores.Writing.push(s.score);
    });
    dTrks.forEach(t => {
      if (t.category === 'Vocabulary') scores.Vocab.push(t.score);
      else if (t.category === 'Grammar') scores.Grammar.push(t.score);
      else if (t.category === 'Reading') scores.Reading.push(t.score);
      else if (t.category === 'Dictation' || t.category === 'Listening') scores.Listening.push(t.score);
      else if (t.category === 'Writing') scores.Writing.push(t.score);
    });
    
    const average = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
    return {
      date: date.slice(5),
      Vocab: average(scores.Vocab),
      Grammar: average(scores.Grammar),
      Reading: average(scores.Reading),
      Listening: average(scores.Listening),
      Writing: average(scores.Writing),
    };
  });

  // 4. Actionable Insights
  const insights: string[] = [];
  if (classTrendData.length >= 2) {
    const firstDay = classTrendData[0];
    const lastDay = classTrendData[classTrendData.length - 1];
    const skills = ['Vocab', 'Grammar', 'Reading', 'Listening', 'Writing'];
    const skillNames: any = { Vocab: 'Từ vựng', Grammar: 'Ngữ pháp', Reading: 'Đọc hiểu', Listening: 'Nghe chép', Writing: 'Viết' };
    
    skills.forEach(skill => {
      const start = (firstDay as any)[skill];
      const end = (lastDay as any)[skill];
      if (start !== null && end !== null) {
        if (end - start <= -15) {
          insights.push(`🚨 Kỹ năng ${skillNames[skill]} đang giảm mạnh (${end - start} điểm) so với 7 ngày trước. Khuyến nghị giao thêm bài tập loại này!`);
        } else if (end - start >= 15) {
          insights.push(`🌟 Lớp học đang có sự tiến bộ vượt bậc ở kỹ năng ${skillNames[skill]} (+${end - start} điểm).`);
        }
      }
    });
  }
  if (insights.length === 0) insights.push('Lớp học đang duy trì phong độ ổn định ở mọi kỹ năng.');

  const now = Date.now();
  const timeAgo = (iso: string) => {
    const diff = now - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Vừa xong';
    if (h < 1) return `${m} phút trước`;
    if (h < 24) return `${h} giờ trước`;
    return `${Math.floor(h / 24)} ngày trước`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background p-6 rounded-2xl border border-white/10 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-foreground">{confirmDialog.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors text-foreground">Hủy</button>
              <button onClick={confirmDialog.action} className="px-4 py-2 rounded-lg font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {addStudentDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background p-6 rounded-2xl border border-white/10 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-foreground">Thêm Học Viên Mới</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tên Học Viên</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={e => setNewStudent(s => ({ ...s, name: e.target.value }))}
                  className="input-field w-full"
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Màu Sắc (Hex)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/i.test(newStudent.color) ? newStudent.color : '#000000'}
                    onChange={e => setNewStudent(s => ({ ...s, color: e.target.value }))}
                    className="h-10 w-10 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={newStudent.color}
                    onChange={e => setNewStudent(s => ({ ...s, color: e.target.value }))}
                    className="input-field flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddStudentDialog(false)} className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors text-foreground">Hủy</button>
              <button onClick={handleAddStudent} className="px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Thêm Mới</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="fade-in stagger-1">
          <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-3">
            Dashboard Giáo Viên
            {isSyncing && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý lớp học và theo dõi tiến độ thi đua</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <button
            type="button"
            onClick={() => { setIsSyncing(true); refreshData(); }}
            disabled={isSyncing}
            className="fade-in stagger-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-semibold border border-primary/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Đồng bộ
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClearAllData(); }}
            className="fade-in stagger-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-semibold border border-red-500/20"
          >
            <Trash2 className="h-4 w-4 pointer-events-none" /> Xóa tất cả dữ liệu
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddStudentDialog(true); }}
            className="fade-in stagger-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors text-sm font-semibold border border-emerald-500/20"
          >
            <Users className="h-4 w-4 pointer-events-none" /> Thêm Học Viên
          </button>
          <div className="fade-in stagger-1 flex items-center gap-2 bg-secondary/50 p-2 rounded-xl border border-white/5">
            <span className="text-sm font-medium text-muted-foreground ml-2">Chọn ngày:</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value || new Date().toISOString().split('T')[0])}
              max={new Date().toISOString().split('T')[0]}
              className="input-field text-sm py-1.5 px-3 w-auto"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in stagger-2">
        {[
          { label: 'Học Viên', value: totalStudents, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
          { label: 'Bài Tập', value: totalAssignments, icon: BookOpen, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
          { label: 'Điểm TB', value: avgScore > 0 ? `${avgScore}đ` : '—', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Nộp Hôm Nay', value: completedToday, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`glass hover-lift rounded-2xl p-5 border ${border}`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">{label}</p>
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold font-heading ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex border-b border-white/10 gap-6 fade-in stagger-3">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'overview' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          Tổng Quan Lớp Học
        </button>
        <button 
          onClick={() => setActiveTab('analytics')} 
          className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'analytics' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          Phân Tích Chuyên Sâu
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6 fade-in stagger-4">
          {/* Star of the day */}
          {starOfTheDay && (
            <div className="glass-strong rounded-3xl p-6 border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Trophy className="w-24 h-24 text-amber-500" />
              </div>
              <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-2"><Flame className="w-5 h-5"/> Ngôi Sao Trong Ngày</h3>
              <p className="text-sm text-muted-foreground mb-4">Học viên có thành tích xuất sắc nhất hôm nay</p>
              <div className="flex items-center gap-4">
                <StudentAvatar name={starOfTheDay.name} />
                <div>
                  <p className="text-xl font-bold">{starOfTheDay.name}</p>
                  <p className="text-sm text-muted-foreground">Điểm trung bình: <span className="text-emerald-400 font-bold">{starOfTheDay.avg}đ</span> • Đã nộp {starOfTheDay.count} bài</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Student Leaderboard */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Bảng Xếp Hạng Thi Đua
          </h2>
          <div className="glass-strong rounded-3xl p-6">
            <div className="space-y-4">
              {studentStats.map((s, idx) => (
                <div 
                  key={s.name} 
                  className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/60 transition-colors border border-white/5 cursor-default group"
                >
                  {/* Rank */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    idx === 1 ? 'bg-slate-400/20 text-slate-400 border border-slate-400/30' :
                    idx === 2 ? 'bg-orange-700/20 text-orange-600 border border-orange-700/30' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>

                  <StudentAvatar name={s.name} />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.submissionCount} bài tập, {s.trackingCount} báo cáo</p>
                  </div>

                  {s.profile && s.profile.streakCount > 0 && (
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="text-xs font-bold text-orange-400">{s.profile.streakCount}</span>
                    </div>
                  )}
                  {s.profile && s.profile.badges.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-secondary/30 border border-white/5">
                      <Trophy className="h-3 w-3 text-amber-400" />
                      <span className="text-xs font-bold">{s.profile.badges.length}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {s.avg !== null ? (
                      <ScoreBadge score={s.avg} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Chưa làm</span>
                    )}
                    {s.trend === 'up'   && <TrendingUp className="h-4 w-4 text-emerald-400" />}
                    {s.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-400" />}
                    {s.trend === 'same' && <Minus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-400" />
              Bài Tập Đã Giao
            </h2>
            <div className="flex items-center gap-2">
              <Link href="/teacher/scores"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/10 transition-colors text-xs font-semibold">
                <Settings className="h-3.5 w-3.5" /> Quản lý điểm
              </Link>
              <Link href="/teacher/assignments/new"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-xs font-semibold">
                <PlusCircle className="h-3.5 w-3.5" /> Thêm
              </Link>
            </div>
          </div>
          <div className="glass-strong rounded-3xl p-6 h-[400px] flex flex-col">
            {assignments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Chưa có bài tập</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {assignments.map(a => {
                  const subs = submissions.filter(s => s.assignmentId === a.id);
                  const avg = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-4 rounded-2xl bg-secondary/30 border border-white/5 group hover:bg-secondary/60 transition-colors">
                      <div className={`p-2.5 rounded-xl ${
                        a.type === 'vocab_context' ? 'bg-violet-500/10 text-violet-400' : 
                        a.type === 'multiple_choice' ? 'bg-teal-500/10 text-teal-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                      {a.type === 'vocab_context' ? <BookOpen className="h-4 w-4" /> : 
                       a.type === 'multiple_choice' ? <ListChecks className="h-4 w-4" /> :
                       <PenTool className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span className={`px-1.5 py-0.5 rounded-md font-medium ${
                          a.type === 'vocab_context' ? 'bg-violet-500/10 text-violet-300' : 
                          a.type === 'multiple_choice' ? 'bg-teal-500/10 text-teal-300' :
                          'bg-amber-500/10 text-amber-300'
                        }`}>
                          {a.type === 'vocab_context' ? 'Vocab' : 
                           a.type === 'multiple_choice' ? 'Quiz' : 'Viết'}
                        </span>
                        <span>•</span>
                        <span>
                          {a.type === 'vocab_context' ? `${a.keywords?.length || 0} từ khóa` : 
                           a.type === 'multiple_choice' ? `${a.questions?.length || 0} câu hỏi` :
                           `${a.keywords?.length || 0} từ khóa`}
                        </span>
                        {avg !== null && <ScoreBadge score={avg} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {a.type === 'multiple_choice' && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleHint(a); }}
                          className={`p-1.5 rounded-lg transition-colors relative z-10 flex items-center gap-1 px-2 ${
                            a.allowHints 
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                              : 'text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-500/10'
                          }`}
                          title={a.allowHints ? "Tắt gợi ý" : "Bật gợi ý"}
                        >
                          <Lightbulb className="h-4 w-4 pointer-events-none" />
                          <span className="text-[10px] font-semibold">{a.allowHints ? 'Bật' : 'Tắt'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShareAssignment(a); }}
                        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-blue-400 hover:bg-blue-500/10 transition-colors relative z-10"
                        title="Chia sẻ bài tập"
                      >
                        <Share2 className="h-4 w-4 pointer-events-none" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(a.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors relative z-10"
                        title="Xóa bài tập"
                      >
                        <Trash2 className="h-4 w-4 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <div className="glass-strong rounded-3xl border border-white/5 overflow-hidden fade-in stagger-4">
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="font-semibold font-heading flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-400" />
              Hoạt Động Gần Đây
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-medium">Học viên</th>
                  <th className="px-6 py-3 text-left font-medium">Nội dung</th>
                  <th className="px-6 py-3 text-left font-medium">Loại</th>
                  <th className="px-6 py-3 text-center font-medium">Điểm</th>
                  <th className="px-6 py-3 text-right font-medium">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {recentActivities.map((act: any) => (
                  <tr key={act.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar name={act.studentName} size="sm" />
                        <span className="font-medium">{act.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground max-w-[200px] truncate">
                      {act.isTracking ? 'Báo cáo: ' + act.category : act.assignmentTitle}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                          act.isTracking ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                          act.assignmentType === 'vocab_context' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 
                          act.assignmentType === 'multiple_choice' ? 'bg-teal-500/10 text-teal-300 border-teal-500/20' :
                          'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          {act.isTracking ? <Target className="h-3 w-3" /> :
                           act.assignmentType === 'vocab_context' ? <BookOpen className="h-3 w-3" /> : 
                           act.assignmentType === 'multiple_choice' ? <ListChecks className="h-3 w-3" /> :
                           <PenTool className="h-3 w-3" />}
                          {act.isTracking ? act.category :
                           act.assignmentType === 'vocab_context' ? 'Vocab' : 
                           act.assignmentType === 'multiple_choice' ? 'Quiz' : 'Viết'}
                        </span>
                    </td>
                    <td className="px-6 py-3 text-center"><ScoreBadge score={act.score} /></td>
                    <td className="px-6 py-3 text-right text-muted-foreground text-xs whitespace-nowrap">{timeAgo(act.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      ) : (
        <div className="space-y-6 fade-in stagger-4">
          {/* Actionable Insights */}
          <div className="glass-strong rounded-3xl p-6 border border-primary/20 bg-primary/5">
            <h3 className="font-semibold font-heading flex items-center gap-2 mb-4 text-primary">
              <Target className="h-5 w-5" /> Thông Tin Biết Nói (Insights)
            </h3>
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                  <span className="text-lg mt-0.5">{insight.startsWith('🚨') ? '🚨' : insight.startsWith('🌟') ? '🌟' : '💡'}</span>
                  <p className="text-sm font-medium leading-relaxed">{insight.replace(/^[🚨🌟💡]\s*/, '')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class Trend Line Chart */}
            <div className="glass-strong rounded-3xl p-6 border border-white/5 lg:col-span-2">
              <h3 className="font-semibold font-heading flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-emerald-400" /> Xu Hướng Kỹ Năng Lớp Học (7 Ngày)
              </h3>
              <div className="w-full h-[300px] min-h-[300px]">
                <ResponsiveContainer width="99%" height="100%">
                  <LineChart data={classTrendData}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="Vocab" name="Từ vựng" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Grammar" name="Ngữ pháp" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Reading" name="Đọc hiểu" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Listening" name="Nghe chép" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Writing" name="Viết" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time Distribution Chart */}
            <div className="glass-strong rounded-3xl p-6 border border-white/5">
              <h3 className="font-semibold font-heading flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-violet-400" /> Thời Gian Nộp Bài
              </h3>
              <div className="w-full h-[250px] min-h-[250px]">
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart data={timeDistributionData}>
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                    <Bar dataKey="count" name="Số bài nộp" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {timeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          index === 0 ? '#60a5fa' : 
                          index === 1 ? '#fbbf24' : 
                          index === 2 ? '#a78bfa' : '#475569'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar summary */}
            <div className="glass-strong rounded-3xl p-6 border border-white/5 flex flex-col items-center">
              <h3 className="font-semibold font-heading flex items-center gap-2 mb-2 w-full">
                <Trophy className="h-5 w-5 text-amber-400" /> Năng Lực Trung Bình
              </h3>
              <p className="text-sm text-muted-foreground mb-4 w-full text-left">Phân bổ điểm số theo 5 kỹ năng của toàn bộ lớp học</p>
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="99%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                    { subject: 'Từ vựng', A: classTrendData.length ? classTrendData[classTrendData.length-1].Vocab : 0, fullMark: 100 },
                    { subject: 'Ngữ pháp', A: classTrendData.length ? classTrendData[classTrendData.length-1].Grammar : 0, fullMark: 100 },
                    { subject: 'Đọc hiểu', A: classTrendData.length ? classTrendData[classTrendData.length-1].Reading : 0, fullMark: 100 },
                    { subject: 'Nghe chép', A: classTrendData.length ? classTrendData[classTrendData.length-1].Listening : 0, fullMark: 100 },
                    { subject: 'Viết', A: classTrendData.length ? classTrendData[classTrendData.length-1].Writing : 0, fullMark: 100 },
                  ]}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Kỹ năng" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
