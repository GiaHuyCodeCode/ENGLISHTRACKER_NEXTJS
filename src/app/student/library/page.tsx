'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getVocabularyCards,
  getStudentVocabProgress,
  VocabCard,
  VocabProgress,
} from '@/lib/local-store';
import {
  BookOpen,
  ArrowLeft,
  Volume2,
  Layers,
  ChevronDown,
  Search,
} from 'lucide-react';
import { audioManager } from '@/lib/audio';

// Stage config: label, color classes, bar color, interval info
const STAGE_CONFIG = [
  { label: 'Chưa học',           bar: 'bg-slate-400',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',   interval: '—'         },
  { label: 'Stage 1',            bar: 'bg-red-400',     badge: 'bg-red-500/10 text-red-400 border-red-500/20',         interval: '1 ngày'    },
  { label: 'Stage 2',            bar: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   interval: '3 ngày'    },
  { label: 'Stage 3',            bar: 'bg-yellow-400',  badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',interval: '7 ngày'    },
  { label: 'Stage 4',            bar: 'bg-indigo-400',  badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',interval: '14 ngày'   },
  { label: 'Stage 5',            bar: 'bg-sky-400',     badge: 'bg-sky-500/10 text-sky-400 border-sky-400/20',         interval: '30 ngày'   },
  { label: '🏆 Master',          bar: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', interval: '60 ngày'},
];

export default function VocabularyLibraryPage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState<string>('');
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [progressList, setProgressList] = useState<VocabProgress[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<'all' | number>('all');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('et_session') || 'null');
    if (session?.role === 'student') {
      setStudentName(session.username);
    } else {
      const saved = localStorage.getItem('et_current_student') || '';
      setStudentName(saved);
    }
    setCards(getVocabularyCards());
  }, []);

  useEffect(() => {
    if (!studentName) return;
    setProgressList(getStudentVocabProgress(studentName));
  }, [studentName, cards]);

  const handleSpeak = (text: string) => {
    // Immediate state change for responsive visual feedback
    setSpeakingWord(text);
    
    // Fallback timer in case onend is not triggered by the browser
    const timer = setTimeout(() => {
      setSpeakingWord(prev => prev === text ? null : prev);
    }, 2000);

    audioManager.speak(text, 0.85, undefined, undefined, undefined,
      () => setSpeakingWord(text),
      () => {
        clearTimeout(timer);
        setSpeakingWord(null);
      }
    );
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch =
      card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.meaning.toLowerCase().includes(searchQuery.toLowerCase());
    const progress = progressList.find(p => p.wordId === card.id);
    const cardStage = progress ? progress.stage : 0;
    if (stageFilter === 'all') return matchesSearch;
    return matchesSearch && cardStage === stageFilter;
  });

  // Stats per stage
  const stageCounts = Array.from({ length: 7 }, (_, i) => {
    return cards.filter(c => {
      const prog = progressList.find(p => p.wordId === c.id);
      return (prog ? prog.stage : 0) === i;
    }).length;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Dashboard Học Viên
        </button>
        <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
          {studentName}
        </span>
      </div>

      <div className="fade-in">
        <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-2">
          <Layers className="h-7 w-7 text-[#0071e3]" strokeWidth={1.5} />
          Thư Viện Từ Vựng
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Toàn bộ {cards.length} từ vựng trong thư viện cá nhân của bạn
        </p>
      </div>

      {/* Stage Overview Bar */}
      {cards.length > 0 && (
        <div className="glass rounded-2xl border border-white/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tiến độ học theo Stage</p>
          {/* Visual stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {STAGE_CONFIG.map((s, i) => {
              const pct = cards.length > 0 ? (stageCounts[i] / cards.length) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={i}
                  className={`${s.bar} h-full transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${s.label}: ${stageCounts[i]} từ`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {STAGE_CONFIG.map((s, i) => (
              <button
                key={i}
                onClick={() => setStageFilter(stageFilter === i ? 'all' : i)}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${stageFilter === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${s.bar}`} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className={`px-1.5 py-0.5 rounded ${s.badge} border text-[10px]`}>{stageCounts[i]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Tìm từ vựng hoặc nghĩa..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <div className="relative">
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="input-field py-3 px-4 pr-10 w-full sm:w-56 appearance-none"
          >
            <option value="all">Tất cả Stage</option>
            {STAGE_CONFIG.map((s, i) => (
              <option key={i} value={i}>{s.label} ({s.interval}) — {stageCounts[i]} từ</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-4 h-4 w-4 text-muted-foreground/60 pointer-events-none" strokeWidth={1.5} />
        </div>
      </div>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="glass p-12 text-center border border-white/5 rounded-3xl text-muted-foreground">
          Không tìm thấy từ vựng nào khớp với điều kiện lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCards.map(c => {
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

                  <p className="text-xs text-primary/80 font-mono">{c.phonetic}</p>
                  <p className="text-sm font-medium leading-relaxed">{c.meaning}</p>

                  {c.synonyms.length > 0 && (
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

                {/* Footer — no delete button */}
                <div className="px-5 pb-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
                  <span>Lần cuối ôn: {progress ? new Date(progress.lastReviewed).toLocaleDateString('vi-VN') : 'Chưa ôn'}</span>
                  <span className={`text-[10px] font-semibold ${cfg.badge.split(' ')[1]}`}>
                    {cfg.interval !== '—' ? `Ôn sau ${cfg.interval}` : 'Chưa bắt đầu'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cards.length === 0 && (
        <div className="glass p-16 text-center border border-white/5 rounded-3xl flex flex-col items-center gap-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Thư viện từ vựng của bạn đang trống.</p>
          <p className="text-xs text-muted-foreground/70">Hãy hoàn thành một bài tập từ vựng để bắt đầu xây dựng thư viện.</p>
        </div>
      )}
    </div>
  );
}
