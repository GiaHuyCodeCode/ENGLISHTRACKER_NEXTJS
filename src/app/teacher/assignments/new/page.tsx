'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveAssignment, VocabKeyword, QuizQuestion, getVocabularyCards, DictationSentence } from '@/lib/local-store';
import {
  BookOpen, ListChecks, Plus, Trash2, Upload,
  CheckCircle2, AlertCircle, ArrowLeft, Eye, FileJson, PenTool,
  Headphones, Play, Clock, ChevronDown, Volume2, Mic
} from 'lucide-react';

type Tab = 'vocab_context' | 'multiple_choice' | 'rewrite_vocab' | 'dictation' | 'vocabulary' | 'shadowing';

import { VocabForm, QuizForm, RewriteVocabForm, DictationForm, VocabularyForm, ShadowingForm } from '@/components/forms/AssignmentForms';

export default function NewAssignmentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('vocab_context');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [skill, setSkill] = useState<'Vocab' | 'Grammar' | 'Reading' | 'Listening' | 'Writing' | 'Speaking'>('Vocab');
  const [createdAtDate, setCreatedAtDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localDate = new Date(local.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (tab === 'vocab_context' || tab === 'vocabulary') {
      setSkill('Vocab');
    } else if (tab === 'multiple_choice') {
      setSkill('Grammar');
    } else if (tab === 'dictation') {
      setSkill('Listening');
    } else if (tab === 'rewrite_vocab') {
      setSkill('Writing');
    } else if (tab === 'shadowing') {
      setSkill('Speaking');
    }
  }, [tab]);

  const handleSave = (data: Omit<Parameters<typeof saveAssignment>[0], 'type'>, type: Tab) => {
    setIsSaving(true);
    const createdAtISO = new Date(createdAtDate + 'T00:00:00Z').toISOString();
    saveAssignment({ ...data, type, skill, createdAt: createdAtISO } as any);
    setTimeout(() => { setSuccess(true); setTimeout(() => router.push('/?tab=assignments_mgmt'), 1200); }, 300);
    setIsSaving(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">Tạo Bài Tập Mới</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lưu trực tiếp trên thiết bị</p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium slide-up">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          Đã lưu thành công! Đang về trang quản lý bài tập...
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Type tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {([
            { key: 'vocab_context' as Tab, icon: BookOpen,   label: 'Điền Chuyện Chêm', desc: 'Điền nghĩa tiếng Việt',          color: 'violet'  },
            { key: 'multiple_choice' as Tab, icon: ListChecks, label: 'Trắc Nghiệm',      desc: 'Chọn 1 trong 4 đáp án',          color: 'teal'    },
            { key: 'rewrite_vocab' as Tab,   icon: PenTool,    label: 'Viết Chuyện Chêm', desc: 'Học viên tự viết đoạn văn',      color: 'amber'   },
            { key: 'dictation' as Tab,       icon: Headphones, label: 'Dictation',         desc: 'Nghe & gõ lại câu',              color: 'sky'     },
            { key: 'vocabulary' as Tab,      icon: FileJson,   label: 'Học Từ Vựng',       desc: 'Flashcard, Quiz, Chính tả',      color: 'indigo'  },
            { key: 'shadowing' as Tab,       icon: Mic,        label: 'Shadowing',          desc: 'Nghe & nhắc lại câu (Speaking)', color: 'emerald' },
          ]).map(({ key, icon: Icon, label, desc, color }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`group glass hover-lift rounded-2xl p-5 text-left border-2 transition-all ${
                tab === key
                  ? color === 'violet'  ? 'border-violet-500/50 bg-violet-500/10'
                  : color === 'teal'    ? 'border-teal-500/50 bg-teal-500/10'
                  : color === 'amber'   ? 'border-amber-500/50 bg-amber-500/10'
                  : color === 'indigo'  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : color === 'emerald' ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-sky-500/50 bg-sky-500/10'
                  : 'border-border hover:border-border/80'
              }`}>
              <Icon className={`h-6 w-6 mb-3 transition-colors ${
                tab === key
                  ? color === 'violet'  ? 'text-violet-400'
                  : color === 'teal'    ? 'text-teal-400'
                  : color === 'amber'   ? 'text-amber-400'
                  : color === 'indigo'  ? 'text-indigo-400'
                  : color === 'emerald' ? 'text-emerald-400'
                  : 'text-sky-400'
                  : 'text-muted-foreground group-hover:text-foreground'
              }`} />
              <p className={`font-semibold text-sm ${tab === key ? (
                color === 'violet'  ? 'text-violet-300'
                : color === 'teal'    ? 'text-teal-300'
                : color === 'amber'   ? 'text-amber-300'
                : color === 'indigo'  ? 'text-indigo-300'
                : color === 'emerald' ? 'text-emerald-300'
                : 'text-sky-300'
              ) : ''}`}>{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </button>
          ))}
        </div>

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
          {tab === 'vocab_context' && <VocabForm onSave={d => handleSave(d, 'vocab_context')} isSaving={isSaving} />}
          {tab === 'multiple_choice' && <QuizForm onSave={d => handleSave(d, 'multiple_choice')} isSaving={isSaving} />}
          {tab === 'rewrite_vocab' && <RewriteVocabForm onSave={d => handleSave(d, 'rewrite_vocab')} isSaving={isSaving} />}
          {tab === 'dictation' && <DictationForm onSave={d => handleSave(d as any, 'dictation')} isSaving={isSaving} />}
          {tab === 'vocabulary' && <VocabularyForm onSave={d => handleSave(d, 'vocabulary')} isSaving={isSaving} />}
          {tab === 'shadowing' && <ShadowingForm onSave={d => handleSave(d as any, 'shadowing')} isSaving={isSaving} />}
        </div>
      </div>
    </div>
  );
}
