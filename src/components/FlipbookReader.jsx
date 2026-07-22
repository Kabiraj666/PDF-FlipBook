import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import Toolbar from "./Toolbar.jsx";
import SidePanel from "./SidePanel.jsx";
import { renderPageToDataUrl, searchInDocument } from "../utils/pdfEngine.js";

function playFlipSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.16; // 0.16s
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.14);
    filter.Q.setValueAtTime(4, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  } catch (err) {
    // blocked or unsupported
  }
}

const Page = React.memo(React.forwardRef(({ initialSrc, pageNum, onDoubleClick }, ref) => {
  const isCover = pageNum === 1;
  return (
    <div 
      ref={ref} 
      className={`page w-full h-full relative cursor-zoom-in overflow-hidden ${isCover ? "bg-void-900 border-l border-void-950 shadow-2xl rounded-r-lg" : "bg-paper"}`} 
      onDoubleClick={onDoubleClick}
    >
      {isCover && (
        <div className="absolute inset-0 bg-gradient-to-br from-void-800 via-void-900 to-void-950 opacity-90 pointer-events-none z-0">
          <div className="absolute inset-3 border border-brass-500/20 rounded-md pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-0 w-3 bg-gradient-to-r from-black/50 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Loading Spinner Element */}
      <div 
        id={`page-spinner-${pageNum}`}
        className="absolute inset-0 flex flex-col items-center justify-center text-void-400 font-sans p-4 relative z-10"
        style={{ display: initialSrc ? 'none' : 'flex' }}
      >
        <div className="animate-spin h-8 w-8 border-4 border-brass-400 border-t-transparent rounded-full mb-3"></div>
        <span className="text-xs uppercase tracking-wider font-semibold opacity-75">Loading Page {pageNum}</span>
      </div>

      {/* Image Canvas Element */}
      <img 
        id={`page-img-${pageNum}`}
        src={initialSrc || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} 
        className={`page-canvas w-full h-full select-none pointer-events-none relative z-10 
          ${isCover ? "object-contain p-6 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" : "object-contain p-2.5"}`} 
        style={{ display: initialSrc ? 'block' : 'none' }}
        draggable={false} 
        alt="" 
      />
    </div>
  );
}));

export default function FlipbookReader({
  fileName,
  pdfDoc,
  pages,
  toc,
  bookmarks,
  onToggleBookmark,
  lastPage,
  onPageChange,
  onExit
}) {
  const bookRef = useRef(null);
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(lastPage || 1);
  const [isFlipping, setIsFlipping] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("leaflet:sound") !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("leaflet:sound", String(soundEnabled));
    } catch {}
  }, [soundEnabled]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [zoomState, setZoomState] = useState(null); // { pageNum, dataUrl }
  const [zoomScale, setZoomScale] = useState(2.5); // 1.0x to 10.0x scale (100% to 1000%)
  const [isZoomRendering, setIsZoomRendering] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [searchResults, setSearchResults] = useState(null);
  const [dims, setDims] = useState(null);
  const activePagesRef = useRef(pages);

  // Directly sets the image src and hides spinner in the DOM to avoid re-renders
  const updatePageInDom = (pageNum, rendered) => {
    activePagesRef.current[pageNum - 1] = rendered;

    const imgEl = document.getElementById(`page-img-${pageNum}`);
    const spinnerEl = document.getElementById(`page-spinner-${pageNum}`);

    if (imgEl && rendered?.dataUrl) {
      imgEl.src = rendered.dataUrl;
      imgEl.style.display = "block";
    }
    if (spinnerEl) {
      spinnerEl.style.display = "none";
    }
  };

  const renderingQueueRef = useRef(new Set());

  // High-priority viewport pre-rendering (renders pages immediately around the current page)
  useEffect(() => {
    if (!pdfDoc) return;

    const numPages = pages.length;
    const windowStart = Math.max(1, currentPage - 4);
    const windowEnd = Math.min(numPages, currentPage + 4);

    // Load pages within the window
    for (let pageNum = windowStart; pageNum <= windowEnd; pageNum++) {
      const isRendered = activePagesRef.current[pageNum - 1] !== null;
      const isRendering = renderingQueueRef.current.has(pageNum);

      if (!isRendered && !isRendering) {
        renderingQueueRef.current.add(pageNum);
        renderPageToDataUrl(pdfDoc, pageNum, 1.4)
          .then((rendered) => {
            updatePageInDom(pageNum, rendered);
          })
          .catch((err) => console.error(`Failed to render page ${pageNum}:`, err))
          .finally(() => {
            renderingQueueRef.current.delete(pageNum);
          });
      }
    }
  }, [currentPage, pdfDoc, pages.length]);

  // Low-priority background pre-rendering (sequentially loads the entire book)
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;
    let timerId = null;

    async function runBackgroundRendering() {
      const numPages = pages.length;
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (isCancelled) break;

        const isRendered = activePagesRef.current[pageNum - 1] !== null;
        const isRendering = renderingQueueRef.current.has(pageNum);

        if (!isRendered && !isRendering) {
          try {
            renderingQueueRef.current.add(pageNum);
            const rendered = await renderPageToDataUrl(pdfDoc, pageNum, 1.4);
            if (isCancelled) {
              renderingQueueRef.current.delete(pageNum);
              break;
            }

            updatePageInDom(pageNum, rendered);
            renderingQueueRef.current.delete(pageNum);

            // 60ms delay to keep the browser responsive
            await new Promise((resolve) => setTimeout(resolve, 60));
          } catch (err) {
            console.error(`Background render failed for page ${pageNum}:`, err);
            renderingQueueRef.current.delete(pageNum);
          }
        }
      }
    }

    // Start background rendering after a 1.5 second delay
    timerId = setTimeout(() => {
      runBackgroundRendering();
    }, 1500);

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
    };
  }, [pdfDoc, pages.length]);

  const aspect = pages[0] ? pages[0].width / pages[0].height : 0.72;

  useEffect(() => {
    function computeDims() {
      const el = containerRef.current;
      if (!el) return;
      const availW = el.clientWidth - 32;
      const availH = el.clientHeight - 32;
      let h = availH;
      let w = h * aspect;
      if (w > availW / 2) {
        w = availW / 2;
        h = w / aspect;
      }
      setDims({ width: Math.max(220, w), height: Math.max(300, h) });
    }
    computeDims();
    window.addEventListener("resize", computeDims);
    return () => window.removeEventListener("resize", computeDims);
  }, [aspect]);

  const flippedOnMount = useRef(false);
  useEffect(() => {
    if (dims && bookRef.current && lastPage > 1 && !flippedOnMount.current) {
      try {
        const pageFlip = bookRef.current.pageFlip();
        if (pageFlip) {
          flippedOnMount.current = true;
          pageFlip.flip(lastPage - 1, "top");
        }
      } catch (err) {
        console.warn("Failed to flip on mount:", err);
      }
    }
  }, [dims, lastPage]);

  const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  const isBookmarked = useMemo(
    () => safeBookmarks.some((b) => b.page === currentPage),
    [safeBookmarks, currentPage]
  );

  function jumpTo(pageNumber) {
    // StPageFlip doesn't queue/cancel overlapping flip() calls cleanly -
    // calling flip() again before the current animation finishes leaves
    // the mid-flip page frozen in a skewed, half-turned state. Ignore
    // the request rather than corrupt the current animation.
    if (isFlipping) return;
    bookRef.current?.pageFlip().flip(pageNumber - 1);
    setPanelOpen(false);
  }

  function handleFlip(e) {
    console.log("EVENT: handleFlip", e.data);
    const p = e.data + 1;
    setCurrentPage(p);
    onPageChange(p);
    if (soundEnabled) {
      playFlipSound();
    }
  }

  function handleChangeState(e) {
    console.log("EVENT: handleChangeState", e.data);
    // States: "user_fold" | "fold_corner" | "flipping" | "read"
    // Anything other than "read" means the book is mid-turn, so we hold
    // off on issuing another programmatic flip() until it settles.
    setIsFlipping(e.data !== "read");
  }

  const handlePanStart = (clientX, clientY) => {
    setIsPanning(true);
    panStartRef.current = {
      x: clientX - panOffset.x,
      y: clientY - panOffset.y
    };
  };

  const handlePanMove = (clientX, clientY) => {
    if (!isPanning) return;
    const newX = clientX - panStartRef.current.x;
    const newY = clientY - panStartRef.current.y;
    setPanOffset({ x: newX, y: newY });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  async function handleZoom(pageNumber, initialScale = 2.5) {
    const targetPage = pageNumber || currentPage;
    setIsZoomRendering(true);
    setPanOffset({ x: 0, y: 0 });
    try {
      const { dataUrl } = await renderPageToDataUrl(pdfDoc, targetPage, 1.4 * initialScale, false);
      setZoomScale(initialScale);
      setZoomState({ pageNum: targetPage, dataUrl });
    } catch (err) {
      console.error("Failed to render zoom view:", err);
    } finally {
      setIsZoomRendering(false);
    }
  }

  async function handleZoomScaleChange(newScale) {
    if (!zoomState?.pageNum || !pdfDoc) return;
    setZoomScale(newScale);
    setIsZoomRendering(true);
    try {
      const { dataUrl } = await renderPageToDataUrl(pdfDoc, zoomState.pageNum, 1.4 * newScale, false);
      setZoomState((prev) => (prev ? { ...prev, dataUrl } : null));
    } catch (err) {
      console.error("Zoom scale re-render error:", err);
    } finally {
      setIsZoomRendering(false);
    }
  }

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  async function handleSearch(query) {
    setSearchResults("searching");
    setPanelOpen(true);
    setTimeout(async () => {
      const results = await searchInDocument(pdfDoc, query);
      setSearchResults(results);
    }, 50);
  }

  const totalBookPages = pages.length + (pages.length % 2 === 1 ? 1 : 0);

  const bookChildren = useMemo(() => {
    const list = pages.map((p, i) => (
      <Page 
        key={`pdf-page-${i}`} 
        initialSrc={p ? p.dataUrl : null} 
        pageNum={i + 1} 
        onDoubleClick={() => handleZoom(i + 1)}
      />
    ));
    if (pages.length % 2 === 1) {
      list.push(<Page key="pdf-page-blank" initialSrc={null} pageNum={pages.length + 1} />);
    }
    return list;
  }, [pdfDoc, pages.length]);

  const progressPct = Math.round((currentPage / totalBookPages) * 100);

  const isPortrait = dims ? (dims.width * 2 > (containerRef.current?.clientWidth || 9999)) : false;
  const MAX_THICKNESS = 16;
  const leftThicknessWidth = pages.length > 1 ? Math.max(1, Math.round((currentPage / pages.length) * MAX_THICKNESS)) : 0;
  const rightThicknessWidth = pages.length > 1 ? Math.max(1, Math.round(((pages.length - currentPage) / pages.length) * MAX_THICKNESS)) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-void-950">
      <Toolbar
        title={fileName}
        currentPage={currentPage}
        totalPages={totalBookPages}
        onJumpTo={jumpTo}
        isBookmarked={isBookmarked}
        onToggleBookmark={() => onToggleBookmark(currentPage)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        onZoom={handleZoom}
        onFullscreen={handleFullscreen}
        onToggleToc={() => {
          setSearchResults(null);
          setPanelOpen(true);
        }}
        onSearch={handleSearch}
        onOpenLibraryScreen={onExit}
      />

      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden px-4 py-4 relative group">
        {/* Left Floating Arrow Button (Previous Page) */}
        {currentPage > 1 && (
          <button
            onClick={() => { if (!isFlipping) bookRef.current?.pageFlip().flipPrev(); }}
            disabled={isFlipping}
            className="absolute left-6 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-void-900/60 hover:bg-void-800 border border-brass-400/25 hover:border-brass-400 text-paper hover:text-brass-300 transition-all duration-200 shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed md:opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Previous Page"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}

        {/* Right Floating Arrow Button (Next Page) */}
        {currentPage < totalBookPages && (
          <button
            onClick={() => { if (!isFlipping) bookRef.current?.pageFlip().flipNext(); }}
            disabled={isFlipping}
            className="absolute right-6 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-void-900/60 hover:bg-void-800 border border-brass-400/25 hover:border-brass-400 text-paper hover:text-brass-300 transition-all duration-200 shadow-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed md:opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Next Page"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}

        {dims ? (
          <div 
            className="relative transition-transform duration-500 ease-in-out rounded-2xl bg-gradient-to-b from-[#161D32] via-[#0F1424] to-[#0A0D18] border-2 border-brass-400/35 p-[24px_12px] shadow-[0_35px_80px_-10px_rgba(0,0,0,0.95),0_15px_30px_rgba(0,0,0,0.8),inset_0_0_35px_rgba(0,0,0,0.85)]" 
            style={{ 
              width: dims.width * (isPortrait ? 1 : 2) + 24, 
              height: dims.height + 48,
              transform: (!isPortrait && currentPage === 1) 
                ? 'translateX(-25%)' 
                : (!isPortrait && currentPage === totalBookPages && totalBookPages % 2 === 0) 
                  ? 'translateX(25%)' 
                  : 'translateX(0)'
            }}
          >
            {/* Hardcover Inner Gold Embossed Filigree Border */}
            <div className="absolute inset-1.5 border border-brass-400/20 rounded-xl pointer-events-none z-0" />
            <div className="absolute inset-2 border border-brass-500/10 rounded-lg pointer-events-none z-0" />

            {/* 3D Brass Metallic Corner Guards */}
            <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-brass-400/60 rounded-tl-sm pointer-events-none z-10" />
            <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-brass-400/60 rounded-tr-sm pointer-events-none z-10" />
            <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-brass-400/60 rounded-bl-sm pointer-events-none z-10" />
            <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-brass-400/60 rounded-br-sm pointer-events-none z-10" />

            {/* Page-Specific Floating Zoom Pill Buttons */}
            {isPortrait || currentPage === 1 ? (
              <button
                onClick={() => handleZoom(currentPage)}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-void-950/90 backdrop-blur-md border border-brass-400/40 text-beam-300 hover:text-paper hover:bg-brass-400/20 text-xs font-mono font-semibold shadow-2xl transition-all cursor-pointer opacity-85 hover:opacity-100 whitespace-nowrap"
                title={`Zoom Page ${currentPage} (HD 360° Pan)`}
              >
                🔍 Zoom Page {currentPage}
              </button>
            ) : (
              <>
                {/* Left Page Specific Zoom Button */}
                <button
                  onClick={() => handleZoom(currentPage)}
                  className="absolute top-3 z-30 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-void-950/90 backdrop-blur-md border border-brass-400/40 text-beam-300 hover:text-paper hover:bg-brass-400/20 text-[10px] sm:text-xs font-mono font-semibold shadow-2xl transition-all cursor-pointer opacity-85 hover:opacity-100 whitespace-nowrap"
                  style={{ left: `${12 + dims.width / 2}px`, transform: 'translateX(-50%)' }}
                  title={`Zoom Left Page ${currentPage} (HD 360° Pan)`}
                >
                  🔍 Page {currentPage}
                </button>

                {/* Right Page Specific Zoom Button */}
                {currentPage + 1 <= totalBookPages && (
                  <button
                    onClick={() => handleZoom(currentPage + 1)}
                    className="absolute top-3 z-30 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-void-950/90 backdrop-blur-md border border-brass-400/40 text-beam-300 hover:text-paper hover:bg-brass-400/20 text-[10px] sm:text-xs font-mono font-semibold shadow-2xl transition-all cursor-pointer opacity-85 hover:opacity-100 whitespace-nowrap"
                    style={{ left: `${12 + dims.width + dims.width / 2}px`, transform: 'translateX(-50%)' }}
                    title={`Zoom Right Page ${currentPage + 1} (HD 360° Pan)`}
                  >
                    🔍 Page {currentPage + 1}
                  </button>
                )}
              </>
            )}

            {/* Left 3D paper stack thickness & page ridge simulation */}
            {!isPortrait && (
              <div 
                className="absolute border-y border-void-600/30 origin-right transition-all duration-300 pointer-events-none rounded-l bg-paper-dim"
                style={{
                  top: '24px',
                  bottom: '24px',
                  left: 12 - leftThicknessWidth,
                  width: leftThicknessWidth,
                  boxShadow: `-${Math.max(2, leftThicknessWidth / 2)}px 4px 15px rgba(0,0,0,0.6)`,
                  backgroundImage: 'repeating-linear-gradient(90deg, #F5F0E1 0px, #F5F0E1 1px, #E5DDC8 1px, #E5DDC8 2px)',
                  zIndex: 10
                }}
              />
            )}

            {/* Right 3D paper stack thickness & page ridge simulation */}
            {!isPortrait && (
              <div 
                className="absolute border-y border-void-600/30 origin-left transition-all duration-300 pointer-events-none rounded-r bg-paper-dim"
                style={{
                  top: '24px',
                  bottom: '24px',
                  right: 12 - rightThicknessWidth,
                  width: rightThicknessWidth,
                  boxShadow: `${Math.max(2, rightThicknessWidth / 2)}px 4px 15px rgba(0,0,0,0.6)`,
                  backgroundImage: 'repeating-linear-gradient(90deg, #F5F0E1 0px, #F5F0E1 1px, #E5DDC8 1px, #E5DDC8 2px)',
                  zIndex: 10
                }}
              />
            )}

            <HTMLFlipBook
              ref={bookRef}
              width={dims.width}
              height={dims.height}
              size="stretch"
              minWidth={100}
              maxWidth={3000}
              minHeight={100}
              maxHeight={3000}
              usePortrait={isPortrait}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={handleFlip}
              onChangeState={handleChangeState}
              className="shadow-book-inner relative z-20"
              style={{ overflow: 'hidden' }}
              flippingTime={700}
              useMouseEvents={true}
              clickEventForward={true}
              showPageCorners={true}
            >
              {bookChildren}
            </HTMLFlipBook>

            {/* Realistic 3D central spine fold shadow - only in two-page spread (not portrait) */}
            {!isPortrait && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '24px',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '40px',
                  background: 'linear-gradient(to right, rgba(0, 0, 0, 0.03) 0%, rgba(0, 0, 0, 0.18) 35%, rgba(0, 0, 0, 0.30) 50%, rgba(0, 0, 0, 0.18) 65%, rgba(0, 0, 0, 0.03) 100%)',
                  zIndex: 30
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-void-200/60 py-10">
            <div className="animate-spin h-8 w-8 border-4 border-brass-400 border-t-transparent rounded-full mb-3"></div>
            <span className="text-xs uppercase tracking-wider font-semibold opacity-75 font-sans">Initializing Book View...</span>
          </div>
        )}
      </div>

      {/* progress bar */}
      <div className="h-1 bg-void-700/60">
        <div className="h-full bg-beam-400 shadow-glow transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        toc={toc}
        bookmarks={safeBookmarks}
        searchResults={searchResults}
        onJumpTo={jumpTo}
      />

      {zoomState && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setZoomState(null)}
        >
          {/* Top HD Zoom Control Bar */}
          <div 
            className="w-full max-w-4xl glass-strong rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 text-paper border border-brass-400/35 shadow-2xl relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-brass-300 font-semibold shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" />
              </svg>
              <span className="whitespace-nowrap">Page {zoomState.pageNum} HD Zoom</span>
              {isZoomRendering && (
                <div className="animate-spin h-3.5 w-3.5 border-2 border-brass-400 border-t-transparent rounded-full ml-1" title="Rendering vector sharpness..." />
              )}
            </div>

            {/* Sharpness Range Slider Bar */}
            <div className="flex items-center gap-2.5 flex-1 max-w-md mx-2">
              <span className="font-mono text-[10px] text-void-200/60 shrink-0">1x</span>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                value={zoomScale}
                onChange={(e) => handleZoomScaleChange(parseFloat(e.target.value))}
                className="w-full accent-brass-400 cursor-pointer"
              />
              <span className="font-mono text-xs text-brass-300 font-bold shrink-0 w-14 text-right">
                {Math.round(zoomScale * 100)}%
              </span>
            </div>

            {/* Quick Zoom Presets & Center Reset */}
            <div className="hidden sm:flex items-center gap-1 shrink-0 font-mono text-[10px]">
              {[1.0, 2.5, 5.0, 10.0].map((sc) => (
                <button
                  key={sc}
                  onClick={() => handleZoomScaleChange(sc)}
                  className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                    zoomScale === sc 
                      ? "bg-brass-400 text-void-950 font-bold border-brass-400" 
                      : "bg-void-900/60 border-void-700 text-void-200 hover:text-brass-300"
                  }`}
                >
                  {Math.round(sc * 100)}%
                </button>
              ))}
              <button
                onClick={() => setPanOffset({ x: 0, y: 0 })}
                className="px-2 py-1 rounded border bg-void-900/60 border-void-700 text-brass-300 hover:bg-brass-400/20 transition-colors cursor-pointer ml-1"
                title="Reset pan position to center"
              >
                🎯 Center
              </button>
            </div>

            {/* Close Button */}
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-void-900/80 hover:bg-void-800 border border-brass-400/30 text-paper hover:text-brass-300 transition-colors cursor-pointer shrink-0 ml-1"
              onClick={() => setZoomState(null)}
              title="Close HD Zoom Viewer"
            >
              ✕
            </button>
          </div>

          {/* Main 360-Degree Panning Viewport (Slide page left, right, up, down in any angle) */}
          <div 
            className={`flex-1 w-full max-w-6xl overflow-hidden my-2 p-2 rounded-xl flex items-center justify-center relative select-none ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => handlePanStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) handlePanStart(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) handlePanMove(t.clientX, t.clientY);
            }}
            onTouchEnd={handlePanEnd}
          >
            {zoomState.dataUrl ? (
              <img 
                src={zoomState.dataUrl} 
                alt={`HD Zoomed Page ${zoomState.pageNum}`} 
                className="max-w-none h-auto object-contain rounded-lg shadow-2xl transition-transform duration-75 pointer-events-none"
                style={{
                  width: `${100 * (zoomScale > 1 ? zoomScale : 1)}%`,
                  maxHeight: 'none',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-void-200/60 font-sans py-12">
                <div className="animate-spin h-8 w-8 border-4 border-brass-400 border-t-transparent rounded-full mb-3"></div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-75">Rendering Razor-Sharp Vector Zoom...</span>
              </div>
            )}
          </div>

          {/* Bottom Hint */}
          <p className="font-mono text-[9px] text-brass-300/60 tracking-widest uppercase pointer-events-none shrink-0">
            🖐 Drag with mouse or swipe with touch to slide page in any direction (360° Angle) • Range slider up to 1000%
          </p>
        </div>
      )}
    </div>
  );
}
