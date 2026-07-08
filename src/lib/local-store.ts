import { USE_MOCK_DB, mockAssignments, mockSubmissions, mockTrackings, mockVocabCards, mockVocabProgress, mockGamification } from './database_mockup';
import { syncSubmissionToSheet, syncAssignmentToSheet, syncActionToSheet, syncVocabListToSheet } from './google-sheets';
import { toLocalDateString } from './utils';

// ─── Fuzzy Match (Levenshtein, threshold 80%) ────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export function isFuzzyMatch(student: string, correct: string, threshold = 0.8): boolean {
  const a = student.trim().toLowerCase();
  const b = correct.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? true : 1 - levenshtein(a, b) / maxLen >= threshold;
}

// Stage config: label, color classes, bar color, interval info
export const STAGE_CONFIG = [
  { label: 'Chưa học',           bar: 'bg-slate-400',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',   interval: '—'         },
  { label: 'Stage 1',            bar: 'bg-red-400',     badge: 'bg-red-500/10 text-red-400 border-red-500/20',         interval: '1 ngày'    },
  { label: 'Stage 2',            bar: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   interval: '3 ngày'    },
  { label: 'Stage 3',            bar: 'bg-yellow-400',  badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',interval: '7 ngày'    },
  { label: 'Stage 4',            bar: 'bg-indigo-400',  badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',interval: '14 ngày'   },
  { label: 'Stage 5',            bar: 'bg-sky-400',     badge: 'bg-sky-500/10 text-sky-400 border-sky-400/20',         interval: '30 ngày'   },
  { label: '🏆 Master',          bar: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', interval: '60 ngày'},
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VocabKeyword { word: string; answer: string; }
export interface QuizQuestion {
  id: number; question: string; options: string[]; answer: string; explanation: string;
  knowledgeArea?: string; hint?: string; translation?: string;
}
// ─── Dictation Types ─────────────────────────────────────────────────────────

export interface DictationSentence {
  id: string | number; // string UUID cho Shadowing, number cho Dictation legacy
  text: string;       // Nội dung câu chuẩn (giáo viên nhập)
  translation?: string; // Nghĩa tiếng Việt của câu
  phonetic?: string;  // Phiên âm của câu
  startTime: number;  // Giây bắt đầu trong video YouTube
  endTime?: number;   // Giây kết thúc (tuỳ chọn)
  audioUrl?: string;  // File âm thanh đọc tự nhiên
}

export interface DictationResult {
  sentenceId: number;
  studentText: string;
  accuracy: number;    // 0–100
  errors: string[];    // Từ bị sai
  replayCount: number; // Số lần replay
}

export interface ShadowingResult {
  word: string;
  recognized: string;  // transcript từ SpeechRecognition
  accuracy: number;    // 0–100, levenshtein word-overlap score
  attempts: number;
  userAudioUrl?: string;
}

export interface Assignment {
  id: string;
  title: string;
  type: 'vocab_context' | 'multiple_choice' | 'rewrite_vocab' | 'dictation' | 'vocabulary' | 'shadowing' | 'repetition';
  passage?: string;
  keywords?: VocabKeyword[];
  questions?: QuizQuestion[];
  vocabCards?: VocabCard[]; // Vocabulary cards for learning & review assignments
  imageUrl?: string;
  allowHints?: boolean;
  createdAt: string;
  skill?: 'Vocab' | 'Grammar' | 'Reading' | 'Listening' | 'Writing' | 'Speaking' | 'Repetition';
  // Dictation / Shadowing fields
  sentences?: DictationSentence[];
  /** ID của bài Dictation gốc nếu bài Shadowing này được tạo tự động từ Dictation */
  sourceDictationId?: string;
  isHidden?: boolean; // Cho bài tập Spaced Repetition bị ẩn
  _localLastUpdated?: number; // local edit timestamp to avoid race conditions
}

export interface VocabAnswerResult {
  word: string; studentAnswer: string; isCorrect: boolean; correctAnswer: string;
  attempts?: number; // Số lần thử trong phần nghe chép
}
export interface QuizAnswerResult {
  questionId: number; studentAnswer: string; isCorrect: boolean;
  correctAnswer: string; explanation: string; knowledgeArea?: string;
}
export interface RewriteAnswerResult {
  studentText: string;
  foundKeywords: string[];
  missingKeywords: string[];
}
export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: 'vocab_context' | 'multiple_choice' | 'rewrite_vocab' | 'dictation' | 'vocabulary' | 'shadowing' | 'repetition';
  studentName: string;
  score: number;
  vocabAnswers?: VocabAnswerResult[];
  quizAnswers?: QuizAnswerResult[];
  rewriteAnswers?: RewriteAnswerResult;
  dictationResults?: DictationResult[];
  shadowingResults?: ShadowingResult[];
  feedback?: string;
  durationMs?: number;
  submittedAt: string;
  details?: string;
}

export interface DailyTracking {
  id: string;
  studentName: string;
  category: 'Vocabulary' | 'Dictation' | 'Grammar' | 'Reading' | 'Listening';
  score: number;
  submittedAt: string;
}

export type TrackCategory = DailyTracking['category'];

export interface VocabCard {
  id: string;
  word: string;
  phonetic?: string;
  synonyms: string[];
  meaning: string;
  example: string;
  audioUrl?: string; // File âm thanh đọc tự nhiên
  createdAt?: string;
}

export interface VocabProgress {
  studentName: string;
  wordId: string;
  stage: number;
  interval: number;
  nextReviewDate: string;
  repetitions: number;
  lastReviewed: string;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  assignments: 'et_assignments',
  submissions: 'et_submissions',
  dailyTracking: 'et_daily_tracking',
  seeded: 'et_seeded_v2',
  session: 'et_session',
  vocabulary: 'et_vocabulary',
  vocabProgress: 'et_vocab_progress',
  gamification: 'et_gamification',
};

// ─── Auth / Session ──────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'student';

export interface UserSession {
  username: string;
  role: UserRole;
}

export function getCurrentUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(KEYS.session) || '') as UserSession;
  } catch {
    return null;
  }
}

export function loginUser(username: string, role: UserRole) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.session, JSON.stringify({ username, role }));
  if (role === 'student') {
    localStorage.setItem('et_current_student', username);
  }
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem('et_current_student');
}

export interface Student {
  id: string;
  name: string;
  color: string; // Hex color
  avatar: string;
  createdAt: string;
}

export function getStudents(): Student[] {
  return read<Student[]>('et_students', [
    { id: '1', name: 'Minh Uyên', color: '#EF4444', avatar: 'MU', createdAt: new Date().toISOString() },
    { id: '2', name: 'Khả Nhi', color: '#3B82F6', avatar: 'KN', createdAt: new Date().toISOString() },
    { id: '3', name: 'Ngọc Huy', color: '#10B981', avatar: 'NH', createdAt: new Date().toISOString() },
    { id: '4', name: 'Dương Lâm', color: '#F59E0B', avatar: 'DL', createdAt: new Date().toISOString() }
  ]);
}

export function getStudentNames(): string[] {
  return getStudents().map(s => s.name);
}

export function createStudent(name: string, color: string) {
  const students = getStudents();
  if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Học viên đã tồn tại!');
  }
  
  const avatar = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
  const newStudent: Student = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
    name,
    color,
    avatar,
    createdAt: new Date().toISOString()
  };
  
  write('et_students', [...students, newStudent]);
  syncActionToSheet({ action: 'add_student', student: newStudent });
  return newStudent;
}

export function getStudentColors(name: string): { bg: string; text: string; border: string; hex: string } {
  const student = getStudents().find(s => s.name === name);
  const hex = student?.color || '#8B5CF6'; 
  
  if (hex.toUpperCase().includes('EF4444')) return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', hex };
  if (hex.toUpperCase().includes('3B82F6')) return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', hex };
  if (hex.toUpperCase().includes('10B981')) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', hex };
  if (hex.toUpperCase().includes('F59E0B')) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', hex };
  if (hex.toUpperCase().includes('8B5CF6')) return { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', hex };
  if (hex.toUpperCase().includes('EC4899')) return { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', hex };
  
  return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', hex };
}

export function getStudentAvatar(name: string): string {
  const student = getStudents().find(s => s.name === name);
  if (student) return student.avatar;
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
}

export interface GamificationProfile {
  studentName: string;
  streakCount: number;
  lastActiveDate: string | null;
  badges: string[];
}

export interface BadgeDef {
  id: string;
  title: string;
  icon: string;
  color: string;
  conditionType: string;
  conditionTarget: string;
  conditionValue: string | number;
  description: string;
}

export function getBadges(): BadgeDef[] {
  return read<BadgeDef[]>('et_badges', []);
}

export function getGamificationProfiles(): GamificationProfile[] {
  const students = getStudentNames();
  const trackings = getDailyTrackings();
  const submissions = getSubmissions();
  const badgesDefs = getBadges();

  return students.map(studentName => {
    // Collect all activities for student
    const activities: { date: string, hour: number, score: number, category: string, type: 'submission' | 'tracking', durationMs: number }[] = [];

    trackings.forEach(t => {
      if (t.studentName === studentName) {
        const d = new Date(t.submittedAt);
        activities.push({ date: toLocalDateString(d), hour: d.getHours(), score: t.score, category: t.category, type: 'tracking', durationMs: 0 });
      }
    });

    submissions.forEach(s => {
      if (s.studentName === studentName) {
        const d = new Date(s.submittedAt);
        activities.push({ date: toLocalDateString(d), hour: d.getHours(), score: s.score, category: s.assignmentType, type: 'submission', durationMs: s.durationMs || 0 });
      }
    });

    // Calculate Streak
    // Sort descending by date
    const uniqueDates = Array.from(new Set(activities.map(a => a.date))).sort((a, b) => b.localeCompare(a));
    let streakCount = 0;

    if (uniqueDates.length > 0) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = toLocalDateString(today);
      const yesterdayStr = toLocalDateString(yesterday);

      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
        streakCount = 1;
        let currentDate = new Date(uniqueDates[0]);
        for (let i = 1; i < uniqueDates.length; i++) {
          const expectedDate = new Date(currentDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
          if (uniqueDates[i] === toLocalDateString(expectedDate)) {
            streakCount++;
            currentDate = expectedDate;
          } else {
            break;
          }
        }
      }
    }

    // Evaluate Badges
    const earnedBadges: string[] = [];

    const totalScore = activities.reduce((sum, a) => sum + a.score, 0);
    const totalDurationMs = activities.reduce((sum, a) => sum + a.durationMs, 0);
    const totalHours = totalDurationMs / 3600000; // convert ms to hours
    const submitCount = activities.length;

    badgesDefs.forEach(badge => {
      let isEarned = false;
      const target = badge.conditionTarget?.toLowerCase() || '';
      const value = Number(badge.conditionValue) || 0;

      switch (badge.conditionType) {
        case 'STREAK':
          if (streakCount >= value) isEarned = true;
          break;
        case 'TOTAL_SCORE':
          if (totalScore >= value) isEarned = true;
          break;
        case 'SUBMIT_COUNT':
          if (submitCount >= value) isEarned = true;
          break;
        case 'NIGHT_OWL':
          if (activities.some(a => a.hour >= 22 || a.hour <= 4)) isEarned = true;
          break;
        case 'EARLY_BIRD':
          if (activities.some(a => a.hour >= 4 && a.hour <= 7)) isEarned = true;
          break;
        case 'PERFECT_SCORE':
          // Target could be 'vocabulary', 'grammar', 'reading', 'listening', 'writing', or empty for any
          const perfectCount = activities.filter(a => {
            if (a.score < 100) return false;
            if (!target) return true; // Any perfect score

            // Map category to target
            const cat = a.category.toLowerCase();
            if (target === 'vocabulary' && (cat === 'vocabulary' || cat === 'vocab_context')) return true;
            if (target === 'grammar' && (cat === 'grammar' || cat === 'multiple_choice')) return true;
            if (target === 'writing' && (cat === 'writing' || cat === 'rewrite_vocab')) return true;
            if (cat === target) return true;

            return false;
          }).length;

          if (perfectCount >= value) isEarned = true;
          break;
        case 'TOTAL_TIME':
          if (totalHours >= value) isEarned = true;
          break;
        case 'FAST_SUBMISSION':
          // value is in seconds, score must be >= 80, time under value.
          if (activities.some(a => a.type === 'submission' && a.score >= 80 && a.durationMs > 0 && a.durationMs <= value * 1000)) {
            isEarned = true;
          }
          break;
      }

      if (isEarned) earnedBadges.push(badge.id);
    });

    return {
      studentName,
      streakCount,
      lastActiveDate: uniqueDates[0] || null,
      badges: earnedBadges
    };
  });
}

// ─── CRUD – Assignments ───────────────────────────────────────────────────────

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}
function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getAssignments(includeHidden: boolean = false): Assignment[] {
  const list = read<Assignment[]>(KEYS.assignments, []);
  return list.filter(a => {
    // Bỏ qua các bài tập bị ẩn nếu không yêu cầu
    if (!includeHidden && a.isHidden === true) return false;

    const isOldSrsId = a.id && (a.id.startsWith('rep-stage') || a.id.startsWith('stage'));
    const isOldSrsTitle = a.title && (a.title.toLowerCase().startsWith('stage ') || a.title.toLowerCase().startsWith('stage-'));
    return !(isOldSrsId || isOldSrsTitle);
  });
}



export function getAssignment(id: string): Assignment | undefined {
  return getAssignments().find(a => a.id === id);
}

export function saveAssignment(data: Omit<Assignment, 'id' | 'createdAt'> & { createdAt?: string }): Assignment {
  const all = getAssignments(true);
  const a: Assignment = { ...data, id: crypto.randomUUID(), createdAt: data.createdAt || new Date().toISOString() };
  write(KEYS.assignments, [...all, a]);

  // Đồng bộ lên Google Sheets (Chạy ngầm)
  syncAssignmentToSheet(a);

  // Đẩy từ vựng vào thư viện chung nếu là bài tập từ vựng
  if (a.type === 'vocabulary' && a.vocabCards) {
    const currentCards = getVocabularyCards();
    const updatedCards = [...currentCards];
    let hasNewCards = false;
    a.vocabCards.forEach(c => {
      if (!updatedCards.some(curr => curr.word.toLowerCase() === c.word.toLowerCase())) {
        updatedCards.push({
          ...c,
          id: c.id || crypto.randomUUID(),
          createdAt: c.createdAt || new Date().toISOString()
        });
        hasNewCards = true;
      }
    });
    if (hasNewCards) {
      saveVocabularyCards(updatedCards);
    }
    
    // Tự động thêm progress cho assignment mới tạo
    syncVocabProgressFromAssignments();
    // createdDateRaw.setHours(0, 0, 0, 0);
    // const createdMidnight = createdDateRaw.getTime();
    //
    // const newRepetitions: Assignment[] = [];
    //
    // for (let i = 0; i < intervals.length; i++) {
    //   cumulativeDays += intervals[i];
    //   const stage = i + 1;
    //
    //   const targetDate = new Date(createdMidnight);
    //   targetDate.setDate(targetDate.getDate() + cumulativeDays);
    //   targetDate.setHours(8, 0, 0, 0); // 8:00 AM of target day
    //
    //   const repId = `rep-stage${stage}-${a.id}`;
    //   const repAssignment: Assignment = {
    //     id: repId,
    //     title: `Stage ${stage} - ${a.title}`,
    //     type: 'repetition',
    //     skill: 'Repetition',
    //     vocabCards: a.vocabCards,
    //     createdAt: targetDate.toISOString(),
    //     isHidden: true
    //   };
    //   newRepetitions.push(repAssignment);
    //   syncAssignmentToSheet(repAssignment);
    // }
    //
    // if (newRepetitions.length > 0) {
    //   const updatedAll = getAssignments();
    //   // It's possible updatedAll doesn't have `a` if it was fetched before writing, but we did write before this.
    //   write(KEYS.assignments, [...updatedAll, ...newRepetitions]);
    // }
  }

  // Tự động tạo bài tập Viết chuyện chêm từ Điền chuyện chêm (vocab_context)
  if (a.type === 'vocab_context' && a.keywords && a.keywords.length > 0) {
    const rewriteTitle = `Viết chuyện chêm: ${a.title}`;
    const rewriteData = {
      title: rewriteTitle,
      passage: 'Viết một đoạn văn ngắn (chuyện chêm) bằng tiếng Việt, có sử dụng các từ khóa tiếng Anh dưới đây.',
      keywords: a.keywords.map((k: any) => ({ word: k.word, answer: '' })),
      createdAt: a.createdAt,
      vocabCards: []
    };
    const rewriteAssignment: Assignment = {
      ...rewriteData,
      id: crypto.randomUUID(),
      type: 'rewrite_vocab'
    };
    const updatedAll = getAssignments(true);
    write(KEYS.assignments, [...updatedAll, rewriteAssignment]);
    syncAssignmentToSheet(rewriteAssignment);
  }

  // Tạo bài Shadowing thực (uuid riêng) chỉ khi teacher chọn "Tạo kèm bài Shadowing"
  // Không dùng virtual shadowing nữa để tránh nhầm lẫn id khi xóa.
  if (a.type === 'dictation' && (data as any).createShadowing === true && Array.isArray(a.sentences) && a.sentences.length > 0) {
    const shadowingAssignment: Assignment = {
      id: crypto.randomUUID(),
      title: `Shadowing: ${a.title}`,
      type: 'shadowing',
      skill: 'Speaking',
      createdAt: a.createdAt,
      sentences: a.sentences,
      passage: JSON.stringify(a.sentences), // GAS lưu sentences vào cột Passage
      sourceDictationId: a.id,   // Lưu id Dictation gốc để phân biệt khi cần
    };
    const updatedAll2 = getAssignments(true);
    write(KEYS.assignments, [...updatedAll2, shadowingAssignment]);
    syncAssignmentToSheet(shadowingAssignment);
  }

  return a;
}

export function importAssignment(assignment: Assignment): void {
  const all = getAssignments(true);
  // Check if it already exists to avoid duplicates
  if (!all.find(a => a.id === assignment.id)) {
    write(KEYS.assignments, [...all, assignment]);
    if (assignment.type === 'vocabulary') {
      syncVocabProgressFromAssignments();
    }
  }
}

export function syncAllFromCloud(cloudData: any): boolean {
  if (typeof window === 'undefined') return false;
  let hasChanges = false;

  // 0. Students (Overwrite completely since it's managed in Sheets)
  if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
    write('et_students', cloudData.students);
    hasChanges = true;
  }

  // 1. Assignments — merge strategy:
  //    - Cloud is authoritative for IDs it knows about, EXCEPT when cloud version
  //      is missing critical data (e.g. GAS doesn't store `sentences` for shadowing).
  //    - Local-only assignments (IDs not in cloud) are always preserved.
  if (Array.isArray(cloudData.assignments)) {
    const local = getAssignments(true);
    const localMap = new Map(local.map(a => [a.id, a]));
    
    // Đọc danh sách ID đã xóa
    const deletedIds = read<string[]>('et_deleted_assignment_ids', []);
    const deletedIdsSet = new Set(deletedIds);

    // Lọc bỏ các bài tập đã bị xóa khỏi dữ liệu Cloud, và các bài repetition kiểu cũ (Stage)
    const activeCloudAssignments = cloudData.assignments.filter((cloudA: any) => {
      if (deletedIdsSet.has(cloudA.id)) return false;
      const isOldSrsId = cloudA.id && (cloudA.id.startsWith('rep-stage') || cloudA.id.startsWith('stage'));
      const isOldSrsTitle = cloudA.title && (cloudA.title.toLowerCase().startsWith('stage ') || cloudA.title.toLowerCase().startsWith('stage-'));
      if (isOldSrsId || isOldSrsTitle) return false;
      return true;
    });

    // Dọn dẹp Tombstone list: Nếu ID đã xóa không còn xuất hiện trong response của Cloud nữa,
    // nghĩa là Cloud đã thực sự xóa xong bài đó. Ta loại bỏ ID đó khỏi deletedIds để giải phóng bộ nhớ.
    const cloudIdsInResponse = new Set(cloudData.assignments.map((c: any) => c.id));
    const stillPendingDeletion = deletedIds.filter(id => cloudIdsInResponse.has(id));
    if (stillPendingDeletion.length !== deletedIds.length) {
      write('et_deleted_assignment_ids', stillPendingDeletion);
    }

    const merged = activeCloudAssignments.map((cloudA: any) => {
      const localA = localMap.get(cloudA.id);
      if (!localA) return cloudA; // New from cloud

      // Nếu local mới được update trong vòng 10 giây qua, giữ nguyên các trường local vừa sửa
      if (localA._localLastUpdated && (Date.now() - localA._localLastUpdated < 10 * 1000)) {
        return {
          ...cloudA,
          title: localA.title,
          isHidden: localA.isHidden,
          allowHints: localA.allowHints,
          _localLastUpdated: localA._localLastUpdated
        };
      }

      // Prefer local for shadowing when cloud lacks sentences (GAS schema gap)
      if ((localA.type === 'shadowing' || localA.type === 'dictation') &&
          Array.isArray(localA.sentences) && !Array.isArray(cloudA.sentences)) {
        return localA;
      }
      // Prefer local createdAt/isHidden for repetition phases: GAS stores the
      // sheet-row insert timestamp, not the staggered target date computed
      // client-side, so trusting cloud here collapses every phase onto the
      // same date as the base assignment.
      if (localA.type === 'repetition') {
        return { ...cloudA, createdAt: localA.createdAt, isHidden: localA.isHidden };
      }
      return cloudA; // Cloud is authoritative otherwise
    });

    // Xử lý bài tập local-only (có ở local nhưng không có trên cloud)
    const cloudIds = new Set(activeCloudAssignments.map((c: any) => c.id));
    const nowTime = new Date().getTime();

    // Phát hiện các bài daily review bị xóa trên Cloud
    const deletedDailyReviews = read<string[]>('et_deleted_daily_reviews', []);
    const deletedDailyReviewsSet = new Set(deletedDailyReviews);
    let deletedDailyReviewsChanged = false;

    local.forEach(a => {
      if (a.type === 'repetition' && a.id.startsWith('daily-review-')) {
        if (!cloudIds.has(a.id)) {
          // Nếu bài tập không tồn tại trên cloud và đã được tạo hơn 5 phút (tránh trường hợp mới tạo chưa kịp sync)
          const createdTime = new Date(a.createdAt || 0).getTime();
          if (nowTime - createdTime > 5 * 60 * 1000) {
            if (!deletedDailyReviewsSet.has(a.id)) {
              deletedDailyReviewsSet.add(a.id);
              deletedDailyReviewsChanged = true;
            }
          }
        }
      }
    });

    if (deletedDailyReviewsChanged) {
      write('et_deleted_daily_reviews', Array.from(deletedDailyReviewsSet));
    }

    const localOnly = local.filter(a => {
      // Bỏ qua nếu bài tập này đã có trên cloud hoặc nằm trong danh sách đã xóa
      if (cloudIds.has(a.id) || deletedIdsSet.has(a.id)) return false;

      // Các bài Spaced Repetition (daily-review-*) được tính toán client-side từ vocab assignments.
      // Luôn giữ lại chúng trong local vì chúng có createdAt trong quá khứ (ngày ôn tập)
      // và sẽ bị loại sai bởi logic 5 phút bên dưới.
      // Tuy nhiên, nếu bài ôn tập đó đã bị xóa trên cloud (nằm trong danh sách deletedDailyReviewsSet),
      // thì ta KHÔNG giữ lại nữa để bài tập biến mất hoàn toàn.
      if (a.type === 'repetition' && a.id.startsWith('daily-review-')) {
        if (deletedDailyReviewsSet.has(a.id)) return false;
        return true;
      }

      // Nếu bài tập mới được tạo ở local trong vòng 5 phút qua, giữ lại vì có thể đang đợi sync lên cloud
      const createdTime = new Date(a.createdAt || 0).getTime();
      if (nowTime - createdTime < 5 * 60 * 1000) return true;

      // Nếu bài tập cũ nhưng không có trên cloud -> đã bị xóa trên cloud, loại bỏ khỏi local
      return false;
    });

    write(KEYS.assignments, [...merged, ...localOnly]);
    hasChanges = true;
  }

  // 2. Submissions (Overwrite completely)
  if (Array.isArray(cloudData.submissions)) {
    write(KEYS.submissions, cloudData.submissions);
    hasChanges = true;
    
    // Recalculate vocab progress for all active students when submissions change
    getStudentNames().forEach(name => {
      recalculateVocabProgress(name);
    });
  }

  // 3. Daily Tracking (Overwrite completely)
  if (Array.isArray(cloudData.dailyTracking)) {
    write(KEYS.dailyTracking, cloudData.dailyTracking);
    hasChanges = true;
  }

  // 4. Badges (Overwrite completely)
  if (Array.isArray(cloudData.badges) && cloudData.badges.length > 0) {
    write('et_badges', cloudData.badges);
    hasChanges = true;
  }

  // 5. Vocabulary (Overwrite completely)
  if (Array.isArray(cloudData.vocabulary)) {
    write(KEYS.vocabulary, cloudData.vocabulary);
    hasChanges = true;
  }

  // 6. Tự động đồng bộ tiến độ học từ vựng từ ngày giao bài tập
  syncVocabProgressFromAssignments();

  return hasChanges;
}

export function syncVocabProgressFromAssignments(): void {
  const students = getStudentNames();
  const assignments = getAssignments(true).filter(a => a.type === 'vocabulary');
  const allProgress = getVocabProgressList();
  const progressMap = new Map<string, VocabProgress>();
  
  allProgress.forEach(p => {
    progressMap.set(`${p.studentName}_${p.wordId}`, p);
  });
  
  let hasChanges = false;
  const now = new Date();
  
  assignments.forEach(assignment => {
    if (!assignment.vocabCards || !assignment.createdAt) return;
    
    const targetStage = getCalculatedStage(assignment.createdAt);
    if (targetStage === 0) return;
    
    // Tính toán nextReviewDate cho stage này
    const createdDate = new Date(assignment.createdAt);
    let cumulativeDays = 0;
    for (let i = 0; i < targetStage - 1; i++) {
      cumulativeDays += REVIEW_INTERVALS[i];
    }
    const interval = REVIEW_INTERVALS[targetStage - 1] || 1;
    const nextReviewDate = new Date(createdDate.getTime() + (cumulativeDays + interval) * 24 * 60 * 60 * 1000).toISOString();
    
    students.forEach(student => {
      assignment.vocabCards!.forEach(card => {
        const key = `${student}_${card.id}`;
        const existing = progressMap.get(key);
        
        if (!existing) {
          const newProgress: VocabProgress = {
            studentName: student,
            wordId: card.id,
            stage: targetStage,
            interval: interval,
            nextReviewDate: nextReviewDate,
            repetitions: targetStage > 1 ? targetStage : 0,
            lastReviewed: now.toISOString()
          };
          progressMap.set(key, newProgress);
          allProgress.push(newProgress);
          hasChanges = true;
        } else if (existing.stage < targetStage) {
          existing.stage = targetStage;
          existing.interval = interval;
          existing.nextReviewDate = nextReviewDate;
          existing.repetitions = Math.max(existing.repetitions, targetStage > 1 ? targetStage : 0);
          hasChanges = true;
        }
      });
    });
  });
  
  if (hasChanges) {
    saveVocabProgressList(allProgress);
  }
}

export function updateAssignment(id: string, partial: Partial<Assignment>) {
  const current = getAssignments(true);
  const index = current.findIndex(a => a.id === id);
  if (index !== -1) {
    const oldTitle = current[index].title;
    current[index] = { 
      ...current[index], 
      ...partial,
      _localLastUpdated: Date.now()
    };
    write(KEYS.assignments, current);
    syncAssignmentToSheet(current[index], 'update_assignment');

    // Nếu tên bài tập thay đổi → cập nhật assignmentTitle trong tất cả submissions liên quan
    const newTitle = current[index].title;
    if (partial.title !== undefined && newTitle !== oldTitle) {
      const allSubs = getSubmissions();
      const updatedSubs = allSubs.map(s => {
        if (s.assignmentId === id) {
          return { ...s, assignmentTitle: newTitle };
        }
        return s;
      });
      write(KEYS.submissions, updatedSubs);
      // Sync tên mới lên Google Sheets (Submissions + sheet học sinh)
      syncActionToSheet({ action: 'rename_assignment_title', id, newTitle, oldTitle });
    }

    if (current[index].type === 'vocabulary' && current[index].vocabCards) {
      const currentCards = getVocabularyCards();
      const updatedCards = [...currentCards];
      let hasNewCards = false;
      current[index].vocabCards!.forEach(c => {
        if (!updatedCards.some(curr => curr.word.toLowerCase() === c.word.toLowerCase())) {
          updatedCards.push({
            ...c,
            id: c.id || crypto.randomUUID(),
            createdAt: c.createdAt || new Date().toISOString()
          });
          hasNewCards = true;
        }
      });
      if (hasNewCards) {
        saveVocabularyCards(updatedCards);
      }
    }
  }
}

export function deleteAssignment(id: string): void {
  // Lấy title trước khi xóa khỏi local store (để truyền lên GAS làm fallback xóa theo cột B)
  const assignmentToDelete = getAssignments(true).find(a => a.id === id);
  const assignmentTitle = assignmentToDelete?.title || '';

  // Ghi nhận ID bài tập đã bị xóa vào Tombstone list
  if (typeof window !== 'undefined') {
    const deletedIds = read<string[]>('et_deleted_assignment_ids', []);
    if (!deletedIds.includes(id)) {
      write('et_deleted_assignment_ids', [...deletedIds, id]);
    }

    // Nếu là bài ôn tập daily review, ghi nhận vào danh sách et_deleted_daily_reviews để tránh tự động sinh lại
    if (id.startsWith('daily-review-')) {
      const deletedReviews = read<string[]>('et_deleted_daily_reviews', []);
      if (!deletedReviews.includes(id)) {
        write('et_deleted_daily_reviews', [...deletedReviews, id]);
      }
    }
  }

  write(KEYS.assignments, getAssignments(true).filter(a => a.id !== id));
  write(KEYS.submissions, getSubmissions().filter(s => s.assignmentId !== id));
  // Truyền thêm title để GAS xóa theo cột B (Title) như fallback
  // — đặc biệt cần thiết với bài SR (daily-review-*) có thể tồn tại trên sheet với ID khác
  syncActionToSheet({ action: 'delete_assignment', id, title: assignmentTitle });
}

/**
 * Xóa chỉ các submissions của bài Shadowing ảo (có assignmentId = 'shadowing_<dictationId>').
 * Không xóa bài Dictation gốc. Dùng khi user xóa "Shadowing: ..." được sinh tự động từ Dictation.
 */
export function deleteVirtualShadowingSubmissions(shadowingAssignmentId: string): void {
  write(KEYS.submissions, getSubmissions().filter(s => s.assignmentId !== shadowingAssignmentId));
  // Không gọi delete_assignment trên server vì record gốc là Dictation, không phải Shadowing
}

// ─── CRUD – Submissions ───────────────────────────────────────────────────────

export function getSubmissions(): Submission[] {
  const raw = read<Submission[]>(KEYS.submissions, []);
  return raw.map(s => {
    if (s.details) {
      let parsedDetails = s.details;
      if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch {}
      }
      if (s.assignmentType === 'shadowing' && !s.shadowingResults) {
        return { ...s, shadowingResults: parsedDetails as any };
      } else if (s.assignmentType === 'multiple_choice' && !s.quizAnswers) {
        return { ...s, quizAnswers: parsedDetails as any };
      } else if ((s.assignmentType === 'vocab_context' || s.assignmentType === 'vocabulary') && !s.vocabAnswers) {
        return { ...s, vocabAnswers: parsedDetails as any };
      } else if (s.assignmentType === 'rewrite_vocab' && !s.rewriteAnswers) {
        return { ...s, rewriteAnswers: parsedDetails as any };
      }
    }
    return s;
  });
}

export function getSubmissionsByStudent(name: string): Submission[] {
  return getSubmissions().filter(s => s.studentName === name).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export function getSubmissionsByAssignment(id: string): Submission[] {
  return getSubmissions().filter(s => s.assignmentId === id);
}

export function getStudentSubmission(assignmentId: string, studentName: string): Submission | undefined {
  return getSubmissions().find(s => s.assignmentId === assignmentId && s.studentName === studentName);
}

// ─── CRUD – Daily Tracking ────────────────────────────────────────────────────

export function getDailyTrackings(): DailyTracking[] {
  return read<DailyTracking[]>(KEYS.dailyTracking, []);
}

export function getDailyTrackingsByStudent(name: string): DailyTracking[] {
  return getDailyTrackings().filter(t => t.studentName === name).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

// ─── Update & Delete ──────────────────────────────────────────────────────────

export function updateSubmissionScore(id: string, newScore: number): void {
  const all = getSubmissions();
  const idx = all.findIndex(s => s.id === id);
  if (idx !== -1) {
    all[idx].score = newScore;
    write(KEYS.submissions, all);
    syncActionToSheet({ action: 'update_submission_score', id, score: newScore });
  }
}

export function updateSubmissionDate(id: string, newDateStr: string): void {
  const all = getSubmissions();
  const idx = all.findIndex(s => s.id === id);
  if (idx !== -1) {
    all[idx].submittedAt = new Date(newDateStr + 'T12:00:00').toISOString();
    write(KEYS.submissions, all);
    syncActionToSheet({ action: 'update_submission_score', id, score: all[idx].score, submittedAt: all[idx].submittedAt });
  }
}

export function updateTrackingDate(id: string, newDateStr: string): void {
  const all = getDailyTrackings();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx].submittedAt = new Date(newDateStr + 'T12:00:00').toISOString();
    write(KEYS.dailyTracking, all);
    syncActionToSheet({ action: 'update_tracking_score', id, score: all[idx].score, submittedAt: all[idx].submittedAt });
  }
}

export function deleteSubmission(id: string): void {
  const all = getSubmissions();
  const subToDelete = all.find(s => s.id === id);
  if (!subToDelete) return;

  write(KEYS.submissions, all.filter(s => s.id !== id));
  syncActionToSheet({ action: 'delete_submission', id });

  // If this was a vocabulary or repetition submission, recalculate spaced repetition progress
  if (subToDelete.assignmentType === 'vocabulary' || subToDelete.assignmentType === 'repetition') {
    recalculateVocabProgress(subToDelete.studentName);
  }
}

export function updateTrackingScore(id: string, newScore: number): void {
  const all = getDailyTrackings();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx].score = newScore;
    write(KEYS.dailyTracking, all);
    syncActionToSheet({ action: 'update_tracking_score', id, score: newScore });
  }
}

export function deleteTracking(id: string): void {
  const all = getDailyTrackings();
  write(KEYS.dailyTracking, all.filter(t => t.id !== id));
  syncActionToSheet({ action: 'delete_tracking', id });
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.assignments);
  localStorage.removeItem(KEYS.submissions);
  localStorage.removeItem(KEYS.dailyTracking);
  // Không xóa KEYS.seeded để tránh việc tự động tạo lại dữ liệu mẫu khi reload
  localStorage.removeItem('et_gamification');
  
  syncActionToSheet({ action: 'clear_all_data' });
}

// ─── Scoring & Submit ─────────────────────────────────────────────────────────

function getAdjustedSubmitTime(assignmentCreatedAt: string | undefined, overrideDate?: string): string {
  const now = new Date();
  // If an overrideDate is provided (e.g. nextReviewDate for repetition), use it
  const anchorDateStr = overrideDate || assignmentCreatedAt;
  if (!anchorDateStr) return now.toISOString();

  try {
    const anchorDate = new Date(anchorDateStr);
    if (isNaN(anchorDate.getTime())) return now.toISOString();

    const anchorDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (nowDay > anchorDay) {
      const adjusted = new Date(anchorDay);
      adjusted.setHours(23, 59, 59, 999);
      return adjusted.toISOString();
    }
  } catch (e) {
    // Ignore error
  }
  return now.toISOString();
}

// Get the nextReviewDate for all vocab cards in an assignment for a specific student.
// Returns the earliest nextReviewDate so the assignment's submission is aligned to it.
export function getAssignmentNextReviewDate(assignmentId: string, studentName: string): string | undefined {
  const assignment = getAssignment(assignmentId);
  if (!assignment?.vocabCards || assignment.vocabCards.length === 0) return undefined;
  const progressList = getVocabProgressList();
  let earliest: string | undefined;
  assignment.vocabCards.forEach(card => {
    const prog = progressList.find(p => p.studentName === studentName && p.wordId === card.id);
    if (prog?.nextReviewDate) {
      if (!earliest || prog.nextReviewDate < earliest) {
        earliest = prog.nextReviewDate;
      }
    }
  });
  return earliest;
}

export function submitVocab(payload: {
  assignmentId: string; studentName: string;
  answers: { word: string; studentAnswer: string }[];
  overriddenWords?: string[];
  durationMs?: number;
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const keywords = assignment.keywords || [];
  const vocabAnswers: VocabAnswerResult[] = keywords.map(kw => {
    const entry = payload.answers.find(a => a.word.toLowerCase() === kw.word.toLowerCase());
    const studentAnswer = entry?.studentAnswer || '';
    const isOverride = payload.overriddenWords?.includes(kw.word) || false;
    return { word: kw.word, studentAnswer, isCorrect: isOverride || isFuzzyMatch(studentAnswer, kw.answer), correctAnswer: kw.answer };
  });

  const correct = vocabAnswers.filter(a => a.isCorrect).length;
  const score = keywords.length > 0 ? Math.round((correct / keywords.length) * 100) : 0;

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: 'vocab_context',
    studentName: payload.studentName,
    score,
    vocabAnswers,
    durationMs: payload.durationMs,
    submittedAt: getAdjustedSubmitTime(assignment.createdAt),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitVocabularyAssignment(payload: {
  assignmentId: string;
  studentName: string;
  score: number;
  dictationScore?: number;
  answers: { word: string; studentAnswer: string; isCorrect: boolean; attempts?: number }[];
  durationMs?: number;
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const isRepetition = assignment.type === 'repetition';
  
  // For repetition assignments, stamp submission on the nextReviewDate
  const nextReviewDate = isRepetition
    ? getAssignmentNextReviewDate(payload.assignmentId, payload.studentName)
    : undefined;

  const submittedAt = getAdjustedSubmitTime(assignment.createdAt, nextReviewDate);

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: isRepetition ? 'repetition' : 'vocabulary',
    studentName: payload.studentName,
    score: payload.score,
    vocabAnswers: payload.answers.map(ans => ({
      word: ans.word,
      studentAnswer: ans.studentAnswer,
      isCorrect: ans.isCorrect,
      correctAnswer: ans.word,
      attempts: ans.attempts
    })),
    durationMs: payload.durationMs,
    submittedAt,
  };

  // Save the submission
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);

  // If there's a dictation score from a requirement workflow, save it as a Daily Tracking
  if (payload.dictationScore !== undefined) {
    const trackingRecord: DailyTracking = {
      id: crypto.randomUUID(),
      studentName: payload.studentName,
      category: 'Dictation',
      score: payload.dictationScore,
      submittedAt,
    };
    write(KEYS.dailyTracking, [...getDailyTrackings(), trackingRecord]);
    syncSubmissionToSheet({
      ...trackingRecord,
      type: 'daily_tracking',
      imageBase64: ''
    });
  }

  // Seed into global vocabulary library if not present
  const currentCards = getVocabularyCards();
  const assignmentCards = assignment.vocabCards || [];

  const updatedCards = [...currentCards];
  assignmentCards.forEach(c => {
    if (!updatedCards.some(curr => curr.word.toLowerCase() === c.word.toLowerCase())) {
      updatedCards.push({
        ...c,
        id: c.id || crypto.randomUUID(),
        createdAt: c.createdAt || new Date().toISOString()
      });
    }
  });
  saveVocabularyCards(updatedCards);

  // Initialize/update progress in spaced repetition for the student
  // We need to re-fetch vocabulary cards to have the correct assigned IDs
  const freshCards = getVocabularyCards();
  assignmentCards.forEach(ac => {
    const matched = freshCards.find(fc => fc.word.toLowerCase() === ac.word.toLowerCase());
    if (matched) {
      const ansStatus = payload.answers.find(a => a.word.toLowerCase() === ac.word.toLowerCase());
      const rating = ansStatus ? (ansStatus.isCorrect ? 'good' : 'again') : 'good';
      updateVocabProgress(payload.studentName, matched.id, rating);
    }
  });

  return sub;
}

export function submitQuiz(payload: {
  assignmentId: string; studentName: string;
  answers: { questionId: number; studentAnswer: string }[];
  durationMs?: number;
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const questions = assignment.questions || [];
  const quizAnswers: QuizAnswerResult[] = questions.map(q => {
    const entry = payload.answers.find(a => a.questionId === q.id);
    const studentAnswer = entry?.studentAnswer || '';
    const isCorrect = studentAnswer.trim().toUpperCase() === q.answer.trim().toUpperCase();
    return { questionId: q.id, studentAnswer, isCorrect, correctAnswer: q.answer, explanation: q.explanation, knowledgeArea: q.knowledgeArea };
  });

  const correct = quizAnswers.filter(a => a.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  const wrongAnswers = quizAnswers.filter(a => !a.isCorrect);
  const areas: Record<string, number> = {};
  wrongAnswers.forEach(w => {
    const area = w.knowledgeArea || 'Khác';
    areas[area] = (areas[area] || 0) + 1;
  });
  const feedback = Object.keys(areas).length > 0
    ? `Hệ thống nhận thấy bạn cần ôn tập thêm các mảng kiến thức sau:\n` + Object.keys(areas).map(k => `- ${k} (sai ${areas[k]} câu)`).join('\n')
    : 'Tuyệt vời, bạn đã nắm vững các kiến thức trong bài!';

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: 'multiple_choice',
    studentName: payload.studentName,
    score,
    quizAnswers,
    feedback,
    durationMs: payload.durationMs,
    submittedAt: getAdjustedSubmitTime(assignment.createdAt),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitRewrite(payload: {
  assignmentId: string; studentName: string;
  studentText: string;
  durationMs?: number;
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const keywords = assignment.keywords || [];
  const textLower = payload.studentText.toLowerCase();

  const foundKeywords: string[] = [];
  const missingKeywords: string[] = [];

  keywords.forEach(kw => {
    // Check if keyword exists in text (case insensitive)
    if (textLower.includes(kw.word.toLowerCase())) {
      foundKeywords.push(kw.word);
    } else {
      missingKeywords.push(kw.word);
    }
  });

  const correct = foundKeywords.length;
  const score = keywords.length > 0 ? Math.round((correct / keywords.length) * 100) : 0;

  const rewriteAnswers: RewriteAnswerResult = {
    studentText: payload.studentText,
    foundKeywords,
    missingKeywords,
  };

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: 'rewrite_vocab',
    studentName: payload.studentName,
    score,
    rewriteAnswers,
    durationMs: payload.durationMs,
    submittedAt: getAdjustedSubmitTime(assignment.createdAt),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

// ─── Dictation Submit ────────────────────────────────────────────────────────

export function submitDictation(payload: {
  assignmentId: string;
  studentName: string;
  results: DictationResult[];
  durationMs?: number;
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const totalAccuracy = payload.results.reduce((sum, r) => sum + r.accuracy, 0);
  const score = payload.results.length > 0 ? Math.round(totalAccuracy / payload.results.length) : 0;

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: 'dictation',
    studentName: payload.studentName,
    score,
    dictationResults: payload.results,
    durationMs: payload.durationMs,
    submittedAt: getAdjustedSubmitTime(assignment.createdAt),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitSentenceShadowing(payload: {
  assignmentId: string;      // UUID của bài Shadowing (standalone hoặc sinh từ Dictation)
  assignmentTitle: string;
  studentName: string;
  results: { sentenceId: string | number; recognized: string; accuracy: number; attempts: number }[];
  durationMs?: number;
}): Submission {
  const newScore = payload.results.length > 0
    ? Math.round(payload.results.reduce((sum, r) => sum + r.accuracy, 0) / payload.results.length)
    : 0;

  const newShadowingResults = payload.results.map(r => ({
    word: String(r.sentenceId),
    recognized: r.recognized,
    accuracy: r.accuracy,
    attempts: r.attempts,
  }));

  // Tự động lấy điểm cao nhất: nếu đã có submission cho bài này → cập nhật thay vì tạo mới.
  // - Nếu điểm mới CAO hơn → cập nhật toàn bộ (score + results + duration).
  // - Nếu điểm mới THẤP hơn → giữ score cũ nhưng vẫn cập nhật results để hiện lần luyện mới nhất.
  const allSubs = getSubmissions();
  const existingIdx = allSubs.findIndex(
    s => s.assignmentId === payload.assignmentId && s.studentName === payload.studentName
  );

  if (existingIdx !== -1) {
    const existing = allSubs[existingIdx];
    const keepScore = Math.max(existing.score, newScore); // luôn giữ điểm cao hơn
    const updated: Submission = {
      ...existing,
      score: keepScore,
      shadowingResults: newShadowingResults,
      durationMs: payload.durationMs ?? existing.durationMs,
      // Giữ submittedAt gốc nếu điểm mới không vượt qua điểm cũ
      submittedAt: newScore > existing.score
        ? getAdjustedSubmitTime(getAssignment(payload.assignmentId)?.createdAt)
        : existing.submittedAt,
    };
    allSubs[existingIdx] = updated;
    write(KEYS.submissions, allSubs);
    syncSubmissionToSheet(updated);
    return updated;
  }

  // Lần đầu nộp → tạo mới bình thường
  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: payload.assignmentTitle,
    assignmentType: 'shadowing',
    studentName: payload.studentName,
    score: newScore,
    shadowingResults: newShadowingResults,
    durationMs: payload.durationMs,
    submittedAt: getAdjustedSubmitTime(getAssignment(payload.assignmentId)?.createdAt),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitDailyTracking(payload: {
  studentName: string;
  category: TrackCategory;
  score: number;
  imageBase64: string;
  customDate?: string;
}): DailyTracking {
  const record: DailyTracking = {
    id: crypto.randomUUID(),
    studentName: payload.studentName,
    category: payload.category,
    score: payload.score,
    submittedAt: payload.customDate
      ? new Date(payload.customDate).toISOString()
      : new Date().toISOString(),
  };

  // Lưu record vào localStorage (KHÔNG lưu image để tiết kiệm dung lượng)
  write(KEYS.dailyTracking, [...getDailyTrackings(), record]);

  // Đẩy lên Google Sheets kèm theo ảnh
  syncSubmissionToSheet({
    ...record,
    type: 'daily_tracking',
    imageBase64: payload.imageBase64
  });

  return record;
}

// ─── Data Migrations ──────────────────────────────────────────────────────────

const MIGRATION_KEY = 'et_migration_v1_submittedAt';

/**
 * Caps any submission whose submittedAt falls on a day AFTER the assignment's
 * creation day to 23:59:59.999 of that creation day.
 *
 * Uses a localStorage flag so the full scan only runs once per device.
 * The flag is cleared on each new app version bump (change MIGRATION_KEY).
 */
export function migrateStaleSubmitTimestamps(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const assignments = getAssignments();
  const submissions = getSubmissions();
  let changed = false;

  const updated = submissions.map(sub => {
    // Tất cả Shadowing submissions giờ dùng UUID trực tiếp, không có prefix
    const assignment = assignments.find(
      a => a.id === sub.assignmentId
    );
    if (assignment?.createdAt && sub.submittedAt) {
      const cDate = new Date(assignment.createdAt);
      const sDate = new Date(sub.submittedAt);
      if (!isNaN(cDate.getTime()) && !isNaN(sDate.getTime())) {
        const cDay = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate());
        const sDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
        if (sDay > cDay) {
          const adjusted = new Date(cDay);
          adjusted.setHours(23, 59, 59, 999);
          changed = true;
          return { ...sub, submittedAt: adjusted.toISOString() };
        }
      }
    }
    return sub;
  });

  if (changed) write(KEYS.submissions, updated);

  // Trigger GAS to run the same fix on the Google Sheets database.
  // Fire-and-forget (no-cors) — GAS handles the 'fix_submitted_at' action
  // by calling fixPastSubmissionsTime() on the server side.
  void syncActionToSheet({ action: 'fix_submitted_at' });

  localStorage.setItem(MIGRATION_KEY, '1');
}

const CLEANUP_REPETITION_SUBS_KEY = 'et_migration_v1_cleanupRepetitionSubs';

/**
 * Removes fake submissions (score: 100) that autoSubmitPreviousStagesLocal
 * injected for skipped Spaced Repetition stages. These aren't real test
 * results and were skewing class-average stats. The Repetition feature
 * itself has been removed, so this is a one-time cleanup.
 *
 * Uses a localStorage flag so the full scan only runs once per device.
 */
export function cleanupFakeRepetitionSubmissions(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(CLEANUP_REPETITION_SUBS_KEY)) return;

  const submissions = getSubmissions();
  const filtered = submissions.filter(s => s.assignmentType !== 'repetition');

  if (filtered.length !== submissions.length) {
    write(KEYS.submissions, filtered);
  }

  // Trigger GAS to run the same cleanup on the Google Sheets database.
  // Fire-and-forget (no-cors) — GAS handles the 'cleanup_fake_repetition_submissions'
  // action by calling cleanupFakeRepetitionSubmissions() on the server side.
  void syncActionToSheet({ action: 'cleanup_fake_repetition_submissions' });

  localStorage.setItem(CLEANUP_REPETITION_SUBS_KEY, '1');
}

// Auto-run on every page that imports this module (client-side only).
// setTimeout defers past React's hydration so localStorage is definitely available.
if (typeof window !== 'undefined') {
  setTimeout(migrateStaleSubmitTimestamps, 0);
  setTimeout(cleanupFakeRepetitionSubmissions, 0);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

let initializedSwitch = false;
export function seedIfEmpty(): void {
  if (typeof window === 'undefined') return;

  if (!initializedSwitch) {
    initializedSwitch = true;
    const isCurrentlyMock = localStorage.getItem('is_mock_db') === '1';
    if (USE_MOCK_DB && !isCurrentlyMock) {
      localStorage.clear();
      localStorage.setItem('is_mock_db', '1');
    } else if (!USE_MOCK_DB && isCurrentlyMock) {
      localStorage.clear();
      localStorage.setItem('is_mock_db', '0');
    }
  }

  // Patch existing assignments that might be missing keywords or vocabCards (e.g. D8 bug)
  const assignments = getAssignments(true);
  let changed = false;
  const updatedAssignments = assignments.map(a => {
    let patched = false;
    const update = { ...a };
    if (!update.keywords) {
      update.keywords = [];
      patched = true;
    }
    if (!update.vocabCards) {
      update.vocabCards = [];
      patched = true;
    }
    if (update.type === 'repetition' && (!update.skill || update.skill !== 'Repetition')) {
      update.skill = 'Repetition';
      patched = true;
    }
    if (patched) changed = true;
    return update;
  });

  if (changed) {
    write(KEYS.assignments, updatedAssignments);
    void syncActionToSheet({ action: 'fix_repetition_skill' });
  }

  migrateStaleSubmitTimestamps();

  if (localStorage.getItem(KEYS.seeded)) return;

  if (USE_MOCK_DB) {
    write(KEYS.assignments, mockAssignments);
    write(KEYS.submissions, mockSubmissions);
    write(KEYS.dailyTracking, mockTrackings);
    write(KEYS.vocabulary, mockVocabCards);
    write(KEYS.vocabProgress, mockVocabProgress);
    write(KEYS.gamification, mockGamification);
    write('et_students', [
      { id: '1', name: 'Huy', color: '#3B82F6', avatar: 'HY', createdAt: new Date().toISOString() },
      { id: '2', name: 'Linh', color: '#10B981', avatar: 'LN', createdAt: new Date().toISOString() },
      { id: '3', name: 'Tuấn', color: '#F59E0B', avatar: 'TN', createdAt: new Date().toISOString() },
      { id: '4', name: 'Mai', color: '#EF4444', avatar: 'MI', createdAt: new Date().toISOString() }
    ]);
  }

  localStorage.setItem(KEYS.seeded, '1');
}

export function getVocabularyCards(): VocabCard[] {
  const cards = read<VocabCard[]>(KEYS.vocabulary, []);
  // Filter out corrupted cards (e.g. VocabProgress objects mistakenly saved as cards)
  return cards.filter(c => c.word !== undefined);
}

export function saveVocabularyCards(cards: VocabCard[]): void {
  write(KEYS.vocabulary, cards);
  syncVocabListToSheet(cards);
}

export function getVocabProgressList(): VocabProgress[] {
  return read<VocabProgress[]>(KEYS.vocabProgress, []);
}

export function saveVocabProgressList(list: VocabProgress[]): void {
  write(KEYS.vocabProgress, list);
}

export function getStudentVocabProgress(studentName: string): VocabProgress[] {
  return getVocabProgressList().filter(p => p.studentName === studentName);
}

const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60]; // 2 months stages

export function getCalculatedStage(createdAt?: string): number {
  if (!createdAt) return 0;
  const createdDate = new Date(createdAt);
  const today = new Date();
  const diffTime = Math.max(0, today.getTime() - createdDate.getTime());
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysPassed >= 55) return 6;
  if (daysPassed >= 25) return 5;
  if (daysPassed >= 11) return 4;
  if (daysPassed >= 4) return 3;
  if (daysPassed >= 1) return 2;
  return 1;
}

export function updateVocabProgress(
  studentName: string,
  wordId: string,
  rating: 'easy' | 'good' | 'hard' | 'again',
  actionDate?: Date,
  isSynced: boolean = false
): VocabProgress {
  const allProgress = getVocabProgressList();
  let progressIndex = allProgress.findIndex(p => p.studentName === studentName && p.wordId === wordId);

  let progress: VocabProgress;
  const now = actionDate || new Date();

  if (isSynced) {
    // Calculate stage based on actionDate (creation date of assignment) and today's date
    const today = new Date();
    const diffTime = Math.max(0, today.getTime() - now.getTime());
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let computedStage = 2; // Default to Stage 2 since they got 100% correct
    if (daysPassed >= 55) {
      computedStage = 6;
    } else if (daysPassed >= 25) {
      computedStage = 5;
    } else if (daysPassed >= 11) {
      computedStage = 4;
    } else if (daysPassed >= 4) {
      computedStage = 3;
    } else if (daysPassed >= 1) {
      computedStage = 2;
    }
    
    const interval = REVIEW_INTERVALS[computedStage - 1] || 1;
    const nextReviewDate = new Date(today.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
    
    if (progressIndex === -1) {
      progress = {
        studentName,
        wordId,
        stage: computedStage,
        interval,
        nextReviewDate,
        repetitions: 1,
        lastReviewed: now.toISOString()
      };
      allProgress.push(progress);
    } else {
      progress = allProgress[progressIndex];
      // Keep the higher stage (real progress shouldn't be downgraded by sync)
      progress.stage = Math.max(progress.stage, computedStage);
      progress.interval = REVIEW_INTERVALS[progress.stage - 1] || 1;
      progress.nextReviewDate = nextReviewDate;
      progress.lastReviewed = now.toISOString();
      allProgress[progressIndex] = progress;
    }
  } else {
    if (progressIndex === -1) {
      progress = {
        studentName,
        wordId,
        stage: rating === 'again' ? 1 : rating === 'hard' ? 1 : rating === 'good' ? 2 : 3,
        interval: 1,
        nextReviewDate: now.toISOString(),
        repetitions: 1,
        lastReviewed: now.toISOString()
      };

      // Calculate initial next review date
      const stageVal = progress.stage;
      const days = REVIEW_INTERVALS[stageVal - 1] || 1;
      progress.interval = days;
      progress.nextReviewDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      allProgress.push(progress);
    } else {
      progress = allProgress[progressIndex];
      progress.repetitions += 1;
      progress.lastReviewed = now.toISOString();

      const isDue = new Date(progress.nextReviewDate) <= now;

      if (rating === 'again') {
        progress.stage = 1;
      } else if (rating === 'hard') {
        progress.stage = Math.max(1, progress.stage - 1);
      } else if (rating === 'good') {
        if (isDue) progress.stage = Math.min(6, progress.stage + 1);
      } else if (rating === 'easy') {
        if (isDue) progress.stage = Math.min(6, progress.stage + 2);
      }

      const days = REVIEW_INTERVALS[progress.stage - 1];
      progress.interval = days;
      progress.nextReviewDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      allProgress[progressIndex] = progress;
    }
  }

  write(KEYS.vocabProgress, allProgress);
  return progress;
}

export function recalculateVocabProgress(studentName: string): void {
  // Clear progress for this student
  let allProgress = getVocabProgressList().filter(p => p.studentName !== studentName);
  write(KEYS.vocabProgress, allProgress);

  // Get all remaining vocabulary submissions for this student, sorted oldest to newest
  const allSubmissions = getSubmissions()
    .filter(s => s.studentName === studentName && 
                 (s.assignmentType === 'vocabulary' || 
                 (s.assignmentType === 'repetition' && (s.durationMs !== 0 || s.assignmentId.startsWith('daily-review-')))))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const freshCards = getVocabularyCards();

  // Replay submissions
  allSubmissions.forEach(sub => {
    if (!sub.vocabAnswers) return;
    const subDate = new Date(sub.submittedAt);
    const isSynced = !sub.durationMs || Number(sub.durationMs) === 0;

    sub.vocabAnswers.forEach(ans => {
      const matchedCard = freshCards.find(fc => fc.word.toLowerCase() === ans.word.toLowerCase());
      if (matchedCard) {
        const rating = ans.isCorrect ? 'good' : 'again';
        updateVocabProgress(studentName, matchedCard.id, rating, subDate, isSynced);
      }
    });
  });
}

export function importExternalVocabWithProgress(
  studentName: string,
  vocabCards: VocabCard[],
  stage: number,
  repetitions: number,
  creationDateStr: string
): void {
  const currentCards = getVocabularyCards();
  const updatedCards = [...currentCards];
  let hasNewCards = false;

  const resolvedCards: VocabCard[] = [];

  vocabCards.forEach(c => {
    let existingCard = updatedCards.find(curr => curr.word.toLowerCase() === c.word.toLowerCase());
    if (!existingCard) {
      existingCard = {
        ...c,
        id: c.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7)),
        createdAt: c.createdAt || new Date().toISOString()
      };
      updatedCards.push(existingCard);
      hasNewCards = true;
    }
    resolvedCards.push(existingCard);
  });

  if (hasNewCards) {
    saveVocabularyCards(updatedCards);
  }

  const allProgress = getVocabProgressList();
  const creationDate = new Date(creationDateStr);
  
  const interval = REVIEW_INTERVALS[Math.max(0, stage - 1)] || 1;
  const nextReviewDate = new Date(creationDate.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();

  resolvedCards.forEach(c => {
    const wordId = c.id;
    const progressIndex = allProgress.findIndex(p => p.studentName === studentName && p.wordId === wordId);

    if (progressIndex === -1) {
      allProgress.push({
        studentName,
        wordId,
        stage,
        interval,
        nextReviewDate,
        repetitions,
        lastReviewed: creationDate.toISOString()
      });
    } else {
      allProgress[progressIndex] = {
        ...allProgress[progressIndex],
        stage,
        interval,
        nextReviewDate,
        repetitions,
        lastReviewed: creationDate.toISOString()
      };
    }
  });

  write(KEYS.vocabProgress, allProgress);
}

function getDaysDifference(date1: Date | string, date2: Date | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ─── SR Preview Types ────────────────────────────────────────────────────────

export interface SRPreviewItem {
  date: string;           // YYYY-MM-DD
  dateLabel: string;      // Hiển thị: "07/07/2026"
  id: string;             // daily-review-YYYY-MM-DD
  cardCount: number;
  sources: { id: string; title: string; round: number }[];
  status: 'new' | 'update' | 'unchanged' | 'delete';
  // Nếu là bài vocab tạo hôm nay thì lên lịch ngày mai 5h sáng
  scheduledFor?: string;  // ISO string thực tế sẽ dùng làm createdAt
}

export interface SRPreviewResult {
  items: SRPreviewItem[];
  newCount: number;
  updateCount: number;
  deleteCount: number;
  unchangedCount: number;
}

/** Chạy logic SR giống generateDailyReviewAssignment nhưng KHÔNG LƯU — chỉ trả về preview */
export function previewSRGeneration(clearDeletedTombstone = false): SRPreviewResult {
  const assignments = getAssignments();
  const vocabAssignments = assignments.filter(a => a.type === 'vocabulary' && a.vocabCards && a.vocabCards.length > 0);

  if (vocabAssignments.length === 0) {
    return { items: [], newCount: 0, updateCount: 0, deleteCount: 0, unchangedCount: 0 };
  }

  const sortedVocab = [...vocabAssignments].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const firstDate = new Date(sortedVocab[0].createdAt || new Date());
  firstDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(today);

  // Tính ngày mai 5h sáng cho bài vocab tạo hôm nay
  const tomorrowAt5 = new Date(today);
  tomorrowAt5.setDate(tomorrowAt5.getDate() + 1);
  tomorrowAt5.setHours(5, 0, 0, 0);

  const intervals = [1, 4, 11, 25, 55, 115];

  // Khi user chủ động nhấn "Tạo bài Ôn tập SR", xóa tombstone để cho phép tạo lại.
  // Tombstone chỉ cần ngăn cloud-sync tự động tạo lại, không nên chặn user chủ động.
  if (clearDeletedTombstone && typeof window !== 'undefined') {
    write('et_deleted_daily_reviews', []);
  }
  const deletedDailyReviews = typeof window !== 'undefined' ? read<string[]>('et_deleted_daily_reviews', []) : [];

  const items: SRPreviewItem[] = [];
  let newCount = 0, updateCount = 0, deleteCount = 0, unchangedCount = 0;

  const currentDate = new Date(firstDate);
  while (currentDate <= today) {
    const dateStr = toLocalDateString(currentDate);
    const dailyReviewId = `daily-review-${dateStr}`;

    if (deletedDailyReviews.includes(dailyReviewId)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const cardsToReview: VocabCard[] = [];
    const sources: { id: string; title: string; round: number }[] = [];

    vocabAssignments.forEach(a => {
      const diff = getDaysDifference(a.createdAt || new Date(), currentDate);
      const idx = intervals.indexOf(diff);
      if (idx !== -1) {
        const round = idx + 2;
        (a.vocabCards || []).forEach(card => {
          if (!cardsToReview.some(c => c.word.toLowerCase() === card.word.toLowerCase())) {
            cardsToReview.push(card);
          }
        });
        sources.push({ id: a.id, title: a.title, round });
      }
    });

    const existingAssign = assignments.find(a => a.id === dailyReviewId);
    const passageStr = JSON.stringify({ sources });

    // Xác định scheduledFor: ngày hôm nay thì dời sang 5h sáng ngày mai
    const isToday = dateStr === todayStr;
    const targetDate = new Date(currentDate);
    targetDate.setHours(isToday ? 0 : 8, 0, 0, 0);
    const scheduledFor = isToday ? tomorrowAt5.toISOString() : targetDate.toISOString();

    let status: SRPreviewItem['status'];

    if (existingAssign) {
      const isSameCards =
        existingAssign.vocabCards &&
        existingAssign.vocabCards.length === cardsToReview.length &&
        existingAssign.vocabCards.every((c, i) => c.id === cardsToReview[i]?.id);
      const isSamePassage = existingAssign.passage === passageStr;

      if (cardsToReview.length === 0) {
        status = 'delete';
        deleteCount++;
      } else if (!isSameCards || !isSamePassage) {
        status = 'update';
        updateCount++;
      } else {
        status = 'unchanged';
        unchangedCount++;
      }
    } else {
      if (cardsToReview.length > 0) {
        status = 'new';
        newCount++;
      } else {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
    }

    items.push({
      date: dateStr,
      dateLabel: new Date(dateStr + 'T12:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      id: dailyReviewId,
      cardCount: cardsToReview.length,
      sources,
      status,
      scheduledFor: isToday ? tomorrowAt5.toISOString() : undefined,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { items, newCount, updateCount, deleteCount, unchangedCount };
}

export function generateDailyReviewAssignment(clearDeletedTombstone = false) {
  const assignments = getAssignments(true);
  const vocabAssignments = assignments.filter(a => a.type === 'vocabulary' && a.vocabCards && a.vocabCards.length > 0);
  if (vocabAssignments.length === 0) return;

  // Sắp xếp các bài vocabulary theo ngày tạo tăng dần để tìm ngày bắt đầu
  const sortedVocab = [...vocabAssignments].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const firstDate = new Date(sortedVocab[0].createdAt || new Date());
  firstDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(today);

  // Bài vocab tạo hôm nay → SR lên lịch 5h sáng ngày mai
  const tomorrowAt5 = new Date(today);
  tomorrowAt5.setDate(tomorrowAt5.getDate() + 1);
  tomorrowAt5.setHours(5, 0, 0, 0);

  // Lần 1: 0, Lần 2: 1, Lần 3: 4, Lần 4: 11, Lần 5: 25, Lần 6: 55, Lần 7: 115
  const intervals = [1, 4, 11, 25, 55, 115]; // Tương ứng Lần 2, 3, 4, 5, 6, 7
  let hasChanges = false;
  const newAssignments = [...assignments];

  // Khi user chủ động nhấn "Tạo bài Ôn tập SR", xóa tombstone để cho phép tạo lại.
  // Tombstone chỉ cần ngăn cloud-sync tự động tạo lại, không nên chặn user chủ động.
  if (clearDeletedTombstone && typeof window !== 'undefined') {
    write('et_deleted_daily_reviews', []);
  }

  // Đọc danh sách bài ôn tập daily review đã bị xóa để tránh tự động tạo lại
  const deletedDailyReviews = typeof window !== 'undefined' ? read<string[]>('et_deleted_daily_reviews', []) : [];

  // Duyệt qua từng ngày từ firstDate đến today
  const currentDate = new Date(firstDate);
  while (currentDate <= today) {
    const dateStr = toLocalDateString(currentDate);
    const dailyReviewId = `daily-review-${dateStr}`;

    const isDeleted = deletedDailyReviews.includes(dailyReviewId);
    if (isDeleted) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Tìm tất cả từ vựng cần ôn vào ngày currentDate (Lần lặp > 1)
    const cardsToReview: VocabCard[] = [];
    const sources: { id: string; title: string; round: number }[] = [];

    vocabAssignments.forEach(a => {
      const diff = getDaysDifference(a.createdAt || new Date(), currentDate);
      const idx = intervals.indexOf(diff);
      if (idx !== -1) {
        const round = idx + 2; // idx = 0 -> Lần 2
        (a.vocabCards || []).forEach(card => {
          if (!cardsToReview.some(c => c.word.toLowerCase() === card.word.toLowerCase())) {
            cardsToReview.push(card);
          }
        });
        sources.push({ id: a.id, title: a.title, round });
      }
    });

    // Xác định thời điểm thực tế cho bài ôn tập:
    // - Ngày hôm nay (vocab vừa tạo hôm nay) → dời sang 5h sáng ngày mai
    // - Các ngày trong quá khứ → 8h sáng ngày đó
    const isToday = dateStr === todayStr;
    const targetDate = isToday ? tomorrowAt5 : (() => {
      const d = new Date(currentDate);
      d.setHours(8, 0, 0, 0);
      return d;
    })();

    const passageStr = JSON.stringify({ sources });

    // Kiểm tra xem bài ôn tập cho ngày này đã có trong danh sách chưa
    const existingIndex = newAssignments.findIndex(a => a.id === dailyReviewId);

    if (existingIndex !== -1) {
      // Đã tồn tại bài ôn tập, cần kiểm tra xem có cần cập nhật không
      const existing = newAssignments[existingIndex];
      
      const isSameCards =
        existing.vocabCards &&
        existing.vocabCards.length === cardsToReview.length &&
        existing.vocabCards.every((c, i) => c.id === cardsToReview[i].id);

      const isSamePassage = existing.passage === passageStr;

      if (!isSameCards || !isSamePassage) {
        if (cardsToReview.length === 0) {
          // Nếu không còn từ nào cần ôn ở ngày này, xóa bài ôn tập đó đi
          newAssignments.splice(existingIndex, 1);
          syncActionToSheet({ action: 'delete_assignment', id: dailyReviewId });
        } else {
          // Cập nhật lại bài ôn tập
          const updatedAssign = {
            ...existing,
            vocabCards: cardsToReview,
            passage: passageStr
          };
          newAssignments[existingIndex] = updatedAssign;
          syncAssignmentToSheet(updatedAssign, 'update_assignment');
        }
        hasChanges = true;
      }
    } else {
      // Chưa tồn tại, tiến hành tạo mới nếu có từ cần ôn
      if (cardsToReview.length > 0) {
        const reviewAssign: Assignment = {
          id: dailyReviewId,
          title: `📝 Ôn tập từ vựng — ${targetDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
          type: 'repetition',
          skill: 'Repetition',
          vocabCards: cardsToReview,
          createdAt: targetDate.toISOString(),
          isHidden: false,
          passage: passageStr
        };

        newAssignments.push(reviewAssign);
        hasChanges = true;
        syncAssignmentToSheet(reviewAssign);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (hasChanges) {
    write(KEYS.assignments, newAssignments);
  }
}

export async function syncPastReviewAssignments(): Promise<{ count: number }> {
  const assignments = getAssignments();
  const todayStr = toLocalDateString(new Date());
  
  // Lọc các bài daily review trong quá khứ (ngày tạo trước ngày hôm nay)
  const pastReviews = assignments.filter(a => 
    a.type === 'repetition' && 
    a.id.startsWith('daily-review-') && 
    a.id.replace('daily-review-', '') < todayStr
  );

  const students = getStudentNames();
  const allSubmissions = getSubmissions();
  const newSubs: Submission[] = [];

  pastReviews.forEach(a => {
    const reviewDateStr = a.id.replace('daily-review-', ''); // YYYY-MM-DD
    const submittedAt = new Date(reviewDateStr + 'T23:59:59').toISOString();

    students.forEach(student => {
      const exists = allSubmissions.some(sub => sub.studentName === student && sub.assignmentId === a.id);
      if (!exists) {
        const vocabAnswers = (a.vocabCards || []).map(card => ({
          word: card.word,
          studentAnswer: card.word,
          isCorrect: true,
          correctAnswer: card.word
        }));

        newSubs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
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
          submittedAt: submittedAt,
          durationMs: 0
        });
      }
    });
  });

  if (newSubs.length > 0) {
    write(KEYS.submissions, [...allSubmissions, ...newSubs]);
    // Sau khi thêm submissions mới, tính toán lại vocab progress cho tất cả học sinh bị ảnh hưởng
    const affectedStudents = Array.from(new Set(newSubs.map(s => s.studentName)));
    affectedStudents.forEach(studentName => {
      recalculateVocabProgress(studentName);
    });
  }

  // Khôi phục (unhide) các bài daily-review cũ để hiển thị trên danh sách bài tập (trước đây bị ẩn)
  const allAssignments = read<Assignment[]>(KEYS.assignments, []);
  let hasChanges = false;
  const updatedAssignments = allAssignments.map(a => {
    if (a.type === 'repetition' && a.id.startsWith('daily-review-') && a.isHidden) {
      hasChanges = true;
      return { ...a, isHidden: false };
    }
    return a;
  });
  if (hasChanges) {
    write(KEYS.assignments, updatedAssignments);
  }

  // Sync lên Google Sheets qua action sync_all_past_assignments
  if (pastReviews.length > 0) {
    try {
      await syncActionToSheet({
        action: 'sync_all_past_assignments',
        assignments: pastReviews.map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
          createdAt: a.createdAt,
          vocabCards: a.vocabCards
        }))
      });
    } catch (e) {
      console.error('Lỗi khi sync lên Google Sheets:', e);
    }
  }

  return { count: pastReviews.length };
}

export function autoSyncAllSpacedRepetition(clearDeletedTombstone = false) {
  generateDailyReviewAssignment(clearDeletedTombstone);
}

export function autoSubmitPreviousStagesLocal(
  baseAssignId: string,
  originalTitle: string,
  targetStage: number,
  specificStudent: string | null
): void {
  const baseAssign = getAssignment(baseAssignId);
  if (!baseAssign) return;

  const createdDate = new Date(baseAssign.createdAt || new Date());
  createdDate.setHours(0, 0, 0, 0);

  const allSubs = getSubmissions();
  const students = specificStudent && specificStudent !== 'ALL_STUDENTS' 
    ? [specificStudent] 
    : getStudentNames();
    
  let hasChanges = false;
  const intervals = [1, 3, 7, 14, 30]; // Stage 1..5
  let cumulativeDays = 0;

  for (let s = 1; s < targetStage; s++) {
    const repAssignId = `rep-stage${s}-${baseAssignId}`;
    const repTitle = `Stage ${s} - ${originalTitle}`;
    
    // Tính ngày DUE của stage s
    cumulativeDays += intervals[s - 1] || 1;
    const dueDate = new Date(createdDate.getTime());
    dueDate.setDate(dueDate.getDate() + cumulativeDays);
    dueDate.setHours(23, 59, 59, 999);
    const submittedAtStr = dueDate.toISOString();
    
    students.forEach(student => {
      const exists = allSubs.find(sub => sub.studentName === student && sub.assignmentId === repAssignId);
      if (!exists) {
        allSubs.push({
          id: crypto.randomUUID(),
          assignmentId: repAssignId,
          assignmentTitle: repTitle,
          assignmentType: 'repetition',
          studentName: student,
          score: 100,
          vocabAnswers: [],
          durationMs: 0,
          submittedAt: submittedAtStr
        });
        hasChanges = true;
      }
    });
  }

  if (hasChanges) {
    write(KEYS.submissions, allSubs);
  }
}
