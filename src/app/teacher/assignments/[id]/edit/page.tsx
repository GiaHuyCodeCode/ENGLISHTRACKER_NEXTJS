'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAssignment, updateAssignment } from '@/lib/local-store';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { VocabForm, QuizForm, RewriteVocabForm, DictationForm, VocabularyForm } from '@/components/forms/AssignmentForms';

export default function EditAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params?.id as string;
  const [assignment, setAssignment] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const a = getAssignment(assignmentId);
    if (!a) {
      router.push('/');
    } else {
      setAssignment(a);
    }
  }, [assignmentId, router]);

  const handleSave = (data: any) => {
    setIsSaving(true);
    updateAssignment(assignmentId, data);
    setTimeout(() => { 
      setSuccess(true); 
      setTimeout(() => router.push('/'), 1200); 
    }, 300);
    setIsSaving(false);
  };

  if (!assignment) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">Chỉnh Sửa Bài Tập</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sửa nội dung cho bài "{assignment.title}"</p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium slide-up">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          Đã cập nhật thành công! Đang về dashboard...
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        <div className="glass rounded-2xl border border-border p-6">
          {assignment.type === 'vocab_context' && <VocabForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'multiple_choice' && <QuizForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'rewrite_vocab' && <RewriteVocabForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'dictation' && <DictationForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'vocabulary' && <VocabularyForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
        </div>
      </div>
    </div>
  );
}
