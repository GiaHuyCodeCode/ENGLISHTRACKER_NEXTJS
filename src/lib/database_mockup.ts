import type { Assignment, Submission, DailyTracking, VocabCard } from './local-store';

export const USE_MOCK_DB = false; // Toggle to false to use Google Sheets

const now = new Date();
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export const mockVocabCards: VocabCard[] = [
  { id: 'v1', word: 'Accommodate', phonetic: '/əˈkɒmədeɪt/', meaning: 'Cung cấp chỗ ở, đáp ứng', example: 'The hotel can accommodate up to 500 guests.', synonyms: ['house', 'lodge', 'fit'], createdAt: d(10) },
  { id: 'v2', word: 'Fluctuate', phonetic: '/ˈflʌktʃueɪt/', meaning: 'Dao động', example: 'Vegetable prices fluctuate according to the season.', synonyms: ['vary', 'change', 'shift'], createdAt: d(10) },
  { id: 'v3', word: 'Intricate', phonetic: '/ˈɪntrɪkət/', meaning: 'Phức tạp, lắt léo', example: 'The watch mechanism is extremely intricate.', synonyms: ['complex', 'complicated'], createdAt: d(9) },
  { id: 'v4', word: 'Obsolete', phonetic: '/ˈɒbsəliːt/', meaning: 'Lỗi thời', example: 'Gas lamps became obsolete when electric lighting was invented.', synonyms: ['outdated', 'old-fashioned'], createdAt: d(9) },
];

export const mockAssignments: Assignment[] = [
  {
    id: 'a1',
    title: 'Từ vựng tuần 1',
    type: 'vocabulary',
    vocabCards: mockVocabCards,
    createdAt: d(10)
  },
  {
    id: 'a2',
    title: 'Nghe Chép Youtube (Mock)',
    type: 'dictation',
    imageUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    sentences: [
      { id: 1, text: "Welcome to this dictation practice.", startTime: 0, endTime: 3 },
      { id: 2, text: "It is important to listen carefully.", startTime: 3, endTime: 6 }
    ],
    createdAt: d(8)
  },
  {
    id: 'a3',
    title: 'Điền từ ngữ cảnh',
    type: 'vocab_context',
    passage: "The prices of vegetables often [Fluctuate] according to the season. The hotel can [Accommodate] up to 500 guests.",
    keywords: [
      { word: "Fluctuate", answer: "Dao động" },
      { word: "Accommodate", answer: "Cung cấp chỗ ở" }
    ],
    createdAt: d(8)
  },
  {
    id: 'a4',
    title: 'Trắc Nghiệm Kiến Thức',
    type: 'multiple_choice',
    questions: [
      { id: 1, question: "Which word means 'outdated'?", options: ['Obsolete', 'Intricate', 'Fluctuate', 'Accommodate'], answer: 'Obsolete', explanation: 'Obsolete means no longer produced or used.' }
    ],
    createdAt: d(7)
  }
];

export const mockSubmissions: Submission[] = [
  {
    id: 'sub1', assignmentId: 'a1', assignmentTitle: 'Từ vựng tuần 1', assignmentType: 'vocabulary',
    studentName: 'Huy', score: 100, submittedAt: d(6), durationMs: 120000,
    vocabAnswers: [
      { word: 'Accommodate', studentAnswer: 'Cung cấp', isCorrect: true, correctAnswer: 'Accommodate' },
      { word: 'Fluctuate', studentAnswer: 'Dao động', isCorrect: true, correctAnswer: 'Fluctuate' }
    ]
  },
  {
    id: 'sub2', assignmentId: 'a1', assignmentTitle: 'Từ vựng tuần 1', assignmentType: 'vocabulary',
    studentName: 'Linh', score: 50, submittedAt: d(6), durationMs: 95000,
    vocabAnswers: [
      { word: 'Accommodate', studentAnswer: 'Cung cấp', isCorrect: true, correctAnswer: 'Accommodate' },
      { word: 'Fluctuate', studentAnswer: 'Dạo', isCorrect: false, correctAnswer: 'Fluctuate' } // Error to trigger peer failure
    ]
  },
  {
    id: 'sub3', assignmentId: 'a3', assignmentTitle: 'Điền từ ngữ cảnh', assignmentType: 'vocab_context',
    studentName: 'Tuấn', score: 50, submittedAt: d(5), durationMs: 180000,
    vocabAnswers: [
      { word: 'Fluctuate', studentAnswer: 'Dao động', isCorrect: true, correctAnswer: 'Fluctuate' },
      { word: 'Accommodate', studentAnswer: 'Cung cp', isCorrect: false, correctAnswer: 'Accommodate' } // Error
    ]
  },
  { id: 'sub4', assignmentId: 'a2', assignmentTitle: 'Dictation Mock', assignmentType: 'dictation', studentName: 'Mai', score: 50, submittedAt: d(4), durationMs: 420000, dictationResults: [{ sentenceId: 1, studentText: 'Welcome to this', accuracy: 80, errors: [], replayCount: 1 }, { sentenceId: 2, studentText: 'It is important', accuracy: 0, errors: [], replayCount: 1 }] },
  { id: 'sub5', assignmentId: 'a2', assignmentTitle: 'Dictation Mock', assignmentType: 'dictation', studentName: 'Huy', score: 100, submittedAt: d(4), durationMs: 250000, dictationResults: [{ sentenceId: 1, studentText: 'Welcome to this dictation practice.', accuracy: 100, errors: [], replayCount: 1 }, { sentenceId: 2, studentText: 'It is important to listen carefully.', accuracy: 100, errors: [], replayCount: 1 }] },
  { id: 'sub6', assignmentId: 'a3', assignmentTitle: 'Điền từ', assignmentType: 'vocab_context', studentName: 'Linh', score: 100, submittedAt: d(3), durationMs: 65000 },
  { id: 'sub7', assignmentId: 'a3', assignmentTitle: 'Điền từ', assignmentType: 'vocab_context', studentName: 'Huy', score: 80, submittedAt: d(2), durationMs: 85000 },
  { id: 'sub8', assignmentId: 'a1', assignmentTitle: 'Từ vựng', assignmentType: 'vocabulary', studentName: 'Tuấn', score: 120, submittedAt: d(1), durationMs: 310000 },
  { id: 'sub9', assignmentId: 'a1', assignmentTitle: 'Từ vựng', assignmentType: 'vocabulary', studentName: 'Mai', score: 90, submittedAt: d(1), durationMs: 145000 },
  { id: 'sub10', assignmentId: 'a2', assignmentTitle: 'Dictation Mock', assignmentType: 'dictation', studentName: 'Huy', score: 55, submittedAt: d(0), durationMs: 400000 },
  {
    id: 'sub11', assignmentId: 'a4', assignmentTitle: 'Trắc Nghiệm Kiến Thức', assignmentType: 'multiple_choice',
    studentName: 'Linh', score: 0, submittedAt: d(0), durationMs: 15000,
    quizAnswers: [
      { questionId: 1, studentAnswer: 'Intricate', isCorrect: false, correctAnswer: 'Obsolete', explanation: '' } // Peer failure
    ]
  }
];

export const mockTrackings: DailyTracking[] = [
  { id: 'trk1', studentName: 'Huy', category: 'Listening', score: 20, submittedAt: d(0) },
  { id: 'trk2', studentName: 'Linh', category: 'Reading', score: 40, submittedAt: d(1) },
];

export const mockVocabProgress: any[] = [
  { studentName: 'Huy', wordId: 'v1', stage: 2, interval: 3, nextReviewDate: d(0), repetitions: 2, lastReviewed: d(3) }, // Due today
  { studentName: 'Huy', wordId: 'v2', stage: 3, interval: 7, nextReviewDate: d(-3), repetitions: 3, lastReviewed: d(4) }, // Due in 3 days
  { studentName: 'Huy', wordId: 'v3', stage: 1, interval: 1, nextReviewDate: d(1), repetitions: 1, lastReviewed: d(2) }, // Due yesterday (Overdue)
  { studentName: 'Huy', wordId: 'v4', stage: 4, interval: 14, nextReviewDate: d(-10), repetitions: 4, lastReviewed: d(4) }, // Due in 10 days
  { studentName: 'Linh', wordId: 'v1', stage: 1, interval: 1, nextReviewDate: d(0), repetitions: 1, lastReviewed: d(1) }, // Due today
];

export const mockGamification: any[] = [
  { studentName: 'Huy', streakCount: 3, badges: ['b1', 'b2'], points: 100, lastActiveDate: d(0) },
  { studentName: 'Linh', streakCount: 1, badges: ['b1'], points: 50, lastActiveDate: d(0) },
  { studentName: 'Tuấn', streakCount: 5, badges: ['b3'], points: 80, lastActiveDate: d(0) },
  { studentName: 'Mai', streakCount: 2, badges: [], points: 90, lastActiveDate: d(0) }
];
