'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { saveAssignment, VocabKeyword, QuizQuestion } from '@/lib/local-store';
import {
  BookOpen, ListChecks, Plus, Trash2, Upload,
  CheckCircle2, AlertCircle, ArrowLeft, Eye, FileJson, PenTool
} from 'lucide-react';

type Tab = 'vocab_context' | 'multiple_choice' | 'rewrite_vocab';

// ── Vocab Form ────────────────────────────────────────────────────────────────

function VocabForm({ onSave, isSaving }: {
  onSave: (d: { title: string; passage: string; keywords: VocabKeyword[]; imageUrl?: string }) => void;
  isSaving: boolean;
}) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!jsonText.trim()) { setError('Vui lòng nhập JSON'); return; }
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title) { setError('JSON thiếu trường "title"'); return; }
      if (!parsed.passage) { setError('JSON thiếu trường "passage"'); return; }
      if (!Array.isArray(parsed.keywords) || !parsed.keywords.length) { setError('JSON thiếu mảng "keywords" hợp lệ'); return; }
      
      const keywords = parsed.keywords.map((k: any) => ({
        word: k.word || '',
        answer: k.answer || ''
      }));

      if (keywords.some((k: VocabKeyword) => !k.word || !k.answer)) {
        setError('Tất cả keywords phải có đủ "word" và "answer"');
        return;
      }

      setError('');
      onSave({ 
        title: parsed.title, 
        passage: parsed.passage, 
        keywords
      });
    } catch (e: unknown) {
      setError(`JSON không hợp lệ: ${e instanceof Error ? e.message : 'lỗi không xác định'}`);
    }
  };

  const jsonTemplate = `{
  "title": "Chuyện Đi Lạc Của Cún Nhỏ",
  "passage": "Một ngày nọ, chú cún [decided] đi dạo. Nó cảm thấy rất [happy] vì thời tiết đẹp.",
  "keywords": [
    { "word": "decided", "answer": "quyết định" },
    { "word": "happy", "answer": "hạnh phúc" }
  ]
}`;

  return (
    <div className="space-y-5">
      
      {/* JSON Template Alert */}
      <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm">
        <div className="flex items-center gap-2 font-semibold text-violet-400 mb-2">
          <FileJson className="h-4 w-4" /> Định dạng JSON mẫu (Copy & Sửa):
        </div>
        <pre className="text-xs text-muted-foreground bg-black/30 p-3 rounded-lg overflow-x-auto font-mono">
          {jsonTemplate}
        </pre>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80 flex items-center justify-between">
          <span>Dán JSON vào đây</span>
          <span className="text-xs text-muted-foreground font-normal">Mọi thay đổi sẽ được lưu tự động khi nhấn Lưu</span>
        </label>
        <textarea 
          value={jsonText} 
          onChange={e => setJsonText(e.target.value)} 
          rows={10} 
          className="input-field resize-y font-mono text-xs w-full p-4"
          placeholder={'Dán cấu trúc JSON chứa bài tập vào đây...'} 
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary flex items-center justify-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        {isSaving ? 'Đang lưu...' : 'Lưu Bài Tập Vocab'}
      </button>
    </div>
  );
}

// ── Quiz Form ────────────────────────────────────────────────────────────────

function QuizForm({ onSave, isSaving }: {
  onSave: (d: { title: string; questions: QuizQuestion[] }) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const qs: QuizQuestion[] = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(qs) || !qs.length) throw new Error('Không tìm thấy mảng "questions"');
      if (!title && parsed.title) setTitle(parsed.title);
      setQuestions(qs);
      setError('');
    } catch (e: unknown) {
      setError(`JSON không hợp lệ: ${e instanceof Error ? e.message : 'lỗi không xác định'}`);
      setQuestions(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setJsonText(text);
      parseJson(text);
    };
    reader.readAsText(file);
  };

  const jsonTemplate = `{
  "title": "Quiz Unit 5",
  "questions": [
    {
      "id": 1,
      "question": "'Give up' có nghĩa là?",
      "options": ["Bắt đầu", "Từ bỏ", "Tiếp tục", "Hoàn thành"],
      "answer": "B",
      "explanation": "Give up = từ bỏ",
      "hint": "Cụm động từ này thường dùng khi bạn không muốn làm gì nữa vì quá khó.",
      "knowledgeArea": "Phrasal Verbs"
    }
  ]
}`;

  return (
    <div className="space-y-5">
      {/* JSON Template Alert */}
      <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-sm">
        <div className="flex items-center gap-2 font-semibold text-teal-400 mb-2">
          <FileJson className="h-4 w-4" /> Định dạng JSON mẫu (Copy & Sửa):
        </div>
        <pre className="text-xs text-muted-foreground bg-black/30 p-3 rounded-lg overflow-x-auto font-mono">
          {jsonTemplate}
        </pre>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">Tiêu đề bài tập</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
          placeholder="VD: Unit 5 – Phrasal Verbs Quiz" />
      </div>

      {/* Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group">
        <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground group-hover:text-teal-400 transition-colors" />
        <p className="text-sm text-muted-foreground">
          Kéo thả hoặc <span className="text-teal-400 font-medium">click để upload file .json</span>
        </p>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground">hoặc paste JSON trực tiếp</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      <textarea value={jsonText}
        onChange={e => { setJsonText(e.target.value); if (e.target.value.trim()) parseJson(e.target.value); }}
        rows={8} className="input-field font-mono text-xs resize-none"
        placeholder={'{\n  "title": "Quiz Unit 5",\n  "questions": [\n    {\n      "id": 1,\n      "question": "\'Give up\' có nghĩa là?",\n      "options": ["Bắt đầu", "Từ bỏ", "Tiếp tục", "Hoàn thành"],\n      "answer": "B",\n      "explanation": "Give up = từ bỏ",\n      "hint": "Gợi ý đây...",\n      "knowledgeArea": "Phrasal Verbs"\n    }\n  ]\n}'} />

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {questions && (
        <div className="p-4 rounded-xl bg-teal-500/8 border border-teal-500/25 space-y-2">
          <div className="flex items-center gap-2 text-teal-400 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Preview: {questions.length} câu hỏi hợp lệ
          </div>
          {questions.slice(0, 2).map((q, i) => (
            <p key={i} className="text-xs text-muted-foreground pl-6 truncate">
              <span className="text-foreground font-medium">{i + 1}.</span> {q.question}
            </p>
          ))}
          {questions.length > 2 && <p className="text-xs text-muted-foreground pl-6">...và {questions.length - 2} câu nữa</p>}
        </div>
      )}

      <button
        onClick={() => {
          if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return; }
          if (!questions) { setError('Vui lòng nhập JSON hợp lệ'); return; }
          onSave({ title, questions });
        }}
        disabled={isSaving || !questions}
        className="w-full py-3.5 rounded-xl bg-teal-500 text-white font-semibold text-sm hover:bg-teal-400 disabled:opacity-40 transition-all">
        {isSaving ? 'Đang lưu...' : '✓ Lưu Bài Tập Trắc Nghiệm'}
      </button>
    </div>
  );
}

// ── Rewrite Vocab Form ────────────────────────────────────────────────────────

function RewriteVocabForm({ onSave, isSaving }: {
  onSave: (d: { title: string; passage: string; keywords: VocabKeyword[] }) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [passage, setPassage] = useState('');
  const [keywords, setKeywords] = useState<{ word: string }[]>([{ word: '' }]);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return; }
    
    const validKeywords = keywords.filter(k => k.word.trim() !== '');
    if (validKeywords.length === 0) { setError('Vui lòng nhập ít nhất 1 từ khóa'); return; }

    setError('');
    // For rewrite, we just need the 'word' part of the VocabKeyword.
    onSave({ 
      title, 
      passage: passage || 'Viết một đoạn văn ngắn (chuyện chêm) bằng tiếng Việt, có sử dụng các từ khóa tiếng Anh dưới đây.', 
      keywords: validKeywords.map(k => ({ word: k.word.trim(), answer: '' })) 
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">Tiêu đề bài tập</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
          placeholder="VD: Viết chuyện chêm: Daily Routines" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">Hướng dẫn làm bài (không bắt buộc)</label>
        <textarea value={passage} onChange={e => setPassage(e.target.value)} rows={3} className="input-field resize-none text-sm"
          placeholder="Viết một đoạn văn ngắn (chuyện chêm) bằng tiếng Việt, có sử dụng các từ khóa tiếng Anh dưới đây." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Danh sách từ khóa yêu cầu</label>
        <div className="space-y-2">
          {keywords.map((k, i) => (
            <div key={i} className="flex items-center gap-3">
              <input value={k.word}
                onChange={e => setKeywords(prev => prev.map((kk, ii) => ii === i ? { word: e.target.value } : kk))}
                className="input-field" placeholder="Ví dụ: wake up" />
              <button onClick={() => setKeywords(prev => prev.filter((_, ii) => ii !== i))}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setKeywords(prev => [...prev, { word: '' }])}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-4 w-4" /> Thêm từ khóa
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-400 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)]">
        {isSaving ? 'Đang lưu...' : '✓ Lưu Bài Tập Viết Lại'}
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NewAssignmentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('vocab_context');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = (data: Omit<Parameters<typeof saveAssignment>[0], 'type'>, type: Tab) => {
    setIsSaving(true);
    saveAssignment({ ...data, type });
    setTimeout(() => { setSuccess(true); setTimeout(() => router.push('/'), 1200); }, 300);
    setIsSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          Đã lưu thành công! Đang về dashboard...
        </div>
      )}

      {/* Type tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {([
          { key: 'vocab_context' as Tab, icon: BookOpen, label: 'Điền Chuyện Chêm', desc: 'Điền nghĩa tiếng Việt', color: 'violet' },
          { key: 'multiple_choice' as Tab, icon: ListChecks, label: 'Trắc Nghiệm', desc: 'Chọn 1 trong 4 đáp án', color: 'teal' },
          { key: 'rewrite_vocab' as Tab, icon: PenTool, label: 'Viết Chuyện Chêm', desc: 'Học viên tự viết đoạn văn', color: 'amber' },
        ]).map(({ key, icon: Icon, label, desc, color }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`group glass hover-lift rounded-2xl p-5 text-left border-2 transition-all ${
              tab === key
                ? color === 'violet' ? 'border-violet-500/50 bg-violet-500/10'
                  : color === 'teal' ? 'border-teal-500/50 bg-teal-500/10'
                  : 'border-amber-500/50 bg-amber-500/10'
                : 'border-border hover:border-border/80'
            }`}>
            <Icon className={`h-6 w-6 mb-3 transition-colors ${
              tab === key
                ? color === 'violet' ? 'text-violet-400' 
                  : color === 'teal' ? 'text-teal-400'
                  : 'text-amber-400'
                : 'text-muted-foreground group-hover:text-foreground'
            }`} />
            <p className={`font-semibold text-sm ${tab === key ? (
              color === 'violet' ? 'text-violet-300' 
              : color === 'teal' ? 'text-teal-300' 
              : 'text-amber-300'
            ) : ''}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="glass rounded-2xl border border-border p-6">
        {tab === 'vocab_context' && <VocabForm onSave={d => handleSave(d, 'vocab_context')} isSaving={isSaving} />}
        {tab === 'multiple_choice' && <QuizForm onSave={d => handleSave(d, 'multiple_choice')} isSaving={isSaving} />}
        {tab === 'rewrite_vocab' && <RewriteVocabForm onSave={d => handleSave(d, 'rewrite_vocab')} isSaving={isSaving} />}
      </div>
    </div>
  );
}
