import { useState, useRef, useCallback, useEffect } from 'react';

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
  // Tracks whether the user explicitly pressed Stop — prevents auto-restart loop
  const explicitlyStoppedRef = useRef(false);
  const settledRef = useRef(false);
  const transcriptRef = useRef('');
  const confidenceRef = useRef(0);
  const onCompleteRef = useRef<((t: string, c: number) => void) | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(
    (onComplete: (transcript: string, confidence: number) => void) => {
      if (!isSupported) return;

      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }

      explicitlyStoppedRef.current = false;
      settledRef.current = false;
      transcriptRef.current = '';
      confidenceRef.current = 0;
      onCompleteRef.current = onComplete;

      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      recognitionRef.current = recognition;

      const settle = () => {
        if (settledRef.current) return;
        settledRef.current = true;
        setIsListening(false);
        onCompleteRef.current?.(transcriptRef.current.trim(), confidenceRef.current);
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcriptRef.current += event.results[i][0].transcript.trim() + ' ';
            confidenceRef.current = event.results[i][0].confidence;
          }
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' and 'aborted' are transient on mobile — restart instead of stopping.
        // 'aborted' fires when we call abort() to restart; treat it as non-fatal.
        if (!explicitlyStoppedRef.current && (event.error === 'no-speech' || event.error === 'aborted')) {
          // onend will fire right after onerror; let onend handle the restart.
          return;
        }
        if (event.error !== 'aborted') setError(event.error as string);
        settle();
      };

      recognition.onend = () => {
        // Mobile browsers fire onend after every short silence even with continuous=true.
        // Restart to keep listening — but delay by 100ms because calling start()
        // immediately after onend throws InvalidStateError (the browser is still in
        // "ending" state and hasn't transitioned back to "inactive" yet).
        if (!explicitlyStoppedRef.current && !settledRef.current) {
          setTimeout(() => {
            if (!explicitlyStoppedRef.current && !settledRef.current) {
              try { recognition.start(); }
              catch { settle(); }
            }
          }, 100);
          return;
        }
        settle();
      };

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
    // Set flag BEFORE calling .stop() so onend/onerror know not to restart
    explicitlyStoppedRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  // Abort and detach all handlers when the component unmounts.
  // Without this, onend keeps firing and restarting recognition indefinitely,
  // which causes the browser to do DOM work that React can no longer track →
  // "removeChild: node is not a child" NotFoundError.
  useEffect(() => {
    return () => {
      explicitlyStoppedRef.current = true;
      settledRef.current = true; // prevent onComplete from firing post-unmount
      const r = recognitionRef.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        try { r.abort(); } catch { /* ignore */ }
      }
      recognitionRef.current = null;
    };
  }, []);

  return { isListening, isSupported, error, start, stop };
}
