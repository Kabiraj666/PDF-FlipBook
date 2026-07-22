import React, { useCallback, useRef, useState, useEffect } from "react";
import Book3D from "./Book3D.jsx";
import { listBooks } from "../utils/db.js";

export default function UploadScreen({
  onFileSelected,
  onUrlSelected,
  urlError,
  urlLoading,
  library = {},
  onBookSelected,
  onBookDeleted
}) {
  const [dragging, setDragging] = useState(false);
  const [bookState, setBookState] = useState("idle");
  const [openingBookId, setOpeningBookId] = useState(null);
  const inputRef = useRef(null);
  const [recentBooks, setRecentBooks] = useState([]);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    listBooks()
      .then((books) => {
        setRecentBooks(books.sort((a, b) => b.updatedAt - a.updatedAt));
      })
      .catch((err) => console.warn("Failed to load recent books:", err));
  }, []);

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0];
      const isPdf = file && (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      );
      if (isPdf) {
        setBookState("opening");
        setTimeout(() => {
          onFileSelected(file);
        }, 1200);
      } else if (file) {
        alert("Selected file is not a PDF. Please choose a valid PDF file.");
      }
    },
    [onFileSelected]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-void-950 text-paper relative overflow-hidden py-12">
      {/* signature ambient glow — the one deliberate flourish on this screen */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-beam-400/12 blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-1/3 w-[400px] h-[400px] rounded-full bg-signal-400/10 blur-3xl" />

      <div className="relative z-10 text-center max-w-lg flex flex-col items-center">
        {/* Kushal Kabiraj Brand Logo */}
        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-brass-400/40 p-1 bg-void-900/60 shadow-glass mb-4 transition-transform hover:scale-105 duration-300">
          <img src="/logo.jpg" className="w-full h-full object-cover rounded-lg" alt="Kushal Kabiraj Logo" />
        </div>

        <p className="font-mono text-xs tracking-[0.3em] text-beam-300 uppercase mb-3">
          Leaflet
        </p>
        <h1 className="font-display font-semibold text-5xl sm:text-6xl leading-[1.05] mb-4 tracking-tight">
          Any PDF.
          <br />
          Read like a book.
        </h1>
        <p className="text-void-200/70 text-base mb-6">
          Real page-turns, bookmarks, and night mode — open, no upload.
        </p>
      </div>

      <Book3D state={bookState} />

      {/* Recent Bookshelf */}
      {recentBooks.length > 0 && (
        <div className="relative z-10 w-full max-w-xl mb-8 px-2 text-center">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-brass-300">
              Your Bookshelf
            </h2>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (window.confirm("Are you sure you want to clear your entire library bookshelf?")) {
                  // Delete all books from indexedDB
                  for (const b of recentBooks) {
                    await onBookDeleted(b.id);
                  }
                  setRecentBooks([]);
                }
              }}
              className="text-[9px] font-mono tracking-widest text-red-400/80 hover:text-red-400 uppercase transition-colors cursor-pointer"
            >
              Clear Library
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentBooks.map((b) => {
              const isThisBookOpening = openingBookId === b.id;
              return (
                <div 
                  key={b.id}
                  onClick={() => {
                    if (openingBookId) return;
                    setOpeningBookId(b.id);
                    setTimeout(() => {
                      onBookSelected(b.id, b.name);
                    }, 800);
                  }}
                  className={`glass-strong border border-brass-400/20 hover:border-brass-400/50 p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer group shadow-glass text-left relative overflow-hidden
                    ${openingBookId && !isThisBookOpening ? "opacity-40 pointer-events-none" : ""}`}
                >
                  {/* Book cover icon */}
                  <div className="w-8 h-11 bg-gradient-to-br from-void-800 to-void-950 rounded border border-brass-400/25 p-0.5 flex flex-col justify-between shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300 relative overflow-hidden">
                    {isThisBookOpening ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-void-900/90">
                        <div className="animate-spin h-4.5 w-4.5 border-2 border-brass-400 border-t-transparent rounded-full" />
                      </div>
                    ) : (
                      <>
                        <div className="w-2.5 h-0.5 bg-brass-400/40 mx-auto mt-0.5" />
                        <div className="text-center font-mono text-[6px] text-brass-300/40 uppercase">PDF</div>
                        <div className="w-1.5 h-px bg-brass-400/35 mx-auto mb-0.5" />
                      </>
                    )}
                  </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-paper truncate group-hover:text-brass-300 transition-colors">
                    {b.name}
                  </h3>
                  <p className="text-[9px] text-void-200/50 mt-0.5 font-mono">
                    Page {library[b.id]?.lastPage || 1}
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookDeleted(b.id);
                    setRecentBooks((prev) => prev.filter((item) => item.id !== b.id));
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-red-950/40 text-void-200/30 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                  title="Remove from library"
                >
                  ✕
                </button>
              </div>
            );
          })}
          </div>
        </div>
      )}

      <div
        className={`glass relative z-10 w-full max-w-xl rounded-2xl p-8 text-center transition-all cursor-pointer
          ${dragging ? "border-beam-400 shadow-glow" : "hover:border-beam-400/40 hover:shadow-glow"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
          setBookState("dragging");
        }}
        onDragLeave={() => {
          setDragging(false);
          setBookState("idle");
        }}
        onMouseEnter={() => {
          if (bookState !== "opening") setBookState("hover");
        }}
        onMouseLeave={() => {
          if (bookState !== "opening") setBookState("idle");
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-beam-400/15 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5FB6FF" strokeWidth="1.6">
            <path d="M12 3v12" strokeLinecap="round" />
            <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="font-medium mb-1">Drop a PDF, or click to choose one</p>
        <p className="text-sm text-void-200/60">Opens right in your browser — nothing is uploaded.</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Paste a link */}
      <div className="relative z-10 w-full max-w-xl mt-4 px-2" onClick={(e) => e.stopPropagation()}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = urlValue.trim();
            if (trimmed && !urlLoading) onUrlSelected(trimmed);
          }}
        >
          <input
            type="url"
            inputMode="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="…or paste a link to a PDF"
            disabled={urlLoading}
            className="glass flex-1 min-w-0 rounded-xl px-4 py-2.5 text-sm text-paper placeholder:text-void-200/40 border border-void-800 focus:border-brass-400/50 outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={urlLoading || !urlValue.trim()}
            className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium bg-brass-400/90 text-void-950 hover:bg-brass-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {urlLoading ? "Loading…" : "Load"}
          </button>
        </form>
        {urlError && (
          <p className="mt-2 text-xs text-red-400/90 font-mono">{urlError}</p>
        )}
      </div>

      {/* How to Use Section */}
      <div className="relative z-10 w-full max-w-xl mt-12 text-left px-2">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-brass-300 mb-4 border-b border-void-800 pb-2">
          Quick Start Guide
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px]">
          <div className="glass p-4 rounded-xl border border-void-800 hover:border-brass-400/20 transition-all duration-300 shadow-glass">
            <span className="text-brass-300 font-bold block mb-1">1. Choose a PDF</span>
            <p className="text-void-200/60 leading-relaxed">
              Drag &amp; drop a file, browse locally, or click any book from your bookshelf cache.
            </p>
          </div>
          <div className="glass p-4 rounded-xl border border-void-800 hover:border-brass-400/20 transition-all duration-300 shadow-glass">
            <span className="text-brass-300 font-bold block mb-1">2. Flip to Read</span>
            <p className="text-void-200/60 leading-relaxed">
              Swipe or click page corners to turn pages. Toggle the flip sound button to hear satisfying acoustic folds.
            </p>
          </div>
          <div className="glass p-4 rounded-xl border border-void-800 hover:border-brass-400/20 transition-all duration-300 shadow-glass">
            <span className="text-brass-300 font-bold block mb-1">3. Access Tools</span>
            <p className="text-void-200/60 leading-relaxed">
              Bookmark lines, search text keywords, zoom to examine details, or enable Night Mode to relax your eyes.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center opacity-40 hover:opacity-80 transition-opacity duration-300 relative z-10">
        <p className="font-mono text-[10px] tracking-[0.25em] text-brass-300 uppercase">
          Created by Kushal Kabiraj
        </p>
      </div>
    </div>
  );
}
