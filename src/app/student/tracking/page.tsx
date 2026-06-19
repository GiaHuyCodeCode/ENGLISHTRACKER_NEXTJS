'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitDailyTracking, TrackCategory, getStudentNames, getStudentColors, getStudentAvatar } from '@/lib/local-store';
import { Upload, CheckCircle2, AlertCircle, ArrowLeft, Image as ImageIcon, Send, User, ChevronRight } from 'lucide-react';

// ── Student picker modal ────────────────────────────────────────────────────
function StudentModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [chosen, setChosen] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="glass-strong border border-border rounded-2xl p-8 w-full max-w-sm space-y-6 slide-up">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center">
            <User className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-bold font-heading gradient-text">Bạn là ai?</h2>
          <p className="text-sm text-muted-foreground">Chọn tên để nộp báo cáo</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {getStudentNames().map(name => {
            const c = getStudentColors(name);
            const initials = getStudentAvatar(name);
            return (
              <button
                key={name}
                onClick={() => setChosen(name)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-sm font-medium transition-all ${
                  chosen === name
                    ? `${c.bg} ${c.text} border-current ${c.border}`
                    : 'border-border hover:border-primary/40 hover:bg-slate-800/50 text-foreground/70'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                  {initials}
                </span>
                <span className="leading-tight">{name}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => chosen && onConfirm(chosen)}
          disabled={!chosen}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary"
        >
          Xác Nhận <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Image Compressor ─────────────────────────────────────────────────────────
function compressImage(file: File, maxWidth = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0, width, height);
        // Chuyển thành jpeg base64 để tối ưu dung lượng (chấp nhận mất kênh alpha)
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

// ── Main Page ────────────────────────────────────────────────────────────────
const CATEGORIES: TrackCategory[] = ['Vocabulary', 'Dictation', 'Grammar', 'Reading', 'Listening'];

export default function DailyTrackingPage() {
  const router = useRouter();
  const [currentStudent, setCurrentStudent] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  
  const [category, setCategory] = useState<TrackCategory>('Vocabulary');
  const [score, setScore] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('et_current_student');
    if (saved && getStudentNames().includes(saved)) {
      setCurrentStudent(saved);
    } else {
      setShowStudentModal(true);
    }
  }, []);

  const handleStudentConfirm = (name: string) => {
    localStorage.setItem('et_current_student', name);
    setCurrentStudent(name);
    setShowStudentModal(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size > 10MB just as a safety net
    if (file.size > 10 * 1024 * 1024) {
      setError('File ảnh quá lớn. Vui lòng chọn ảnh dưới 10MB.');
      return;
    }

    try {
      setIsCompressing(true);
      setError('');
      // Tạo preview
      setPreviewUrl(URL.createObjectURL(file));
      
      // Nén ảnh
      const compressed = await compressImage(file, 800, 0.7); // Tối đa 800px rộng, chất lượng 70%
      setImageBase64(compressed);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xử lý ảnh. Vui lòng thử ảnh khác.');
      setPreviewUrl(null);
      setImageBase64(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            setError('File ảnh quá lớn. Vui lòng chọn ảnh dưới 10MB.');
            return;
          }
          try {
            setIsCompressing(true);
            setError('');
            setPreviewUrl(URL.createObjectURL(file));
            const compressed = await compressImage(file, 800, 0.7);
            setImageBase64(compressed);
          } catch (err) {
            console.error(err);
            setError('Lỗi khi xử lý ảnh. Vui lòng thử lại.');
            setPreviewUrl(null);
            setImageBase64(null);
          } finally {
            setIsCompressing(false);
          }
        }
        break;
      }
    }
  };

  const handleSubmit = () => {
    if (!currentStudent) { setShowStudentModal(true); return; }
    if (!category) { setError('Vui lòng chọn môn học'); return; }
    if (!reportDate) { setError('Vui lòng chọn ngày nộp bài'); return; }
    
    const scoreNum = parseInt(score, 10);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setError('Điểm số phải từ 0 đến 100');
      return;
    }

    if (!imageBase64) {
      setError('Vui lòng tải lên ảnh bài làm');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      submitDailyTracking({
        studentName: currentStudent,
        category,
        score: scoreNum,
        imageBase64,
        customDate: reportDate,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/student');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu.');
      setIsSubmitting(false);
    }
  };

  if (showStudentModal) {
    return <StudentModal onConfirm={handleStudentConfirm} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 lg:pb-0" onPaste={handlePaste}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/student')}
          className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">Báo Cáo Tiến Độ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Học viên: <span className="font-semibold text-foreground">{currentStudent}</span>
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium slide-up">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          Đã nộp báo cáo thành công! Tự động quay về...
        </div>
      )}

      <div className="glass rounded-2xl border border-border p-6 space-y-6">
        {/* Date Picker */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Ngày nộp báo cáo</label>
          <input 
            type="date" 
            value={reportDate} 
            onChange={e => setReportDate(e.target.value)} 
            className="input-field max-w-[200px]"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Category */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground/80">Bạn vừa hoàn thành môn gì?</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all border ${
                  category === cat
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-secondary text-muted-foreground border-border hover:border-border/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Điểm số tự chấm (Thang 100)</label>
          <input 
            type="number" 
            min="0" max="100"
            value={score} 
            onChange={e => setScore(e.target.value)} 
            className="input-field max-w-[150px] text-xl font-bold text-center"
            placeholder="VD: 85" 
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80 flex items-center justify-between">
            <span>Ảnh bài làm thực tế</span>
            {previewUrl && (
              <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline">
                Đổi ảnh khác
              </button>
            )}
          </label>
          
          {!previewUrl ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                Bấm để chụp hoặc nhấn <kbd className="px-2 py-0.5 mx-1 rounded bg-secondary/50 font-mono text-xs">Ctrl+V</kbd> dán ảnh
              </p>
              <p className="text-xs text-muted-foreground mt-1">Hỗ trợ JPG, PNG</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-border group bg-black/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[300px] object-contain" />
              {isCompressing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-sm font-medium text-primary">Đang nén ảnh...</span>
                </div>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isCompressing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? 'Đang gửi báo cáo...' : 'Nộp Báo Cáo'}
        </button>
      </div>
    </div>
  );
}
