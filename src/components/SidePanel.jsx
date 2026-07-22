import React, { useState, useEffect } from "react";

export default function SidePanel({ open, onClose, toc, bookmarks, searchResults, onJumpTo }) {
  const [tab, setTab] = useState("toc");

  // Auto-switch to search tab when a new search starts
  useEffect(() => {
    if (searchResults) {
      setTab("search");
    }
  }, [searchResults]);

  if (!open) return null;

  const activeTab = tab === "search" && !searchResults ? "toc" : tab;

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="flex-1 bg-void-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong w-80 max-w-[85vw] h-full text-paper flex flex-col">
        <div className="flex border-b border-void-600">
          {[
            ["toc", "Contents"],
            ["bookmarks", `Bookmarks (${bookmarks.length})`],
            ...(searchResults ? [["search", searchResults === "searching" ? "Searching..." : `Results (${searchResults.length})`]] : [])
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide ${
                activeTab === key ? "text-beam-300 border-b-2 border-beam-400" : "text-void-200/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {activeTab === "toc" &&
            (toc.length === 0 ? (
              <p className="text-sm text-void-200/60 p-3">
                This PDF has no embedded table of contents.
              </p>
            ) : (
              toc.map((item, i) => (
                <button
                  key={i}
                  onClick={() => item.page && onJumpTo(item.page)}
                  style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                  className="block w-full text-left py-2 px-2 rounded-lg hover:bg-void-600/50 text-sm truncate transition-colors"
                >
                  {item.title}
                  {item.page && <span className="text-void-200/40 font-mono text-xs ml-2">p.{item.page}</span>}
                </button>
              ))
            ))}

          {activeTab === "bookmarks" &&
            (bookmarks.length === 0 ? (
              <p className="text-sm text-void-200/60 p-3">
                No bookmarks yet. Tap the ribbon icon while reading to save a page.
              </p>
            ) : (
              bookmarks
                .sort((a, b) => a.page - b.page)
                .map((b) => (
                  <button
                    key={b.page}
                    onClick={() => onJumpTo(b.page)}
                    className="flex items-center justify-between w-full text-left py-2 px-3 rounded-lg hover:bg-void-600/50 text-sm transition-colors"
                  >
                    <span>Page {b.page}</span>
                    <span className="text-beam-300">🔖</span>
                  </button>
                ))
            ))}

          {activeTab === "search" &&
            (searchResults === "searching" ? (
              <div className="flex flex-col items-center justify-center p-8 text-void-200/60 font-sans">
                <div className="animate-spin h-6 w-6 border-2 border-brass-400 border-t-transparent rounded-full mb-3"></div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-75">Searching Document...</span>
              </div>
            ) : searchResults?.length === 0 ? (
              <p className="text-sm text-void-200/60 p-3">No matches found.</p>
            ) : (
              searchResults?.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onJumpTo(r.page)}
                  className="block w-full text-left py-2 px-3 rounded-lg hover:bg-void-600/50 text-sm transition-colors"
                >
                  <span className="font-mono text-xs text-beam-300">p.{r.page}</span>
                  <p className="text-void-200/80 mt-0.5 line-clamp-2">{r.snippet}</p>
                </button>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
