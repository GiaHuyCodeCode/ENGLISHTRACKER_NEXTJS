class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentTimer: NodeJS.Timeout | null = null;
  private timeUpdateListener: (() => void) | null = null;

  public speak(
    text: string,
    rate: number = 1.0,
    audioUrl?: string,
    startTime?: number,
    endTime?: number,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined') return;

    // 1. Dọn dẹp tiến trình cũ
    this.stop();

    // 2. Logic Audio Slicing (Nếu có URL và startTime hợp lệ)
    if (audioUrl && startTime !== undefined && startTime >= 0) {
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.playbackRate = rate;

      const startPlayback = () => {
        if (!this.currentAudio) return;
        // currentTime must be set AFTER loadedmetadata — iOS Safari silently ignores it before
        this.currentAudio.currentTime = startTime;

        if (endTime && endTime > startTime) {
          this.timeUpdateListener = () => {
            if (this.currentAudio && this.currentAudio.currentTime >= endTime) {
              this.currentAudio.pause();
              if (onEnd) onEnd();
              this.stop();
            }
          };
          this.currentAudio.addEventListener('timeupdate', this.timeUpdateListener);
        } else {
          this.currentAudio.onended = () => {
            if (onEnd) onEnd();
            this.stop();
          };
        }

        this.currentAudio.play().then(() => {
          if (onStart) onStart();
        }).catch(e => {
          console.error('Lỗi phát Audio (Có thể do trình duyệt chặn tự động phát):', e);
          if (onEnd) onEnd();
        });
      };

      // iOS Safari requires metadata to be loaded before seeking with currentTime
      if (this.currentAudio.readyState >= 1 /* HAVE_METADATA */) {
        startPlayback();
      } else {
        this.currentAudio.addEventListener('loadedmetadata', startPlayback, { once: true });
        // Explicitly trigger load — iOS Safari doesn't always auto-load
        this.currentAudio.load();
      }

      return;
    }

    // 3. Logic Default: Nếu không có URL hoặc startTime=0 -> Dùng Text-to-Speech (Mặc định)
    if (!window.speechSynthesis) {
       if (onEnd) onEnd();
       return;
    }
    
    // Đảm bảo không bị kẹt TTS cũ trên Safari/Chrome
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    const bestVoice = getBestEnglishVoice();
    if (bestVoice) {
      utt.voice = bestVoice;
    }
    utt.lang = 'en-US';
    utt.rate = rate;

    if (onStart) utt.onstart = onStart;
    if (onEnd) {
      utt.onend = onEnd;
      utt.onerror = onEnd;
    }

    // iOS Safari requires a tick between cancel() and speak() — without it, the new
    // utterance silently fails or plays back choppy/distorted audio
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setTimeout(() => window.speechSynthesis.speak(utt), 50);
    } else {
      window.speechSynthesis.speak(utt);
    }
  }

  public stop() {
    if (typeof window === 'undefined') return;
    
    window.speechSynthesis.cancel();

    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }

    if (this.currentAudio) {
      if (this.timeUpdateListener) {
        this.currentAudio.removeEventListener('timeupdate', this.timeUpdateListener);
        this.timeUpdateListener = null;
      }
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }
}

export function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  
  const preferredNames = ['Google US English', 'Samantha', 'Karen', 'Daniel', 'Moira', 'Alex', 'Victoria', 'Fred'];
  for (const name of preferredNames) {
    const voice = voices.find(v => v.name === name);
    if (voice) return voice;
  }
  return voices.find(v => v.lang.startsWith('en')) || voices[0];
}

// Pre-load voices for mobile browsers to avoid empty voices list on first call
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// Singleton instance dùng chung cho toàn app
export const audioManager = new AudioManager();
