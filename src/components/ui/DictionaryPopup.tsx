'use client';

import { useEffect, useState } from 'react';
import { getVocabularyCards, VocabCard } from '@/lib/local-store';
import { X, Volume2, Search, BookOpen } from 'lucide-react';

interface DictionaryData {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

export function DictionaryPopup() {
  const [selectedWord, setSelectedWord] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [localData, setLocalData] = useState<VocabCard | null>(null);
  const [apiData, setApiData] = useState<DictionaryData | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);

  useEffect(() => {
    // Helper function to find word under coordinates
    const getWordAtPoint = (x: number, y: number) => {
      let range;
      // @ts-ignore
      if (document.caretPositionFromPoint) {
        // @ts-ignore
        const pos = document.caretPositionFromPoint(x, y);
        if (!pos) return null;
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      // @ts-ignore
      } else if (document.caretRangeFromPoint) {
        // @ts-ignore
        range = document.caretRangeFromPoint(x, y);
      } else {
        return null;
      }

      if (!range) return null;
      
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return null;
      
      const text = node.textContent || '';
      const offset = range.startOffset;
      
      // Find word boundaries (allow letters, hyphens, apostrophes)
      let start = offset;
      let end = offset;
      const isWordChar = (char: string) => /[a-zA-Z'\-]/.test(char);
      
      while (start > 0 && isWordChar(text[start - 1])) start--;
      while (end < text.length && isWordChar(text[end])) end++;
      
      // Trim trailing punctuation (e.g. hyphen at the end)
      while (start < end && !/[a-zA-Z]/.test(text[start])) start++;
      while (end > start && !/[a-zA-Z]/.test(text[end - 1])) end--;
      
      const word = text.slice(start, end);
      
      if (word.length > 1) {
        const wordRange = document.createRange();
        try {
          wordRange.setStart(node, start);
          wordRange.setEnd(node, end);
          return { word, rect: wordRange.getBoundingClientRect() };
        } catch (e) {
          return { word, rect: null };
        }
      }
      return null;
    };

    const handleEvent = (e: MouseEvent | TouchEvent) => {
      // Don't trigger if clicking inside the popup
      if ((e.target as HTMLElement).closest('#dictionary-popup')) return;

      const selection = window.getSelection();
      let text = selection?.toString().trim() || '';

      // Clean selection: remove leading/trailing non-letters
      text = text.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');

      // Check if it's a valid single word
      const isValidWord = (w: string) => w && w.length > 1 && w.length < 30 && /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(w) && !w.includes(' ');

      // 1. Try to use selected text (Desktop / Long press on mobile)
      if (isValidWord(text)) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect && rect.width > 0) {
          let x = rect.left + rect.width / 2;
          let y = rect.top - 10;
          
          setSelectedWord(text.toLowerCase());
          setPosition({ x, y });
          setIsVisible(true);
          lookupWord(text.toLowerCase());
          return;
        }
      }

      // 2. Fallback to tap-to-lookup for mobile devices (if no text is selected)
      const isTouch = 'touches' in e;
      if (!text && isTouch) {
        // Prevent looking up text inside generic buttons like "Submit" or "Next"
        // But allow it inside options if they have a specific class like 'allow-dictionary'
        const target = e.target as HTMLElement;
        const isButton = target.closest('button');
        if (isButton && !isButton.classList.contains('allow-dictionary')) {
           setIsVisible(false);
           return;
        }

        let clientX = e.changedTouches[0].clientX;
        let clientY = e.changedTouches[0].clientY;

        const wordData = getWordAtPoint(clientX, clientY);
        if (wordData && isValidWord(wordData.word)) {
          let x = wordData.rect ? wordData.rect.left + wordData.rect.width / 2 : clientX;
          let y = wordData.rect ? wordData.rect.top - 10 : clientY - 20;

          setSelectedWord(wordData.word.toLowerCase());
          setPosition({ x, y });
          setIsVisible(true);
          lookupWord(wordData.word.toLowerCase());
          return;
        }
      }

      // 3. Hide if clicked elsewhere and no valid word found
      setIsVisible(false);
    };

    document.addEventListener('mouseup', handleEvent);
    document.addEventListener('touchend', handleEvent);

    return () => {
      document.removeEventListener('mouseup', handleEvent);
      document.removeEventListener('touchend', handleEvent);
    };
  }, []);

  const lookupWord = async (word: string) => {
    setLoading(true);
    setLocalData(null);
    setApiData(null);
    setTranslatedText(null);

    // 1. Check local vocabulary first
    const vocabCards = getVocabularyCards();
    const found = vocabCards.find(c => c.word.toLowerCase() === word);
    if (found) {
      setLocalData(found);
      setLoading(false);
      return;
    }

    // 2. Fallback to free dictionary API (for phonetics)
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (res.ok) {
        const data = await res.json();
        setApiData(data[0]);
      }
    } catch (error) {
      console.error('Dictionary API failed', error);
    }

    // 3. Get Vietnamese translation from Google Translate API
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          setTranslatedText(data[0][0][0]);
        }
      }
    } catch (error) {
      console.error('Translate API failed', error);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    window.speechSynthesis.speak(utt);
  };

  if (!isVisible) return null;

  return (
    <div 
      id="dictionary-popup"
      className="fixed z-[100] transform -translate-x-1/2 -translate-y-full px-3 py-2 glass-strong rounded-xl border border-white/20 shadow-2xl w-max min-w-[140px] max-w-[200px] sm:max-w-[240px] animate-in fade-in zoom-in-95 duration-200"
      style={{ 
        left: Math.max(120, Math.min(window.innerWidth - 120, position.x)), 
        top: Math.max(60, position.y) 
      }}
    >
      {/* Arrow */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-b border-r border-white/20 rotate-45" />

      {/* Content */}
      <div className="flex flex-col gap-0.5 relative z-10">
        
        {/* Top Row: Word & Phonetic & Close */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-sm font-bold text-sky-400 capitalize truncate max-w-[100px]">{selectedWord}</span>
          
          <button 
            onClick={() => speak(selectedWord)}
            className="p-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors shrink-0"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>

          {(localData?.phonetic || apiData?.phonetic) && (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 truncate max-w-[60px]">
              {localData?.phonetic || apiData?.phonetic}
            </span>
          )}

          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 rounded-full hover:bg-white/10 text-muted-foreground shrink-0 ml-auto -mr-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom Row: Meaning */}
        <div className="text-[12px] leading-snug">
          {loading ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Search className="w-3 h-3 animate-spin" />
            </span>
          ) : localData ? (
            <span className="text-emerald-400 font-medium line-clamp-2">
              {localData.meaning}
            </span>
          ) : translatedText ? (
            <span className="text-foreground capitalize line-clamp-2">
              {translatedText}
            </span>
          ) : (
            <span className="italic text-muted-foreground text-[10px]">
              Không có nghĩa
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
