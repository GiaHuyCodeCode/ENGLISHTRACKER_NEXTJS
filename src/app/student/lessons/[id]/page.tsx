'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAssignment, Assignment, submitVocabularyAssignment, Submission, getStudentNames, getStudentSubmission, getStudentVocabProgress, STAGE_CONFIG } from '@/lib/local-store';
import { 
  ArrowLeft, BookOpen, Search, Volume2, 
  Layers, Headphones, FileText, LayoutGrid, X
} from 'lucide-react';
import { VocabularyExercise } from '@/components/exercises/VocabularyExercise';
import { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';

export default function LessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [result, setResult] = useState<Submission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressList, setProgressList] = useState<any[]>([]);
  const [studentName, setStudentName] = useState<string>('');

  useEffect(() => {
    const a = getAssignment(id);
    if (!a) { router.replace('/student/lessons'); return; }
    setAssignment(a);
    
    // Check if there is an existing result for the current user
    const saved = localStorage.getItem('et_current_student') || '';
    setStudentName(saved);
    if (saved) {
      const existing = getStudentSubmission(id, saved);
      if (existing) setResult(existing);
      setProgressList(getStudentVocabProgress(saved));
    }
  }, [id, router]);

  if (!assignment) return null;

  const vocabCards = assignment.vocabCards || [];
  const filteredCards = vocabCards.filter(c => 
    c.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.meaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.onstart = () => setSpeakingWord(text);
      utterance.onend = () => setSpeakingWord(null);
      utterance.onerror = () => setSpeakingWord(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const openMode = (mode: string) => {
    setActiveMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVocabularySubmit = (answers: { word: string; studentAnswer: string; isCorrect: boolean }[], customScore?: number) => {
    setIsSubmitting(true);
    try {
      const studentName = localStorage.getItem('et_current_student') || getStudentNames()[0] || 'Unknown';
      const list = answers;
      let score = customScore !== undefined ? customScore : (list.filter(a => a.isCorrect).length / list.length) * 100;
      
      const sub = submitVocabularyAssignment({
        assignmentId: id,
        studentName,
        score: Math.round(score),
        answers: list,
        durationMs: 0,
      });
      setResult(sub);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeMode) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 relative pb-10">
        <div className="flex items-center justify-between sticky top-4 z-50 bg-background/80 backdrop-blur-xl p-4 -mx-4 md:mx-0 md:-mt-4 rounded-2xl border border-white/10 shadow-2xl">
          <button
            onClick={() => setActiveMode(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm transition-all shadow-lg hover-lift"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại bài học
          </button>
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg">
            {activeMode === 'flashcard' ? 'Lướt Flashcard' :
             activeMode === 'synonym' ? 'Đồng Nghĩa' :
             activeMode === 'test' ? 'Trắc Nghiệm' :
             activeMode === 'dictation' ? 'Nghe Chép' : 'Nối Từ'}
          </div>
        </div>
        
        <VocabularyExercise
          vocabCards={vocabCards}
          initialMode={activeMode as any}
          isRequirementWorkflow={false}
          hideTabs={true}
          onSubmit={handleVocabularySubmit}
          isSubmitting={isSubmitting}
          result={result?.vocabAnswers}
          score={result?.score}
          durationMs={result?.durationMs}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 fade-in">
        <button
          onClick={() => router.push('/student/lessons')}
          className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-indigo-500/15 text-indigo-400">
              Thư mục Từ Vựng
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading gradient-text leading-tight">{assignment.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng cộng: {vocabCards.length} từ vựng
          </p>
        </div>
      </div>

      {/* Action Grid (Study Modes) */}
      <div className="space-y-3 fade-in stagger-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Các Chế Độ Học Tập</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button onClick={() => openMode('flashcard')} className="glass hover-lift p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border-emerald-500/20 hover:border-emerald-500/40 group">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Flashcard</p>
              <p className="text-[10px] text-muted-foreground">Lật thẻ ghi nhớ</p>
            </div>
          </button>
          
          <button onClick={() => openMode('synonym')} className="glass hover-lift p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border-violet-500/20 hover:border-violet-500/40 group">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Đồng Nghĩa</p>
              <p className="text-[10px] text-muted-foreground">Đoán từ qua gợi ý</p>
            </div>
          </button>

          <button onClick={() => openMode('test')} className="glass hover-lift p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border-amber-500/20 hover:border-amber-500/40 group">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Kiểm Tra</p>
              <p className="text-[10px] text-muted-foreground">Làm bài trắc nghiệm</p>
            </div>
          </button>

          <button onClick={() => openMode('dictation')} className="glass hover-lift p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border-sky-500/20 hover:border-sky-500/40 group">
            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-colors">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Nghe Chép</p>
              <p className="text-[10px] text-muted-foreground">Nghe và gõ lại</p>
            </div>
          </button>

          <button onClick={() => openMode('game_match')} className="glass hover-lift p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center border-rose-500/20 hover:border-rose-500/40 group col-span-2 md:col-span-1">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/20 transition-colors">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Nối Từ</p>
              <p className="text-[10px] text-muted-foreground">Minigame trí nhớ</p>
            </div>
          </button>
        </div>
      </div>

      {/* Word List (Overview First) */}
      <div className="space-y-4 fade-in stagger-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Danh Sách Từ Vựng</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm từ vựng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field !pl-10 w-full sm:w-64 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {filteredCards.length === 0 ? (
            <div className="text-center p-8 border border-white/5 rounded-2xl text-muted-foreground col-span-2">
              Không tìm thấy từ vựng nào.
            </div>
          ) : (
            filteredCards.map((c) => {
              const progress = progressList.find(p => p.wordId === c.id);
              const stage = progress ? progress.stage : 0;
              const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG[0];
              const nextReview = progress ? new Date(progress.nextReviewDate) : null;
              const isDue = nextReview ? nextReview <= new Date() : true;

              return (
                <div
                  key={c.id}
                  className={`glass hover-lift rounded-3xl border flex flex-col justify-between space-y-4 overflow-hidden ${
                    isDue ? 'border-amber-500/30' : 'border-white/5'
                  }`}
                >
                  {/* Stage color bar on top */}
                  <div className={`h-1 w-full ${cfg.bar}`} />

                  <div className="px-5 pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-foreground">{c.word}</h3>
                        <button 
                          onClick={() => handleSpeak(c.word)} 
                          className={`p-1 rounded-full transition-all duration-200 ${
                            speakingWord === c.word 
                              ? 'bg-sky-500/20 text-sky-400' 
                              : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {isDue && stage > 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold">⏰ Cần ôn hôm nay</span>
                        )}
                      </div>
                    </div>

                    {c.phonetic && <p className="text-xs text-primary/80 font-mono">{c.phonetic}</p>}
                    <p className="text-sm font-medium leading-relaxed">{c.meaning}</p>

                    {c.synonyms && c.synonyms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.synonyms.map(syn => (
                          <span key={syn} className="px-2 py-0.5 rounded bg-violet-500/5 text-violet-400 text-xs font-semibold border border-violet-500/10">
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}

                    {c.example && (
                      <p className="text-xs text-muted-foreground italic bg-secondary/20 p-2.5 rounded-xl">
                        &quot;{c.example}&quot;
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
                    <span>Lần cuối ôn: {progress ? new Date(progress.lastReviewed).toLocaleDateString('vi-VN') : 'Chưa ôn'}</span>
                    <span className={`text-[10px] font-semibold ${cfg.badge.split(' ')[1]}`}>
                      {cfg.interval !== '—' ? `Ôn sau ${cfg.interval}` : 'Chưa bắt đầu'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
