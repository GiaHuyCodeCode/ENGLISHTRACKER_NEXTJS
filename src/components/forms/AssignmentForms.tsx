'use client';

import { useState, useRef } from 'react';
import { VocabKeyword, QuizQuestion, DictationSentence, getVocabularyCards } from '@/lib/local-store';
import { BookOpen, ListChecks, Plus, Trash2, Upload, CheckCircle2, AlertCircle, ArrowLeft, Eye, FileJson, PenTool, Headphones, Play, Clock, ChevronDown, Volume2, Save, X, XCircle, Search, Copy } from 'lucide-react';

// YouTube URL parser
export function extractYoutubeId(url: string): string | null {
  const regExps = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of regExps) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ── Vocab Form ──────────────────────────────────────────────────────────────
export function VocabForm({ onSave, isSaving, initialData }: {
  onSave: (d: { title: string; passage: string; keywords: VocabKeyword[]; imageUrl?: string }) => void;
  isSaving: boolean;
  initialData?: any;
}) {
  const [parsedData, setParsedData] = useState<{ title: string; passage: string; keywords: VocabKeyword[] } | null>(
    initialData ? { title: initialData.title || '', passage: initialData.passage || '', keywords: initialData.keywords || [] } : null
  );
  
  const [jsonText, setJsonText] = useState(() => {
    if (initialData) return JSON.stringify(initialData, null, 2);
    return '';
  });
  const [error, setError] = useState('');

  const parseJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.title || !parsed.passage || !Array.isArray(parsed.keywords)) {
        throw new Error('JSON thiếu title, passage hoặc mảng keywords');
      }
      setParsedData({
        title: parsed.title,
        passage: parsed.passage,
        keywords: parsed.keywords.map((k: any) => ({ word: k.word || '', answer: k.answer || '' }))
      });
      setError('');
    } catch (e: unknown) {
      setError(`JSON không hợp lệ: ${e instanceof Error ? e.message : 'lỗi không xác định'}`);
      setParsedData(null);
    }
  };

  const handleSave = () => {
    if (!parsedData) { setError('Vui lòng nhập JSON hợp lệ trước khi lưu'); return; }
    if (parsedData.keywords.some(k => !k.word || !k.answer)) {
      setError('Tất cả keywords phải có đủ "word" và "answer"');
      return;
    }
    setError('');
    onSave(parsedData);
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
          <span className="text-xs text-muted-foreground font-normal">Sẽ tự động sinh ra bảng Preview bên dưới</span>
        </label>
        <textarea 
          value={jsonText} 
          onChange={e => { setJsonText(e.target.value); if (e.target.value.trim()) parseJson(e.target.value); }} 
          rows={6} 
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

      {parsedData && (
        <div className="space-y-4 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Tiêu đề bài học</label>
            <input 
              className="input-field text-sm w-full font-bold text-violet-400"
              value={parsedData.title}
              onChange={e => setParsedData(p => p ? { ...p, title: e.target.value } : null)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Đoạn văn (passage)</label>
            <textarea 
              className="input-field text-sm w-full resize-y"
              rows={3}
              value={parsedData.passage}
              onChange={e => setParsedData(p => p ? { ...p, passage: e.target.value } : null)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Từ khóa (Có thể sửa trực tiếp)</label>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {parsedData.keywords.map((k, i) => (
                <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-black/20 border border-white/5 relative group">
                  <button 
                    onClick={() => setParsedData(p => p ? { ...p, keywords: p.keywords.filter((_, idx) => idx !== i) } : null)}
                    className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Xóa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <input 
                    className="bg-transparent border-b border-white/10 focus:border-violet-400 outline-none w-full text-sm font-semibold pb-1 pr-6"
                    value={k.word}
                    placeholder="Từ tiếng Anh"
                    onChange={e => {
                      const newKw = [...parsedData.keywords];
                      newKw[i] = { ...k, word: e.target.value };
                      setParsedData(p => p ? { ...p, keywords: newKw } : null);
                    }}
                  />
                  <input 
                    className="bg-transparent outline-none w-full text-xs text-muted-foreground focus:text-foreground mt-1"
                    value={k.answer}
                    placeholder="Nghĩa tiếng Việt"
                    onChange={e => {
                      const newKw = [...parsedData.keywords];
                      newKw[i] = { ...k, answer: e.target.value };
                      setParsedData(p => p ? { ...p, keywords: newKw } : null);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving || !parsedData}
        className="w-full py-3.5 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-400 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(139,92,246,0.25)] flex items-center justify-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        {isSaving ? 'Đang lưu...' : 'Lưu Bài Tập Vocab'}
      </button>
    </div>
  );
}

// ── Quiz Form ────────────────────────────────────────────────────────────────

export function QuizForm({ onSave, isSaving, initialData }: {
  onSave: (d: { title: string; questions: QuizQuestion[] }) => void;
  isSaving: boolean;
  initialData?: any;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [jsonText, setJsonText] = useState(() => {
    if (initialData?.questions) return JSON.stringify({ title: initialData.title, questions: initialData.questions }, null, 2);
    return '';
  });
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(initialData?.questions || null);
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
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-teal-400 text-sm font-medium px-2">
            <CheckCircle2 className="h-4 w-4" />
            Preview: {questions.length} câu hỏi (Có thể chỉnh sửa trực tiếp)
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {questions.map((q, i) => (
              <div key={i} className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-3 relative group">
                <button 
                  onClick={() => setQuestions(qs => qs!.filter((_, idx) => idx !== i))}
                  className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Xóa câu hỏi này"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="pr-8">
                  <label className="text-xs text-muted-foreground mb-1 block">Câu hỏi {i + 1}</label>
                  <textarea 
                    className="input-field w-full text-sm font-medium resize-y"
                    rows={2}
                    value={q.question}
                    onChange={e => {
                      const newQs = [...questions];
                      newQs[i] = { ...q, question: e.target.value };
                      setQuestions(newQs);
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4 flex-shrink-0 text-center">{['A', 'B', 'C', 'D'][optIdx]}</span>
                      <input 
                        className="input-field w-full text-xs py-1.5"
                        value={opt}
                        onChange={e => {
                          const newQs = [...questions];
                          const newOpts = [...q.options];
                          newOpts[optIdx] = e.target.value;
                          newQs[i] = { ...q, options: newOpts };
                          setQuestions(newQs);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Đáp án đúng (A/B/C/D)</label>
                    <input 
                      className="input-field w-full text-xs py-1.5 font-bold text-teal-400 uppercase"
                      value={q.answer}
                      maxLength={1}
                      onChange={e => {
                        const newQs = [...questions];
                        newQs[i] = { ...q, answer: e.target.value.toUpperCase() };
                        setQuestions(newQs);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mảng kiến thức</label>
                    <input 
                      className="input-field w-full text-xs py-1.5"
                      value={q.knowledgeArea || ''}
                      placeholder="VD: Phrasal Verbs"
                      onChange={e => {
                        const newQs = [...questions];
                        newQs[i] = { ...q, knowledgeArea: e.target.value };
                        setQuestions(newQs);
                      }}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <label className="text-xs text-muted-foreground">Giải thích / Gợi ý</label>
                    <textarea 
                      className="input-field w-full text-xs py-1.5 resize-y"
                      rows={2}
                      value={q.explanation || q.hint || ''}
                      onChange={e => {
                        const newQs = [...questions];
                        newQs[i] = { ...q, explanation: e.target.value, hint: e.target.value };
                        setQuestions(newQs);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
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

export function RewriteVocabForm({ onSave, isSaving, initialData }: {
  onSave: (d: { title: string; passage: string; keywords: VocabKeyword[] }) => void;
  isSaving: boolean;
  initialData?: any;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [passage, setPassage] = useState(initialData?.passage || '');
  const [keywords, setKeywords] = useState<{ word: string }[]>(
    initialData?.keywords?.map((k: any) => ({ word: k.word })) || [{ word: '' }]
  );
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

// ── Dictation Form ────────────────────────────────────────────────────────────

export function DictationForm({ onSave, isSaving, initialData }: {
  onSave: (d: any) => void;
  isSaving: boolean;
  initialData?: any;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  
  // Safe parse sentences for Dictation
  const initSentences = () => {
    let s = initialData?.sentences || initialData?.passage;
    if (!s) return [{ id: 1, text: '', startTime: 0 }];
    if (typeof s === 'string') {
      try { s = JSON.parse(s); } catch { s = []; }
      if (typeof s === 'string') {
        try { s = JSON.parse(s); } catch { s = []; }
      }
    }
    return Array.isArray(s) && s.length > 0 ? s : [{ id: 1, text: '', startTime: 0 }];
  };

  const [sentences, setSentences] = useState<DictationSentence[]>(initSentences());
  const [error, setError] = useState('');
  const [jsonText, setJsonText] = useState(() => {
    if (initialData?.sentences || initialData?.passage) return JSON.stringify({ title: initialData.title, sentences: initSentences() }, null, 2);
    return '';
  });

  const parseJson = (raw: string) => {
    try {
      const json = JSON.parse(raw);
      if (!Array.isArray(json.sentences) || json.sentences.length === 0) {
        setError('File JSON phải có trường "sentences" là mảng không rỗng.');
        return;
      }
      const parsed: DictationSentence[] = json.sentences.map((s: any, i: number) => ({
        id: s.id ?? i + 1,
        text: s.text || '',
        startTime: s.startTime ?? 0,
      }));
      setSentences(parsed);
      if (json.title && !title) setTitle(json.title);
      setError('');
    } catch {
      setError('JSON không hợp lệ. Vui lòng kiểm tra lại định dạng.');
    }
  };

  const addSentence = () => setSentences(prev => [...prev, { id: prev.length + 1, text: '', startTime: 0 }]);
  const updateSentence = (idx: number, value: string) =>
    setSentences(prev => prev.map((s, i) => i === idx ? { ...s, text: value } : s));
  const removeSentence = (idx: number) =>
    setSentences(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, id: i + 1 })));

  const handleSave = () => {
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề bài tập'); return; }
    const validSentences = sentences.filter(s => s.text.trim());
    if (validSentences.length === 0) { setError('Vui lòng nhập ít nhất 1 câu'); return; }
    setError('');
    onSave({ title, sentences: validSentences, passage: JSON.stringify(validSentences) });
  };

  const jsonSample = `{
  "title": "Tên bài dictation",
  "sentences": [
    { "id": 1, "text": "The weather today is really nice." },
    { "id": 2, "text": "I usually wake up early in the morning." }
  ]
}`;

  return (
    <div className="space-y-6">
      {/* Guide */}
      <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sm">
        <div className="flex items-center gap-2 font-semibold text-sky-400 mb-2">
          <Headphones className="h-4 w-4" /> Tạo bài Dictation từ file JSON
        </div>
        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
          <li>Chuẩn bị JSON chứa danh sách câu theo định dạng mẫu bên dưới</li>
          <li>Paste (dán) trực tiếp nội dung JSON vào ô textbox</li>
          <li>Học viên sẽ nghe TTS đọc từng câu và gõ lại, điểm tính tự động</li>
        </ol>
      </div>

      {/* JSON sample */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-white/5">
        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Định dạng JSON mẫu</p>
        <pre className="text-xs text-emerald-400 font-mono bg-black/30 p-3 rounded-lg overflow-x-auto">{jsonSample}</pre>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">Tiêu đề bài tập</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
          placeholder="VD: Dictation Unit 5 – Daily Routines" />
      </div>

      {/* Paste JSON */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80 flex items-center justify-between">
          <span>Dán JSON vào đây</span>
          <span className="text-xs text-muted-foreground font-normal">Sẽ tự động điền danh sách câu bên dưới</span>
        </label>
        <textarea 
          value={jsonText} 
          onChange={e => { setJsonText(e.target.value); if (e.target.value.trim()) parseJson(e.target.value); }}
          rows={8} 
          className="input-field font-mono text-xs w-full p-4 resize-y"
          placeholder="Dán cấu trúc JSON chứa bài tập vào đây..." 
        />
      </div>

      {/* Sentences */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground/80">
            Danh sách câu ({sentences.filter(s => s.text.trim()).length} câu)
          </label>
        </div>
        <div className="space-y-3">
          {sentences.map((s, idx) => (
            <div key={idx} className="glass rounded-2xl border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase">Câu {idx + 1}</span>
                {sentences.length > 1 && (
                  <button onClick={() => removeSentence(idx)} className="p-1 text-muted-foreground/40 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <textarea value={s.text} onChange={e => updateSentence(idx, e.target.value)}
                rows={2} className="input-field text-sm w-full resize-none"
                placeholder={`Nội dung câu ${idx + 1}...`} />
            </div>
          ))}
        </div>
        <button onClick={addSentence} className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors">
          <Plus className="h-4 w-4" /> Thêm câu
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-400 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(14,165,233,0.25)] flex items-center justify-center gap-2">
        <Headphones className="h-4 w-4" />
        {isSaving ? 'Đang lưu...' : '✓ Lưu Bài Tập Dictation'}
      </button>
    </div>
  );
}

// ── Vocabulary Form ──────────────────────────────────────────────────────────

export function VocabularyForm({ onSave, isSaving, initialData }: {
  onSave: (d: { title: string; vocabCards: any[] }) => void;
  isSaving: boolean;
  initialData?: any;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [jsonText, setJsonText] = useState(() => {
    if (initialData?.vocabCards) return JSON.stringify(initialData.vocabCards, null, 2);
    return '';
  });
  const [vocabCards, setVocabCards] = useState<any[] | null>(initialData?.vocabCards || null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const parseJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const cards = Array.isArray(parsed) ? parsed : parsed.vocabCards || parsed.cards;
      if (!Array.isArray(cards) || !cards.length) throw new Error('Không tìm thấy mảng từ vựng hợp lệ');
      
      // Validate each card
      const validated = cards.map((c: any, index: number) => {
        if (!c.word) throw new Error(`Từ vựng thứ ${index + 1} thiếu trường "word"`);
        if (!c.meaning) throw new Error(`Từ vựng "${c.word || index + 1}" thiếu trường "meaning"`);
        return {
          id: c.id || crypto.randomUUID(),
          word: c.word.trim(),
          phonetic: (c.phonetic || '').trim(),
          synonyms: Array.isArray(c.synonyms) ? c.synonyms.map((s: any) => String(s).trim()) : [],
          meaning: c.meaning.trim(),
          example: (c.example || '').trim()
        };
      });

      if (!title && parsed.title) setTitle(parsed.title);
      setVocabCards(validated);
      setError('');
    } catch (e: unknown) {
      setError(`JSON không hợp lệ: ${e instanceof Error ? e.message : 'lỗi không xác định'}`);
      setVocabCards(null);
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

  const handleDeleteCard = (index: number) => {
    if (!vocabCards) return;
    const updated = vocabCards.filter((_, i) => i !== index);
    setVocabCards(updated);
    // Update raw JSON string too
    setJsonText(JSON.stringify(updated, null, 2));
  };

  const jsonTemplate = `[
  {
    "word": "Consume",
    "phonetic": "/kənˈsjuːm/",
    "synonyms": ["Absorb", "Use up", "Deplete"],
    "meaning": "Tiêu thụ, sử dụng hết",
    "example": "This machine ___ too much energy."
  }
]`;

  return (
    <div className="space-y-6">
      {/* Guide & Template */}
      <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm space-y-3">
        <div className="flex items-center gap-2 font-semibold text-violet-400">
          <FileJson className="h-4 w-4" /> Định dạng JSON mẫu (Mảng các từ vựng):
        </div>
        <pre className="text-xs text-muted-foreground bg-black/30 p-3 rounded-lg overflow-x-auto font-mono">
          {jsonTemplate}
        </pre>
        <button 
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(jsonTemplate);
            alert('Đã copy cấu trúc JSON mẫu!');
          }}
          className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline"
        >
          Copy JSON Mẫu
        </button>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">Tiêu đề bài học từ vựng</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
          placeholder="VD: Vocabulary Unit 5 – Technology Words" />
      </div>

      {/* Input text */}
      <textarea value={jsonText}
        onChange={e => { setJsonText(e.target.value); if (e.target.value.trim()) parseJson(e.target.value); }}
        rows={6} className="input-field font-mono text-xs resize-y"
        placeholder="Dán JSON từ vựng vào đây..." />

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Preview table */}
      {vocabCards && vocabCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Bảng xem trước ({vocabCards.length} từ vựng)
          </div>
          <div className="border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-white/5 text-muted-foreground uppercase font-bold text-[10px]">
                  <th className="p-3">Từ</th>
                  <th className="p-3">Phiên âm</th>
                  <th className="p-3">Từ đồng nghĩa</th>
                  <th className="p-3">Nghĩa</th>
                  <th className="p-3">Ví dụ</th>
                  <th className="p-3 text-center w-12">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-secondary/10">
                {vocabCards.map((c, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-bold text-foreground text-sm">
                      <input 
                        className="bg-transparent border-b border-white/10 focus:border-primary outline-none w-full pb-1"
                        value={c.word}
                        onChange={(e) => {
                          const newCards = [...vocabCards];
                          newCards[idx] = { ...newCards[idx], word: e.target.value };
                          setVocabCards(newCards);
                        }}
                      />
                    </td>
                    <td className="p-3 font-mono text-primary flex items-center gap-1.5">
                      <input 
                        className="bg-transparent border-b border-white/10 focus:border-primary outline-none w-full pb-1"
                        value={c.phonetic || ''}
                        onChange={(e) => {
                          const newCards = [...vocabCards];
                          newCards[idx] = { ...newCards[idx], phonetic: e.target.value };
                          setVocabCards(newCards);
                        }}
                        placeholder="Phiên âm"
                      />
                      <button 
                        type="button"
                        onClick={() => handleSpeak(c.word)}
                        className="p-1 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all flex-shrink-0"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="p-3">
                      <input 
                        className="bg-transparent border-b border-white/10 focus:border-primary outline-none w-full pb-1 text-[11px]"
                        value={c.synonyms.join(', ')}
                        onChange={(e) => {
                          const newCards = [...vocabCards];
                          newCards[idx] = { ...newCards[idx], synonyms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                          setVocabCards(newCards);
                        }}
                        placeholder="syn1, syn2..."
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <input 
                        className="bg-transparent border-b border-white/10 focus:border-primary outline-none w-full pb-1 text-xs"
                        value={c.meaning}
                        onChange={(e) => {
                          const newCards = [...vocabCards];
                          newCards[idx] = { ...newCards[idx], meaning: e.target.value };
                          setVocabCards(newCards);
                        }}
                      />
                    </td>
                    <td className="p-3 italic text-muted-foreground">
                      <textarea 
                        className="bg-transparent border-b border-white/10 focus:border-primary outline-none w-full text-xs resize-y"
                        rows={1}
                        value={c.example || ''}
                        onChange={(e) => {
                          const newCards = [...vocabCards];
                          newCards[idx] = { ...newCards[idx], example: e.target.value };
                          setVocabCards(newCards);
                        }}
                        placeholder="Ví dụ"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        type="button"
                        onClick={() => handleDeleteCard(idx)}
                        className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                        title="Xóa từ này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return; }
          if (!vocabCards || vocabCards.length === 0) { setError('Vui lòng dán JSON từ vựng hợp lệ'); return; }
          onSave({ title, vocabCards });
        }}
        disabled={isSaving || !vocabCards || vocabCards.length === 0}
        className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(124,58,237,0.25)] flex items-center justify-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        {isSaving ? 'Đang lưu...' : '✓ Xác nhận & Lưu Bài Tập Từ Vựng'}
      </button>
    </div>
  );
}

// ── Vocab Library Helper Sidebar (removed) ──────────────────────────────────

function VocabLibrarySidebar_REMOVED() {
  const [search, setSearch] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const cards = getVocabularyCards();

  const filtered = cards.filter(c => 
    c.word.toLowerCase().includes(search.toLowerCase()) || 
    c.meaning.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopySnippet = (word: string, meaning: string, index: number) => {
    const snippet = JSON.stringify({ word, answer: meaning }, null, 2);
    navigator.clipboard.writeText(snippet);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyRawJson = () => {
    const list = cards.map(c => ({ word: c.word, answer: c.meaning }));
    navigator.clipboard.writeText(JSON.stringify(list, null, 2));
    alert('Đã copy toàn bộ danh sách từ dưới dạng mảng JSON bài tập!');
  };

  return (
    <div className="glass rounded-2xl border border-border p-5 space-y-4 h-[600px] flex flex-col">
      <div>
        <h3 className="font-bold text-sm flex items-center gap-1.5 text-violet-400">
          <BookOpen className="h-4 w-4" />
          Thư Viện Từ Đang Học
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Copy nhanh từ khóa & nghĩa để dán vào bài tập</p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Tìm từ khóa..." 
          className="input-field text-xs py-2 px-3 flex-1"
        />
        <button 
          onClick={handleCopyRawJson}
          className="px-2.5 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0"
          title="Copy toàn bộ dưới dạng mảng JSON bài tập"
        >
          <FileJson className="h-3.5 w-3.5" />
          Copy All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Chưa có từ vựng nào.</p>
        ) : (
          filtered.map((c, i) => (
            <div key={c.id} className="p-2.5 rounded-xl bg-secondary/30 border border-white/5 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{c.word}</span>
                <button 
                  onClick={() => handleCopySnippet(c.word, c.meaning, i)}
                  className="px-2 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  {copiedIndex === i ? 'Copied!' : 'Copy Snippet'}
                </button>
              </div>
              <p className="text-muted-foreground line-clamp-1">{c.meaning}</p>
              {c.synonyms.length > 0 && (
                <p className="text-violet-300/80 font-mono text-[10px] truncate">
                  Syn: {c.synonyms.join(', ')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

