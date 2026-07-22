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
        className={`page-canvas w-full h-full select-none pointer-events-none transition-opacity duration-300 relative z-10 
          ${isCover ? "object-contain p-6 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" : "object-contain"}`} 
        style={{ display: initialSrc ? 'block' : 'none' }}
        draggable={false} 
        alt="" 
      />

      {/* Paper-fiber texture + soft curl-side shading so the page reads as physical paper while it turns */}
      <div className="absolute inset-0 pointer-events-none z-20 page-shading" />
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
  const [zoomSrc, setZoomSrc] = useState(null);
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

  async function handleZoom(pageNumber) {
    const targetPage = pageNumber || currentPage;
    const { dataUrl } = await renderPageToDataUrl(pdfDoc, targetPage, 2.2, false);
    setZoomSrc(dataUrl);
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
            className="relative overflow-hidden transition-transform duration-500 ease-in-out rounded-2xl bg-void-900 border border-brass-600/30 p-[24px_12px] shadow-[0_30px_70px_rgba(0,0,0,0.9),inset_0_0_40px_rgba(0,0,0,0.7)]" 
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
            {/* Hardcover Inner Gold Border */}
            <div className="absolute inset-1 border border-brass-500/10 rounded-xl pointer-events-none z-0" />

            {/* Left 3D page stack thickness */}
            {!isPortrait && (
              <div 
                className="absolute border-y border-void-600/20 origin-right transition-all duration-300 pointer-events-none rounded-l bg-paper-dim"
                style={{
                  top: '24px',
                  bottom: '24px',
                  left: 12 - leftThicknessWidth,
                  width: leftThicknessWidth,
                  boxShadow: `-${Math.max(1, leftThicknessWidth / 2)}px 4px 12px rgba(0,0,0,0.45)`,
                  backgroundImage: 'linear-gradient(to bottom, transparent 90%, rgba(0,0,0,0.06) 90%)',
                  backgroundSize: '100% 2px',
                  zIndex: 10
                }}
              />
            )}

            {/* Right 3D page stack thickness */}
            {!isPortrait && (
              <div 
                className="absolute border-y border-void-600/20 origin-left transition-all duration-300 pointer-events-none rounded-r bg-paper-dim"
                style={{
                  top: '24px',
                  bottom: '24px',
                  right: 12 - rightThicknessWidth,
                  width: rightThicknessWidth,
                  boxShadow: `${Math.max(1, rightThicknessWidth / 2)}px 4px 12px rgba(0,0,0,0.45)`,
                  backgroundImage: 'linear-gradient(to bottom, transparent 90%, rgba(0,0,0,0.06) 90%)',
                  backgroundSize: '100% 2px',
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
              style={{ overflow: 'visible' }}
              flippingTime={650}
              maxShadowOpacity={0.6}
              disableFlipByClick={true}
            >
              {bookChildren}
            </HTMLFlipBook>

            {/* Central spine fold shadow - only in two-page spread (not portrait) */}
            {!isPortrait && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '24px',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '36px',
                  background: 'linear-gradient(to right, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.16) 40%, rgba(0, 0, 0, 0.20) 50%, rgba(0, 0, 0, 0.16) 60%, rgba(0, 0, 0, 0.05) 100%)',
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

      {zoomSrc && (
        <div
          className="fixed inset-0 z-40 bg-black/95 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomSrc(null)}
        >
          <button 
            className="absolute top-4 right-4 text-paper/80 hover:text-brass-300 w-10 h-10 flex items-center justify-center rounded-full bg-void-900/60 border border-brass-400/25 transition-colors cursor-pointer"
            onClick={() => setZoomSrc(null)}
          >
            ✕
          </button>
          <div className="max-w-[90vw] max-h-[80vh] overflow-auto rounded-lg shadow-book cursor-default" onClick={(e) => e.stopPropagation()}>
            <img src={zoomSrc} alt="Zoomed page" className="max-w-full h-auto object-contain rounded" />
          </div>
          <p className="mt-4 font-mono text-[9px] text-brass-300/40 tracking-widest uppercase pointer-events-none">Click anywhere outside to exit zoom</p>
        </div>
      )}
    </div>
  );
}
