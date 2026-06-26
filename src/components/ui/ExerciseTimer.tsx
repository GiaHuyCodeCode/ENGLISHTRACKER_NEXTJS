import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface ExerciseTimerProps {
  isRunning: boolean;
  className?: string;
}

export function ExerciseTimer({ isRunning, className = '' }: ExerciseTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-secondary/30 text-muted-foreground font-mono text-sm ${className}`}>
      <Clock className={`h-4 w-4 ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
      <span className={isRunning ? 'text-foreground' : ''}>{formatTime(elapsedSeconds)}</span>
    </div>
  );
}
