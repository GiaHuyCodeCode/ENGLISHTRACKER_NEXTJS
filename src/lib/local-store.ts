import { syncSubmissionToSheet } from './google-sheets';


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
}
export interface Assignment {
  id: string;
  title: string;
  type: 'vocab_context' | 'multiple_choice' | 'rewrite_vocab';
  passage?: string;
  keywords?: VocabKeyword[];
  questions?: QuizQuestion[];
  imageUrl?: string;
  createdAt: string;
}

export interface VocabAnswerResult {
  word: string; studentAnswer: string; isCorrect: boolean; correctAnswer: string;
}
export interface QuizAnswerResult {
  questionId: number; studentAnswer: string; isCorrect: boolean;
  correctAnswer: string; explanation: string;
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
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem('et_current_student');
}

export const STUDENT_NAMES = ['Minh Uyên', 'Khả Nhi', 'Ngọc Huy', 'Dương Lâm'];

export const STUDENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Minh Uyên': { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  'Khả Nhi':   { bg: 'bg-teal-500/15',   text: 'text-teal-400',   border: 'border-teal-500/30' },
  'Ngọc Huy':  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Dương Lâm': { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/30' },
};

export const STUDENT_AVATARS: Record<string, string> = {
  'Minh Uyên': 'MU',
  'Khả Nhi':   'KN',
  'Ngọc Huy':  'NH',
  'Dương Lâm': 'DL',
};

// ─── Gamification ──────────────────────────────────────────────────────────────

export interface GamificationProfile {
  studentName: string;
  streakCount: number;
  lastActiveDate: string | null;
  badges: string[];
}

export const BADGE_DEFS: Record<string, { title: string; icon: string; color: string; desc: string }> = {
  'cham-chi': { title: 'Chăm Chỉ', icon: '🔥', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', desc: 'Học liên tiếp 3 ngày' },
  'vua-tu-vung': { title: 'Vua Từ Vựng', icon: '👑', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', desc: 'Đạt điểm tuyệt đối Từ vựng 3 lần' },
  'cu-dem': { title: 'Cú Đêm', icon: '🦉', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', desc: 'Nộp bài sau 10h tối' }
};

export function getGamificationProfiles(): GamificationProfile[] {
  return read<GamificationProfile[]>('et_gamification', STUDENT_NAMES.map(name => ({
    studentName: name,
    streakCount: 0,
    lastActiveDate: null,
    badges: []
  })));
}

export function updateGamification(studentName: string, type: 'submission' | 'tracking', data: any) {
  const profiles = getGamificationProfiles();
  const profile = profiles.find(p => p.studentName === studentName);
  if (!profile) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const submitHour = now.getHours();

  // 1. Check Streak
  if (profile.lastActiveDate !== todayStr) {
    if (profile.lastActiveDate) {
      const lastDate = new Date(profile.lastActiveDate);
      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays === 1) {
        profile.streakCount += 1;
      } else if (diffDays > 1) {
        profile.streakCount = 1;
      }
    } else {
      profile.streakCount = 1;
    }
    profile.lastActiveDate = todayStr;
  }

  // 2. Check Badges
  const newBadges = new Set(profile.badges);
  
  // Chăm chỉ
  if (profile.streakCount >= 3) newBadges.add('cham-chi');
  
  // Cú đêm
  if (submitHour >= 22 || submitHour <= 4) newBadges.add('cu-dem');
  
  // Vua từ vựng (we need to check historical data, but for simplicity we assume the logic checks if current submission is Vocab with 100)
  // To do it properly, we count 100 scores
  const trackings = read<DailyTracking[]>('et_daily_tracking', []);
  const subs = read<Submission[]>('et_submissions', []);
  
  const vocab100Count = 
    trackings.filter(t => t.studentName === studentName && t.category === 'Vocabulary' && t.score === 100).length +
    subs.filter(s => s.studentName === studentName && s.assignmentType === 'vocab_context' && s.score === 100).length;

  if (vocab100Count >= 3) newBadges.add('vua-tu-vung');

  profile.badges = Array.from(newBadges);

  write('et_gamification', profiles);

  return profile;
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
  return a;
}

export function importAssignment(assignment: Assignment): void {
  const all = getAssignments();
  // Check if it already exists to avoid duplicates
  if (!all.find(a => a.id === assignment.id)) {
    write(KEYS.assignments, [...all, assignment]);
  }
}

export function deleteAssignment(id: string): void {
  write(KEYS.assignments, getAssignments().filter(a => a.id !== id));
  write(KEYS.submissions, getSubmissions().filter(s => s.assignmentId !== id));
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
  }
}

export function deleteSubmission(id: string): void {
  const all = getSubmissions();
  write(KEYS.submissions, all.filter(s => s.id !== id));
}

export function updateTrackingScore(id: string, newScore: number): void {
  const all = getDailyTrackings();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx].score = newScore;
    write(KEYS.dailyTracking, all);
  }
}

export function deleteTracking(id: string): void {
  const all = getDailyTrackings();
  write(KEYS.dailyTracking, all.filter(t => t.id !== id));
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.assignments);
  localStorage.removeItem(KEYS.submissions);
  localStorage.removeItem(KEYS.dailyTracking);
  localStorage.removeItem(KEYS.seeded);
  localStorage.removeItem('et_gamification');
}

// ─── Scoring & Submit ─────────────────────────────────────────────────────────

export function submitVocab(payload: {
  assignmentId: string; studentName: string;
  answers: { word: string; studentAnswer: string }[];
}): Submission {
  const assignment = getAssignment(payload.assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const keywords = assignment.keywords || [];
  const vocabAnswers: VocabAnswerResult[] = keywords.map(kw => {
    const entry = payload.answers.find(a => a.word.toLowerCase() === kw.word.toLowerCase());
    const studentAnswer = entry?.studentAnswer || '';
    return { word: kw.word, studentAnswer, isCorrect: isFuzzyMatch(studentAnswer, kw.answer), correctAnswer: kw.answer };
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
  const profile = updateGamification(payload.studentName, 'submission', sub);
  syncSubmissionToSheet({ ...sub, profile });
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
    return { questionId: q.id, studentAnswer, isCorrect, correctAnswer: q.answer, explanation: q.explanation };
  });

  const correct = quizAnswers.filter(a => a.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  const sub: Submission = {
    id: crypto.randomUUID(),
    assignmentId: payload.assignmentId,
    assignmentTitle: assignment.title,
    assignmentType: 'multiple_choice',
    studentName: payload.studentName,
    score,
    quizAnswers,
    submittedAt: new Date().toISOString(),
  };
  write(KEYS.submissions, [...getSubmissions(), sub]);
  const profile = updateGamification(payload.studentName, 'submission', sub);
  syncSubmissionToSheet({ ...sub, profile });
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
  const profile = updateGamification(payload.studentName, 'submission', sub);
  syncSubmissionToSheet({ ...sub, profile });
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

  const profile = updateGamification(payload.studentName, 'tracking', record);

  // Đẩy lên Google Sheets kèm theo ảnh và gamification
  syncSubmissionToSheet({
    ...record,
    type: 'daily_tracking',
    imageBase64: payload.imageBase64,
    profile
  });

  return record;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

const SEED_ASSIGNMENTS: Omit<Assignment, 'id' | 'createdAt'>[] = [
  {
    title: 'Unit 3 – Daily Routines (Vocab In-Context)',
    type: 'vocab_context',
    passage: 'Mỗi buổi sáng, Nam [wake up] lúc 6 giờ và bắt đầu [exercise] trong 30 phút trước khi ăn sáng. Sau đó anh ấy [commute] đến trường bằng xe máy, mất khoảng 20 phút. Anh cố gắng [focus] trong giờ học để có thể [accomplish] mọi bài tập trước khi về nhà.',
    keywords: [
      { word: 'wake up',    answer: 'thức dậy' },
      { word: 'exercise',   answer: 'tập thể dục' },
      { word: 'commute',    answer: 'đi lại' },
      { word: 'focus',      answer: 'tập trung' },
      { word: 'accomplish', answer: 'hoàn thành' },
    ],
  },
  {
    title: 'Unit 5 – Phrasal Verbs Quiz',
    type: 'multiple_choice',
    questions: [
      { id: 1, question: '"Give up" có nghĩa là gì?', options: ['Bắt đầu', 'Từ bỏ', 'Tiếp tục', 'Hoàn thành'], answer: 'B', explanation: '"Give up" = từ bỏ. Mẹo: hình dung bạn "cho đi" (give) cơ hội của mình = từ bỏ.' },
      { id: 2, question: '"She ran out of money" nghĩa là?', options: ['Cô ấy tìm thấy tiền', 'Cô ấy kiếm được tiền', 'Cô ấy hết tiền', 'Cô ấy mất tiền'], answer: 'C', explanation: '"Run out of" = hết, cạn kiệt. Ghi nhớ: run out = chạy hết = không còn gì.' },
      { id: 3, question: '"Look forward to" có nghĩa là?', options: ['Nhìn về phía trước', 'Mong đợi / Trông chờ', 'Trốn tránh', 'Lo lắng'], answer: 'B', explanation: '"Look forward to" = mong chờ điều gì tốt đẹp sắp xảy ra. Luôn theo sau bởi danh từ/V-ing.' },
      { id: 4, question: '"Break down" KHÔNG có nghĩa nào sau đây?', options: ['Hỏng máy móc', 'Mất tinh thần', 'Phân tích chi tiết', 'Xây dựng lại'], answer: 'D', explanation: '"Break down" = hỏng, sụp đổ, phân tích — nhưng KHÔNG có nghĩa là "xây dựng".' },
      { id: 5, question: '"Put off the meeting" có nghĩa là?', options: ['Hủy cuộc họp', 'Tổ chức cuộc họp', 'Hoãn cuộc họp', 'Kết thúc cuộc họp'], answer: 'C', explanation: '"Put off" = hoãn lại, dời lịch. Không nhầm với "call off" (hủy hoàn toàn).' },
    ],
  },
  {
    title: 'Viết Lại Chuyện Chêm - Unit 3',
    type: 'rewrite_vocab',
    passage: 'Viết một đoạn văn ngắn về buổi sáng của bạn, sử dụng các từ khóa sau.',
    keywords: [
      { word: 'wake up',    answer: 'thức dậy' },
      { word: 'exercise',   answer: 'tập thể dục' },
      { word: 'commute',    answer: 'đi lại' },
      { word: 'focus',      answer: 'tập trung' },
      { word: 'accomplish', answer: 'hoàn thành' },
    ],
  },
];

const SEED_SUBMISSIONS: Omit<Submission, 'id'>[] = [
  // Minh Uyên – Vocab: 4/5 (thức dậy sai)
  // Khả Nhi – Vocab: 5/5
  // Ngọc Huy – Quiz: 3/5
  // Dương Lâm – Quiz: 5/5
];

export function seedIfEmpty(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEYS.seeded)) return;

  const assignments: Assignment[] = SEED_ASSIGNMENTS.map(data => ({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }));
  write(KEYS.assignments, assignments);

  const vocabId = assignments[0].id;
  const quizId = assignments[1].id;
  const rewriteId = assignments[2].id;

  const subs: Submission[] = [
    // Minh Uyên – vocab (80)
    {
      id: crypto.randomUUID(), assignmentId: vocabId,
      assignmentTitle: assignments[0].title, assignmentType: 'vocab_context',
      studentName: 'Minh Uyên', score: 80,
      vocabAnswers: [
        { word: 'wake up',    studentAnswer: 'thức giấc', isCorrect: true,  correctAnswer: 'thức dậy' },
        { word: 'exercise',   studentAnswer: 'tập thể dục', isCorrect: true, correctAnswer: 'tập thể dục' },
        { word: 'commute',    studentAnswer: '',           isCorrect: false, correctAnswer: 'đi lại' },
        { word: 'focus',      studentAnswer: 'tập trung', isCorrect: true,  correctAnswer: 'tập trung' },
        { word: 'accomplish', studentAnswer: 'hoàn thành', isCorrect: true, correctAnswer: 'hoàn thành' },
      ],
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    // Khả Nhi – vocab (100)
    {
      id: crypto.randomUUID(), assignmentId: vocabId,
      assignmentTitle: assignments[0].title, assignmentType: 'vocab_context',
      studentName: 'Khả Nhi', score: 100,
      vocabAnswers: [
        { word: 'wake up',    studentAnswer: 'thức dậy',   isCorrect: true, correctAnswer: 'thức dậy' },
        { word: 'exercise',   studentAnswer: 'tập thể dục', isCorrect: true, correctAnswer: 'tập thể dục' },
        { word: 'commute',    studentAnswer: 'di chuyển',  isCorrect: true, correctAnswer: 'đi lại' },
        { word: 'focus',      studentAnswer: 'tập trung',  isCorrect: true, correctAnswer: 'tập trung' },
        { word: 'accomplish', studentAnswer: 'đạt được',   isCorrect: true, correctAnswer: 'hoàn thành' },
      ],
      submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    // Ngọc Huy – quiz (60)
    {
      id: crypto.randomUUID(), assignmentId: quizId,
      assignmentTitle: assignments[1].title, assignmentType: 'multiple_choice',
      studentName: 'Ngọc Huy', score: 60,
      quizAnswers: [
        { questionId: 1, studentAnswer: 'B', isCorrect: true,  correctAnswer: 'B', explanation: '"Give up" = từ bỏ.' },
        { questionId: 2, studentAnswer: 'A', isCorrect: false, correctAnswer: 'C', explanation: '"Run out of" = hết.' },
        { questionId: 3, studentAnswer: 'B', isCorrect: true,  correctAnswer: 'B', explanation: '"Look forward to" = mong chờ.' },
        { questionId: 4, studentAnswer: 'A', isCorrect: false, correctAnswer: 'D', explanation: '"Break down" không có nghĩa xây dựng.' },
        { questionId: 5, studentAnswer: 'C', isCorrect: true,  correctAnswer: 'C', explanation: '"Put off" = hoãn lại.' },
      ],
      submittedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    // Dương Lâm – quiz (100)
    {
      id: crypto.randomUUID(), assignmentId: quizId,
      assignmentTitle: assignments[1].title, assignmentType: 'multiple_choice',
      studentName: 'Dương Lâm', score: 100,
      quizAnswers: [
        { questionId: 1, studentAnswer: 'B', isCorrect: true, correctAnswer: 'B', explanation: '"Give up" = từ bỏ.' },
        { questionId: 2, studentAnswer: 'C', isCorrect: true, correctAnswer: 'C', explanation: '"Run out of" = hết.' },
        { questionId: 3, studentAnswer: 'B', isCorrect: true, correctAnswer: 'B', explanation: '"Look forward to" = mong chờ.' },
        { questionId: 4, studentAnswer: 'D', isCorrect: true, correctAnswer: 'D', explanation: '"Break down" không có nghĩa xây dựng.' },
        { questionId: 5, studentAnswer: 'C', isCorrect: true, correctAnswer: 'C', explanation: '"Put off" = hoãn lại.' },
      ],
      submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    // Minh Uyên - rewrite (80)
    {
      id: crypto.randomUUID(), assignmentId: rewriteId,
      assignmentTitle: assignments[2].title, assignmentType: 'rewrite_vocab',
      studentName: 'Minh Uyên', score: 80,
      rewriteAnswers: {
        studentText: 'Sáng nay tôi wake up lúc 7h. Sau đó tôi exercise và đi làm bằng xe buýt nên tôi commute khá xa. Tôi luôn focus vào công việc.',
        foundKeywords: ['wake up', 'exercise', 'commute', 'focus'],
        missingKeywords: ['accomplish']
      },
      submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }
  ];
  write(KEYS.submissions, subs);
  localStorage.setItem(KEYS.seeded, '1');
}
