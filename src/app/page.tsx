'use client';

import { useEffect, useState } from 'react';
import {
  getAssignments, getSubmissions, getDailyTrackings, deleteAssignment,
  updateSubmissionScore, updateTrackingScore, deleteSubmission, deleteTracking, clearAllData,
  Assignment, Submission, DailyTracking, getStudentNames, getStudentColors, getStudentAvatar,
  seedIfEmpty, getGamificationProfiles, getBadges, GamificationProfile, importAssignment, updateAssignment, syncAllFromCloud, createStudent,
  getVocabularyCards, getVocabProgressList, saveVocabProgressList, saveVocabularyCards, VocabCard,
  importExternalVocabWithProgress, STAGE_CONFIG, autoSyncAllSpacedRepetition, autoSubmitPreviousStagesLocal, syncPastReviewAssignments,
  previewSRGeneration, SRPreviewResult, getCalculatedStage, syncVocabProgressFromAssignments,
  saveSubmissions,
} from '@/lib/local-store';
import { syncVocabListToSheet, syncActionToSheet } from '@/lib/google-sheets';
import { StudentPerformanceChart } from '@/components/ui/StudentPerformanceChart';
import { StudentTimeChart } from '@/components/ui/StudentTimeChart';
import { toLocalDateString, toLocal2359ISOString } from '@/lib/utils';
import {
  Users, BookOpen, Clock, Target, Edit2, Save, X, XCircle,
  Trophy, CheckCircle2, TrendingUp, ListChecks, PenTool, TrendingDown, Minus, PlusCircle, Trash2, Flame, Share2, Lightbulb, Settings, Loader2, RefreshCw, FileJson, Volume2, Headphones, Calendar, Mic, Lock, Unlock, Eye, EyeOff, Sparkles, AlertTriangle, Info
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [trackings, setTrackings] = useState<DailyTracking[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'vocabulary' | 'assignments_mgmt'>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mgmtDateFilter, setMgmtDateFilter] = useState<string>('');
  const [mgmtSkillFilter, setMgmtSkillFilter] = useState<string>('all');

  const [importVocabDialog, setImportVocabDialog] = useState(false);
  const [importStudent, setImportStudent] = useState('');
  const [importText, setImportText] = useState('');
  const [importStage, setImportStage] = useState(3);
  const [importRepetitions, setImportRepetitions] = useState(5);
  const [importCreationDate, setImportCreationDate] = useState(toLocalDateString());
  const [parseError, setParseError] = useState('');
  const [parsedCards, setParsedCards] = useState<VocabCard[]>([]);
  
  // SRS Manual Override States
  const [syncPhaseDialog, setSyncPhaseDialog] = useState<{ assignment: Assignment, studentName: string, phase: number } | null>(null);

  // SR Preview Dialog
  const [srPreviewDialog, setSrPreviewDialog] = useState<SRPreviewResult | null>(null);
  const [srPreviewLoading, setSrPreviewLoading] = useState(false);

  /** Mở dialog preview SR — đọc dữ liệu và tính toán trước khi hiện */
  const handleOpenSRPreview = () => {
    setSrPreviewLoading(true);
    // Chạy trong setTimeout để UI kịp render spinner
    setTimeout(() => {
      try {
        // clearDeletedTombstone=true: xóa tombstone để những ngày đã xóa xuất hiện lại trong preview.
        // Tombstone chỉ ngăn cloud-sync tự động, không nên chặn khi user chủ động nhấn button.
        const preview = previewSRGeneration(true);
        setSrPreviewDialog(preview);
      } catch (e) {
        console.error('Lỗi khi preview SR:', e);
        alert('Đã có lỗi xảy ra khi đọc dữ liệu.');
      } finally {
        setSrPreviewLoading(false);
      }
    }, 50);
  };

  /** Xác nhận → thực sự generate SR assignments */
  const handleConfirmSRGeneration = async () => {
    setIsSyncing(true);
    try {
      // clearDeletedTombstone=true: xóa tombstone để tạo lại các bài đã xóa (tombstone đã bị xóa trong preview,
      // nhưng truyền lại để an toàn trong trường hợp confirm mà không qua preview)
      autoSyncAllSpacedRepetition(true);
      setSrPreviewDialog(null);
      
      // Cập nhật local state ngay lập tức
      setAssignments(getAssignments(true));
      setSubmissions(getSubmissions());
      setTrackings(getDailyTrackings());
      
      // Chạy refresh ngầm
      refreshData();
    } catch (e) {
      console.error('Lỗi khi tạo bài ôn tập:', e);
      alert('Đã có lỗi xảy ra khi tạo bài ôn tập.');
    } finally {
      setIsSyncing(false);
    }
  };

  /** Đồng bộ hóa các bài ôn tập quá khứ — tự động hoàn thành với 100đ */
  const handleSyncSpacedRepetition = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đồng bộ ôn tập cũ',
      message: 'Tự động hoàn thành tất cả bài ôn tập SR trong quá khứ cho tất cả học viên với 100 điểm? (Chỉ áp dụng cho các bài đã quá hạn, không ảnh hưởng bài hôm nay.)',
      confirmText: 'Đồng ý',
      confirmClass: 'bg-primary text-primary-foreground hover:opacity-90',
      action: async () => {
        setConfirmDialog(null);
        setIsSyncing(true);
        try {
          const res = await syncPastReviewAssignments();
          alert(`Hoàn thành! Đã tự động xử lý ${res.count} bài ôn tập quá hạn.`);
          
          // Cập nhật local state ngay lập tức
          setAssignments(getAssignments(true));
          setSubmissions(getSubmissions());
          setTrackings(getDailyTrackings());
          
          // Chạy refresh ngầm
          refreshData();
        } catch (e: any) {
          console.error('Lỗi khi đồng bộ ôn tập:', e);
          alert('Đã có lỗi xảy ra khi đồng bộ ôn tập cũ.\n\nChi tiết: ' + (e?.message || String(e)));
        } finally {
          setIsSyncing(false);
        }
      }
    });
  };

  const handleAutoSyncPhase = async (assignment: Assignment) => {
    if (!confirm('Đồng bộ Phase cho TẤT CẢ học viên trong bài tập này dựa trên ngày tạo?')) return;

    try {
      const createdDate = new Date(assignment.createdAt || new Date());
      const created = createdDate.getTime();
      const daysDiff = Math.floor((new Date().getTime() - created) / (1000 * 3600 * 24));

      let calculatedStage = 1;
      let cumulativeDays = 0;
      const intervals = [1, 3, 7, 14, 30, 60];

      if (daysDiff === 0) {
        calculatedStage = 0;
      } else {
        for (let i = 0; i < intervals.length; i++) {
          if (daysDiff > cumulativeDays + intervals[i]) {
            cumulativeDays += intervals[i];
            calculatedStage = i + 2;
          } else {
            break;
          }
        }
        calculatedStage = Math.min(calculatedStage, 6);
      }

      const calculatedNextReviewDate = new Date(createdDate);
      if (calculatedStage === 0) {
        calculatedNextReviewDate.setDate(calculatedNextReviewDate.getDate()); // Due today
      } else {
        calculatedNextReviewDate.setDate(calculatedNextReviewDate.getDate() + cumulativeDays + (intervals[calculatedStage - 1] || 1));
      }

      const progressList = getVocabProgressList();
      const students = getStudentNames();

      students.forEach(studentName => {
        // Mặc định coi như học sinh đã làm bài và tính phase theo ngày tạo
        const targetStage = calculatedStage;
        const nextReviewDate = calculatedNextReviewDate.toISOString();
        const interval = intervals[Math.max(0, targetStage - 1)] || 1;

        (assignment.vocabCards || []).forEach(card => {
          const pIndex = progressList.findIndex(p => p.studentName === studentName && p.wordId === card.id);
          if (pIndex !== -1) {
            progressList[pIndex].stage = targetStage;
            progressList[pIndex].nextReviewDate = nextReviewDate;
            progressList[pIndex].interval = interval;
          } else {
            progressList.push({
              studentName,
              wordId: card.id,
              stage: targetStage,
              repetitions: targetStage > 1 ? targetStage : 0,
              interval: interval,
              lastReviewed: new Date().toISOString(),
              nextReviewDate: nextReviewDate
            });
          }
        });
      });

      saveVocabProgressList(progressList);

      if (calculatedStage > 1) {
        autoSubmitPreviousStagesLocal(assignment.id, assignment.title, calculatedStage, 'ALL_STUDENTS');
        await syncActionToSheet({
          action: 'auto_submit_previous_stage',
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          targetStage: calculatedStage,
          studentName: 'ALL_STUDENTS',
          baseCreatedAt: assignment.createdAt
        });
      }

      alert('Đồng bộ Phase thành công!');
      refreshData();
    } catch (e) {
      console.error('Lỗi khi đồng bộ phase:', e);
      alert('Đã có lỗi xảy ra khi đồng bộ phase. Vui lòng thử lại.');
    }
  };

  const submitManualPhaseEdit = () => {
    if (!syncPhaseDialog || !syncPhaseDialog.studentName) return alert('Vui lòng chọn học viên!');
    
    const targetStage = syncPhaseDialog.phase;
    const intervals = [1, 3, 7, 14, 30, 60];
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + (intervals[Math.max(0, targetStage - 1)] || 1));

    const progressList = getVocabProgressList();
    
    const targetStudents = syncPhaseDialog.studentName === 'ALL_STUDENTS'
      ? getStudentNames()
      : [syncPhaseDialog.studentName];

    targetStudents.forEach(studentName => {
      (syncPhaseDialog.assignment.vocabCards || []).forEach(card => {
        const pIndex = progressList.findIndex(p => p.studentName === studentName && p.wordId === card.id);
        if (pIndex !== -1) {
          progressList[pIndex].stage = targetStage;
          progressList[pIndex].nextReviewDate = nextReviewDate.toISOString();
          progressList[pIndex].interval = intervals[Math.max(0, targetStage - 1)] || 1;
        } else {
          progressList.push({
            studentName: studentName,
            wordId: card.id,
            stage: targetStage,
            repetitions: targetStage > 1 ? targetStage : 0,
            interval: intervals[Math.max(0, targetStage - 1)] || 1,
            lastReviewed: new Date().toISOString(),
            nextReviewDate: nextReviewDate.toISOString()
          });
        }
      });
    });

    saveVocabProgressList(progressList);
    
    if (targetStage > 1) {
      autoSubmitPreviousStagesLocal(syncPhaseDialog.assignment.id, syncPhaseDialog.assignment.title, targetStage, syncPhaseDialog.studentName);
      syncActionToSheet({
        action: 'auto_submit_previous_stage',
        assignmentId: syncPhaseDialog.assignment.id,
        assignmentTitle: syncPhaseDialog.assignment.title,
        targetStage: targetStage,
        studentName: syncPhaseDialog.studentName,
        baseCreatedAt: syncPhaseDialog.assignment.createdAt
      });
    }

    alert('Cập nhật Phase thành công!');
    setSyncPhaseDialog(null);
    refreshData();
  };

  // allAssignments = assignments thực từ localStorage (Shadowing được tạo thực khi teacher chọn, không dùng virtual shadowing nữa)
  const allAssignments = assignments;

  useEffect(() => {
    if (tabParam === 'assignments_mgmt' || tabParam === 'overview' || tabParam === 'analytics' || tabParam === 'vocabulary') {
      setActiveTab(tabParam as any);
    } else if (!tabParam) {
      setActiveTab('overview');
    }
  }, [tabParam]);

  const refreshData = async () => {
    // 1. Lấy dữ liệu local trước để hiển thị nhanh
    setAssignments(getAssignments(true));
    setSubmissions(getSubmissions());
    setTrackings(getDailyTrackings());

    // 2. Fetch từ server ngầm
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) {
        const cloudData = await res.json();
        const hasChanges = syncAllFromCloud(cloudData);
        if (hasChanges) {
          setAssignments(getAssignments(true));
          setSubmissions(getSubmissions());
          setTrackings(getDailyTrackings());
        }
      }
    } catch (e) {
      console.error('Lỗi khi đồng bộ dữ liệu:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDictationCount = (a: any) => {
    if (a.sentences && Array.isArray(a.sentences)) return a.sentences.length;
    if (!a.passage) return 0;
    let parsed = a.passage;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return 0; }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { return 0; }
      }
    }
    return Array.isArray(parsed) ? parsed.length : 0;
  };

  useEffect(() => {
    seedIfEmpty();
    refreshData();
  }, []);

  // Re-read local assignments whenever switching to management tab, so newly
  // created assignments are visible before (or if) the cloud sync responds.
  useEffect(() => {
    if (activeTab === 'assignments_mgmt') {
      setAssignments(getAssignments(true));
    }
  }, [activeTab]);

  const [confirmDialog, setConfirmDialog] = useState<{ 
    isOpen: boolean, 
    action: () => void, 
    title: string, 
    message: string,
    confirmText?: string,
    confirmClass?: string
  } | null>(null);
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

  const handleParseText = () => {
    setParseError('');
    if (!importText.trim()) return;
    try {
      const entries = importText.split(/;|\n/).map(s => s.trim()).filter(Boolean);
      const parsed: VocabCard[] = [];
      for (const entry of entries) {
        let example = "";
        let mainPart = entry;
        const exIndex = entry.indexOf("[Ex]");
        if (exIndex !== -1) {
          example = entry.substring(exIndex + 4).trim();
          mainPart = entry.substring(0, exIndex).trim();
        }
        let meaning = "";
        const tildeIndex = mainPart.indexOf("~");
        if (tildeIndex !== -1) {
          meaning = mainPart.substring(tildeIndex + 1).trim();
          mainPart = mainPart.substring(0, tildeIndex).trim();
        }
        let synonymsStr = "";
        const equalIndex = mainPart.indexOf("=");
        if (equalIndex !== -1) {
          synonymsStr = mainPart.substring(equalIndex + 1).trim();
          mainPart = mainPart.substring(0, equalIndex).trim();
        }
        if (synonymsStr.endsWith('.')) synonymsStr = synonymsStr.slice(0, -1).trim();
        const synonyms = synonymsStr ? synonymsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        let word = "";
        let phonetic = "";
        const plusIndex = mainPart.indexOf("+");
        if (plusIndex !== -1) {
          word = mainPart.substring(0, plusIndex).trim();
          phonetic = mainPart.substring(plusIndex + 1).trim();
        } else {
          word = mainPart.trim();
        }
        if (word) {
          parsed.push({
            id: word.toLowerCase().replace(/[^a-z0-9]/g, '') || Math.random().toString(36).substring(7),
            word, phonetic, synonyms, meaning, example,
            createdAt: new Date().toISOString()
          });
        }
      }
      if (parsed.length === 0) setParseError('Không tìm thấy từ vựng hợp lệ.');
      else setParsedCards(parsed);
    } catch (e) {
      setParseError('Lỗi phân tích cú pháp.');
    }
  };

  const saveImportedCards = () => {
    if (!importStudent) {
      alert('Vui lòng chọn học viên!');
      return;
    }
    if (parsedCards.length === 0) return;
    importExternalVocabWithProgress(importStudent, parsedCards, importStage, importRepetitions, importCreationDate);
    alert(`Đã nhập thành công ${parsedCards.length} từ vựng cho ${importStudent}!`);
    setImportVocabDialog(false);
    setParsedCards([]);
    setImportText('');
    refreshData();
  };

  const handleSyncPastAssignment = (a: Assignment) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đồng bộ bài tập cũ',
      message: 'Hệ thống sẽ tự động tạo bài nộp (100 điểm, 0 giây) cho tất cả các học viên chưa làm bài này. Bạn có chắc chắn không?',
      confirmText: 'Đồng ý',
      confirmClass: 'bg-primary text-primary-foreground hover:opacity-90',
      action: async () => {
        setConfirmDialog(null);
        try {
          const activeStudents = getStudentNames();
          const allSubs = getSubmissions();
          const existingSubs = allSubs.filter(s => s.assignmentId === a.id);
          const existingStudents = new Set(existingSubs.map(s => s.studentName));
          const newSubs: Submission[] = [];
          
          activeStudents.forEach(student => {
            if (!existingStudents.has(student)) {
              const vocabAnswers = a.type === 'vocabulary' && a.vocabCards
                ? a.vocabCards.map((c: any) => ({
                    word: c.word,
                    isCorrect: true,
                    studentAnswer: c.word,
                    correctAnswer: c.word
                  }))
                : undefined;

              newSubs.push({
                id: Math.random().toString(36).substring(7),
                assignmentId: a.id,
                assignmentTitle: a.title,
                assignmentType: a.type,
                studentName: student,
                score: 100,
                vocabAnswers,
                details: JSON.stringify({ 
                  auto_submit: true, 
                  note: "Đồng bộ bài tập cũ",
                  vocabAnswers
                }),
                submittedAt: a.createdAt ? toLocal2359ISOString(a.createdAt) : toLocal2359ISOString(),
                durationMs: 0
              });
            }
          });
          
          if (newSubs.length > 0) {
            saveSubmissions([...allSubs, ...newSubs]);
          }
          
          await syncActionToSheet({
            action: 'sync_past_assignment',
            assignmentId: a.id,
            assignmentTitle: a.title,
            assignmentType: a.type,
            createdAt: a.createdAt,
            vocabCards: a.vocabCards
          });
          
          alert('Đã đồng bộ bài tập thành công!');
          
          // Cập nhật local state ngay lập tức
          setAssignments(getAssignments(true));
          setSubmissions(getSubmissions());
          setTrackings(getDailyTrackings());
          
          // Chạy refresh ngầm
          refreshData();
        } catch (error) {
          console.error(error);
          alert('Có lỗi xảy ra khi đồng bộ. Vui lòng thử lại.');
        }
      }
    });
  };

  const handleSyncAllPastAssignments = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đồng bộ tất cả bài tập cũ',
      message: 'Hệ thống sẽ tự động tạo bài nộp (100 điểm, 0 giây) cho TẤT CẢ các bài tập và TẤT CẢ học viên chưa làm. Bạn có chắc chắn không?',
      confirmText: 'Đồng ý',
      confirmClass: 'bg-primary text-primary-foreground hover:opacity-90',
      action: async () => {
        setConfirmDialog(null);
        setIsSyncing(true);
        try {
          const activeStudents = getStudentNames();
          const allSubs = getSubmissions();
          // CHỈ đồng bộ các bài đã tạo trước 00:00 hôm nay.
          // Bài tạo trong ngày hôm nay và bài lên lịch trong tương lai KHÔNG được đồng bộ.
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const allAssigns = getAssignments().filter(a => {
            // Bài không có createdAt (legacy) coi như bài cũ -> vẫn đồng bộ
            if (!a.createdAt) return true;
            return new Date(a.createdAt).getTime() < startOfToday.getTime();
          });
          const newSubs: Submission[] = [];

          allAssigns.forEach(a => {
            const existingSubs = allSubs.filter(s => s.assignmentId === a.id);
            const existingStudents = new Set(existingSubs.map(s => s.studentName));
            
            activeStudents.forEach(student => {
              if (!existingStudents.has(student)) {
                const vocabAnswers = a.type === 'vocabulary' && a.vocabCards
                  ? a.vocabCards.map((c: any) => ({
                      word: c.word,
                      isCorrect: true,
                      studentAnswer: c.word,
                      correctAnswer: c.word
                    }))
                  : undefined;

                newSubs.push({
                  id: Math.random().toString(36).substring(7),
                  assignmentId: a.id,
                  assignmentTitle: a.title,
                  assignmentType: a.type,
                  studentName: student,
                  score: 100,
                  vocabAnswers,
                  details: JSON.stringify({ 
                    auto_submit: true, 
                    note: "Đồng bộ bài tập cũ",
                    vocabAnswers
                  }),
                  submittedAt: a.createdAt ? toLocal2359ISOString(a.createdAt) : toLocal2359ISOString(),
                  durationMs: 0
                });
              }
            });
          });

          if (newSubs.length > 0) {
            saveSubmissions([...allSubs, ...newSubs]);
          }

          await syncActionToSheet({
            action: 'sync_all_past_assignments',
            assignments: allAssigns.map(a => ({
              id: a.id,
              title: a.title,
              type: a.type,
              createdAt: a.createdAt,
              vocabCards: a.vocabCards
            }))
          });

          alert('Đã đồng bộ tất cả bài tập thành công!');
          
          // Cập nhật local state ngay lập tức
          setAssignments(getAssignments(true));
          setSubmissions(getSubmissions());
          setTrackings(getDailyTrackings());
          
          // Chạy refresh ngầm
          refreshData();
        } catch (error) {
          console.error(error);
          alert('Có lỗi xảy ra khi đồng bộ. Vui lòng thử lại.');
        } finally {
          setIsSyncing(false);
        }
      }
    });
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

  const handleToggleHidden = (a: any) => {
    const currentlyHidden = a.isHidden !== false;
    updateAssignment(a.id, { isHidden: !currentlyHidden });
    refreshData();
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
  const [_edy, _edm, _edd] = selectedDate.split('-').map(Number);
  const endOfDay = new Date(_edy, _edm - 1, _edd, 23, 59, 59, 999).toISOString();
  const filteredSubmissions = submissions.filter(s => s.id && s.submittedAt <= endOfDay && Number(s.durationMs) > 0);
  const filteredTrackings = trackings.filter(t => t.submittedAt <= endOfDay);
  const filteredAssignments = allAssignments.filter(a => (a.createdAt ? a.createdAt <= endOfDay : true) && a.isHidden !== true);

  const formatDuration = (ms?: number) => {
    if (!ms) return '0 giây';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m} phút ${s} giây`;
    return `${s} giây`;
  };

  const formatTotalTime = (ms: number) => {
    if (!ms) return '0 phút';
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalStudents = getStudentNames().length;
  const totalAssignments = filteredAssignments.length;
  const avgScore = filteredSubmissions.length
    ? Math.round(filteredSubmissions.reduce((s, x) => s + x.score, 0) / filteredSubmissions.length)
    : 0;
  const completedToday = filteredSubmissions.filter(
    s => toLocalDateString(s.submittedAt) === selectedDate,
  ).length;

  // ── Per-student stats ──────────────────────────────────────────────────────
  const profiles = getGamificationProfiles();
  const studentStats = getStudentNames().map(name => {
    const subs = filteredSubmissions.filter(s => s.studentName === name);
    const trks = filteredTrackings.filter(t => t.studentName === name);
    const profile = profiles.find(p => p.studentName === name);

    // Chỉ tính điểm trung bình từ các bài tập (submissions)
    const totalScore = subs.reduce((s, x) => s + x.score, 0);
    const totalCount = subs.length;
    const totalMs = subs.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    const avg = totalCount ? Math.round(totalScore / totalCount) : null;
    const trend = subs.length >= 2 ? (subs[0].score > subs[1].score ? 'up' : subs[0].score < subs[1].score ? 'down' : 'same') : 'same';

    return { name, avg, submissionCount: subs.length, trackingCount: trks.length, trend, profile, totalMs };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  // ── Recent activities (mix submissions and trackings) ──────────────────────
  const recentActivities = [
    ...filteredSubmissions
      .filter(s => !(s.assignmentType === 'repetition' && (!s.durationMs || Number(s.durationMs) === 0)))
      .map(s => ({ ...s, isTracking: false })),
    ...filteredTrackings.map(t => ({ ...t, isTracking: true }))
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 8);

  // ── Analytics Data ─────────────────────────────────────────────────────────
  const todayActivities = [
    ...filteredSubmissions.filter(s => toLocalDateString(s.submittedAt) === selectedDate && !(s.assignmentType === 'repetition' && (!s.durationMs || Number(s.durationMs) === 0))),
    ...filteredTrackings.filter(t => toLocalDateString(t.submittedAt) === selectedDate)
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
  const monday = (() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon;
  })();

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const getVNWeekday = (dStr: string) => {
    const [year, month, day] = dStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${dayNames[d.getDay()]} (${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')})`;
  };

  const assignmentMap = new Map<string, Assignment>();
  allAssignments.forEach(a => assignmentMap.set(a.id, a));

  const classTrendData = last7Days.map(date => {
    const dSubs = submissions.filter(s => s.id && toLocalDateString(s.submittedAt) === date && Number(s.durationMs) > 0);
    const dTrks = trackings.filter(t => toLocalDateString(t.submittedAt) === date);

    const scores = { Vocab: [] as number[], Grammar: [] as number[], Reading: [] as number[], Listening: [] as number[], Writing: [] as number[] };
    const allScores: number[] = [];

    dSubs.forEach(s => {
      const a = assignmentMap.get(s.assignmentId);
      const skill = a?.skill || 'Vocab';
      if (skill === 'Vocab' || skill === 'Repetition') scores.Vocab.push(s.score);
      else if (skill === 'Grammar') scores.Grammar.push(s.score);
      else if (skill === 'Reading') scores.Reading.push(s.score);
      else if (skill === 'Listening') scores.Listening.push(s.score);
      else if (skill === 'Writing') scores.Writing.push(s.score);
      allScores.push(s.score);
    });
    dTrks.forEach(t => {
      if (t.category === 'Vocabulary') scores.Vocab.push(t.score);
      else if (t.category === 'Grammar') scores.Grammar.push(t.score);
      else if (t.category === 'Reading') scores.Reading.push(t.score);
      else if (t.category === 'Dictation' || t.category === 'Listening') scores.Listening.push(t.score);
      else if (t.category === 'Writing') scores.Writing.push(t.score);
      allScores.push(t.score);
    });

    const average = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return {
      date: getVNWeekday(date),
      Vocab: average(scores.Vocab),
      Grammar: average(scores.Grammar),
      Reading: average(scores.Reading),
      Listening: average(scores.Listening),
      Writing: average(scores.Writing),
      Score: average(allScores),
    };
  });

  // Calculate overall average for radar
  const getOverallSkillAverage = (skill: string) => {
    const scores: number[] = [];
    submissions.filter(s => s.id && Number(s.durationMs) > 0).forEach(s => {
      const a = assignmentMap.get(s.assignmentId);
      const aSkill = a?.skill || 'Vocab';
      if (aSkill.toLowerCase() === skill.toLowerCase() || (skill.toLowerCase() === 'vocab' && aSkill.toLowerCase() === 'repetition')) scores.push(s.score);
    });
    trackings.forEach(t => {
      let tSkill: string = t.category;
      if (tSkill === 'Vocabulary') tSkill = 'Vocab';
      else if (tSkill === 'Dictation') tSkill = 'Listening';
      if (tSkill.toLowerCase() === skill.toLowerCase()) scores.push(t.score);
    });
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  };

  // 4. Actionable Insights
  const insights: string[] = [];
  if (classTrendData.length >= 2) {
    const skills = ['Vocab', 'Grammar', 'Reading', 'Listening', 'Writing'];
    const skillNames: any = { Vocab: 'Từ vựng', Grammar: 'Ngữ pháp', Reading: 'Đọc hiểu', Listening: 'Nghe chép', Writing: 'Viết' };

    skills.forEach(skill => {
      let start: number | null = null;
      for (let i = 0; i < classTrendData.length; i++) {
        if ((classTrendData[i] as any)[skill] !== null) {
          start = (classTrendData[i] as any)[skill];
          break;
        }
      }
      let end: number | null = null;
      for (let i = classTrendData.length - 1; i >= 0; i--) {
        if ((classTrendData[i] as any)[skill] !== null) {
          end = (classTrendData[i] as any)[skill];
          break;
        }
      }
      if (start !== null && end !== null && start !== end) {
        const diff = end - start;
        if (diff <= -15) {
          insights.push(`🚨 Kỹ năng ${skillNames[skill]} đang giảm mạnh (${diff} điểm) so với đầu tuần. Khuyến nghị giao thêm bài tập loại này!`);
        } else if (diff >= 15) {
          insights.push(`🌟 Lớp học đang có sự tiến bộ vượt bậc ở kỹ năng ${skillNames[skill]} (+${diff} điểm) so với đầu tuần.`);
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
  const formatSubmissionTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${date}/${month} - ${hours}:${minutes}`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      {/* SR Generation Preview Dialog */}
      {srPreviewDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Xem trước bài Ôn tập Spaced Repetition</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Kiểm tra danh sách bài sẽ được tạo / cập nhật trước khi xác nhận</p>
                </div>
              </div>
              <button onClick={() => setSrPreviewDialog(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-3 p-4 border-b border-white/10">
              {[
                { label: 'Tạo mới', value: srPreviewDialog.newCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Cập nhật', value: srPreviewDialog.updateCount, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Xóa', value: srPreviewDialog.deleteCount, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                { label: 'Không đổi', value: srPreviewDialog.unchangedCount, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                  <p className={`text-xl font-bold font-heading ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Today's vocab info */}
            {srPreviewDialog.items.some(i => i.scheduledFor) && (
              <div className="mx-4 mt-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Bài vocab tạo <strong>hôm nay</strong> sẽ có bài ôn tập đầu tiên vào <strong>5:00 sáng ngày mai</strong> (không xuất hiện ngay hôm nay).
                </span>
              </div>
            )}

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {srPreviewDialog.items.filter(i => i.status !== 'unchanged').length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400/50" />
                  <p className="font-semibold">Không có thay đổi nào</p>
                  <p className="text-xs mt-1">Tất cả bài ôn tập đã đồng bộ.</p>
                </div>
              ) : (
                srPreviewDialog.items
                  .filter(item => item.status !== 'unchanged')
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(item => {
                    const statusConfig = {
                      new:       { label: 'Tạo mới',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
                      update:    { label: 'Cập nhật',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
                      delete:    { label: 'Xóa',         color: 'text-red-400 bg-red-500/10 border-red-500/25' },
                      unchanged: { label: 'Không đổi',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/25' },
                    }[item.status];
                    return (
                      <div key={item.id} className={`flex items-center gap-3 rounded-xl p-3 border ${
                        item.status === 'unchanged' ? 'border-white/5 opacity-60' : 'border-white/10 bg-white/[0.02]'
                      }`}>
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {item.scheduledFor
                                ? `📅 ${new Date(item.scheduledFor).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} lúc 5:00 sáng`
                                : item.dateLabel
                              }
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {item.scheduledFor && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border text-sky-400 bg-sky-500/10 border-sky-500/20">
                                Hôm nay 5h sáng
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.cardCount} từ vựng • {item.sources.map(s => `${s.title} (lần ${s.round})`).join(', ')}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-xs text-muted-foreground">
                {srPreviewDialog.items.filter(i => i.status !== 'unchanged').length} thay đổi sẽ được áp dụng
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSrPreviewDialog(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors border border-white/10"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmSRGeneration}
                  disabled={isSyncing || srPreviewDialog.items.filter(i => i.status !== 'unchanged').length === 0}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-violet-500/20"
                >
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Xác nhận tạo bài
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background p-6 rounded-2xl border border-white/10 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-foreground">{confirmDialog.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors text-foreground">Hủy</button>
              <button 
                onClick={confirmDialog.action} 
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${confirmDialog.confirmClass || 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
              >
                {confirmDialog.confirmText || 'Xóa'}
              </button>
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

      {importVocabDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-background p-6 rounded-2xl border border-white/10 max-w-2xl w-full mx-4 shadow-xl my-8 relative">
            <button onClick={() => setImportVocabDialog(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-1 text-foreground flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> Cập Nhật Dữ Liệu Học Spaced Repetition</h3>
            <p className="text-sm text-muted-foreground mb-6">Đồng bộ lịch sử học từ vựng (Quizlet/nguồn ngoài) cho học viên cụ thể để tiếp tục lịch ôn tập.</p>
            
            <div className="space-y-5 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Chọn Học Viên</label>
                  <select
                    value={importStudent}
                    onChange={e => setImportStudent(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">-- Chọn học viên --</option>
                    {getStudentNames().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Ngày học đầu tiên</label>
                  <input
                    type="date"
                    value={importCreationDate}
                    onChange={e => setImportCreationDate(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Stage hiện tại (1-6)</label>
                  <select
                    value={importStage}
                    onChange={e => setImportStage(Number(e.target.value))}
                    className="input-field w-full text-sm appearance-none"
                  >
                    <option value="1">Stage 1 (1 ngày)</option>
                    <option value="2">Stage 2 (3 ngày)</option>
                    <option value="3">Stage 3 (7 ngày)</option>
                    <option value="4">Stage 4 (14 ngày)</option>
                    <option value="5">Stage 5 (30 ngày)</option>
                    <option value="6">Stage 6 (60 ngày - Master)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Số lần ôn tập trước đó</label>
                  <input
                    type="number"
                    min="1"
                    value={importRepetitions}
                    onChange={e => setImportRepetitions(Number(e.target.value))}
                    className="input-field w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Nội Dung Từ Vựng (Text format)</label>
                <div className="text-[11px] text-muted-foreground mb-2 p-2 bg-secondary/30 rounded border border-white/5">
                  Cú pháp: <code className="text-primary">Từ vựng + Phiên âm = Từ đồng nghĩa ~ Nghĩa Tiếng Việt [Ex] Câu ví dụ;</code> (mỗi từ cách nhau bằng dấu <code>;</code>)
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="input-field w-full h-32 font-mono text-sm resize-y"
                  placeholder="Ví dụ: Hello + /həˈləʊ/ = Hi, Greetings ~ Xin chào [Ex] Hello there!;"
                />
                
                {parseError && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5" /> {parseError}
                  </div>
                )}
                
                <div className="mt-2 flex justify-end">
                  <button onClick={handleParseText} className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-semibold transition-colors">
                    Phân tích Text
                  </button>
                </div>
              </div>

              {parsedCards.length > 0 && (
                <div className="border border-border rounded-xl p-3 bg-secondary/10">
                  <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                    <span>Xem trước dữ liệu ({parsedCards.length} từ)</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {parsedCards.map((c, i) => (
                      <div key={i} className="flex gap-3 p-2 bg-background rounded-lg border border-border text-xs">
                        <div className="w-1/3">
                          <p className="font-bold">{c.word}</p>
                          <p className="text-[10px] text-muted-foreground">{c.phonetic}</p>
                        </div>
                        <div className="w-2/3">
                          <p>{c.meaning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setImportVocabDialog(false)} className="px-5 py-2.5 rounded-xl font-medium hover:bg-secondary transition-colors text-foreground">Hủy</button>
              <button 
                onClick={saveImportedCards} 
                disabled={parsedCards.length === 0 || !importStudent}
                className="px-5 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Đồng Bộ Lịch Sử
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="fade-in stagger-1">
          <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-3">
            Dashboard Giáo Viên
            {(isSyncing || isRefreshing) && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý lớp học và theo dõi tiến độ thi đua</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <button
            type="button"
            onClick={async () => { setIsSyncing(true); try { await refreshData(); } finally { setIsSyncing(false); } }}
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
              onChange={e => setSelectedDate(e.target.value || toLocalDateString())}
              max={toLocalDateString()}
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
          onClick={() => setActiveTab('assignments_mgmt')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'assignments_mgmt' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          Quản Lý Bài Tập
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'analytics' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          Dashboard Điểm Số & Skill
        </button>
        <button
          onClick={() => setActiveTab('vocabulary')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${activeTab === 'vocabulary' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
        >
          Theo Dõi Từ Vựng
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 fade-in stagger-4">
          {/* Star of the day */}
          {starOfTheDay && (
            <div className="glass-strong rounded-3xl p-6 border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Trophy className="w-24 h-24 text-amber-500" />
              </div>
              <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-2"><Flame className="w-5 h-5" /> Ngôi Sao Trong Ngày</h3>
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
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                Biểu Đồ Thi Đua Học Tập
              </h2>
              <div className="glass-strong rounded-3xl p-6 flex flex-col justify-center">
                <StudentPerformanceChart submissions={filteredSubmissions} referenceDate={selectedDate} />
              </div>
            </div>

            {/* Student Study Time Board */}
            <div className="lg:col-span-3 space-y-4">
              <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-400" />
                Bảng Thống Kê Tổng Thời Gian Học
              </h2>
              <div className="glass-strong rounded-3xl p-6 flex flex-col justify-center border border-white/5">
                <StudentTimeChart submissions={filteredSubmissions} referenceDate={selectedDate} />
              </div>
            </div>

            {/* Class Trend Line Chart */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Dashboard Điểm Số & Skill
              </h2>
              <div className="glass-strong rounded-3xl p-6 h-[400px] flex flex-col justify-center border border-white/5">
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="99%" height="100%">
                    <LineChart data={classTrendData}>
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={15}
                        tickFormatter={(val, idx) => {
                          if (idx === 0 || idx === classTrendData.length - 1) {
                            return val.replace('Thứ ', 'T.');
                          }
                          return '•';
                        }}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 17, 17, 0.95)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '11px' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="Score" name="Điểm trung bình" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} connectNulls={true} />
                      <Line type="monotone" dataKey="Vocab" name="Từ vựng" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                      <Line type="monotone" dataKey="Grammar" name="Ngữ pháp" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                      <Line type="monotone" dataKey="Reading" name="Đọc hiểu" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                      <Line type="monotone" dataKey="Listening" name="Nghe chép" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                      <Line type="monotone" dataKey="Writing" name="Viết" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="px-6 py-3 text-left font-medium">Học viên</th>
                      <th className="px-6 py-3 text-left font-medium">Nội dung</th>
                      <th className="px-6 py-3 text-left font-medium">Loại</th>
                      <th className="px-6 py-3 text-center font-medium">Điểm</th>
                      <th className="px-6 py-3 text-right font-medium">Nộp lúc</th>
                      <th className="px-6 py-3 text-right font-medium">Làm bài tốn</th>
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
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${act.isTracking ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                            act.assignmentType === 'vocab_context' || act.assignmentType === 'vocabulary' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' :
                              act.assignmentType === 'multiple_choice' ? 'bg-teal-500/10 text-teal-300 border-teal-500/20' :
                                act.assignmentType === 'dictation' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' :
                                  'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}>
                            {act.isTracking ? <Target className="h-3 w-3" /> :
                              act.assignmentType === 'vocab_context' ? <BookOpen className="h-3 w-3" /> :
                                act.assignmentType === 'multiple_choice' ? <ListChecks className="h-3 w-3" /> :
                                  act.assignmentType === 'dictation' ? <Headphones className="h-3 w-3" /> :
                                    act.assignmentType === 'vocabulary' ? <FileJson className="h-3 w-3" /> :
                                      <PenTool className="h-3 w-3" />}
                            {act.isTracking ? act.category :
                              act.assignmentType === 'vocab_context' || act.assignmentType === 'vocabulary' ? 'Vocab' :
                                act.assignmentType === 'multiple_choice' ? 'Quiz' :
                                  act.assignmentType === 'dictation' ? 'Nghe chép' : 'Viết'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center"><ScoreBadge score={act.score} /></td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">{formatSubmissionTime(act.submittedAt)}</span>
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          {!act.isTracking && act.durationMs ? (
                            <span className="text-[11px] text-sky-400 font-medium flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" /> {formatDuration(act.durationMs)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-white/5">
                {recentActivities.map((act: any) => (
                  <div key={act.id} className="p-4 space-y-2 hover:bg-slate-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StudentAvatar name={act.studentName} size="sm" />
                        <span className="font-semibold text-sm text-foreground">{act.studentName}</span>
                      </div>
                      <ScoreBadge score={act.score} />
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {act.isTracking ? 'Báo cáo: ' + act.category : act.assignmentTitle}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium border ${act.isTracking ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                        act.assignmentType === 'vocab_context' || act.assignmentType === 'vocabulary' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' :
                          act.assignmentType === 'multiple_choice' ? 'bg-teal-500/10 text-teal-300 border-teal-500/20' :
                            act.assignmentType === 'dictation' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' :
                              'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                        {act.isTracking ? act.category :
                          act.assignmentType === 'vocab_context' || act.assignmentType === 'vocabulary' ? 'Vocab' :
                            act.assignmentType === 'multiple_choice' ? 'Quiz' :
                              act.assignmentType === 'dictation' ? 'Nghe chép' : 'Viết'}
                      </span>

                      <span>
                        {formatSubmissionTime(act.submittedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'assignments_mgmt' && (
        <div className="space-y-6 fade-in stagger-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-bold font-heading text-primary flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-violet-400" />
                Quản Lý Bài Tập Đã Giao
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Xem danh sách, lọc theo kỹ năng, ngày tạo và quản lý bài tập của học sinh.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleOpenSRPreview}
                disabled={srPreviewLoading || isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors text-sm font-semibold border border-violet-500/20 shadow-lg shadow-violet-500/5"
              >
                {srPreviewLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />
                }
                Tạo bài Ôn tập SR
              </button>
              <button
                onClick={handleSyncSpacedRepetition}
                disabled={isSyncing}
                title="Tự động hoàn thành các bài SR quá hạn trong quá khứ (100 điểm)"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors text-sm font-semibold border border-amber-500/20 shadow-lg shadow-amber-500/5"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Đồng bộ Ôn tập cũ
              </button>
              <button
                onClick={handleSyncAllPastAssignments}
                disabled={isSyncing}
                title="Tự động hoàn thành TẤT CẢ các bài tập quá hạn cho TẤT CẢ học viên chưa làm (100 điểm)"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors text-sm font-semibold border border-blue-500/20 shadow-lg shadow-blue-500/5"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Đồng bộ Tất cả
              </button>
              <Link href="/teacher/scores"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary/50 border border-white/5 text-foreground hover:bg-secondary transition-colors text-sm font-semibold">
                <Settings className="h-4 w-4" /> Quản lý điểm
              </Link>
              <Link href="/teacher/assignments/new"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-semibold border border-primary/20 shadow-lg shadow-primary/5">
                <PlusCircle className="h-4 w-4" /> Thêm Bài Tập Mới
              </Link>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-5 rounded-2xl glass flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Skill filter buttons */}
            <div className="space-y-1.5 flex-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Lọc Theo Kỹ Năng</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'Vocab', label: 'Từ vựng (Vocab)' },
                  { value: 'Repetition', label: 'Space Repetition' },
                  { value: 'Grammar', label: 'Ngữ pháp (Grammar)' },
                  { value: 'Reading', label: 'Đọc hiểu (Reading)' },
                  { value: 'Listening', label: 'Nghe chép (Listening)' },
                  { value: 'Writing', label: 'Viết (Writing)' },
                  { value: 'Speaking', label: 'Nói (Speaking)' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMgmtSkillFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${mgmtSkillFilter === opt.value
                      ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10'
                      : 'bg-transparent border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground hover:border-black/25 dark:hover:border-white/25 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date filter picker */}
            <div className="space-y-1.5 shrink-0">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Lọc Theo Ngày Tạo</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={mgmtDateFilter}
                  onChange={e => setMgmtDateFilter(e.target.value)}
                  className="input-field text-xs py-1.5 px-3 w-auto bg-background border-white/10 rounded-lg text-foreground focus:border-primary/50 focus:outline-none"
                />
                {mgmtDateFilter && (
                  <button
                    onClick={() => setMgmtDateFilter('')}
                    className="p-1.5 rounded-lg border border-red-500/20 text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold transition-colors"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Assignments list */}
          {(() => {
            const filteredMgmtAssignments = allAssignments.filter(a => {
              const isRepetition = a.type?.toLowerCase() === 'repetition' || 
                                   a.skill?.toLowerCase() === 'repetition' || 
                                   a.id?.startsWith('daily-review-') || 
                                   a.id?.startsWith('rep-');

              if (mgmtSkillFilter === 'all') {
                // Không ẩn bài SR ở tab "Tất cả" nữa, hiển thị bình thường như các bài tập khác
                // Ngoại trừ các bài SR bị ẩn (isHidden: true)
                if (isRepetition && a.isHidden) return false;
              } else {
                // Đang filter theo skill cụ thể — áp dụng bất kể có date filter hay không.
                if (mgmtSkillFilter?.toLowerCase() === 'repetition') {
                  // Chỉ hiện bài SR
                  if (!isRepetition) return false;
                } else {
                  // Hiện bài theo skill cụ thể — LUÔN loại SR dù date filter có hay không
                  if (isRepetition) return false;
                  const skill = a.skill || 'Vocab';
                  if (skill.toLowerCase() !== mgmtSkillFilter.toLowerCase()) return false;
                }
              }

              if (mgmtDateFilter) {
                if (!a.createdAt) return false;
                const d = new Date(a.createdAt);
                const aDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                console.log('DEBUG_FILTER:', { aDate, mgmtDateFilter, createdAt: a.createdAt, title: a.title });
                if (aDate !== mgmtDateFilter) return false;
              }

              return true;
            });

            // Sắp xếp các bài tập theo ngày tạo (mới nhất lên đầu)
            filteredMgmtAssignments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

            if (filteredMgmtAssignments.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 glass rounded-3xl">
                  <BookOpen className="h-12 w-12 text-muted-foreground opacity-30" />
                  <p className="text-sm font-semibold text-muted-foreground">Không tìm thấy bài tập nào!</p>
                  <p className="text-xs text-muted-foreground/60 max-w-md">Thử thay đổi điều kiện lọc theo ngày hoặc kỹ năng để tìm thấy bài tập bạn cần.</p>
                </div>
              );
            }

            return (
              <div key={mgmtSkillFilter} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full items-stretch">
                {filteredMgmtAssignments.map(a => {
                  const isRepetition = a.type?.toLowerCase() === 'repetition' || 
                                       a.skill?.toLowerCase() === 'repetition' || 
                                       a.id?.startsWith('daily-review-') || 
                                       a.id?.startsWith('rep-');
                  const subs = submissions.filter(s => s.assignmentId === a.id);
                  const realSubs = subs.filter(s => s.id && Number(s.durationMs) > 0);
                  const avg = realSubs.length ? Math.round(realSubs.reduce((s, x) => s + x.score, 0) / realSubs.length) : null;
                  const skill = a.skill || 'Vocab';
                  const renderCardContent = () => (
                    <>
                      <div className={`p-3 rounded-xl flex-shrink-0 ${skill === 'Vocab' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' :
                        skill === 'Grammar' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          skill === 'Reading' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                            skill === 'Listening' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' :
                              skill === 'Speaking' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' :
                                'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                        {a.type === 'vocab_context' ? <BookOpen className="h-5 w-5" /> :
                          a.type === 'multiple_choice' ? <ListChecks className="h-5 w-5" /> :
                            a.type === 'dictation' ? <Headphones className="h-5 w-5" /> :
                              (a.type === 'vocabulary' || isRepetition) ? <FileJson className="h-5 w-5" /> :
                                a.type === 'shadowing' ? <Mic className="h-5 w-5" /> :
                                  <PenTool className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{a.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${skill === 'Vocab' ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20' :
                            skill === 'Grammar' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' :
                              skill === 'Reading' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' :
                                skill === 'Listening' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20' :
                                  skill === 'Speaking' ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' :
                                    'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                            }`}>
                            {skill}
                          </span>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-muted-foreground">
                            {a.type === 'vocab_context' ? `${a.keywords?.length || 0} từ khóa` :
                              a.type === 'multiple_choice' ? `${a.questions?.length || 0} câu hỏi` :
                                a.type === 'dictation' ? `${getDictationCount(a)} câu` :
                                  (a.type === 'vocabulary' || isRepetition) ? `${a.vocabCards?.length || 0} từ vựng` :
                                    a.type === 'shadowing' ? `${getDictationCount(a)} câu` :
                                      `${a.keywords?.length || 0} từ khóa`}
                          </span>
                          {a.createdAt && (
                            <>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-sky-400" />
                                {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </>
                          )}
                        </div>
                        {avg !== null && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Điểm TB lớp:</span>
                            <ScoreBadge score={avg} />
                            <span className="text-xs text-muted-foreground">({subs.length} lượt làm)</span>
                          </div>
                        )}
                      </div>
                    </>
                  );

                  return (
                    <div key={a.id} className="flex flex-col md:flex-row h-full items-stretch md:items-start justify-between gap-4 p-5 rounded-2xl glass hover:border-primary/30 transition-all group">
                      {isRepetition ? (
                        <div className="flex-1 flex items-start gap-3.5 min-w-0 w-full select-none">
                          {renderCardContent()}
                        </div>
                      ) : (
                        <Link href={`/teacher/assignments/${a.id}/edit`} className="flex-1 flex items-start gap-3.5 min-w-0 cursor-pointer">
                          {renderCardContent()}
                        </Link>
                      )}
                      <div className="flex flex-row items-center gap-1.5 justify-end w-auto mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-t-0 flex-shrink-0 md:grid md:grid-cols-2 md:gap-1.5 md:w-[74px] md:ml-4">
                        {a.type === 'multiple_choice' && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleHint(a); }}
                            className={`p-2 rounded-xl transition-colors relative z-10 flex items-center justify-center ${a.allowHints
                              ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30'
                              : 'text-muted-foreground/50 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10'
                              }`}
                            title={a.allowHints ? "Tắt gợi ý" : "Bật gợi ý"}
                          >
                            <Lightbulb className="h-4.5 w-4.5 pointer-events-none" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleHidden(a); }}
                          className={`p-2 rounded-xl transition-colors relative z-10 flex items-center justify-center ${
                            a.isHidden === false 
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' 
                              : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                          }`}
                          title={a.isHidden === false ? "Đang hiện (Học sinh thấy được)" : "Đang ẩn (Học sinh chưa thấy)"}
                        >
                          {a.isHidden !== false ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSyncPastAssignment(a); }}
                          className="p-2 rounded-xl text-muted-foreground/50 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors relative z-10 flex items-center justify-center"
                          title="Đồng bộ bài tập này (tự động hoàn thành cho học viên chưa làm)"
                        >
                          <RefreshCw className="h-4.5 w-4.5 pointer-events-none" />
                        </button>
                        {a.type !== 'multiple_choice' && <div className="hidden md:block" />}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(a.id); }}
                          className="p-2 rounded-xl text-muted-foreground/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors relative z-10 flex items-center justify-center"
                          title="Xóa bài tập"
                        >
                          <Trash2 className="h-4.5 w-4.5 pointer-events-none" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'analytics' && (
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
                <TrendingUp className="h-5 w-5 text-emerald-400" /> Dashboard Điểm Số & Skill
              </h3>
              <div className="w-full h-[300px] min-h-[300px]">
                <ResponsiveContainer width="99%" height="100%">
                  <LineChart data={classTrendData}>
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={15}
                      tickFormatter={(val, idx) => {
                        if (idx === 0 || idx === classTrendData.length - 1) {
                          return val.replace('Thứ ', 'T.');
                        }
                        return '•';
                      }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="Score" name="Điểm trung bình" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} connectNulls={true} />
                    <Line type="monotone" dataKey="Vocab" name="Từ vựng" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                    <Line type="monotone" dataKey="Grammar" name="Ngữ pháp" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                    <Line type="monotone" dataKey="Reading" name="Đọc hiểu" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                    <Line type="monotone" dataKey="Listening" name="Nghe chép" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                    <Line type="monotone" dataKey="Writing" name="Viết" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
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
                    <XAxis
                      dataKey="time"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => val.split(' ')[0]}
                    />
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
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="99%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="60%" data={[
                    { subject: 'Từ vựng', A: getOverallSkillAverage('Vocab'), fullMark: 100 },
                    { subject: 'Ngữ pháp', A: getOverallSkillAverage('Grammar'), fullMark: 100 },
                    { subject: 'Đọc hiểu', A: getOverallSkillAverage('Reading'), fullMark: 100 },
                    { subject: 'Nghe chép', A: getOverallSkillAverage('Listening'), fullMark: 100 },
                    { subject: 'Viết', A: getOverallSkillAverage('Writing'), fullMark: 100 },
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

      {activeTab === 'vocabulary' && (
        <div className="grid grid-cols-1 gap-6 fade-in">
          {/* Báo cáo ôn tập */}
          <div className="glass-strong rounded-3xl p-6 border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold font-heading">Báo Cáo Ôn Tập Từ Vựng</h3>
                <p className="text-sm text-muted-foreground mt-1">Theo dõi tiến độ lặp lại ngắt quãng (Spaced Repetition) của học sinh</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    syncVocabProgressFromAssignments();
                    alert('Đã đồng bộ tiến độ từ vựng thành công!');
                    refreshData();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đồng bộ Tiến độ
                </button>
                <div className="text-xs px-3 py-2 rounded-xl bg-secondary/80 text-muted-foreground font-semibold">
                  Tổng số từ: <span className="text-primary font-bold">
                    {(() => {
                      const baseCards = getVocabularyCards();
                      const assignCards = allAssignments.filter(a => a.type === 'vocabulary').flatMap(a => a.vocabCards || []);
                      const uniqueIds = new Set([
                        ...baseCards.map(c => c.word.toLowerCase().replace(/[^a-z0-9]/g, '')),
                        ...assignCards.map(c => c.word.toLowerCase().replace(/[^a-z0-9]/g, ''))
                      ]);
                      return uniqueIds.size;
                    })()} từ
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-muted-foreground uppercase font-bold text-xs">
                    <th className="pb-3 pt-2">Học viên</th>
                    <th className="pb-3 pt-2 text-center">Đang học</th>
                    <th className="pb-3 pt-2 text-center">Đã Master (Stage 6)</th>
                    <th className="pb-3 pt-2 text-center">Cần ôn hôm nay</th>
                    <th className="pb-3 pt-2 text-center">Chăm chỉ (Streak)</th>
                    <th className="pb-3 pt-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {getStudentNames().map(name => {
                    const progress = getVocabProgressList().filter(p => p.studentName === name);
                    
                    const baseCards = getVocabularyCards();
                    const assignCards = allAssignments.filter(a => a.type === 'vocabulary').flatMap(a => a.vocabCards || []);
                    const totalCardsMap = new Map<string, any>();
                    baseCards.forEach(c => {
                      const normId = c.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                      totalCardsMap.set(normId, { ...c, id: normId });
                    });
                    assignCards.forEach(c => {
                      const normId = c.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                      totalCardsMap.set(normId, { ...c, id: normId });
                    });
                    const totalCards = Array.from(totalCardsMap.values());
                    
                    const progressMap = new Map<string, any>();
                    progress.forEach(p => progressMap.set(p.wordId, p));

                    const learnedCount = totalCards.filter(card => {
                      const prog = progressMap.get(card.id);
                      return prog && prog.stage > 0;
                    }).length;

                    const masterCount = totalCards.filter(card => {
                      const prog = progressMap.get(card.id);
                      return prog && prog.stage === 6;
                    }).length;

                    const now = new Date();
                    const dueCount = totalCards.filter(card => {
                      const prog = progressMap.get(card.id);
                      if (!prog) return false; // Not started = not due
                      return new Date(prog.nextReviewDate) <= now;
                    }).length;

                    const profile = getGamificationProfiles().find(p => p.studentName === name);

                    return (
                      <tr key={name} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 font-semibold flex items-center gap-3">
                          <StudentAvatar name={name} size="sm" />
                          <span>{name}</span>
                        </td>
                        <td className="py-4 text-center font-bold">{learnedCount} / {totalCards.length}</td>
                        <td className="py-4 text-center text-emerald-400 font-bold">{masterCount}</td>
                        <td className="py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${dueCount > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                            {dueCount} từ
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="text-orange-400 font-bold flex items-center justify-center gap-1">
                            <Flame className="w-4 h-4 text-orange-500" />
                            {profile?.streakCount || 0} ngày
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {dueCount === 0 ? (
                            <span className="text-emerald-400 text-xs font-semibold">Đã ôn đầy đủ</span>
                          ) : (
                            <span className="text-amber-400 text-xs font-semibold">Còn {dueCount} từ đến hạn</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* List of Vocabulary Assignments */}
          <div className="glass-strong rounded-3xl p-6 border border-white/5 mt-2 space-y-4">
            <h3 className="text-xl font-bold font-heading flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Các Bài Tập Từ Vựng Đã Giao
            </h3>
            <p className="text-sm text-muted-foreground">Theo dõi phase ghi nhớ hiện tại của các bài tập từ vựng đã được giao cho lớp.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allAssignments.filter(a => a.type === 'vocabulary').sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map(a => {
                const created = new Date(a.createdAt || new Date()).getTime();
                const daysDiff = Math.floor((new Date().getTime() - created) / (1000 * 3600 * 24));
                let stage = 1;
                let cumulativeDays = 0;
                const intervals = [1, 3, 7, 14, 30, 60];
                if (daysDiff === 0) {
                  stage = 0;
                } else {
                  for (let i = 0; i < intervals.length; i++) {
                    if (daysDiff > cumulativeDays + intervals[i]) {
                      cumulativeDays += intervals[i];
                      stage = i + 2;
                    } else {
                      break;
                    }
                  }
                  stage = Math.min(stage, 6);
                }
                const config = STAGE_CONFIG[stage] || STAGE_CONFIG[1];

                return (
                  <div key={a.id} className="p-4 rounded-xl border border-white/5 bg-secondary/10 hover:bg-secondary/30 transition-colors flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-sm line-clamp-2 leading-tight">{a.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${config.badge}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><FileJson className="w-3.5 h-3.5" /> {a.vocabCards?.length || 0} từ</span>
                      {a.createdAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-sky-400" />
                          {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/5">
                      <div className="flex-1 py-1.5 px-3 bg-black/5 dark:bg-white/5 rounded-lg text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>{daysDiff} ngày kể từ khi giao</span>
                      </div>
                      <button onClick={() => setSyncPhaseDialog({ assignment: a, studentName: '', phase: stage })} className="flex-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-amber-500/20">
                        <Edit2 className="w-3 h-3" /> Chỉnh Phase
                      </button>
                    </div>
                  </div>
                );
              })}
              {allAssignments.filter(a => a.type === 'vocabulary').length === 0 && (
                <div className="col-span-full p-4 text-center text-sm text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-white/10">
                  Chưa có bài tập từ vựng nào được giao.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {syncPhaseDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border p-6 rounded-2xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold font-heading flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-amber-500" />
              Chỉnh Sửa Phase
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Bài tập: <strong>{syncPhaseDialog.assignment.title}</strong></p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Chọn Học Viên</label>
                <select
                  value={syncPhaseDialog.studentName}
                  onChange={e => setSyncPhaseDialog(s => s ? { ...s, studentName: e.target.value } : null)}
                  className="input-field w-full"
                >
                  <option value="">-- Chọn học viên --</option>
                  <option value="ALL_STUDENTS">Tất cả học viên</option>
                  {getStudentNames().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Phase (0-6)</label>
                <select
                  value={syncPhaseDialog.phase}
                  onChange={e => setSyncPhaseDialog(s => s ? { ...s, phase: Number(e.target.value) } : null)}
                  className="input-field w-full"
                >
                  <option value={0}>Phase 0 (Chưa học)</option>
                  <option value={1}>Phase 1 (1 ngày)</option>
                  <option value={2}>Phase 2 (3 ngày)</option>
                  <option value={3}>Phase 3 (7 ngày)</option>
                  <option value={4}>Phase 4 (14 ngày)</option>
                  <option value={5}>Phase 5 (30 ngày)</option>
                  <option value={6}>Phase 6 (60 ngày)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border mt-4">
              <button onClick={() => setSyncPhaseDialog(null)} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors">
                Hủy
              </button>
              <button onClick={submitManualPhaseEdit} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
