import { syncSubmissionToSheet, syncAssignmentToSheet, syncActionToSheet } from './google-sheets';

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VocabKeyword { word: string; answer: string; }
export interface QuizQuestion {
  id: number; question: string; options: string[]; answer: string; explanation: string;
  knowledgeArea?: string; hint?: string;
}
export interface Assignment {
  id: string;
  title: string;
  type: 'vocab_context' | 'multiple_choice' | 'rewrite_vocab';
  passage?: string;
  keywords?: VocabKeyword[];
  questions?: QuizQuestion[];
  imageUrl?: string;
  allowHints?: boolean;
  createdAt: string;
}

export interface VocabAnswerResult {
  word: string; studentAnswer: string; isCorrect: boolean; correctAnswer: string;
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
  assignmentType: 'vocab_context' | 'multiple_choice' | 'rewrite_vocab';
  studentName: string;
  score: number;
  vocabAnswers?: VocabAnswerResult[];
  quizAnswers?: QuizAnswerResult[];
  rewriteAnswers?: RewriteAnswerResult;
  feedback?: string;
  submittedAt: string;
}

export interface DailyTracking {
  id: string;
  studentName: string;
  category: 'Vocabulary' | 'Dictation' | 'Grammar' | 'Reading' | 'Listening';
  score: number;
  submittedAt: string;
}

export type TrackCategory = DailyTracking['category'];

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  assignments: 'et_assignments',
  submissions: 'et_submissions',
  dailyTracking: 'et_daily_tracking',
  seeded: 'et_seeded_v2',
  session: 'et_session',
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

// Hàm hỗ trợ lấy màu sắc an toàn cho Tailwind (map từ hex sang tailwind color)
export function getStudentColors(name: string): { bg: string; text: string; border: string; hex: string } {
  const student = getStudents().find(s => s.name === name);
  const hex = student?.color || '#8B5CF6'; // Default Violet
  
  // Ánh xạ đơn giản màu Hex sang Tailwind class
  if (hex.toUpperCase().includes('EF4444')) return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', hex };
  if (hex.toUpperCase().includes('3B82F6')) return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', hex };
  if (hex.toUpperCase().includes('10B981')) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', hex };
  if (hex.toUpperCase().includes('F59E0B')) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', hex };
  if (hex.toUpperCase().includes('8B5CF6')) return { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', hex };
  if (hex.toUpperCase().includes('EC4899')) return { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', hex };
  
  // Fallback
  return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', hex };
}

export function getStudentAvatar(name: string): string {
  const student = getStudents().find(s => s.name === name);
  if (student) return student.avatar;
  // Fallback auto gen avatar
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
}

// ─── Gamification ──────────────────────────────────────────────────────────────

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
    const activities: { date: string, hour: number, score: number, category: string, type: 'submission' | 'tracking' }[] = [];
    
    trackings.forEach(t => {
      if (t.studentName === studentName) {
        const d = new Date(t.submittedAt);
        activities.push({ date: d.toISOString().split('T')[0], hour: d.getHours(), score: t.score, category: t.category, type: 'tracking' });
      }
    });

    submissions.forEach(s => {
      if (s.studentName === studentName) {
        const d = new Date(s.submittedAt);
        activities.push({ date: d.toISOString().split('T')[0], hour: d.getHours(), score: s.score, category: s.assignmentType, type: 'submission' });
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
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
        streakCount = 1;
        let currentDate = new Date(uniqueDates[0]);
        for (let i = 1; i < uniqueDates.length; i++) {
          const expectedDate = new Date(currentDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
          if (uniqueDates[i] === expectedDate.toISOString().split('T')[0]) {
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

export function getAssignments(): Assignment[] {
  return read<Assignment[]>(KEYS.assignments, []);
}



export function getAssignment(id: string): Assignment | undefined {
  return getAssignments().find(a => a.id === id);
}

export function saveAssignment(data: Omit<Assignment, 'id' | 'createdAt'>): Assignment {
  const all = getAssignments();
  const a: Assignment = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  write(KEYS.assignments, [...all, a]);
  
  // Đồng bộ lên Google Sheets (Chạy ngầm)
  syncAssignmentToSheet(a);
  
  return a;
}

export function importAssignment(assignment: Assignment): void {
  const all = getAssignments();
  // Check if it already exists to avoid duplicates
  if (!all.find(a => a.id === assignment.id)) {
    write(KEYS.assignments, [...all, assignment]);
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

  // 1. Assignments
  if (Array.isArray(cloudData.assignments) && cloudData.assignments.length > 0) {
    const current = getAssignments();
    const newItems = cloudData.assignments.filter((a: any) => !current.find(curr => curr.id === a.id));
    if (newItems.length > 0) {
      write(KEYS.assignments, [...current, ...newItems]);
      hasChanges = true;
    }
  }

  // 2. Submissions
  if (Array.isArray(cloudData.submissions) && cloudData.submissions.length > 0) {
    const current = getSubmissions();
    const newItems = cloudData.submissions.filter((s: any) => !current.find(curr => curr.id === s.id));
    if (newItems.length > 0) {
      write(KEYS.submissions, [...current, ...newItems]);
      hasChanges = true;
    }
  }

  // 3. Daily Tracking
  if (Array.isArray(cloudData.dailyTracking) && cloudData.dailyTracking.length > 0) {
    const current = getDailyTrackings();
    const newItems = cloudData.dailyTracking.filter((t: any) => !current.find(curr => curr.id === t.id));
    if (newItems.length > 0) {
      write(KEYS.dailyTracking, [...current, ...newItems]);
      hasChanges = true;
    }
  }

  // 4. Badges (Overwrite completely)
  if (Array.isArray(cloudData.badges) && cloudData.badges.length > 0) {
    write('et_badges', cloudData.badges);
    hasChanges = true;
  }

  return hasChanges;
}

export function updateAssignment(id: string, partial: Partial<Assignment>) {
  const current = getAssignments();
  const index = current.findIndex(a => a.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...partial };
    write(KEYS.assignments, current);
    syncAssignmentToSheet(current[index], 'update_assignment');
  }
}

export function deleteAssignment(id: string): void {
  write(KEYS.assignments, getAssignments().filter(a => a.id !== id));
  write(KEYS.submissions, getSubmissions().filter(s => s.assignmentId !== id));
  syncActionToSheet({ action: 'delete_assignment', id });
}

// ─── CRUD – Submissions ───────────────────────────────────────────────────────

export function getSubmissions(): Submission[] {
  return read<Submission[]>(KEYS.submissions, []);
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

export function deleteSubmission(id: string): void {
  const all = getSubmissions();
  write(KEYS.submissions, all.filter(s => s.id !== id));
  syncActionToSheet({ action: 'delete_submission', id });
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
}

// ─── Scoring & Submit ─────────────────────────────────────────────────────────

export function submitVocab(payload: {
  assignmentId: string; studentName: string;
  answers: { word: string; studentAnswer: string }[];
  overriddenWords?: string[];
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
    submittedAt: new Date().toISOString(),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitQuiz(payload: {
  assignmentId: string; studentName: string;
  answers: { questionId: number; studentAnswer: string }[];
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
    submittedAt: new Date().toISOString(),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  syncSubmissionToSheet(sub);
  return sub;
}

export function submitRewrite(payload: {
  assignmentId: string; studentName: string;
  studentText: string;
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
    submittedAt: new Date().toISOString(),
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

// ─── Seed ─────────────────────────────────────────────────────────────────────

export function seedIfEmpty(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEYS.seeded)) return;
  
  // Không tạo sample data nữa, chỉ đánh dấu đã khởi tạo
  localStorage.setItem(KEYS.seeded, '1');
}
