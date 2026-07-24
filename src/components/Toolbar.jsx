import React, { useState } from "react";

const IconBtn = ({ onClick, active, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0
      ${active ? "bg-beam-400/20 text-beam-300" : "text-void-200/80 hover:bg-void-600/60 hover:text-void-50"}`}
  >
    {children}
  </button>
);

export default function Toolbar({
  title,
  currentPage,
  totalPages,
  onJumpTo,
  isBookmarked,
  onToggleBookmark,
  soundEnabled,
  onToggleSound,
  onZoom,
  onFullscreen,
  onToggleToc,
  onSearch,
  onOpenLibraryScreen,
  readerZoom = 1.0,
  onZoomIn,
  onZoomOut,
  onResetZoom
}) {
  const [pageInput, setPageInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpModalOpen, setJumpModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleJumpSubmit = (e) => {
    e?.preventDefault();
    const n = parseInt(pageInput, 10);
    if (n >= 1 && n <= totalPages) {
      onJumpTo(n);
      setJumpModalOpen(false);
      setPageInput("");
    }
  };

  return (
    <div className="glass-strong w-full px-1.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 text-paper relative z-20 overflow-x-auto no-scrollbar">
      {/* K. Kabiraj Micro-Branding */}
      <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-3 border-r border-void-600/60 pr-1.5 sm:pr-3 shrink-0">
        <img src="/logo.jpg" className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover border border-brass-400/25 shadow-sm" alt="" />
        <span className="font-mono text-[9px] tracking-wider text-brass-300 uppercase hidden md:inline">K. Kabiraj</span>
      </div>

      <button
        onClick={onOpenLibraryScreen}
        className="font-mono text-[11px] sm:text-xs tracking-wider sm:tracking-widest text-beam-300 uppercase shrink-0 cursor-pointer hover:underline"
      >
        ← <span className="hidden xs:inline">Library</span><span className="xs:hidden">Lib</span>
      </button>

      <span className="font-display text-sm truncate max-w-[100px] sm:max-w-xs hidden md:block">
        {title}
      </span>

      <div className="flex-1 min-w-[4px]" />

      {/* Main Reader Zoom Controls (- / % / +) */}
      <div className="flex items-center bg-void-900/70 border border-brass-400/30 rounded-lg p-0.5 shrink-0">
        <button
          onClick={onZoomOut}
          disabled={readerZoom <= 0.8}
          title="Zoom Out Flipbook"
          className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded text-void-200 hover:text-brass-300 hover:bg-void-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
        >
          −
        </button>
        <button
          onClick={onResetZoom}
          title="Reset Zoom to 100%"
          className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-semibold text-brass-300 hover:text-paper cursor-pointer whitespace-nowrap"
        >
          {Math.round(readerZoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          disabled={readerZoom >= 2.5}
          title="Zoom In Flipbook"
          className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded text-void-200 hover:text-brass-300 hover:bg-void-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
        >
          +
        </button>
      </div>

      <IconBtn title="Table of contents" onClick={onToggleToc}>
        <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
        </svg>
      </IconBtn>

      <IconBtn title="Search" onClick={() => { setSearchOpen((s) => !s); setJumpModalOpen(false); }} active={searchOpen}>
        <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </IconBtn>

      <IconBtn title="HD Vector Zoom Modal (360° Pan)" onClick={() => onZoom(currentPage)}>
        <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" />
        </svg>
      </IconBtn>

      <IconBtn title={isBookmarked ? "Remove bookmark" : "Bookmark this page"} onClick={onToggleBookmark} active={isBookmarked}>
        <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill={isBookmarked ? "#F59E0B" : "none"} stroke="currentColor" strokeWidth="1.8">
          <path d="M6 3h12v18l-6-4-6 4V3z" strokeLinejoin="round" />
        </svg>
      </IconBtn>

      <IconBtn title={soundEnabled ? "Mute flip sound" : "Unmute flip sound"} onClick={onToggleSound} active={soundEnabled}>
        {soundEnabled ? (
          <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </IconBtn>

      <IconBtn title="Fullscreen" onClick={onFullscreen}>
        <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconBtn>

      {/* Directly Go to Desired Page Trigger */}
      <button
        onClick={() => { setJumpModalOpen((s) => !s); setSearchOpen(false); setPageInput(String(currentPage)); }}
        title="Directly Go to Desired Page"
        className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-mono text-[11px] sm:text-xs cursor-pointer transition-all duration-200 shrink-0 ${
          jumpModalOpen 
            ? "bg-brass-400 text-void-950 border-brass-400 font-semibold shadow-glow" 
            : "bg-void-900/60 border-brass-400/40 text-paper hover:border-brass-400 hover:text-brass-300"
        }`}
      >
        <span>p.{currentPage}</span>
        <span className="text-void-200/50 text-[9px] sm:text-[10px]">/{totalPages}</span>
        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Direct Jump to Page Modal Popover */}
      {jumpModalOpen && (
        <div className="glass-strong fixed sm:absolute top-14 right-2 sm:right-4 rounded-xl p-4 shadow-2xl w-[88vw] sm:w-80 z-30 border border-brass-400/30 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3 border-b border-void-700/60 pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-brass-300 font-semibold">
              Go to Desired Page
            </span>
            <button
              onClick={() => setJumpModalOpen(false)}
              className="text-void-200/50 hover:text-paper text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 mb-4">
            <input
              autoFocus
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder={`1 - ${totalPages}`}
              className="flex-1 border border-brass-400/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-brass-400 text-paper font-mono"
              style={{ backgroundColor: "#0B0E1B" }}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-brass-400 text-void-950 font-semibold rounded-lg text-xs hover:bg-brass-300 transition-colors cursor-pointer shrink-0"
            >
              Go →
            </button>
          </form>

          {/* Interactive Page Slider */}
          <div className="mb-4">
            <div className="flex justify-between font-mono text-[10px] text-void-200/60 mb-1">
              <span>Slide to page:</span>
              <span className="text-brass-300 font-bold">Page {pageInput || currentPage}</span>
            </div>
            <input
              type="range"
              min={1}
              max={totalPages}
              value={parseInt(pageInput, 10) || currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setPageInput(String(val));
                onJumpTo(val);
              }}
              className="w-full accent-brass-400 cursor-pointer"
            />
          </div>

          {/* Quick Jump Shortcuts */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-void-700/60 font-mono text-[10px]">
            <button
              onClick={() => { onJumpTo(1); setJumpModalOpen(false); }}
              className="py-1.5 px-1 bg-void-900/80 hover:bg-void-800 border border-void-700 rounded text-center text-void-200 hover:text-brass-300 cursor-pointer"
            >
              First (p.1)
            </button>
            <button
              onClick={() => { const mid = Math.round(totalPages / 2); onJumpTo(mid); setJumpModalOpen(false); }}
              className="py-1.5 px-1 bg-void-900/80 hover:bg-void-800 border border-void-700 rounded text-center text-void-200 hover:text-brass-300 cursor-pointer"
            >
              Middle ({Math.round(totalPages / 2)})
            </button>
            <button
              onClick={() => { onJumpTo(totalPages); setJumpModalOpen(false); }}
              className="py-1.5 px-1 bg-void-900/80 hover:bg-void-800 border border-void-700 rounded text-center text-void-200 hover:text-brass-300 cursor-pointer"
            >
              Last ({totalPages})
            </button>
          </div>
        </div>
      )}

      {/* Document Keyword Search Modal */}
      {searchOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(query);
          }}
          className="glass-strong fixed sm:absolute top-14 right-2 sm:right-4 rounded-xl p-3 shadow-glass w-[88vw] sm:w-72 z-30"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this book…"
            className="w-full border border-brass-400/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-brass-400 placeholder:text-void-400"
            style={{ backgroundColor: "#0B0E1B", color: "#FBF8F1" }}
          />
        </form>
      )}
    </div>
  );
}
