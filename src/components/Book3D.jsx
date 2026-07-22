import React from "react";

export default function Book3D({ state }) {
  // state: 'idle' | 'hover' | 'dragging' | 'opening'
  return (
    <div className="book-perspective w-56 h-72 relative mx-auto my-8 pointer-events-none">
      <div className={`book-3d-wrap ${state}`}>
        {/* Back Cover */}
        <div className="book-face book-back bg-void-800 border-l border-brass-500/20 shadow-2xl" />

        {/* Paper edges block (simulated 3D pages) */}
        <div className="book-pages-right" />
        <div className="book-pages-top" />
        <div className="book-pages-bottom" />

        {/* Dynamic inside pages that fan out slightly when opening */}
        <div className="book-inside-page page-1 bg-paper-dim border-l border-void-600/10" />
        <div className="book-inside-page page-2 bg-paper-dim border-l border-void-600/10" />
        <div className="book-inside-page page-3 bg-paper border-l border-void-600/10" />

        {/* Spine */}
        <div className="book-spine bg-gradient-to-r from-void-900 via-void-800 to-void-900 border-x border-brass-500/30" />

        {/* Front Cover */}
        <div className="book-face book-front bg-void-800 border-r border-brass-500/30">
          <div className="absolute inset-2 border border-brass-500/40 rounded flex flex-col items-center justify-between p-4 bg-void-800/90 shadow-inner">
            {/* Tiny Logo Thumbnail */}
            <div className="w-10 h-10 rounded border border-brass-400/30 p-0.5 bg-void-950/80">
              <img src="/logo.jpg" className="w-full h-full object-cover rounded-sm" alt="" />
            </div>
            <div className="text-center">
              <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-brass-300 block mb-1">Leaflet</span>
              <h2 className="font-display text-2xl font-semibold text-paper leading-tight mb-1">READER</h2>
              <span className="font-mono text-[7px] uppercase tracking-[0.25em] text-void-200/50 block">BY K. KABIRAJ</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-px bg-brass-400/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
