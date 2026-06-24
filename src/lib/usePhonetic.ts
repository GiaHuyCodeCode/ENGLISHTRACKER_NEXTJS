import { useState, useEffect } from 'react';

const phoneticCache = new Map<string, string>();

export async function getSentencePhonetic(sentence: string): Promise<string> {
  if (!sentence) return '';
  
  // Split into words and non-words (preserves punctuation and spaces)
  // Matches English words, including those with hyphens or apostrophes
  const tokens = sentence.split(/([a-zA-Z]+(?:['\-][a-zA-Z]+)*)/);
  
  const result = await Promise.all(tokens.map(async (token) => {
    // If it's not a word (e.g. whitespace, punctuation, numbers)
    if (!/[a-zA-Z]/.test(token)) {
      return token;
    }
    
    const word = token.toLowerCase();
    if (phoneticCache.has(word)) return phoneticCache.get(word)!;
    
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (res.ok) {
        const data = await res.json();
        // Sometimes phonetic is inside the object, sometimes inside phonetics array
        const phonetic = data[0]?.phonetic || data[0]?.phonetics?.find((p: any) => p.text)?.text;
        if (phonetic) {
          phoneticCache.set(word, phonetic);
          return phonetic;
        }
      }
      phoneticCache.set(word, token); // fallback to just the word if not found
      return token;
    } catch {
      phoneticCache.set(word, token); // prevent infinite retries if API fails
      return token;
    }
  }));
  
  return result.join('');
}

export function usePhonetic(text: string | undefined, initialPhonetic?: string) {
  const [phonetic, setPhonetic] = useState<string>(initialPhonetic || '');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (initialPhonetic) {
      setPhonetic(initialPhonetic);
      setLoading(false);
      return;
    }
    if (!text) {
      setPhonetic('');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    
    getSentencePhonetic(text).then((res) => {
      if (isMounted) {
        setPhonetic(res);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [text, initialPhonetic]);

  return { phonetic, loading };
}
