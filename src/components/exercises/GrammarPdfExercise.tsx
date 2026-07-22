'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Assignment, Submission, getAssignment } from '@/lib/local-store';
import {
  ChevronLeft, ChevronRight, CheckCircle2, FileText, ArrowLeft,
  Clock, Eye, AlertCircle, RefreshCw, ExternalLink, Keyboard,
} from 'lucide-react';
import { FilePdf } from '@/components/ui/FilePdf';

interface Props {
  assignment: Assignment;
  onSubmit: () => void;
  isSubmitting?: boolean;
  result?: Submission;
  durationMs?: number;
}

declare global {
  interface Window { pdfjsLib: any; }
}

export function GrammarPdfExercise({ assignment, onSubmit, isSubmitting, result, durationMs }: Props) {
  const router = useRouter();
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState('');
  const [showKeyHint, setShowKeyHint] = useState(false);
  const [showMobileSwipeTip, setShowMobileSwipeTip] = useState(true);
  const [showDesktopTip, setShowDesktopTip] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Extract pdfUrl and linkedAssignmentId from passage if needed
  // GAS auto-parses JSON cells so passage may be an object or a string
  let pdfUrl = assignment.pdfUrl;
  let linkedAssignmentId = assignment.linkedAssignmentId;

  if (!pdfUrl && assignment.passage) {
    const passageData = typeof assignment.passage === 'object'
      ? assignment.passage as any
      : (() => { try { return JSON.parse(assignment.passage as string); } catch { return null; } })();
    if (passageData?.pdfUrl) pdfUrl = passageData.pdfUrl;
    if (passageData?.linkedAssignmentId) linkedAssignmentId = passageData.linkedAssignmentId;
  }

  // Also sanitize if pdfUrl is somehow an object
  if (pdfUrl && typeof pdfUrl !== 'string') pdfUrl = undefined;

  const isFinished = !!result;
  const isLastPage = pageNum === numPages && numPages > 0;

  // ── Load pdf.js from CDN ─────────────────────────────────────────────────
  useEffect(() => {
    if (window.pdfjsLib) { setPdfLibLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        setPdfLibLoaded(true);
      }
    };
    script.onerror = () => {
      setRenderError('Không thể tải thư viện giải mã PDF. Vui lòng kiểm tra kết nối mạng.');
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  // ── Load PDF document ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfLibLoaded || !pdfUrl) return;
    setLoading(true);
    setRenderError('');

    // Nếu pdfUrl là dạng Data URL (base64 local), decode trực tiếp không qua proxy
    if (pdfUrl.startsWith('data:')) {
      try {
        const base64Parts = pdfUrl.split(',');
        const base64Str = base64Parts[1] || base64Parts[0];
        const binaryStr = window.atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        if (!window.pdfjsLib) throw new Error('Thư viện PDF chưa sẵn sàng.');
        window.pdfjsLib.getDocument({ data: bytes }).promise.then(
          (pdfDoc: any) => { setPdf(pdfDoc); setNumPages(pdfDoc.numPages); setLoading(false); },
          (err: any) => {
            console.error('Error decoding Base64 PDF:', err);
            setRenderError('Không thể giải mã file PDF.');
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.error('Error parsing Base64 PDF:', err);
        setRenderError('Lỗi xử lý file PDF.');
        setLoading(false);
      }
      return;
    }

    const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;
    fetch(proxyUrl)
      .then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.arrayBuffer(); })
      .then(arrayBuffer => {
        if (!window.pdfjsLib) throw new Error('Thư viện PDF chưa sẵn sàng.');
        return window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      })
      .then(
        (pdfDoc: any) => { setPdf(pdfDoc); setNumPages(pdfDoc.numPages); setLoading(false); },
        (err: any) => {
          console.error('Error decoding PDF:', err);
          setRenderError('Không thể giải mã file PDF. Hãy đảm bảo file PDF hợp lệ và không bị hỏng.');
          setLoading(false);
        },
      )
      .catch(err => {
        console.error('Error loading PDF:', err);
        setRenderError('Không thể nạp file PDF từ Drive qua máy chủ proxy. Vui lòng kiểm tra quyền chia sẻ của file.');
        setLoading(false);
      });
  }, [pdfLibLoaded, pdfUrl]);

  // ── Render page ──────────────────────────────────────────────────────────
  const renderPage = useCallback((num: number) => {
    if (!pdf) return;
    pdf.getPage(num).then(
      (page: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const containerWidth = canvas.parentElement?.clientWidth || 800;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: Math.min(scale, 1.8) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        page.render({ canvasContext: context, viewport });
      },
      (err: any) => { console.error('Page render error:', err); setRenderError('Lỗi khi vẽ trang tài liệu.'); },
    );
  }, [pdf]);

  useEffect(() => { if (pdf) renderPage(pageNum); }, [pdf, pageNum, renderPage]);

  useEffect(() => {
    const handleResize = () => { if (pdf) renderPage(pageNum); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdf, pageNum, renderPage]);

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handlePrevPage = useCallback(() => {
    if (pageNum > 1) {
      setPageNum(p => p - 1);
      canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [pageNum]);

  const handleNextPage = useCallback(() => {
    if (pageNum < numPages) {
      setPageNum(p => p + 1);
      canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [pageNum, numPages]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); handlePrevPage(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); handleNextPage(); }
      if ((e.key === 'Enter' || e.key === 'c') && isLastPage && !isFinished) { onSubmit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrevPage, handleNextPage, isLastPage, isFinished, onSubmit]);

  // Show keyboard hint briefly on mount (desktop only)
  useEffect(() => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (!isMobile) { setShowKeyHint(true); setTimeout(() => setShowKeyHint(false), 3500); }
  }, []);

  // ── Touch / Swipe ────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) handleNextPage(); // swipe left → next
      else handlePrevPage();         // swipe right → prev
    }
  };

  const linkedAssignment = linkedAssignmentId ? getAssignment(linkedAssignmentId) : null;
  const progress = numPages > 0 ? (pageNum / numPages) * 100 : 0;

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pb-28 lg:pb-0">

      {/* ─── Keyboard Shortcut Hint (desktop toast) ───────────────────── */}
      <div className={`hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 items-center gap-2 px-4 py-2.5 rounded-full glass-strong border border-white/10 shadow-xl text-xs font-medium text-muted-foreground transition-all duration-500 ${showKeyHint ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <Keyboard className="h-3.5 w-3.5 text-fuchsia-400" />
        <span>Phím tắt:</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">←</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">→</kbd>
        <span>chuyển trang</span>
        <span className="text-white/20">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">Enter</kbd>
        <span>hoàn thành</span>
      </div>

      {/* ─── PDF View Panel (3/4 on desktop) ─────────────────────────── */}
      <div className="lg:col-span-3 space-y-3">
        {/* Header bar */}
        <div className="glass rounded-2xl border border-white/5 px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <FilePdf className="h-4 w-4 text-fuchsia-400 shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[160px] sm:max-w-xs">
              {assignment.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Desktop page nav in header */}
            {!loading && !renderError && numPages > 0 && (
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={handlePrevPage} disabled={pageNum === 1}
                  title="Trang trước (←)"
                  className="p-1.5 rounded-lg border border-white/10 bg-slate-800/40 hover:bg-slate-800/80 disabled:opacity-25 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold tabular-nums">
                  <span className="text-fuchsia-400 font-bold">{pageNum}</span>
                  <span className="text-white/30 mx-1">/</span>
                  {numPages}
                </span>
                <button
                  onClick={handleNextPage} disabled={pageNum === numPages}
                  title="Trang sau (→)"
                  className="p-1.5 rounded-lg border border-white/10 bg-slate-800/40 hover:bg-slate-800/80 disabled:opacity-25 transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {pdfUrl && (
              <a
                href={pdfUrl} target="_blank" rel="noopener noreferrer"
                title="Mở PDF trong tab mới"
                className="p-1.5 rounded-lg border border-white/10 bg-slate-800/40 hover:bg-slate-800/80 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 text-[10px] font-bold"
              >
                <ExternalLink className="h-3 w-3" /> Drive
              </a>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-fuchsia-600 to-violet-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Canvas area with swipe support */}
        <div
          className="glass rounded-3xl border border-white/5 p-3 md:p-6 bg-slate-950/40 flex justify-center min-h-[500px] relative overflow-x-auto"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 rounded-3xl z-10 space-y-3">
              <RefreshCw className="h-8 w-8 text-fuchsia-400 animate-spin" />
              <p className="text-sm font-semibold text-fuchsia-300">Đang nạp trang tài liệu...</p>
            </div>
          )}

          {renderError && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold">Không thể hiển thị tài liệu PDF</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{renderError}</p>
              {pdfUrl && (
                <a
                  href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg"
                >
                  <ExternalLink className="h-4 w-4" /> Mở Trên Google Drive
                </a>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className={`shadow-2xl rounded-xl max-w-full h-auto ${loading || renderError ? 'hidden' : 'block'}`} />
        </div>

        {/* Mobile swipe tip — dismissible */}
        {!loading && !renderError && numPages > 1 && showMobileSwipeTip && (
          <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20">
            <div className="flex items-center gap-2 text-[11px] text-fuchsia-300 font-medium">
              <span className="text-base leading-none">👆</span>
              <span>Vuốt <strong>trái / phải</strong> trên tài liệu để chuyển trang</span>
            </div>
            <button
              onClick={() => setShowMobileSwipeTip(false)}
              className="text-white/30 hover:text-white/60 text-xs px-1.5 py-0.5 rounded shrink-0 transition-colors touch-manipulation"
              aria-label="Đóng gợi ý"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ─── Desktop: Side Action Panel (1/4) ────────────────────────── */}
      <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-4 z-30 space-y-4 self-start">
        {/* Status box */}
        <div className="glass-strong rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center">
            Trạng thái bài tập
          </div>
          {isFinished ? (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-emerald-400">Đã Hoàn Thành</p>
              <p className="text-[11px] text-muted-foreground">Điểm số lý thuyết: 100/100</p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-fuchsia-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-fuchsia-400 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                Hãy đọc qua tất cả các trang rồi nhấn <strong>Hoàn Thành</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Desktop keyboard tip — dismissible */}
        {showDesktopTip && !isFinished && (
          <div className="glass rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
                <Keyboard className="h-3 w-3" /> Phím tắt
              </div>
              <button
                onClick={() => setShowDesktopTip(false)}
                className="text-white/25 hover:text-white/50 text-xs px-1 rounded transition-colors"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Trang trước</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-white/70">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-white/70">↑</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Trang tiếp theo</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-white/70">→</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-white/70">Space</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Hoàn thành bài</span>
                <kbd className="px-1.5 py-0.5 rounded bg-emerald-500/30 font-bold text-emerald-300">Enter</kbd>
              </div>
            </div>
          </div>
        )}

        {/* Action box */}
        <div className="glass-strong rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
          {!isFinished ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tiến trình đọc</h4>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Trang hiện tại:</span>
                  <span className="font-bold">{pageNum} / {numPages || 1}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="bg-fuchsia-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {isLastPage ? (
                <button
                  onClick={onSubmit} disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 active:scale-95 transition-all shadow-lg"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting ? 'Đang gửi...' : 'Hoàn Thành Bài Học'}
                </button>
              ) : (
                <button
                  onClick={handleNextPage} disabled={numPages === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-fuchsia-600 text-white font-semibold text-sm hover:bg-fuchsia-500 disabled:opacity-40 transition-all shadow-lg"
                >
                  Trang Tiếp Theo <ChevronRight className="h-4 w-4" />
                </button>
              )}


            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-center text-muted-foreground leading-relaxed">
                Bạn đã hoàn thành việc xem lý thuyết bài học này!
              </div>
              {linkedAssignment ? (
                <div className="space-y-3 pt-1 border-t border-white/5">
                  <div className="text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-fuchsia-400">Bài tập thực hành</p>
                    <p className="text-xs font-bold leading-snug line-clamp-2 px-1">{linkedAssignment.title}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/student/assignments/${linkedAssignment.id}`)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-fuchsia-600 text-white font-semibold text-xs hover:bg-fuchsia-500 active:scale-95 transition-all shadow-lg"
                  >
                    Bắt đầu làm bài trắc nghiệm <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/student/assignments')}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-secondary text-xs font-semibold transition-all"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Quay về danh sách
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile: Fixed Bottom Navigation Bar ─────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-pb">
        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-4 pt-3 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>

          {/* Page indicator + progress */}
          {!loading && !renderError && numPages > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40 font-medium">Tiến trình đọc</span>
                <span className="font-bold text-fuchsia-300">{pageNum} / {numPages} trang</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-fuchsia-500 to-violet-400 h-full rounded-full transition-all duration-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isFinished ? (
            <div className="grid grid-cols-3 gap-2">
              {/* Prev */}
              <button
                onClick={handlePrevPage}
                disabled={pageNum <= 1 || numPages === 0}
                className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl border border-white/10 bg-slate-800/80 active:bg-slate-700 disabled:opacity-25 transition-all touch-manipulation select-none"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Trước</span>
              </button>

              {/* Primary action: Next or Complete */}
              {isLastPage ? (
                <button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold active:bg-emerald-500 disabled:opacity-50 transition-all touch-manipulation select-none shadow-lg shadow-emerald-900/40"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-[10px] font-bold">{isSubmitting ? 'Gửi...' : 'Hoàn Thành'}</span>
                </button>
              ) : (
                <button
                  onClick={handleNextPage}
                  disabled={numPages === 0 || isLastPage}
                  className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl bg-fuchsia-600 text-white font-bold active:bg-fuchsia-500 disabled:opacity-40 transition-all touch-manipulation select-none shadow-lg shadow-fuchsia-900/40"
                >
                  <ChevronRight className="h-5 w-5" />
                  <span className="text-[10px] font-bold">Tiếp theo</span>
                </button>
              )}

              {/* Open in Drive */}
              {pdfUrl ? (
                <a
                  href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl border border-white/10 bg-slate-800/80 active:bg-slate-700 transition-all touch-manipulation select-none"
                >
                  <ExternalLink className="h-5 w-5 text-sky-400" />
                  <span className="text-[10px] font-semibold text-sky-300">Drive</span>
                </a>
              ) : (
                <button
                  onClick={() => router.push('/student/assignments')}
                  className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl border border-white/10 bg-slate-800/80 active:bg-slate-700 transition-all touch-manipulation select-none"
                >
                  <ArrowLeft className="h-5 w-5 text-white/50" />
                  <span className="text-[10px] font-semibold text-white/40">Thoát</span>
                </button>
              )}
            </div>
          ) : (
            // Finished state on mobile
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold mb-2">
                <CheckCircle2 className="h-4 w-4" />
                Đã hoàn thành bài học!
              </div>
              {linkedAssignment ? (
                <button
                  onClick={() => router.push(`/student/assignments/${linkedAssignment.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-fuchsia-600 text-white font-bold text-sm active:bg-fuchsia-500 transition-all shadow-lg touch-manipulation select-none"
                >
                  Bắt đầu bài trắc nghiệm <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => router.push('/student/assignments')}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 text-sm font-semibold active:bg-slate-700 transition-all touch-manipulation select-none"
                >
                  <ArrowLeft className="h-4 w-4" /> Quay về danh sách
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
