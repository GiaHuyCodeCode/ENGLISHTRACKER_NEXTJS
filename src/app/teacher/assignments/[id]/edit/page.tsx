'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAssignment, updateAssignment } from '@/lib/local-store';
import { ArrowLeft, CheckCircle2, Clock, BookOpen } from 'lucide-react';
import { VocabForm, QuizForm, RewriteVocabForm, DictationForm, VocabularyForm, ShadowingForm } from '@/components/forms/AssignmentForms';

export default function EditAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params?.id as string;
  const [assignment, setAssignment] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [skill, setSkill] = useState<'Vocab' | 'Grammar' | 'Reading' | 'Listening' | 'Writing' | 'Speaking'>('Vocab');
  const [createdAtDate, setCreatedAtDate] = useState('');

  useEffect(() => {
    const a = getAssignment(assignmentId);
    if (!a) {
      router.push('/');
    } else {
      setAssignment(a);
      setSkill(a.skill || 'Vocab');
      if (a.createdAt) {
        setCreatedAtDate(new Date(a.createdAt).toISOString().split('T')[0]);
      } else {
        const local = new Date();
        const offset = local.getTimezoneOffset();
        const localDate = new Date(local.getTime() - (offset * 60 * 1000));
        setCreatedAtDate(localDate.toISOString().split('T')[0]);
      }
    }
  }, [assignmentId, router]);

  const handleSave = (data: any) => {
    setIsSaving(true);
    const createdAtISO = new Date(createdAtDate + 'T00:00:00Z').toISOString();
    updateAssignment(assignmentId, { ...data, skill, createdAt: createdAtISO });
    setTimeout(() => { 
      setSuccess(true); 
      setTimeout(() => router.push('/?tab=assignments_mgmt'), 1200); 
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
          Đã cập nhật thành công! Đang về trang quản lý bài tập...
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {/* Date & Skill Scheduler */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl border border-border p-6 space-y-3">
            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Ngày giao bài tập (Scheduled Date)
            </label>
            <input
              type="date"
              value={createdAtDate}
              onChange={e => setCreatedAtDate(e.target.value)}
              className="input-field w-full"
            />
            <p className="text-xs text-muted-foreground">
              Bài tập sẽ chỉ hiển thị ở phía học sinh kể từ ngày được chọn này.
            </p>
          </div>

          <div className="glass rounded-2xl border border-border p-6 space-y-3">
            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Kĩ năng (Skill Area)
            </label>
            <select
              value={skill}
              onChange={e => setSkill(e.target.value as any)}
              className="input-field w-full bg-slate-900 border-border text-foreground"
            >
              <option value="Vocab">Từ vựng (Vocabulary)</option>
              <option value="Grammar">Ngữ pháp (Grammar)</option>
              <option value="Listening">Nghe chép (Listening)</option>
              <option value="Reading">Đọc hiểu (Reading)</option>
              <option value="Writing">Viết (Writing)</option>
              <option value="Speaking">Nói (Speaking)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Chọn nhóm kĩ năng để phân tích điểm số và biểu đồ radar cho học sinh.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl border border-border p-6">
          {assignment.type === 'vocab_context' && <VocabForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'multiple_choice' && <QuizForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'rewrite_vocab' && <RewriteVocabForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'dictation' && <DictationForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'vocabulary' && <VocabularyForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
          {assignment.type === 'shadowing' && <ShadowingForm onSave={handleSave} isSaving={isSaving} initialData={assignment} />}
        </div>
      </div>
    </div>
  );
}
