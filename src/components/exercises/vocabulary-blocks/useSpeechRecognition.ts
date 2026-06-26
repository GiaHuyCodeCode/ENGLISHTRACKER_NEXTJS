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
  // Incremented on every start() call — used to detect stale onend callbacks
  // from a previous session that fires after a new session has already started.
  const sessionIdRef = useRef(0);
  // Failsafe: if settle() is never called (recognition stuck on mobile),
  // a 7-second timer will force-settle with whatever transcript we have so far.
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(
    (onComplete: (transcript: string, confidence: number) => void) => {
      if (!isSupported) return;

      // Abort any existing recognition instance before creating a new one.
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }

      // Clear any pending failsafe timer from the previous session.
      if (failsafeTimerRef.current) {
        clearTimeout(failsafeTimerRef.current);
        failsafeTimerRef.current = null;
      }

      // Bump session ID — any onend/onerror that carries a stale sessionId
      // will know it belongs to a dead session and must not restart.
      const sessionId = ++sessionIdRef.current;

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
        // Clear failsafe — we settled normally.
        if (failsafeTimerRef.current) {
          clearTimeout(failsafeTimerRef.current);
          failsafeTimerRef.current = null;
        }
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
        // Stale event from a previous session — ignore completely.
        if (sessionIdRef.current !== sessionId) return;

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
        // Stale event from a previous session — do NOT restart, do NOT settle.
        // This is the key fix for the "lần 2 không nhận" bug on mobile:
        // the old session's onend fires after we've already started a new session.
        if (sessionIdRef.current !== sessionId) return;

        // Mobile browsers fire onend after every short silence even with continuous=true.
        // Restart to keep listening — but delay by 150ms because calling start()
        // immediately after onend throws InvalidStateError on some mobile browsers.
        if (!explicitlyStoppedRef.current && !settledRef.current) {
          setTimeout(() => {
            // Double-check: session may have changed during the delay.
            if (sessionIdRef.current !== sessionId) return;
            if (!explicitlyStoppedRef.current && !settledRef.current) {
              try { recognition.start(); }
              catch { settle(); }
            }
          }, 150);
          return;
        }
        settle();
      };

      setError(null);
      setIsListening(true);

      // Failsafe: on some mobile browsers, recognition can silently get stuck
      // and never fire onend/onerror. Force-settle after 7 seconds so the UI
      // never stays frozen in the "recording" state indefinitely.
      failsafeTimerRef.current = setTimeout(() => {
        failsafeTimerRef.current = null;
        if (sessionIdRef.current === sessionId && !settledRef.current) {
          try { recognition.abort(); } catch { /* ignore */ }
          settle();
        }
      }, 7000);

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
    // Clear failsafe — we're stopping intentionally.
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
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
      sessionIdRef.current++; // invalidate any pending onend/onerror from old sessions
      if (failsafeTimerRef.current) {
        clearTimeout(failsafeTimerRef.current);
        failsafeTimerRef.current = null;
      }
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
