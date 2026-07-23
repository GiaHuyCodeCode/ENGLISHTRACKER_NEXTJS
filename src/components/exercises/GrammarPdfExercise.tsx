'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Assignment, Submission, getAssignment } from '@/lib/local-store';
import {
  ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft,
  Clock, AlertCircle, RefreshCw, ExternalLink, Keyboard,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Sparkles,
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

// ── Cache API Helper for Ultra-Fast PDF Loading ─────────────────────────────
async function fetchPdfWithCache(proxyUrl: string): Promise<ArrayBuffer> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open('et-pdf-cache-v1');
      const cachedResponse = await cache.match(proxyUrl);
      if (cachedResponse) {
        return await cachedResponse.arrayBuffer();
      }
      const response = await fetch(proxyUrl);
      if (response.ok) {
        cache.put(proxyUrl, response.clone()).catch(err => console.warn('Cache put error:', err));
        return await response.arrayBuffer();
      }
    } catch (e) {
      console.warn('[PDF Cache] Fallback to direct fetch:', e);
    }
  }
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.arrayBuffer();
}

export function GrammarPdfExercise({ assignment, onSubmit, isSubmitting, result, durationMs }: Props) {
  const router = useRouter();
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo tài liệu...');
  const [renderError, setRenderError] = useState('');
  
  // Interactive View Controls
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 75% to 250%
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Hints & Tips
  const [showKeyHint, setShowKeyHint] = useState(false);
  const [showMobileSwipeTip, setShowMobileSwipeTip] = useState(true);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const renderTaskRef = useRef<any>(null);

  // Extract pdfUrl and linkedAssignmentId from passage if needed
  let pdfUrl = assignment.pdfUrl;
  let linkedAssignmentId = assignment.linkedAssignmentId;

  if (!pdfUrl && assignment.passage) {
    const passageData = typeof assignment.passage === 'object'
      ? assignment.passage as any
      : (() => { try { return JSON.parse(assignment.passage as string); } catch { return null; } })();
    if (passageData?.pdfUrl) pdfUrl = passageData.pdfUrl;
    if (passageData?.linkedAssignmentId) linkedAssignmentId = passageData.linkedAssignmentId;
  }

  if (pdfUrl && typeof pdfUrl !== 'string') pdfUrl = undefined;

  const isFinished = !!result;
  const isLastPage = pageNum === numPages && numPages > 0;

  // ── Load pdf.js from CDN ─────────────────────────────────────────────────
  useEffect(() => {
    if (window.pdfjsLib) { setPdfLibLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/async/pdf.js/3.4.120/pdf.min.js';
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
    setLoadingMsg('Đang nạp dữ liệu PDF...');
    setRenderError('');

    // Nếu pdfUrl là dạng Data URL (base64 local), decode trực tiếp
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
          (pdfDoc: any) => {
            setPdf(pdfDoc);
            setNumPages(pdfDoc.numPages);
            setLoading(false);
          },
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
    
    // Nạp siêu tốc qua Cache API
    fetchPdfWithCache(proxyUrl)
      .then(arrayBuffer => {
        if (!window.pdfjsLib) throw new Error('Thư viện PDF chưa sẵn sàng.');
        setLoadingMsg('Đang phân tích cấu trúc trang...');
        return window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      })
      .then(
        (pdfDoc: any) => {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setLoading(false);
        },
        (err: any) => {
          console.error('Error decoding PDF:', err);
          setRenderError('Không thể giải mã file PDF. Hãy đảm bảo file PDF hợp lệ.');
          setLoading(false);
        },
      )
      .catch(err => {
        console.error('Error loading PDF:', err);
        setRenderError('Không thể nạp file PDF từ máy chủ. Vui lòng kiểm tra kết nối.');
        setLoading(false);
      });
  }, [pdfLibLoaded, pdfUrl]);

  // ── Render page with High-DPI / Retina Scaling & Full-Width Container Scale ───────────
  const renderPage = useCallback((num: number) => {
    if (!pdf) return;
    
    // Hủy render task trước đó nếu chưa xong
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    pdf.getPage(num).then(
      (page: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        // Tính toán Retina / Device Pixel Ratio scaling (iPhone 12 Pro Max DPR = 3)
        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        const outputScale = Math.max(dpr, 2); // Tối thiểu 2x để chữ và hình ảnh nét căng

        const parentElem = containerRef.current || canvas.parentElement;
        const containerWidth = parentElem?.clientWidth || 380;
        
        // Trên màn hình di động (< 640px), không trừ bớt margin lề để tận dụng 100% chiều rộng khung hiển thị
        const isMobileScreen = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
        const effectiveContainerWidth = isMobileScreen ? containerWidth : Math.max(containerWidth - 24, 300);
        
        const unscaledViewport = page.getViewport({ scale: 1 });
        
        // Tỷ lệ vừa 100% chiều rộng container hiển thị
        const fitScale = effectiveContainerWidth / unscaledViewport.width;
        const baseScale = fitScale > 0 ? fitScale : 1;
        const currentZoom = baseScale * (zoomLevel / 100);

        // Viewport chuẩn cho hiển thị CSS và Viewport cao cấp cho Canvas Buffer
        const displayViewport = page.getViewport({ scale: currentZoom });
        const renderViewport = page.getViewport({ scale: currentZoom * outputScale });

        // Đặt kích thước thực của Canvas Buffer (sắc nét cao)
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);

        // Đặt kích thước hiển thị CSS
        canvas.style.width = `${Math.floor(displayViewport.width)}px`;
        canvas.style.height = `${Math.floor(displayViewport.height)}px`;

        const renderContext = {
          canvasContext: context,
          viewport: renderViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        renderTask.promise.catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error('Page render error:', err);
          }
        });
      },
      (err: any) => {
        console.error('Get page error:', err);
        setRenderError('Lỗi khi tải dữ liệu trang tài liệu.');
      },
    );
  }, [pdf, zoomLevel]);

  useEffect(() => { if (pdf) renderPage(pageNum); }, [pdf, pageNum, zoomLevel, renderPage]);

  useEffect(() => {
    const handleResize = () => { if (pdf) renderPage(pageNum); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdf, pageNum, renderPage]);

  // ── Navigation & Zoom handlers ───────────────────────────────────────────
  const handlePrevPage = useCallback(() => {
    if (pageNum > 1) {
      setPageNum(p => p - 1);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pageNum]);

  const handleNextPage = useCallback(() => {
    if (pageNum < numPages) {
      setPageNum(p => p + 1);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pageNum, numPages]);

  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 25, 250));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 25, 75));
  const handleZoomReset = () => setZoomLevel(100);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); handlePrevPage(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); handleNextPage(); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoomIn(); }
      if (e.key === '-') { e.preventDefault(); handleZoomOut(); }
      if (e.key === '0') { e.preventDefault(); handleZoomReset(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setIsFullscreen(f => !f); }
      if ((e.key === 'Enter' || e.key === 'c') && isLastPage && !isFinished) { onSubmit(); }
      if (e.key === 'Escape' && isFullscreen) { setIsFullscreen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrevPage, handleNextPage, isLastPage, isFinished, onSubmit, isFullscreen]);

  // Show keyboard hint briefly on mount (desktop only)
  useEffect(() => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (!isMobile) { setShowKeyHint(true); setTimeout(() => setShowKeyHint(false), 3500); }
  }, []);

  // ── Touch & Double-Tap Gestures ──────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const touchEndRef = e.changedTouches[0];
    const dx = touchEndRef.clientX - touchStartX.current;
    const dy = touchEndRef.clientY - touchStartY.current;

    // Detect Double Tap to toggle Zoom (100% <-> 150%)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (now - lastTapTimeRef.current < 300) {
        setZoomLevel(z => (z === 100 ? 150 : 100));
      }
      lastTapTimeRef.current = now;
      return;
    }

    // Horizontal Swipe (Next / Prev Page)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
      if (dx < 0) handleNextPage(); // swipe left → next
      else handlePrevPage();         // swipe right → prev
    }
  };

  const linkedAssignment = linkedAssignmentId ? getAssignment(linkedAssignmentId) : null;
  const progress = numPages > 0 ? (pageNum / numPages) * 100 : 0;

  return (
    <div className={`relative box-border max-w-full ${isFullscreen ? 'fixed inset-0 top-0 bottom-0 left-0 right-0 z-50 bg-slate-950 flex flex-col h-[100dvh] w-full max-w-full overflow-hidden' : 'grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pb-28 lg:pb-0'}`}>

      {/* ─── Keyboard Shortcut Hint (desktop toast) ───────────────────── */}
      {!isFullscreen && (
        <div className={`hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 items-center gap-2 px-4 py-2.5 rounded-full glass-strong border border-white/10 shadow-xl text-xs font-medium text-muted-foreground transition-all duration-500 ${showKeyHint ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <Keyboard className="h-3.5 w-3.5 text-fuchsia-400" />
          <span>Phím tắt:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">←/→</kbd>
          <span>trang</span>
          <span className="text-white/20">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">+/-</kbd>
          <span>zoom</span>
          <span className="text-white/20">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold">F</kbd>
          <span>toàn màn hình</span>
        </div>
      )}

      {/* ─── PDF View Panel ─────────────────────────────────────────────── */}
      <div className={`${isFullscreen ? 'flex-1 flex flex-col h-full w-full max-w-full overflow-hidden' : 'lg:col-span-3 space-y-3 w-full max-w-full'}`}>
        
        {/* Header Bar with Drive Link, Zoom & View Controls */}
        <div className={`glass border border-white/10 px-2.5 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-lg w-full box-border ${isFullscreen ? 'rounded-none border-x-0 border-t-0 bg-slate-900/90 shrink-0' : 'rounded-2xl'}`}>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <FilePdf className="h-4 w-4 text-fuchsia-400 shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate max-w-[110px] sm:max-w-xs" title={assignment.title}>
              {assignment.title}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Direct Google Drive Link for Students - ALWAYS VISIBLE */}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Mở tài liệu PDF gốc trên Google Drive"
                className="flex items-center gap-1 px-2 py-1 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 text-sky-300 transition-all text-[11px] font-bold shrink-0 shadow-sm"
              >
                <ExternalLink className="h-3 w-3 text-sky-400" />
                <span>Drive</span>
              </a>
            )}

            {/* Page navigation indicator */}
            {!loading && !renderError && numPages > 0 && (
              <div className="flex items-center gap-0.5 sm:gap-2 bg-slate-800/60 px-1.5 sm:px-2 py-1 rounded-xl border border-white/5">
                <button
                  onClick={handlePrevPage} disabled={pageNum === 1}
                  title="Trang trước (←)"
                  className="p-0.5 sm:p-1 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all active:scale-95"
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <span className="text-[11px] sm:text-xs font-semibold tabular-nums">
                  <span className="text-fuchsia-400 font-bold">{pageNum}</span>
                  <span className="text-white/30 mx-0.5">/</span>
                  {numPages}
                </span>
                <button
                  onClick={handleNextPage} disabled={pageNum === numPages}
                  title="Trang sau (→)"
                  className="p-0.5 sm:p-1 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all active:scale-95"
                >
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {!loading && !renderError && (
              <div className="hidden xs:flex items-center gap-0.5 sm:gap-1 bg-slate-800/60 p-0.5 rounded-xl border border-white/5">
                <button
                  onClick={handleZoomOut} disabled={zoomLevel <= 75}
                  title="Thu nhỏ (-)"
                  className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all active:scale-95"
                >
                  <ZoomOut className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
                
                <button
                  onClick={handleZoomReset}
                  title="Vừa màn hình (0)"
                  className="px-1 py-0.5 text-[10px] sm:text-[11px] font-bold text-fuchsia-300 hover:bg-white/10 rounded-md transition-colors tabular-nums"
                >
                  {zoomLevel}%
                </button>

                <button
                  onClick={handleZoomIn} disabled={zoomLevel >= 250}
                  title="Phóng to (+)"
                  className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all active:scale-95"
                >
                  <ZoomIn className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? "Thu nhỏ giao diện (Esc)" : "Chế độ đọc toàn màn hình (F)"}
              className={`p-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1 text-[11px] font-semibold ${isFullscreen ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-lg' : 'border-white/10 bg-slate-800/60 hover:bg-slate-800 text-muted-foreground hover:text-foreground'}`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Toàn màn hình</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Top Progress bar */}
        {!isFullscreen && (
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-fuchsia-600 via-violet-500 to-sky-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Canvas Scroll Area - EXPANDED LARGE FRAME FOR MOBILE */}
        <div
          ref={containerRef}
          className={`glass border border-white/5 bg-slate-950/60 relative overflow-auto flex justify-center items-start transition-all box-border w-full max-w-full ${
            isFullscreen
              ? 'flex-1 w-full rounded-none border-none p-1 sm:p-4 min-h-0'
              : 'rounded-2xl sm:rounded-3xl p-1 sm:p-4 min-h-[72vh] lg:min-h-[680px] max-h-[88vh]'
          }`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 rounded-3xl z-20 space-y-3 p-6 text-center">
              <RefreshCw className="h-8 w-8 text-fuchsia-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-fuchsia-300">{loadingMsg}</p>
                <p className="text-[11px] text-muted-foreground">Tài liệu đang được tối ưu nét chuẩn Retina...</p>
              </div>
            </div>
          )}

          {renderError && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4 my-auto">
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
                  <ExternalLink className="h-4 w-4" /> Mở Trực Tiếp Trên Drive
                </a>
              )}
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`shadow-2xl rounded-xl transition-transform duration-150 origin-top max-w-full box-border ${loading || renderError ? 'hidden' : 'block'}`}
          />
        </div>

        {/* Mobile Swipe / Double Tap Tip */}
        {!loading && !renderError && numPages > 1 && showMobileSwipeTip && !isFullscreen && (
          <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20">
            <div className="flex items-center gap-2 text-[11px] text-fuchsia-300 font-medium">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
              <span>Vuốt <strong>trái/phải</strong> chuyển trang · Chạm <strong>đúp 2 lần</strong> để phóng to</span>
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

      {/* ─── Desktop Side Action Panel (1/4) ─────────────────────────── */}
      {!isFullscreen && (
        <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-4 z-30 space-y-4 self-start">
          {/* Status Box */}
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

          {/* Action Box */}
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
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-900/30"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSubmitting ? 'Đang gửi...' : 'Hoàn Thành Bài Học'}
                  </button>
                ) : (
                  <button
                    onClick={handleNextPage} disabled={numPages === 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-fuchsia-600 text-white font-semibold text-sm hover:bg-fuchsia-500 disabled:opacity-40 transition-all shadow-lg shadow-fuchsia-900/30"
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
      )}

      {/* ─── Mobile: Fixed Bottom Navigation Bar ─────────────────────── */}
      <div className={`${isFullscreen ? 'relative z-50 shrink-0 w-full max-w-full' : 'lg:hidden fixed bottom-0 left-0 right-0 z-50 w-full max-w-full'}`}>
        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-3 sm:px-4 pt-3 pb-3 w-full box-border" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>

          {/* Page progress on mobile */}
          {!loading && !renderError && numPages > 0 && !isFullscreen && (
            <div className="mb-2.5 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40 font-medium">Tiến trình đọc</span>
                <span className="font-bold text-fuchsia-300">{pageNum} / {numPages} trang</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-fuchsia-500 to-violet-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isFinished ? (
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full">
              {/* Prev */}
              <button
                onClick={handlePrevPage}
                disabled={pageNum <= 1 || numPages === 0}
                className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border border-white/10 bg-slate-800/80 active:bg-slate-700 disabled:opacity-25 transition-all touch-manipulation select-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-[10px] font-semibold">Trang trước</span>
              </button>

              {/* Primary action: Next or Complete */}
              {isLastPage ? (
                <button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold active:bg-emerald-500 disabled:opacity-50 transition-all touch-manipulation select-none shadow-lg shadow-emerald-900/40"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-bold">{isSubmitting ? 'Gửi...' : 'Hoàn Thành'}</span>
                </button>
              ) : (
                <button
                  onClick={handleNextPage}
                  disabled={numPages === 0 || isLastPage}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-fuchsia-600 text-white font-bold active:bg-fuchsia-500 disabled:opacity-40 transition-all touch-manipulation select-none shadow-lg shadow-fuchsia-900/40"
                >
                  <span className="text-xs font-bold">Trang tiếp theo</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {/* Fullscreen or Exit */}
              <button
                onClick={() => setIsFullscreen(f => !f)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border transition-all touch-manipulation select-none ${isFullscreen ? 'bg-fuchsia-600/30 border-fuchsia-500/50 text-fuchsia-300' : 'border-white/10 bg-slate-800/80 active:bg-slate-700'}`}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4 text-fuchsia-300" /> : <Maximize2 className="h-4 w-4 text-white/70" />}
                <span className="text-[10px] font-semibold">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn'}</span>
              </button>
            </div>
          ) : (
            // Finished state on mobile
            <div className="space-y-2 w-full">
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <CheckCircle2 className="h-4 w-4" />
                Đã hoàn thành bài học!
              </div>
              {linkedAssignment ? (
                <button
                  onClick={() => router.push(`/student/assignments/${linkedAssignment.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-fuchsia-600 text-white font-bold text-xs active:bg-fuchsia-500 transition-all shadow-lg touch-manipulation select-none"
                >
                  Bắt đầu bài trắc nghiệm <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => router.push('/student/assignments')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-xs font-semibold active:bg-slate-700 transition-all touch-manipulation select-none"
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
