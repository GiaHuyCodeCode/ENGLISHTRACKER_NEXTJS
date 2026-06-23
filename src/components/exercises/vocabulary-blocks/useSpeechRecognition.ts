import { useState, useRef, useCallback } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  start: (onComplete: (transcript: string, confidence: number) => void) => void;
  stop: () => void;
}

export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(
    (onComplete: (transcript: string, confidence: number) => void) => {
      if (!isSupported) return;

      // Abort any in-flight recognition before starting a new one
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }

      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognitionRef.current = recognition;

      // settled prevents onComplete being called twice (onresult + onend)
      let settled = false;
      const settle = (transcript: string, confidence: number) => {
        if (settled) return;
        settled = true;
        setIsListening(false);
        onComplete(transcript, confidence);
      };

      recognition.onresult = (event: any) => {
        const best = event.results[event.results.length - 1][0];
        settle(best.transcript.trim(), best.confidence);
      };

      recognition.onerror = (event: any) => {
        setError(event.error as string);
        settle('', 0);
      };

      recognition.onend = () => settle('', 0);

      setError(null);
      setIsListening(true);

      try {
        recognition.start();
      } catch {
        setIsListening(false);
        onComplete('', 0);
      }
    },
    [isSupported, lang],
  );

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  return { isListening, isSupported, error, start, stop };
}
