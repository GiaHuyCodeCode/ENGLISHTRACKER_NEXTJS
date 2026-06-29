'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  getAssignment, getStudentSubmission, getSubmissions, submitVocab, submitQuiz, submitRewrite, submitVocabularyAssignment,
  Assignment, Submission, getStudentNames, getStudentColors, getStudentAvatar, seedIfEmpty,
  getAssignmentNextReviewDate,
} from '@/lib/local-store';
import { VocabContextExercise } from '@/components/exercises/VocabContextExercise';
import { MultipleChoiceExercise } from '@/components/exercises/MultipleChoiceExercise';
import { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';
import { RewriteVocabExercise } from '@/components/exercises/RewriteVocabExercise';
import { VocabularyExercise } from '@/components/exercises/VocabularyExercise';
import { ExerciseTimer } from '@/components/ui/ExerciseTimer';
import { ArrowLeft, BookOpen, ListChecks, User, ChevronRight, AlertCircle, PenTool, FileJson, Clock, Trophy } from 'lucide-react';

// ── Student picker modal ────────────────────────────────────────────────────

function StudentModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [chosen, setChosen] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="glass-strong border border-border rounded-2xl p-8 w-full max-w-sm space-y-6 slide-up">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center">
            <User className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-bold font-heading gradient-text">Bạn là ai?</h2>
          <p className="text-sm text-muted-foreground">Chọn tên để lưu kết quả</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {getStudentNames().map(name => {
            const c = getStudentColors(name);
            return (
              <button
                key={name}
                onClick={() => setChosen(name)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-sm font-medium transition-all ${
                  chosen === name
                    ? `${c.bg} ${c.text} border-current ${c.border}`
                    : 'border-border hover:border-primary/40 hover:bg-slate-800/50 text-foreground/70'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                  {getStudentAvatar(name)}
                </span>
                <span className="leading-tight">{name}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => chosen && onConfirm(chosen)}
          disabled={!chosen}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary"
        >
          Xác Nhận & Nộp Bài <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Exercise Page ───────────────────────────────────────────────────────

export default function ExercisePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const initialMode = searchParams.get('mode') as any || 'flashcard';

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [existingResult, setExistingResult] = useState<Submission | null>(null);
  const [result, setResult] = useState<Submission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<unknown>(null);
  const [pendingOverrides, setPendingOverrides] = useState<string[] | undefined>(undefined);
  const [currentStudent, setCurrentStudent] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    seedIfEmpty();
    const a = getAssignment(id);
    if (!a) { router.replace('/student/assignments'); return; }
    if (a.createdAt && new Date(a.createdAt) > new Date()) {
      router.replace('/student/assignments');
      return;
    }

    // For repetition assignments, gate access by nextReviewDate of SRS progress
    if (a.type === 'repetition') {
      const savedStudent = localStorage.getItem('et_current_student');
      if (savedStudent) {
        const nextReview = getAssignmentNextReviewDate(id, savedStudent);
        if (nextReview && new Date(nextReview) > new Date()) {
          router.replace('/student/assignments');
          return;
        }
      }
    }
    
    // Safely parse properties because Google Sheets sync may save arrays/objects as stringified JSON
    const parsed: Assignment = { ...a };
    
    const parseJsonSafely = (val: any) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
      }
      return val;
    };
    
    if (parsed.keywords) parsed.keywords = parseJsonSafely(parsed.keywords);
    if (parsed.questions) parsed.questions = parseJsonSafely(parsed.questions);
    if (parsed.vocabCards) parsed.vocabCards = parseJsonSafely(parsed.vocabCards);
    if (parsed.sentences) parsed.sentences = parseJsonSafely(parsed.sentences);
    
    setAssignment(parsed);

    const saved = localStorage.getItem('et_current_student');
    if (saved && getStudentNames().includes(saved)) {
      setCurrentStudent(saved);
      const existing = getStudentSubmission(id, saved);
      if (existing) {
        const parsedExisting = { ...existing };
        if (parsedExisting.details) {
          const detailsParsed = parseJsonSafely(parsedExisting.details);
          if (parsedExisting.assignmentType === 'multiple_choice') {
            parsedExisting.quizAnswers = detailsParsed;
          } else if (parsedExisting.assignmentType === 'vocab_context' || parsedExisting.assignmentType === 'vocabulary' || parsedExisting.assignmentType === 'repetition') {
            parsedExisting.vocabAnswers = detailsParsed;
          } else if (parsedExisting.assignmentType === 'rewrite_vocab') {
            parsedExisting.rewriteAnswers = detailsParsed;
          }
        } else {
          if (parsedExisting.rewriteAnswers) parsedExisting.rewriteAnswers = parseJsonSafely(parsedExisting.rewriteAnswers);
          if (parsedExisting.quizAnswers) parsedExisting.quizAnswers = parseJsonSafely(parsedExisting.quizAnswers);
          if (parsedExisting.vocabAnswers) parsedExisting.vocabAnswers = parseJsonSafely(parsedExisting.vocabAnswers);
        }
        
        setExistingResult(parsedExisting);
      }
    }
  }, [id, router]);

  const handleVocabSubmit = (answers: { word: string; studentAnswer: string }[], overriddenWords?: string[]) => {
    setPendingAnswers(answers);
    setPendingOverrides(overriddenWords);
    if (currentStudent) doSubmitVocab(currentStudent, answers, overriddenWords);
    else setShowModal(true);
  };

  const handleQuizSubmit = (answers: { questionId: number; studentAnswer: string }[]) => {
    setPendingAnswers(answers);
    if (currentStudent) doSubmitQuiz(currentStudent, answers);
    else setShowModal(true);
  };

  const handleRewriteSubmit = (studentText: string) => {
    setPendingAnswers(studentText);
    if (currentStudent) doSubmitRewrite(currentStudent, studentText);
    else setShowModal(true);
  };

  const handleVocabularySubmit = (answers: { word: string; studentAnswer: string; isCorrect: boolean }[], customScore?: number, dictationScore?: number) => {
    setPendingAnswers({ answers, customScore, dictationScore });
    if (currentStudent) doSubmitVocabulary(currentStudent, { answers, customScore, dictationScore });
    else setShowModal(true);
  };

  const doSubmitVocab = (name: string, answers: unknown, overriddenWords?: string[]) => {
    setIsSubmitting(true);
    setShowModal(false);
    localStorage.setItem('et_current_student', name);
    setCurrentStudent(name);
    try {
      const sub = submitVocab({
        assignmentId: id,
        studentName: name,
        answers: answers as { word: string; studentAnswer: string }[],
        overriddenWords,
        durationMs: Date.now() - startTimeRef.current,
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  const doSubmitVocabulary = (name: string, pending: any) => {
    setIsSubmitting(true);
    setShowModal(false);
    localStorage.setItem('et_current_student', name);
    setCurrentStudent(name);
    try {
      const { answers, customScore, dictationScore } = pending;
      const list = answers as { word: string; studentAnswer: string; isCorrect: boolean }[];
      let score = 0;
      if (customScore !== undefined) {
        score = customScore;
      } else {
        const correct = list.filter(a => a.isCorrect).length;
        score = list.length > 0 ? Math.round((correct / list.length) * 100) : 0;
      }
      const sub = submitVocabularyAssignment({
        assignmentId: id,
        studentName: name,
        score,
        dictationScore,
        answers: list,
        durationMs: Date.now() - startTimeRef.current,
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  const doSubmitQuiz = (name: string, answers: unknown) => {
    setIsSubmitting(true);
    setShowModal(false);
    localStorage.setItem('et_current_student', name);
    setCurrentStudent(name);
    try {
      const sub = submitQuiz({
        assignmentId: id,
        studentName: name,
        answers: answers as { questionId: number; studentAnswer: string }[],
        durationMs: Date.now() - startTimeRef.current,
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  const doSubmitRewrite = (name: string, studentText: unknown) => {
    setIsSubmitting(true);
    setShowModal(false);
    localStorage.setItem('et_current_student', name);
    setCurrentStudent(name);
    try {
      const sub = submitRewrite({
        assignmentId: id,
        studentName: name,
        studentText: studentText as string,
        durationMs: Date.now() - startTimeRef.current,
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalConfirm = (name: string) => {
    if (assignment?.type === 'vocab_context') doSubmitVocab(name, pendingAnswers, pendingOverrides);
    else if (assignment?.type === 'multiple_choice') doSubmitQuiz(name, pendingAnswers);
    else if (assignment?.type === 'vocabulary' || assignment?.type === 'repetition') doSubmitVocabulary(name, pendingAnswers);
    else doSubmitRewrite(name, pendingAnswers);
  };

  if (!assignment) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="space-y-3 w-full max-w-lg">
        {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}
      </div>
    </div>
  );

  const displayResult = result || existingResult;
  const isReview = !!existingResult && !result;

  return (
    <>
      {showModal && <StudentModal onConfirm={handleModalConfirm} />}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/student/assignments')}
            className="p-2 rounded-xl border border-white/5 hover:border-primary/40 hover:bg-black/5 dark:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                assignment.type === 'vocab_context' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' : 
                assignment.type === 'multiple_choice' ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400' :
                (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? 'bg-[#0071e3]/15 text-sky-600 dark:text-sky-400' :
                'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {assignment.type === 'vocab_context' ? 'Vocab In-Context' : 
                 assignment.type === 'multiple_choice' ? 'Trắc Nghiệm' :
                 (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? 'Học Từ Vựng' : 'Viết Chuyện Chêm'}
              </span>
              {isReview && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                  Đã hoàn thành
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold font-heading gradient-text leading-tight">{assignment.title}</h1>
              {(!result && !isReview && assignment.type !== 'multiple_choice') && <ExerciseTimer isRunning={true} />}
            </div>
            {currentStudent && (
              <p className="text-xs text-muted-foreground mt-1">Học viên: <span className="text-foreground font-medium">{currentStudent}</span></p>
            )}
          </div>
        </div>

        {/* Exercise Header - Small Minimal Header Bar */}
        <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            assignment.type === 'vocab_context' ? 'bg-violet-500/15' : 
            assignment.type === 'multiple_choice' ? 'bg-teal-500/15' : 
            (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? 'bg-[#0071e3]/15' : 
            'bg-amber-500/15'
          }`}>
            {assignment.type === 'vocab_context' ? <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={1.5} /> : 
             assignment.type === 'multiple_choice' ? <ListChecks className="h-4 w-4 text-teal-600 dark:text-teal-400" strokeWidth={1.5} /> :
             (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? <FileJson className="h-4 w-4 text-sky-600 dark:text-sky-400" strokeWidth={1.5} /> :
             <PenTool className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {assignment.type === 'vocab_context' ? 'Điền Nghĩa Từ Vựng' : 
               assignment.type === 'multiple_choice' ? 'Chọn Đáp Án Đúng' :
               (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? 'Học & Kiểm Tra Từ Vựng' : 'Viết Chuyện Chêm'}
            </p>
            <p className="text-xs text-muted-foreground">
              {assignment.type === 'vocab_context' ? `${assignment.keywords?.length} từ khóa` : 
               assignment.type === 'multiple_choice' ? `${assignment.questions?.length} câu hỏi` :
               (assignment.type === 'vocabulary' || assignment.type === 'repetition') ? `${assignment.vocabCards?.length || 0} từ vựng` :
               `${assignment.keywords?.length} từ khóa cần dùng`}
            </p>
          </div>
        </div>

        {/* Exercise Content Area - Completely released from tight glass card bounds */}
        <div className="w-full">
          {assignment.type === 'vocab_context' && assignment.passage && assignment.keywords && (
            <div className="glass rounded-3xl border border-white/5 p-6 md:p-8">
              <VocabContextExercise
                passage={assignment.passage}
                keywords={assignment.keywords}
                onSubmit={handleVocabSubmit}
                isSubmitting={isSubmitting}
                result={displayResult?.vocabAnswers}
                score={displayResult?.score}
                durationMs={displayResult?.durationMs}
                allSubmissions={getSubmissions().filter(s => s.assignmentId === id)}
              />
            </div>
          )}

          {assignment.type === 'multiple_choice' && assignment.questions && (
            <MultipleChoiceExercise
              questions={assignment.questions}
              onSubmit={handleQuizSubmit}
              isSubmitting={isSubmitting}
              result={displayResult?.quizAnswers}
              score={displayResult?.score}
              durationMs={displayResult?.durationMs}
              allowHints={assignment.allowHints}
              feedback={displayResult?.feedback}
              allSubmissions={getSubmissions().filter(s => s.assignmentId === id)}
            />
          )}

          {assignment.type === 'rewrite_vocab' && assignment.keywords && (
            <div className="glass rounded-3xl border border-white/5 p-6 md:p-8">
              <RewriteVocabExercise
                passage={assignment.passage || 'Viết một đoạn văn ngắn (chuyện chêm) bằng tiếng Việt, có sử dụng các từ khóa tiếng Anh dưới đây.'}
                keywords={assignment.keywords}
                onSubmit={handleRewriteSubmit}
                isSubmitting={isSubmitting}
                result={displayResult?.rewriteAnswers}
                score={displayResult?.score}
                durationMs={displayResult?.durationMs}
              />
            </div>
          )}

          {(assignment.type === 'vocabulary' || assignment.type === 'repetition') && assignment.vocabCards && (
            <VocabularyExercise
              vocabCards={assignment.vocabCards}
              onSubmit={handleVocabularySubmit}
              isSubmitting={isSubmitting}
              result={displayResult?.vocabAnswers}
              score={displayResult?.score}
              durationMs={displayResult?.durationMs}
              initialMode={assignment.type === 'repetition' ? 'dictation' : initialMode}
              isRequirementWorkflow={assignment.type === 'vocabulary'}
              isRepetitionWorkflow={assignment.type === 'repetition'}
              hideTabs={assignment.type === 'vocabulary' || assignment.type === 'repetition'}
              allSubmissions={getSubmissions().filter(s => s.assignmentId === id)}
            />
          )}
        </div>

        {/* Post-submit CTA */}
        {(result || isReview) && (
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/student/assignments')}
              className="flex-1 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 text-sm font-medium transition-all"
            >
              ← Về danh sách
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3 rounded-xl bg-slate-800/60 hover:bg-secondary text-sm font-medium transition-all"
            >
              Xem bảng xếp hạng
            </button>
          </div>
        )}

        {/* Leaderboard */}
        {(result || isReview) && (
          <RaceTrackLeaderboard submissions={getSubmissions().filter(s => s.assignmentId === id)} />
        )}
      </div>
    </>
  );
}
