'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getVocabularyCards,
  saveVocabularyCards,
  getStudentVocabProgress,
  updateVocabProgress,
  VocabCard,
  VocabProgress,
  getStudentColors,
  getStudentAvatar,
  getAssignments,
  Assignment
} from '@/lib/local-store';
import {
  BookOpen,
  ArrowLeft,
  PlusCircle,
  HelpCircle,
  Check,
  X,
  Volume2,
  Bookmark,
  Award,
  Calendar,
  Layers,
  ChevronRight,
  RefreshCw,
  Search,
  Sparkles,
  ChevronDown,
  Edit,
  Trash,
  ArrowRight
} from 'lucide-react';
import { VocabularyExercise } from '@/components/exercises/VocabularyExercise';
import { audioManager } from '@/lib/audio';

export default function StudentVocabularyPage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'review' | 'library' | 'lessons'>('review');
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [progressList, setProgressList] = useState<VocabProgress[]>([]);
  const [lessons, setLessons] = useState<Assignment[]>([]);
  
  // Import states
  const [importText, setImportText] = useState<string>('');
  const [parsedCards, setParsedCards] = useState<VocabCard[]>([]);
  const [parseError, setParseError] = useState<string>('');
  
  // Review states
  const [reviewQueue, setReviewQueue] = useState<VocabCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [testMode, setTestMode] = useState<'flashcard' | 'synonym' | 'fill' | 'dictation'>('flashcard');
  const [selectedSynonymOption, setSelectedSynonymOption] = useState<string[] | null>(null);
  const [synonymOptions, setSynonymOptions] = useState<string[][]>([]);
  const [fillAnswer, setFillAnswer] = useState<string>('');
  const [dictationAnswer, setDictationAnswer] = useState<string>('');
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);
  const [isReviewingSrs, setIsReviewingSrs] = useState<boolean>(false);
  
  // Library search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');
  
  // Single word state
  const [importMode, setImportMode] = useState<'bulk' | 'single'>('bulk');
  const [singleWord, setSingleWord] = useState({
    word: '',
    phonetic: '',
    synonyms: '',
    meaning: '',
    example: ''
  });
  


  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  const handleFinishSrsReview = (answers: { word: string; studentAnswer: string; isCorrect: boolean }[]) => {
    const freshCards = getVocabularyCards();
    reviewQueue.forEach(ac => {
      const matched = freshCards.find(fc => fc.word.toLowerCase() === ac.word.toLowerCase());
      if (matched) {
        const ansStatus = answers.find(a => a.word.toLowerCase() === ac.word.toLowerCase());
        const rating = ansStatus ? (ansStatus.isCorrect ? 'good' : 'again') : 'good';
        updateVocabProgress(studentName, matched.id, rating);
      }
    });

    setIsReviewingSrs(false);
    setReviewQueue([]);
    const progress = getStudentVocabProgress(studentName);
    setProgressList(progress);
    alert('🌟 Hoàn thành ôn tập hôm nay và cập nhật lịch Spaced Repetition thành công!');
  };

  const handleAddSingleWord = () => {
    if (!singleWord.word.trim()) return alert('Vui lòng nhập từ vựng!');
    if (!singleWord.meaning.trim()) return alert('Vui lòng nhập nghĩa!');

    const newCard: VocabCard = {
      id: singleWord.word.toLowerCase().replace(/[^a-z0-9]/g, '') || Math.random().toString(36).substring(7),
      word: singleWord.word.trim(),
      phonetic: singleWord.phonetic.trim(),
      synonyms: singleWord.synonyms ? singleWord.synonyms.split(',').map(s => s.trim()).filter(Boolean) : [],
      meaning: singleWord.meaning.trim(),
      example: singleWord.example.trim(),
      createdAt: new Date().toISOString()
    };

    const merged = [...cards];
    const exists = merged.findIndex(c => c.word.toLowerCase() === newCard.word.toLowerCase());
    if (exists !== -1) {
      merged[exists] = newCard;
    } else {
      merged.push(newCard);
    }

    saveVocabularyCards(merged);
    setCards(merged);
    setSingleWord({
      word: '',
      phonetic: '',
      synonyms: '',
      meaning: '',
      example: ''
    });
    alert('Đã thêm từ vựng thành công!');
    setActiveTab('library');
  };

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('et_session') || 'null');
    if (session?.role === 'student') {
      setStudentName(session.username);
    } else {
      const saved = localStorage.getItem('et_current_student') || '';
      setStudentName(saved);
    }

    const baseCards = getVocabularyCards();
    const assignCards = getAssignments().filter(a => a.type === 'vocabulary').flatMap(a => a.vocabCards || []);
    const totalCardsMap = new Map<string, VocabCard>();
    baseCards.forEach(c => totalCardsMap.set(c.id, c));
    assignCards.forEach(c => totalCardsMap.set(c.id, c as VocabCard));
    const loadedCards = Array.from(totalCardsMap.values());
    
    setCards(loadedCards);
    const now = new Date();
    setLessons(getAssignments().filter(a => {
      if (a.type !== 'vocabulary') return false;
      if (!a.createdAt) return true;
      return new Date(a.createdAt) <= now;
    }));
  }, []);

  useEffect(() => {
    if (!studentName) return;
    const progress = getStudentVocabProgress(studentName);
    setProgressList(progress);
  }, [studentName, cards]);

  // Generate Review Queue based on nextReviewDate
  useEffect(() => {
    if (!studentName || cards.length === 0) return;
    const now = new Date();
    const progressMap = new Map<string, VocabProgress>();
    progressList.forEach(p => progressMap.set(p.wordId, p));

    const queue = cards.filter(card => {
      const prog = progressMap.get(card.id);
      if (!prog) return true; // Brand new word is due
      return new Date(prog.nextReviewDate) <= now;
    });

    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setReviewQueue(shuffled);
    setCurrentIdx(0);
    resetCardState(0, shuffled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressList, cards, studentName]);

  // Prepare options for Synonym Matching mode
  useEffect(() => {
    if (reviewQueue.length === 0 || currentIdx >= reviewQueue.length) return;
    const currentCard = reviewQueue[currentIdx];
    if (testMode === 'synonym') {
      // Current card synonyms
      const correct = currentCard.synonyms;
      // Get distractor cards
      const distractors = cards
        .filter(c => c.id !== currentCard.id && c.synonyms.length > 0)
        .map(c => c.synonyms)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      const combined = [correct, ...distractors].sort(() => Math.random() - 0.5);
      setSynonymOptions(combined);
    }
  }, [currentIdx, reviewQueue, testMode, cards]);

  const resetCardState = useCallback((nextIdx?: number, customQueue?: VocabCard[]) => {
    setShowAnswer(false);
    setSelectedSynonymOption(null);
    setFillAnswer('');
    setDictationAnswer('');
    setIsAnswerChecked(false);
    setIsAnswerCorrect(false);
    
    // Choose test mode randomly using nextIdx if provided
    const idxToUse = nextIdx !== undefined ? nextIdx : currentIdx;
    const q = customQueue !== undefined ? customQueue : reviewQueue;
    if (q.length > 0 && idxToUse < q.length) {
      const card = q[idxToUse];
      const modes: ('flashcard' | 'synonym' | 'fill' | 'dictation')[] = ['flashcard'];
      if (card.synonyms.length > 0) modes.push('synonym');
      if (card.example) modes.push('fill');
      if (card.phonetic) modes.push('dictation');
      
      const randomMode = modes[Math.floor(Math.random() * modes.length)];
      setTestMode(randomMode);
    }
  }, [currentIdx, reviewQueue]);

  const handleSpeak = (text: string) => {
    audioManager.speak(text, 0.9, undefined, undefined, undefined,
      () => setSpeakingWord(text),
      () => setSpeakingWord(null)
    );
  };

  useEffect(() => {
    if (reviewQueue.length === 0 || currentIdx >= reviewQueue.length) return;
    const card = reviewQueue[currentIdx];
    if (testMode === 'dictation' || testMode === 'flashcard') {
      const timer = setTimeout(() => {
        handleSpeak(card.word);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, testMode, reviewQueue]);

  // Text Parser for Quizlet Export
  const handleParseText = () => {
    setParseError('');
    if (!importText.trim()) return;

    try {
      // Split by semicolon OR newline
      const entries = importText.split(/;|\n/).map(s => s.trim()).filter(Boolean);
      const parsed: VocabCard[] = [];

      for (const entry of entries) {
        // Expected structure: Word + Phonetic = Synonyms ~ Meaning [Ex] Example;
        let example = "";
        let mainPart = entry;
        
        const exIndex = entry.indexOf("[Ex]");
        if (exIndex !== -1) {
          example = entry.substring(exIndex + 4).trim();
          mainPart = entry.substring(0, exIndex).trim();
        }

        let meaning = "";
        const tildeIndex = mainPart.indexOf("~");
        if (tildeIndex !== -1) {
          meaning = mainPart.substring(tildeIndex + 1).trim();
          mainPart = mainPart.substring(0, tildeIndex).trim();
        }

        let synonymsStr = "";
        const equalIndex = mainPart.indexOf("=");
        if (equalIndex !== -1) {
          synonymsStr = mainPart.substring(equalIndex + 1).trim();
          mainPart = mainPart.substring(0, equalIndex).trim();
        }

        if (synonymsStr.endsWith('.')) {
          synonymsStr = synonymsStr.slice(0, -1).trim();
        }
        const synonyms = synonymsStr ? synonymsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

        let word = "";
        let phonetic = "";
        const plusIndex = mainPart.indexOf("+");
        if (plusIndex !== -1) {
          word = mainPart.substring(0, plusIndex).trim();
          phonetic = mainPart.substring(plusIndex + 1).trim();
        } else {
          word = mainPart.trim();
        }

        if (word) {
          parsed.push({
            id: word.toLowerCase().replace(/[^a-z0-9]/g, '') || Math.random().toString(36).substring(7),
            word,
            phonetic,
            synonyms,
            meaning,
            example,
            createdAt: new Date().toISOString()
          });
        }
      }

      if (parsed.length === 0) {
        setParseError('Không tìm thấy từ vựng nào hợp lệ. Vui lòng kiểm tra lại cấu trúc.');
      } else {
        setParsedCards(parsed);
      }
    } catch (e) {
      setParseError('Lỗi phân tích cú pháp. Vui lòng kiểm tra lại định dạng.');
    }
  };

  const handleParseJSON = () => {
    setParseError('');
    try {
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        const validated = parsed.filter(item => item.word);
        if (validated.length === 0) {
          setParseError('JSON không chứa từ vựng hợp lệ.');
        } else {
          // Normalize structure
          const normalized = validated.map(c => ({
            id: c.id || c.word.toLowerCase().replace(/[^a-z0-9]/g, ''),
            word: c.word,
            phonetic: c.phonetic || '',
            synonyms: Array.isArray(c.synonyms) ? c.synonyms : (c.synonyms ? [c.synonyms] : []),
            meaning: c.meaning || '',
            example: c.example || '',
            createdAt: c.createdAt || new Date().toISOString()
          }));
          setParsedCards(normalized);
        }
      } else {
        setParseError('Dữ liệu JSON phải là một mảng danh sách từ.');
      }
    } catch (e) {
      setParseError('Lỗi định dạng JSON không hợp lệ.');
    }
  };

  const saveImportedCards = () => {
    if (parsedCards.length === 0) return;
    const merged = [...cards];
    let addedCount = 0;
    
    parsedCards.forEach(newCard => {
      const exists = merged.findIndex(c => c.word.toLowerCase() === newCard.word.toLowerCase());
      if (exists !== -1) {
        merged[exists] = newCard; // Overwrite
      } else {
        merged.push(newCard);
        addedCount++;
      }
    });

    saveVocabularyCards(merged);
    setCards(merged);
    setParsedCards([]);
    setImportText('');
    alert(`Đã thêm mới/cập nhật thành công ${parsedCards.length} từ vựng!`);
    setActiveTab('library');
  };

  // Submit Spaced Repetition feedback
  const handleRating = (rating: 'easy' | 'good' | 'hard' | 'again') => {
    if (reviewQueue.length === 0 || currentIdx >= reviewQueue.length) return;
    const currentCard = reviewQueue[currentIdx];
    
    updateVocabProgress(studentName, currentCard.id, rating);
    
    // Play correct sound or micro-animation triggers
    if (currentIdx + 1 < reviewQueue.length) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      resetCardState(nextIdx);
    } else {
      // Queue empty
      alert('🌟 Hoàn thành xuất sắc toàn bộ từ vựng cần ôn hôm nay!');
      setReviewQueue([]);
      // Reload progress lists
      setProgressList(getStudentVocabProgress(studentName));
    }
  };

  const checkAnswer = () => {
    if (reviewQueue.length === 0) return;
    const card = reviewQueue[currentIdx];
    let correct = false;

    if (testMode === 'synonym') {
      correct = selectedSynonymOption?.join(', ') === card.synonyms.join(', ');
    } else if (testMode === 'fill') {
      correct = fillAnswer.trim().toLowerCase() === card.word.trim().toLowerCase();
    } else if (testMode === 'dictation') {
      correct = dictationAnswer.trim().toLowerCase() === card.word.trim().toLowerCase();
    }

    setIsAnswerCorrect(correct);
    setIsAnswerChecked(true);
    setShowAnswer(true);

    if (correct) {
      handleSpeak(card.word);
    }
  };

  // Filtered Library
  const filteredCards = cards.filter(card => {
    const matchesSearch = card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          card.meaning.toLowerCase().includes(searchQuery.toLowerCase());
    
    const progress = progressList.find(p => p.wordId === card.id);
    const cardStage = progress ? progress.stage : 0; // 0 means not started

    if (stageFilter === 'all') return matchesSearch;
    return matchesSearch && cardStage === stageFilter;
  });

  const handleDeleteCard = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa từ vựng này khỏi thư viện chung?')) {
      const updated = cards.filter(c => c.id !== id);
      saveVocabularyCards(updated);
      setCards(updated);
    }
  };

  const getStageBadge = (stage: number) => {
    switch (stage) {
      case 0: return { label: 'Chưa học', color: 'bg-slate-500/10 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
      case 1: return { label: 'Stage 1 (1 ngày)', color: 'bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
      case 2: return { label: 'Stage 2 (3 ngày)', color: 'bg-amber-500/10 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 3: return { label: 'Stage 3 (7 ngày)', color: 'bg-violet-500/10 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' };
      case 4: return { label: 'Stage 4 (14 ngày)', color: 'bg-indigo-500/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      case 5: return { label: 'Stage 5 (30 ngày)', color: 'bg-sky-500/10 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-400/20' };
      case 6: return { label: 'Stage 6 (60 ngày - Master)', color: 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      default: return { label: 'Unknown', color: 'bg-secondary' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Dashboard Học Viên
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tài khoản:</span>
          <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
            {studentName}
          </span>
        </div>
      </div>

      <div className="fade-in">
        <h1 className="text-3xl font-bold font-heading gradient-text flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-violet-600 dark:text-violet-400" />
          Spaced Repetition: Học Từ Vựng
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Ôn tập thông minh bằng thẻ ghi nhớ và các thử thách tương tác</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 dark:border-white/10 gap-6 fade-in">
        {[
          { id: 'review', label: `Hôm Nay (${reviewQueue.length})`, icon: Calendar },
          { id: 'library', label: `Thư Viện (${cards.length})`, icon: Layers },
          { id: 'lessons', label: `Thư Mục (${lessons.length})`, icon: BookOpen }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Contents */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          {reviewQueue.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center border border-white/5 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Bạn Đã Hoàn Thành Ôn Tập!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Không có từ vựng nào cần ôn tập hôm nay. Hệ thống sẽ lên lịch ôn tiếp theo khi đến hạn!
              </p>
              <button onClick={() => setActiveTab('library')} className="px-5 py-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-semibold transition-colors">
                Xem Thư Viện Từ Vựng
              </button>
            </div>
          ) : !isReviewingSrs ? (
            <div className="glass-strong rounded-3xl p-12 text-center border border-black/10 dark:border-white/10 max-w-2xl mx-auto space-y-6 slide-up glow-primary relative overflow-hidden">
              <div className="absolute inset-0 bg-dot-pattern opacity-30"></div>
              <div className="relative z-10 space-y-6">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Calendar className="w-10 h-10 text-violet-600 dark:text-violet-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold font-heading">Lịch Ôn Tập Hôm Nay</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Hôm nay bạn có <span className="text-primary font-bold">{reviewQueue.length} từ vựng</span> cần được ôn tập lại theo phương pháp Spaced Repetition.
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-2xl border border-white/5 inline-block text-xs font-semibold text-muted-foreground">
                  ⚠️ Lưu ý: Bạn cần hoàn thành cả phần Nghe Chép và Trắc Nghiệm để hoàn tất lịch ôn tập hôm nay.
                </div>
                <div>
                  <button 
                    onClick={() => setIsReviewingSrs(true)}
                    className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl transition-all hover:bg-primary/90 flex items-center justify-center gap-2 mx-auto hover-lift glow-primary shadow-lg shadow-primary/20"
                  >
                    Bắt đầu Ôn Tập Ngay <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="slide-up">
              <VocabularyExercise
                vocabCards={reviewQueue}
                isRequirementWorkflow={true}
                onSubmit={handleFinishSrsReview}
              />
            </div>
          )}
        </div>
      )}



      {activeTab === 'library' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
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
                <option value="all">Tất cả các Stage</option>
                <option value="0">Chưa học (Stage 0)</option>
                <option value="1">Stage 1 (1 ngày)</option>
                <option value="2">Stage 2 (3 ngày)</option>
                <option value="3">Stage 3 (7 ngày)</option>
                <option value="4">Stage 4 (14 ngày)</option>
                <option value="5">Stage 5 (30 ngày)</option>
                <option value="6">Stage 6 (60 ngày)</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-4 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Cards List */}
          {filteredCards.length === 0 ? (
            <div className="glass p-12 text-center border border-white/5 text-muted-foreground">
              Không tìm thấy từ vựng nào khớp với điều kiện lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCards.map(c => {
                const progress = progressList.find(p => p.wordId === c.id);
                const stage = progress ? progress.stage : 0;
                const badge = getStageBadge(stage);
                
                return (
                  <div key={c.id} className="glass hover-lift p-5 rounded-3xl border border-white/5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-foreground">{c.word}</h3>
                          <button 
                            onClick={() => handleSpeak(c.word)} 
                            className={`p-1 rounded-full transition-all duration-200 ${
                              speakingWord === c.word 
                                ? 'bg-primary/20 text-primary animate-pulse' 
                                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      
                      <p className="text-xs text-primary/80 font-mono">{c.phonetic}</p>
                      
                      <p className="text-sm font-medium leading-relaxed">{c.meaning}</p>
                      
                      {c.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {c.synonyms.map(syn => (
                            <span key={syn} className="px-2 py-0.5 rounded bg-violet-500/5 text-violet-600 dark:text-violet-400 text-xs font-semibold border border-violet-500/10">
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

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
                      <span>Lần cuối ôn: {progress ? new Date(progress.lastReviewed).toLocaleDateString('vi-VN') : 'Chưa ôn'}</span>
                      <button onClick={() => handleDeleteCard(c.id)} className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:bg-red-500/10 transition-colors">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'lessons' && (
        <div className="space-y-6 fade-in">
          {lessons.length === 0 ? (
            <div className="glass p-12 text-center border border-white/5 text-muted-foreground rounded-3xl">
              Chưa có thư mục bài học nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {lessons.map(lesson => (
                <div key={lesson.id} className="glass hover-lift p-5 rounded-3xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-xl">
                        <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground leading-tight">{lesson.title}</h3>
                        <p className="text-xs text-muted-foreground">{lesson.vocabCards?.length || 0} từ vựng</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> {new Date(lesson.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                    <button
                      onClick={() => router.push(`/student/lessons/${lesson.id}`)}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-md flex items-center gap-1.5"
                    >
                      Vào Ôn Tập <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
