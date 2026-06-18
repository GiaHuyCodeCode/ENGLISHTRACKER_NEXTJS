'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAssignment, getStudentSubmission, getSubmissions, submitVocab, submitQuiz, submitRewrite,
  Assignment, Submission, getStudentNames, getStudentColors, getStudentAvatar, seedIfEmpty,
} from '@/lib/local-store';
import { VocabContextExercise } from '@/components/exercises/VocabContextExercise';
import { MultipleChoiceExercise } from '@/components/exercises/MultipleChoiceExercise';
import { RewriteVocabExercise } from '@/components/exercises/RewriteVocabExercise';
import { ArrowLeft, BookOpen, ListChecks, User, ChevronRight, AlertCircle, PenTool } from 'lucide-react';

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
  const router = useRouter();
  const id = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [existingResult, setExistingResult] = useState<Submission | null>(null);
  const [result, setResult] = useState<Submission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<unknown>(null);
  const [pendingOverrides, setPendingOverrides] = useState<string[] | undefined>(undefined);
  const [currentStudent, setCurrentStudent] = useState<string | null>(null);

  useEffect(() => {
    seedIfEmpty();
    const a = getAssignment(id);
    if (!a) { router.replace('/student/assignments'); return; }
    setAssignment(a);

    const saved = localStorage.getItem('et_current_student');
    if (saved && getStudentNames().includes(saved)) {
      setCurrentStudent(saved);
      const existing = getStudentSubmission(id, saved);
      if (existing) setExistingResult(existing);
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
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalConfirm = (name: string) => {
    if (assignment?.type === 'vocab_context') doSubmitVocab(name, pendingAnswers, pendingOverrides);
    else if (assignment?.type === 'multiple_choice') doSubmitQuiz(name, pendingAnswers);
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

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/student/assignments')}
            className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                assignment.type === 'vocab_context' ? 'bg-violet-500/15 text-violet-400' : 
                assignment.type === 'multiple_choice' ? 'bg-teal-500/15 text-teal-400' :
                'bg-amber-500/15 text-amber-400'
              }`}>
                {assignment.type === 'vocab_context' ? 'Vocab In-Context' : 
                 assignment.type === 'multiple_choice' ? 'Trắc Nghiệm' : 'Viết Chuyện Chêm'}
              </span>
              {isReview && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">
                  Đang xem lại
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold font-heading gradient-text leading-tight">{assignment.title}</h1>
            {currentStudent && (
              <p className="text-xs text-muted-foreground mt-1">Học viên: <span className="text-foreground font-medium">{currentStudent}</span></p>
            )}
          </div>
        </div>

        {/* Exercise */}
        <div className="glass rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border/50">
            <div className={`p-2 rounded-lg ${
              assignment.type === 'vocab_context' ? 'bg-violet-500/15' : 
              assignment.type === 'multiple_choice' ? 'bg-teal-500/15' : 
              'bg-amber-500/15'
            }`}>
              {assignment.type === 'vocab_context' ? <BookOpen className="h-4 w-4 text-violet-400" /> : 
               assignment.type === 'multiple_choice' ? <ListChecks className="h-4 w-4 text-teal-400" /> :
               <PenTool className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {assignment.type === 'vocab_context' ? 'Điền Nghĩa Từ Vựng' : 
                 assignment.type === 'multiple_choice' ? 'Chọn Đáp Án Đúng' : 'Viết Chuyện Chêm'}
              </p>
              <p className="text-xs text-muted-foreground">
                {assignment.type === 'vocab_context' ? `${assignment.keywords?.length} từ khóa` : 
                 assignment.type === 'multiple_choice' ? `${assignment.questions?.length} câu hỏi` :
                 `${assignment.keywords?.length} từ khóa cần dùng`}
              </p>
            </div>
          </div>

          {assignment.type === 'vocab_context' && assignment.passage && assignment.keywords && (
            <VocabContextExercise
              passage={assignment.passage}
              keywords={assignment.keywords}
              onSubmit={handleVocabSubmit}
              isSubmitting={isSubmitting}
              result={displayResult?.vocabAnswers}
              score={displayResult?.score}
            />
          )}

          {assignment.type === 'multiple_choice' && assignment.questions && (
            <MultipleChoiceExercise
              questions={assignment.questions}
              onSubmit={handleQuizSubmit}
              isSubmitting={isSubmitting}
              result={displayResult?.quizAnswers}
              score={displayResult?.score}
              allowHints={assignment.allowHints}
              feedback={displayResult?.feedback}
              allSubmissions={getSubmissions().filter(s => s.assignmentId === id)}
            />
          )}

          {assignment.type === 'rewrite_vocab' && assignment.passage && assignment.keywords && (
            <RewriteVocabExercise
              passage={assignment.passage}
              keywords={assignment.keywords}
              onSubmit={handleRewriteSubmit}
              isSubmitting={isSubmitting}
              result={displayResult?.rewriteAnswers}
              score={displayResult?.score}
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
      </div>
    </>
  );
}
