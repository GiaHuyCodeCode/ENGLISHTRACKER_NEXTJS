class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentTimer: NodeJS.Timeout | null = null;
  private timeUpdateListener: (() => void) | null = null;

  public speak(
    text: string,
    rate: number = 1.0,
    audioUrl?: string,
    startTime?: number,
    endTime?: number
  ) {
    if (typeof window === 'undefined') return;

    // 1. Dọn dẹp tiến trình cũ
    this.stop();

    // 2. Logic Audio Slicing (Nếu có URL và startTime hợp lệ)
    if (audioUrl && startTime !== undefined && startTime >= 0) {
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.currentTime = startTime;
      this.currentAudio.playbackRate = rate;

      // Handle pause when reaching endTime
      if (endTime && endTime > startTime) {
        this.timeUpdateListener = () => {
          if (this.currentAudio && this.currentAudio.currentTime >= endTime) {
            this.currentAudio.pause();
            this.stop(); // dọn dẹp
          }
        };
        this.currentAudio.addEventListener('timeupdate', this.timeUpdateListener);
      }

      this.currentAudio.play().catch(e => {
        console.error('Lỗi phát Audio (Có thể do trình duyệt chặn tự động phát):', e);
        // Fallback to TTS if audio play fails unexpectedly? Maybe not here to avoid double play bugs.
      });

      return;
    }

    // 3. Logic Default: Nếu không có URL hoặc startTime=0 -> Dùng Text-to-Speech (Mặc định)
    if (!window.speechSynthesis) return;
    
    // Đảm bảo không bị kẹt TTS cũ trên Safari/Chrome
    window.speechSynthesis.cancel();
    
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = rate;
    window.speechSynthesis.speak(utt);
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

// Singleton instance dùng chung cho toàn app
export const audioManager = new AudioManager();
