class AudioManager {
  private currentTimer: NodeJS.Timeout | null = null;

  public speak(
    text: string,
    rate: number = 1.0,
    audioUrl?: string, // Giữ lại tham số để không lỗi code cũ nhưng bỏ qua nó
    startTime?: number,
    endTime?: number,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined') return;

    // 1. Dọn dẹp tiến trình cũ
    this.stop();

    // 2. Logic Default: Sử dụng 100% Text-to-Speech (Mặc định)
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
    
    // Cấu hình để giọng đọc tự nhiên nhất có thể
    utt.lang = 'en-US';
    utt.rate = rate;
    utt.pitch = 1.0; // Giọng tự nhiên

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
  }
}

export function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  
  const preferredNames = [
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Google US English',
    'Samantha (Enhanced)',
    'Samantha',
    'Alex',
    'Daniel',
    'Karen',
    'Microsoft Zira - English (United States)',
    'Moira',
    'Victoria',
    'Fred'
  ];
  for (const name of preferredNames) {
    const voice = voices.find(v => v.name.includes(name));
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
