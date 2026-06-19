import re

with open('src/app/student/dictation/[id]/page.tsx', 'r') as f:
    content = f.read()

# Replace the layout wrapper
content = content.replace('<div className="space-y-6 fade-in">', 
'''<div className="lg:grid lg:grid-cols-3 lg:gap-8 fade-in items-start">
          <div className="lg:col-span-2 space-y-6">''', 1)

# Move progress to sidebar
progress_str = '''          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Câu {currentIdx + 1} / {sentences.length}</span>
              <span>{progress}% hoàn thành</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-violet-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Sentence dots */}
            <div className="flex gap-1.5 flex-wrap pt-1">
              {sentences.map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full transition-all ${
                  completedIdx.has(i) ? 'bg-emerald-400' :
                  i === currentIdx ? 'bg-sky-400 scale-125' :
                  'bg-white/10'
                }`} />
              ))}
            </div>
          </div>'''

content = content.replace(progress_str, '')

# Inject Speed controller into Listen button
listen_btn_str = '''            {/* Listen Button */}
            <div className="text-center py-4">'''

new_listen_btn = '''            {/* Listen Button */}
            <div className="text-center py-4 relative">
              <div className="absolute top-0 right-0">
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-secondary/50 border border-white/10 rounded-lg text-xs py-1 px-2 text-muted-foreground hover:text-foreground outline-none">
                  <option value={0.75}>0.75x</option>
                  <option value={0.85}>0.85x (Chuẩn)</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                </select>
              </div>'''

content = content.replace(listen_btn_str, new_listen_btn, 1)

# Insert sidebar before ending
end_str = '''            {/* Check Button */}
            {feedback === null && (
              <button
                onClick={handleCheck}
                disabled={!input.trim()}
                className="w-full py-3 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Kiểm Tra
              </button>
            )}
          </div>

        </div>
      )}
      
      {/* Leaderboard */}'''

sidebar_str = f'''            {{/* Check Button */}}
            {{feedback === null && (
              <button
                onClick={{handleCheck}}
                disabled={{!input.trim()}}
                className="w-full py-3 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Kiểm Tra
              </button>
            )}}
          </div>
          </div>

          {{/* Sidebar Tracking */}}
          <div className="lg:col-span-1 mt-6 lg:mt-0 space-y-6 sticky top-6">
            <div className="glass-strong rounded-3xl border border-white/5 p-6 space-y-6">
              <div>
                <h3 className="font-bold font-heading text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400" /> Tiến Độ Bài Tập
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Hoàn thành bài tập để đạt điểm tối đa</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6"
                      strokeDasharray={{28 * 2 * Math.PI}}
                      strokeDashoffset={{(28 * 2 * Math.PI) - ((progress / 100) * 28 * 2 * Math.PI)}}
                      className="text-sky-400 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{{progress}}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Đã xong:</span>
                    <span className="font-bold text-emerald-400">{{completedIdx.size}}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Còn lại:</span>
                    <span className="font-bold text-amber-400">{{sentences.length - completedIdx.size}}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground/80">Chi tiết các câu</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {{sentences.map((_, i) => (
                    <div key={{i}} className={{`aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all ${{
                      completedIdx.has(i) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      i === currentIdx ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50 scale-105' :
                      'bg-secondary/40 text-muted-foreground/50 border border-white/5'
                    }}`}}>
                      {{i + 1}}
                    </div>
                  ))}}
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <p className="text-xs text-muted-foreground">Phím tắt nhanh:</p>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-secondary/50 border border-white/10 text-xs font-mono text-muted-foreground font-semibold">Ctrl</kbd>
                    <span className="text-xs text-muted-foreground">Phát / Nghe lại câu hiện tại</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}}
      
      {{/* Leaderboard */}}'''

content = content.replace(end_str, sidebar_str, 1)

with open('src/app/student/dictation/[id]/page.tsx', 'w') as f:
    f.write(content)
