/**
 * Centralized API client for English Tracking backend (NestJS on :3001)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'API Error');
  }
  return res.json();
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export interface VocabKeyword {
  word: string;
  answer: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface Assignment {
  _id: string;
  title: string;
  type: 'vocab_context' | 'multiple_choice';
  passage?: string;
  keywords?: VocabKeyword[];
  questions?: QuizQuestion[];
  createdBy: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAssignmentPayload {
  title: string;
  type: 'vocab_context' | 'multiple_choice';
  passage?: string;
  keywords?: VocabKeyword[];
  questions?: QuizQuestion[];
  createdBy?: string;
}

export const fetchAssignments = () =>
  apiFetch<Assignment[]>('/assignments');

export const fetchAssignment = (id: string) =>
  apiFetch<Assignment>(`/assignments/${id}`);

export const createAssignment = (data: CreateAssignmentPayload) =>
  apiFetch<Assignment>('/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteAssignment = (id: string) =>
  apiFetch<{ message: string }>(`/assignments/${id}`, { method: 'DELETE' });

// ─── Submissions ──────────────────────────────────────────────────────────────

export interface VocabAnswerResult {
  word: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

export interface QuizAnswerResult {
  questionId: number;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

export interface SubmissionResult {
  _id: string;
  assignmentId: string | { _id: string; title: string; type: string };
  studentName: string;
  assignmentType: string;
  vocabAnswers?: VocabAnswerResult[];
  quizAnswers?: QuizAnswerResult[];
  score: number;
  submittedAt: string;
}

export interface SubmitVocabPayload {
  assignmentId: string;
  studentName: string;
  assignmentType: 'vocab_context';
  vocabAnswers: { word: string; studentAnswer: string }[];
}

export interface SubmitQuizPayload {
  assignmentId: string;
  studentName: string;
  assignmentType: 'multiple_choice';
  quizAnswers: { questionId: number; studentAnswer: string }[];
}

export const submitAssignment = (data: SubmitVocabPayload | SubmitQuizPayload) =>
  apiFetch<SubmissionResult>('/submissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const fetchSubmissionsByStudent = (studentName: string) =>
  apiFetch<SubmissionResult[]>(
    `/submissions?studentName=${encodeURIComponent(studentName)}`,
  );

export const fetchSubmissionsByAssignment = (assignmentId: string) =>
  apiFetch<SubmissionResult[]>(`/submissions?assignmentId=${assignmentId}`);

export const fetchStudentNames = () =>
  apiFetch<string[]>('/submissions/students');
