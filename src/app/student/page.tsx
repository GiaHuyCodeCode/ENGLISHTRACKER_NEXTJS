'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAssignments, seedIfEmpty, getDailyTrackings, getSubmissions,
  getStudentNames, getStudentColors, getStudentAvatar,
  Submission, Assignment, DailyTracking,
  getGamificationProfiles, GamificationProfile, getBadges,
  getVocabularyCards, getStudentVocabProgress, syncAllFromCloud, STAGE_CONFIG,
  autoSyncAllSpacedRepetition
} from '@/lib/local-store';

import { StudentPerformanceChart } from '@/components/ui/StudentPerformanceChart';
import { toLocalDateString } from '@/lib/utils';
// 🌸 Flower Icon System — replaces Lucide
type SvgIconProps = { className?: string; strokeWidth?: number | string };
const FTrophy   = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4c-2 3-3 6 0 8c3-2 2-5 0-8z" fill="currentColor" fillOpacity="0.13"/><path d="M12 4c-2 3-3 6 0 8c3-2 2-5 0-8z"/><path d="M6 8c1.5 1.5 3.5 3 6 4c0-2.5-1.5-4.5-6-4z" fill="currentColor" fillOpacity="0.09"/><path d="M6 8c1.5 1.5 3.5 3 6 4c0-2.5-1.5-4.5-6-4z"/><path d="M18 8c-1.5 1.5-3.5 3-6 4c0-2.5 1.5-4.5 6-4z" fill="currentColor" fillOpacity="0.09"/><path d="M18 8c-1.5 1.5-3.5 3-6 4c0-2.5 1.5-4.5 6-4z"/><circle cx="12" cy="12" r="1.3" fill="currentColor" opacity="0.65" stroke="none"/><path d="M12 13.5V19M9 19h6"/></svg>;
const FBook     = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 7C9 7 11 6 13 7C11 8 9 7 9 7Z" fill="currentColor" opacity="0.4" stroke="none"/><path d="M9 11c1-.5 2.5-.5 3.5 0" strokeWidth="1.1" opacity="0.38"/><path d="M9 14c1-.4 2.5-.4 3.5 0" strokeWidth="1.1" opacity="0.28"/></svg>;
const FCheck    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21" strokeWidth="1" opacity="0.3"/><circle cx="12" cy="7" r="0.9" fill="currentColor" opacity="0.4" stroke="none"/></svg>;
const FTrend    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/><path d="M13.5 15.5c-.4-.7-.4-1.5 0-2.2" strokeWidth="1.1" opacity="0.5"/><path d="M8.5 10.5c-.4-.7-.4-1.5 0-2.2" strokeWidth="1.1" opacity="0.4"/><circle cx="23" cy="6" r="1" fill="currentColor" opacity="0.45" stroke="none"/></svg>;
const FUser     = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c-2 0-3.2 1.5-3.2 3.5S10 9 12 9s3.2-1.7 3.2-3.5S14 2 12 2z" fill="currentColor" fillOpacity="0.1"/><path d="M12 2c-2 0-3.2 1.5-3.2 3.5S10 9 12 9s3.2-1.7 3.2-3.5S14 2 12 2z"/><path d="M9.5 3C9 2 9.2 1.2 10 1M14.5 3C15 2 14.8 1.2 14 1" strokeWidth="1.1" opacity="0.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="12" cy="6" r="0.9" fill="currentColor" opacity="0.3" stroke="none"/></svg>;
const FTarget   = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.18"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" strokeWidth="1.1" opacity="0.38"/></svg>;
const FBrain    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v6M10 18c-2 .8-4 .6-6 0M14 18c2 .8 4 .6 6 0"/><circle cx="12" cy="10" r="2.5"/><path d="M12 7.5V5M8.5 8.8L6.5 6.5M15.5 8.8L17.5 6.5M7.5 11L5 11.8M16.5 11L19 11.8M9 13.5L7 15.5M15 13.5L17 15.5"/><circle cx="12" cy="5" r="0.9" fill="currentColor" opacity="0.55" stroke="none"/><circle cx="6.5" cy="6.5" r="0.7" fill="currentColor" opacity="0.4" stroke="none"/><circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" opacity="0.4" stroke="none"/><circle cx="5" cy="11.8" r="0.7" fill="currentColor" opacity="0.4" stroke="none"/><circle cx="19" cy="11.8" r="0.7" fill="currentColor" opacity="0.4" stroke="none"/><circle cx="7" cy="15.5" r="0.7" fill="currentColor" opacity="0.35" stroke="none"/><circle cx="17" cy="15.5" r="0.7" fill="currentColor" opacity="0.35" stroke="none"/></svg>;
const FAlert    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-2 1-3 3-2.5 5.5L12 10l2.5-1.5C15 6 14 4 12 3z" fill="currentColor" fillOpacity="0.1"/><path d="M12 3c-2 1-3 3-2.5 5.5L12 10l2.5-1.5C15 6 14 4 12 3z"/><path d="M9.5 8.5c-1.5 1-2 3-.5 4.5M14.5 8.5c1.5 1 2 3 .5 4.5"/><path d="M9 13c.5 2.5 1.2 4.5 3 6M15 13c-.5 2.5-1.2 4.5-3 6"/><circle cx="12" cy="21" r="1.2" fill="currentColor" opacity="0.65" stroke="none"/></svg>;
const FFlame    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-2.5 3-3 6.5-2.5 9A2.5 2.5 0 0012 14.5a2.5 2.5 0 002.5-2.5C15 9.5 14.5 6 12 3z" fill="currentColor" fillOpacity="0.12"/><path d="M12 3c-2.5 3-3 6.5-2.5 9A2.5 2.5 0 0012 14.5a2.5 2.5 0 002.5-2.5C15 9.5 14.5 6 12 3z"/><path d="M9 7c-1.5 1.5-2 3.5-1 5.5" opacity="0.5" strokeWidth="1.2"/><path d="M12 16v3M9.5 19h5"/></svg>;
const FCalendar = ({className=""}: SvgIconProps) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2.2" fill="currentColor" fillOpacity="0.09" stroke="none"/><path d="M12 13.8v0.8M12 17.4v.8M10.3 16h.7M13 16h.7" strokeWidth="1.05" opacity="0.5"/><circle cx="12" cy="16" r="1.1" fill="currentColor" opacity="0.55" stroke="none"/></svg>;
const FClock    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5"/><polyline points="12 7 12 12 15.5 13.5"/><path d="M12 2.5v1.5M12 20v1.5M21.5 12h-1.5M3.5 12h1.5M18.4 5.6l-1 1M6.6 17.4l-1 1M18.4 18.4l-1-1M6.6 6.6l-1 1" strokeWidth="1.1" opacity="0.38"/><circle cx="12" cy="12" r="1.2" fill="currentColor" opacity="0.5" stroke="none"/></svg>;
const FLoader   = ({className=""}: SvgIconProps) => <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeOpacity="0.25"/><path d="M12 3a9 9 0 019 9"/></svg>;
const FRefresh  = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/><circle cx="12" cy="12" r="1.2" fill="currentColor" opacity="0.45" stroke="none"/></svg>;
// Navigation & UI icons
const FChevronRight = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6c3 2.2 5 4 6 6c-1 2-3 3.8-6 6"/></svg>;
const FListChecks   = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>;
const FHeadphones   = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/><path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/><circle cx="12" cy="8" r="1" fill="currentColor" fillOpacity="0.35" stroke="none"/><path d="M12 6.5v1.3M11.2 7.1l.8.6M12.8 7.1l-.8.6" strokeWidth="1" opacity="0.4"/></svg>;

function getShortTitle(title: string): string {
  const t = title.trim();
  const lower = t.toLowerCase();
  
  if (lower.includes('tân bình xuất sắc') || lower.includes('tân binh xuất sắc')) {
    return 'Tân Binh XS';
  }
  if (lower.includes('học tập chăm chỉ')) {
    return 'Chăm Chỉ';
  }
  if (lower.includes('thành viên tích cực')) {
    return 'Tích Cực';
  }
  if (lower.includes('chiến thần từ vựng')) {
    return 'Chiến Thần';
  }
  if (lower.includes('ông hoàng chăm chỉ')) {
    return 'Chăm Chỉ';
  }
  if (lower.includes('thành tích xuất sắc')) {
    return 'Xuất Sắc';
  }
  if (lower.includes('spaced repetition')) {
    return 'Ôn Tập';
  }
  if (lower.includes('điểm trung bình')) {
    return 'Điểm TB';
  }
  if (lower.includes('đã hoàn thành')) {
    return 'Hoàn Thành';
  }
  
  const words = t.split(/\s+/);
  if (words.length > 3) {
    if (lower.startsWith('huy hiệu ')) {
      return getShortTitle(t.substring(9));
    }
    return words.slice(0, 3).join(' ');
  }
  return t;
}
const FFileJson     = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12a1 1 0 00-1 1v1a1 1 0 01-1 1 1 1 0 011 1v1a1 1 0 001 1"/><path d="M14 18a1 1 0 001-1v-1a1 1 0 011-1 1 1 0 01-1-1v-1a1 1 0 00-1-1"/></svg>;
const FPenTool      = ({className=""}: SvgIconProps) => <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="1.9" fill="currentColor" fillOpacity="0.12"/><circle cx="11" cy="11" r="1.9"/></svg>;
// Flower petal icon for "bloom" effect
const FBloom    = ({className=""}: SvgIconProps) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><ellipse cx="12" cy="5.5" rx="2" ry="3.5"/><ellipse cx="12" cy="5.5" rx="2" ry="3.5" transform="rotate(72 12 12)"/><ellipse cx="12" cy="5.5" rx="2" ry="3.5" transform="rotate(144 12 12)"/><ellipse cx="12" cy="5.5" rx="2" ry="3.5" transform="rotate(216 12 12)"/><ellipse cx="12" cy="5.5" rx="2" ry="3.5" transform="rotate(288 12 12)"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" stroke="none"/></svg>;
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

function StudentCard({ name, isSelected, onClick }: { name: string; isSelected: boolean; onClick: () => void }) {
  const c = getStudentColors(name);
  const subs = getSubmissions().filter(s => s.id && s.studentName === name && Number(s.durationMs) > 0);
  const avg = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;
  const profile = getGamificationProfiles().find(p => p.studentName === name);

  return (
    <button onClick={onClick}
      className={`glass hover-lift rounded-2xl p-5 text-left border-2 transition-all w-full ${isSelected ? `${c.border} ${c.bg}` : 'border-border hover:border-primary/30'
        }`}>
      <div className={`w-12 h-12 ${c.bg} ${c.text} border ${c.border} rounded-xl flex items-center justify-center text-lg font-bold mb-3`}>
        {getStudentAvatar(name)}
      </div>
      <p className={`font-semibold text-sm truncate w-full ${isSelected ? c.text : ''}`} title={name}>{name}</p>
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
    // Lấy TẤT CẢ submissions hợp lệ — kể cả bài sync từ cloud (durationMs=0)
    // Dùng để xác định "Đã Hoàn Thành" và "Cần Làm"
    const subs = getSubmissions().filter(s => s.id && s.studentName === student && s.assignmentType !== 'repetition').sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    const trks = getDailyTrackings().filter(t => t.studentName === student).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    setSubmissions(subs);
    setTrackings(trks);
    setProfile(getGamificationProfiles().find(p => p.studentName === student) || null);

    // Get all unique vocabulary cards (base + assignments)
    const baseCards = getVocabularyCards();
    const assignCards = getAssignments().filter(a => a.type === 'vocabulary').flatMap(a => a.vocabCards || []);
    const totalCardsMap = new Map<string, any>();
    baseCards.forEach(c => {
      const normId = c.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      totalCardsMap.set(normId, { ...c, id: normId });
    });
    assignCards.forEach(c => {
      const normId = c.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      totalCardsMap.set(normId, { ...c, id: normId });
    });
    const allCards = Array.from(totalCardsMap.values());

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

    const activeProgress = studentProgress.filter(p => cardMap.has(p.wordId));

    // 1. Total learned cards
    setTotalLearnedCount(activeProgress.length);

    // 2. Mastered count (Stage 6)
    const mastered = activeProgress.filter(p => p.stage === 6).length;
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

    const avgRet = activeProgress.length ? Math.round(totalRetention / activeProgress.length) : 100;
    setAverageRetention(avgRet);
    setDueVocabList(dueList.sort((a, b) => b.overdueDays - a.overdueDays));

    // 4. Forgetting Curve Prediction (Next 10 Days)
    const curvePoints = Array.from({ length: 11 }, (_, i) => {
      if (activeProgress.length === 0) {
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

    submissions.filter(s => s.id && Number(s.durationMs) > 0).forEach(s => {
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

    allSubmissions.filter(s => s.id && Number(s.durationMs) > 0).forEach(s => {
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

  const totalScores = [...submissions.filter(s => s.id && Number(s.durationMs) > 0).map(s => s.score)];
  const avg = totalScores.length ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length) : null;
  const nowVal = new Date();
  const visibleAssignments = assignments.filter(a => {
    if (a.type === 'repetition') return false; // Không tính bài ôn tập vào số bài tập chính thức
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
  const allSubmissions = getSubmissions().filter(s => s.id && s.assignmentType !== 'repetition' && Number(s.durationMs) > 0);
  const allTrackings = getDailyTrackings();
  const allScoresList = [...allSubmissions.map(s => s.score)];
  const classAvg = allScoresList.length ? Math.round(allScoresList.reduce((a, b) => a + b, 0) / allScoresList.length) : null;

  // ── Advanced Analytics Calculation ─────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toLocalDateString(d);
  });

  const progressData = last7Days.map(date => {
    // Student daily score
    const dSubs = submissions.filter(s => s.id && toLocalDateString(s.submittedAt) === date && Number(s.durationMs) > 0);
    const dTrks = trackings.filter(t => toLocalDateString(t.submittedAt) === date);
    const dScores = [...dSubs.map(s => s.score)];
    const myAvg = dScores.length ? Math.round(dScores.reduce((a, b) => a + b, 0) / dScores.length) : null;

    // Class daily score
    const classSubs = allSubmissions.filter(s => toLocalDateString(s.submittedAt) === date);
    const classTrks = allTrackings.filter(t => toLocalDateString(t.submittedAt) === date);
    const classScores = [...classSubs.map(s => s.score)];
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
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">

      {/* ── HERO HEADER ──────────────────────────────────────────────────────── */}
      <div className="glass-strong relative rounded-3xl overflow-hidden fade-in stagger-1"
        style={{
          boxShadow: '0 8px 40px hsl(150 30% 2% / 0.5)',
        }}
      >
        {/* Flower image background — right side */}
        <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
          style={{
            backgroundImage: 'url(/flower-hero.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center left',
            opacity: 0.18,
            maskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, transparent 100%)',
          }}
        />
        {/* Petal glow — desktop: right side / mobile: center bloom */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: [
            'radial-gradient(ellipse 60% 80% at 80% 50%, hsl(340 60% 58% / 0.06) 0%, transparent 70%)',
            'radial-gradient(ellipse 100% 60% at 50% 110%, hsl(340 60% 58% / 0.05) 0%, transparent 60%)',
          ].join(',') }}
        />

        {/* 🌸 Floating petals — ambient floral scatter */}
        {([
          { left:'5%',  top:'15%', r:40,  s:10, c:'hsl(340 60% 68%/0.32)', delay:'0s',   dur:'6.5s' },
          { left:'15%', top:'68%', r:130, s:8,  c:'hsl(340 60% 68%/0.24)', delay:'1.4s', dur:'7.3s' },
          { left:'26%', top:'10%', r:210, s:13, c:'hsl(47 72% 65%/0.18)',  delay:'2.2s', dur:'8.1s' },
          { left:'38%', top:'78%', r:75,  s:7,  c:'hsl(340 60% 68%/0.18)', delay:'0.9s', dur:'9.0s' },
          { left:'52%', top:'22%', r:165, s:9,  c:'hsl(47 72% 65%/0.14)',  delay:'3.1s', dur:'7.6s' },
          { left:'65%', top:'60%', r:250, s:11, c:'hsl(340 60% 68%/0.20)', delay:'1.9s', dur:'6.8s' },
          { left:'78%', top:'18%', r:35,  s:12, c:'hsl(340 60% 68%/0.16)', delay:'4.2s', dur:'8.3s' },
          { left:'88%', top:'72%', r:290, s:8,  c:'hsl(47 72% 65%/0.12)',  delay:'2.7s', dur:'7.0s' },
          { left:'93%', top:'38%', r:110, s:6,  c:'hsl(340 60% 68%/0.18)', delay:'0.4s', dur:'5.8s' },
        ] as const).map((p, i) => (
          <svg key={i} aria-hidden="true" className="petal-drift absolute pointer-events-none select-none"
            style={{ left: p.left, top: p.top, '--petal-delay': p.delay, '--petal-dur': p.dur } as React.CSSProperties}
            width={p.s} height={p.s} viewBox="0 0 24 24" fill={p.c}
          >
            <ellipse cx="12" cy="5.5" rx="3" ry="5" transform={`rotate(${p.r} 12 12)`} />
          </svg>
        ))}

        <div className="relative px-6 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="eyebrow-tag mb-3"><FBloom className="h-3.5 w-3.5 icon-spin-slow" /> Bloom Dashboard</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold gradient-text leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Dashboard Học Viên
              {isSyncing && <FLoader className="inline ml-3 h-6 w-6 text-petal animate-spin" />}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user?.role === 'student' ? 'Tổng quan tiến độ học tập của bạn hôm nay' : 'Chọn tên học viên để xem tiến độ'}
            </p>
          </div>
          <button
            onClick={() => refreshData()}
            disabled={isSyncing}
            className="self-start sm:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.97] text-primary"
            style={{
              background: 'hsl(var(--petal) / 0.12)',
              border: '1px solid hsl(var(--petal) / 0.22)',
            }}
            title="Đồng bộ dữ liệu"
          >
            <FRefresh className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Đồng bộ</span>
          </button>
        </div>
      </div>

      {/* Student Picker (Only for Admin) */}
      {user?.role !== 'student' && (
        <div className="fade-in stagger-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted-foreground">
            <FUser /> Chọn học viên
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {getStudentNames().map(name => (
              <StudentCard key={name} name={name} isSelected={selectedStudent === name} onClick={() => setSelectedStudent(name)} />
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD SECTION */}
      <div className="fade-in stagger-4 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-[hsl(var(--pollen))]">
          <FTrophy /> Biểu Đồ Thi Đua Học Tập
        </h2>
        <StudentPerformanceChart 
          submissions={getSubmissions().filter(s => s.id && s.assignmentType !== 'repetition' && Number(s.durationMs) > 0)} 
          referenceDate={toLocalDateString()} 
        />
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
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/10 border border-orange-500/20 shrink-0">
                      <FFlame className="h-5 w-5 text-orange-600 dark:text-orange-600 dark:text-orange-400 icon-sway" />
                      <div>
                        <p className="text-[10px] text-orange-600/80 dark:text-orange-500/80 uppercase font-semibold leading-none">Streak</p>
                        <p className="text-xs sm:text-sm font-bold text-orange-600 dark:text-orange-600 dark:text-orange-400 mt-0.5 whitespace-nowrap">{profile.streakCount} ngày</p>
                      </div>
                    </div>
                    {profile.badges.slice(0, 2).map(b => {
                      const def = getBadges().find(badge => badge.id === b);
                      return def ? (
                        <div key={b} className={`flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 rounded-xl border shrink-0 ${def.color}`} title={def.description}>
                          <span className="text-lg">{def.icon}</span>
                          <div>
                            <p className="text-[10px] opacity-80 uppercase font-semibold leading-none">Huy Hiệu</p>
                            <p className="text-xs sm:text-sm font-bold truncate max-w-[100px] sm:max-w-none whitespace-nowrap mt-0.5" title={def.title}>
                              <span className="hidden sm:inline">{def.title}</span>
                              <span className="sm:hidden">{getShortTitle(def.title)}</span>
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Điểm Trung Bình', shortLabel: 'Điểm TB', value: avg !== null ? `${avg}đ` : '—', icon: FTrophy, color: 'text-amber-600 dark:text-amber-600 dark:text-amber-400' },
                  { label: 'Đã Hoàn Thành', shortLabel: 'Hoàn Thành', value: `${submissions.length}/${visibleAssignments.length}`, icon: FCheck, color: 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' },
                  { label: 'Cần Làm', shortLabel: 'Cần Làm', value: todo.length, icon: FBook, color: 'text-[#0071e3] dark:text-[#4da3f5]' },
                  { label: 'Thời Gian Học', shortLabel: 'Thời Gian', value: formatTotalTime(totalDurationMs), icon: FClock, color: 'text-violet-600 dark:text-violet-600 dark:text-violet-400' },
                ].map(({ label, shortLabel, value, icon: Icon, color }) => (
                  <div key={label} className="bloom-press text-center p-4 min-h-[80px] rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-1 active:bg-muted/60 transition-colors">
                    <Icon className={`h-5 w-5 ${color} icon-bloom-hover`} />
                    <p className={`text-xl md:text-2xl font-bold font-heading ${color}`}>{value}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{shortLabel}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Spaced Repetition Daily Review Alert Widget */}
            {(() => {
              const todayStr = toLocalDateString(new Date());
              const todayReviewId = `daily-review-${todayStr}`;
              const todayReviewAssign = assignments.find(a => a.id === todayReviewId);
              const isTodayReviewDone = getSubmissions().some(
                s => s.studentName === selectedStudent && s.assignmentId === todayReviewId
              );

              // Kiểm tra xem bài ôn tập hôm nay có thực sự chứa từ vựng đến hạn ôn tập của học sinh hay không
              const studentProgress = getStudentVocabProgress(selectedStudent || '');
              const progressMap = new Map<string, any>();
              studentProgress.forEach(p => progressMap.set(p.wordId, p));
              const now = new Date();

              const hasSRTask = !!todayReviewAssign;
              const hasDueWords = todayReviewAssign
                ? todayReviewAssign.vocabCards?.some(card => {
                    const prog = progressMap.get(card.id);
                    if (!prog) return true; // Chưa từng học -> đến hạn ôn
                    return new Date(prog.nextReviewDate) <= now;
                  })
                : false;

              const isCompleted = isTodayReviewDone || (hasSRTask && !hasDueWords);
              const showActive = hasSRTask && hasDueWords && !isTodayReviewDone;

              let cardBorderClass = "border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-rose-500/5";
              let glowColor = "bg-rose-500/10";
              let iconWrapperClass = "p-3 rounded-2xl bg-rose-500/20 text-rose-500 flex-shrink-0";
              let badgeClass = "bg-rose-500/20 text-rose-500";
              let title = "Đã đến giờ ôn tập từ vựng ngày hôm nay!";
              let titleColor = "text-rose-700 dark:text-rose-400";
              let description = "";

              if (showActive) {
                // Đếm số từ thực sự đến hạn trong bài tập này
                const dueCardsCount = todayReviewAssign.vocabCards?.filter(card => {
                  const prog = progressMap.get(card.id);
                  if (!prog) return true;
                  return new Date(prog.nextReviewDate) <= now;
                }).length || 0;
                description = `Bạn có ${dueCardsCount} từ vựng cần nhắc lại để đưa vào bộ nhớ dài hạn.`;
              } else if (isCompleted) {
                cardBorderClass = "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/5";
                glowColor = "bg-emerald-500/10";
                iconWrapperClass = "p-3 rounded-2xl bg-emerald-500/20 text-emerald-500 flex-shrink-0";
                badgeClass = "bg-emerald-500/20 text-emerald-500";
                title = "Đã hoàn thành ôn tập từ vựng ngày hôm nay!";
                titleColor = "text-emerald-700 dark:text-emerald-400";
                description = "Tuyệt vời! Bạn đã hoàn thành việc ôn tập từ vựng hôm nay.";
              } else {
                cardBorderClass = "border-border bg-gradient-to-r from-card/50 via-muted/5 to-card/50";
                glowColor = "bg-muted/10";
                iconWrapperClass = "p-3 rounded-2xl bg-muted/20 text-muted-foreground flex-shrink-0";
                badgeClass = "bg-muted/20 text-muted-foreground";
                title = "Không có lịch ôn tập từ vựng hôm nay";
                titleColor = "text-muted-foreground";
                description = "Hôm nay bạn không có từ vựng nào đến hạn ôn tập. Hãy học thêm bài mới nhé!";
              }

              return (
                <div className={`relative overflow-hidden rounded-3xl border ${cardBorderClass} p-6 shadow-lg`}>
                  <div className={`absolute -right-6 -top-6 w-24 h-24 ${glowColor} rounded-full blur-xl pointer-events-none`}></div>
                  <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={iconWrapperClass}>
                        <FBrain className="h-6 w-6" />
                      </div>
                      <div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${badgeClass}`}>
                          Spaced Repetition
                        </span>
                        <h3 className={`text-lg font-bold mt-1 ${titleColor}`}>
                          {title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {showActive ? (
                            <>Bạn có <span className="font-bold text-rose-600 dark:text-rose-400">{todayReviewAssign.vocabCards?.length || 0} từ vựng</span> cần nhắc lại để đưa vào bộ nhớ dài hạn.</>
                          ) : (
                            description
                          )}
                        </p>
                      </div>
                    </div>
                    {showActive ? (
                      <Link 
                        href={`/student/vocabulary?assignId=${todayReviewAssign.id}&srs=true`}
                        className="self-end sm:self-center px-5 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-md shadow-rose-500/20 transition-all hover:scale-[1.03] active:scale-[0.98] text-center shrink-0 min-w-[130px]"
                      >
                        Bắt đầu ôn ngay
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="self-end sm:self-center px-5 py-3 rounded-2xl text-sm font-bold bg-neutral-700/30 dark:bg-neutral-800/50 text-neutral-400 border border-neutral-600/20 cursor-not-allowed text-center shrink-0 min-w-[130px]"
                      >
                        Hoàn thành
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TABS */}
            <div className="flex border-b border-border gap-6 fade-in stagger-4">
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
                      <FBrain className="h-5 w-5 text-primary" /> Phân Tích Kỹ Năng
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
                        <FBrain className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Chưa có đủ dữ liệu</p>
                      </div>
                    )}
                  </div>

                  <div className="glass-strong rounded-3xl border border-white/5 p-6 flex flex-col">
                    <h3 className="font-semibold font-heading flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-600 dark:text-amber-400">
                      <FAlert className="h-5 w-5" /> Cẩm Nang Học Tập
                    </h3>
                    {weakestSkill ? (
                      <div className="flex-1 space-y-4">
                        <p className="text-sm text-foreground">
                          Dựa trên dữ liệu, kỹ năng <span className="font-bold text-amber-600 dark:text-amber-600 dark:text-amber-400">{weakestSkill.subject}</span> của bạn hiện đang cần được cải thiện nhất (Điểm trung bình: <span className="font-bold text-amber-600 dark:text-amber-600 dark:text-amber-400">{weakestSkill.A}</span>).
                        </p>
                        <div className="p-4 rounded-2xl bg-muted/40 border border-border">
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
                  <h3 className="font-semibold font-heading text-lg flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-600 dark:text-emerald-400">
                    <FTarget className="h-5 w-5" /> So Sánh Cùng Lớp Học
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
                      <div className="flex flex-col items-center justify-center p-6 bg-muted/30 border border-border rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-muted/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2 z-10">Trung Bình Lớp</p>
                        <p className="text-5xl font-bold text-foreground font-heading z-10">{classAvg !== null ? classAvg : '—'}</p>
                      </div>
                    </div>

                    {/* Feedback Message */}
                    {avg !== null && classAvg !== null && (
                      <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${avg >= classAvg
                          ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-600 dark:text-amber-400'
                        }`}>
                        {avg >= classAvg ? <FTrophy className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <FTrend className="h-5 w-5 flex-shrink-0 mt-0.5" />}
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
                      <div className="mt-6 pt-6 border-t border-border">
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
                      <FTrend className="h-5 w-5 text-emerald-600 dark:text-emerald-600 dark:text-emerald-400" /> Tiến Độ Học Tập (7 Ngày)
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
                      <FFlame className="h-5 w-5 text-orange-600 dark:text-orange-400" /> Sự Chăm Chỉ (Số Bài Nộp)
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
                      <FBrain className="h-5 w-5 text-violet-600 dark:text-violet-600 dark:text-violet-400" /> Mức Độ Phân Bổ Kỹ Năng
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
                        <FBook className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Chưa có bài làm nào để phân tích thói quen.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}


            {/* Recent submissions */}
            {submissions.length > 0 && (
              <div className="fade-in stagger-4">
                <h2 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
                  <FTrend className="h-4 w-4 text-violet-600 dark:text-violet-600 dark:text-violet-400" />
                  Lịch Sử Bài Làm
                </h2>
                <div className="glass-strong rounded-3xl border border-white/5 overflow-hidden">
                  <div className="divide-y divide-border">
                    {submissions.filter(s => s.id && Number(s.durationMs) > 0).slice(0, 5).map(s => {
                      const href = `/student/review/${s.id}`;
                      return (
                        <Link key={s.id} href={href} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors cursor-pointer group w-full">
                          <div className={`p-2 rounded-lg ${
                            s.assignmentType === 'vocab_context' ? 'bg-violet-500/10 dark:bg-violet-500/10' :
                            s.assignmentType === 'multiple_choice' ? 'bg-teal-500/10 dark:bg-teal-500/10' :
                            s.assignmentType === 'dictation' ? 'bg-sky-500/10 dark:bg-sky-500/10' :
                            s.assignmentType === 'vocabulary' ? 'bg-indigo-500/10 dark:bg-indigo-500/10' :
                            'bg-amber-500/10 dark:bg-amber-500/10'
                          }`}>
                            {s.assignmentType === 'vocab_context' ? <FBook className="h-4 w-4 text-violet-600 dark:text-violet-600 dark:text-violet-400" /> :
                             s.assignmentType === 'multiple_choice' ? <FListChecks className="h-4 w-4 text-teal-600 dark:text-teal-600 dark:text-teal-400" /> :
                             s.assignmentType === 'dictation' ? <FHeadphones className="h-4 w-4 text-sky-600 dark:text-sky-600 dark:text-sky-400" /> :
                             s.assignmentType === 'vocabulary' ? <FFileJson className="h-4 w-4 text-indigo-600 dark:text-indigo-600 dark:text-indigo-400" /> :
                             <FPenTool className="h-4 w-4 text-amber-600 dark:text-amber-600 dark:text-amber-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{s.assignmentTitle}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{new Date(s.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              {s.durationMs && (
                                <span className="text-[10px] text-sky-600 dark:text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                                  • <FClock className="w-3 h-3" /> {formatDuration(s.durationMs)}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full border text-sm font-bold ${s.score >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : s.score >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/15 text-red-700 dark:text-red-600 dark:text-red-400 border-red-500/30'
                              }`}>
                              {s.score}/100
                            </span>
                            <FChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}


          </div>
        );
      })()}
    </div>
  );
}
