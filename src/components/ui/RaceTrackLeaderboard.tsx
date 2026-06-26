import { Submission, getStudentAvatar, getStudentColors } from '@/lib/local-store';
import { Trophy, Clock, Flag } from 'lucide-react';

export function RaceTrackLeaderboard({ submissions }: { submissions: Submission[] }) {
  if (!submissions || submissions.length === 0) return null;
  
  const sorted = [...submissions].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const durA = a.durationMs || Infinity;
    const durB = b.durationMs || Infinity;
    return durA - durB;
  });

  const formatDuration = (ms?: number) => {
    if (!ms || ms === Infinity) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m} phút ${s} giây`;
    return `${s} giây`;
  };

  return (
    <div className="glass rounded-3xl border border-white/5 overflow-hidden mt-8 slide-up">
      <div className="p-5 border-b border-white/5 flex items-center gap-3 bg-secondary/20">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Flag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-bold text-lg font-heading text-foreground">Đường Đua Thành Tích</h3>
          <p className="text-xs text-muted-foreground">Tốc độ & Điểm số của các học viên</p>
        </div>
      </div>
      
      <div className="p-5 space-y-6">
        {sorted.map((sub, idx) => {
          const colors = getStudentColors(sub.studentName);
          const initials = getStudentAvatar(sub.studentName);
          const isTop1 = idx === 0;
          const score = Math.max(0, Math.min(100, sub.score));
          
          return (
            <div key={sub.id} className="relative">
              {/* Name & Time label */}
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{sub.studentName}</span>
                  {isTop1 && <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                </div>
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">{score}đ</span>
                  {sub.durationMs ? (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 flex items-center gap-1 bg-sky-500/10 dark:bg-sky-500/10 px-1.5 py-0.5 rounded">
                      <Clock className="w-3 h-3" /> {formatDuration(sub.durationMs)}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> —
                    </span>
                  )}
                </div>
              </div>

              {/* Track */}
              <div className="relative h-12 bg-secondary/40 rounded-full border border-white/5 overflow-hidden flex items-center px-1">
                {/* Background dash pattern for track */}
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, #ffffff 10px, #ffffff 20px)' }}></div>
                
                {/* Progress fill */}
                <div 
                  className={`absolute left-0 top-0 bottom-0 ${isTop1 ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/40' : 'bg-gradient-to-r from-sky-500/10 to-sky-500/30'} transition-all duration-1000 ease-out border-r border-white/20`}
                  style={{ width: `${score}%` }}
                ></div>

                {/* Avatar / Car on track */}
                <div 
                  className="absolute transition-all duration-1000 ease-out"
                  style={{ left: `calc(${score}% - 40px)`, zIndex: 10 }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-lg ${colors.bg} ${colors.text} ${isTop1 ? 'border-amber-400 shadow-amber-500/20' : colors.border}`}>
                    {initials}
                  </div>
                </div>
                
                {/* Finish line pattern */}
                <div className="absolute right-0 top-0 bottom-0 w-6 flex flex-wrap opacity-30">
                  {Array(8).fill(0).map((_, i) => (
                    <div key={i} className={`w-3 h-3 ${i % 2 === 0 ? 'bg-white' : 'bg-black'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
