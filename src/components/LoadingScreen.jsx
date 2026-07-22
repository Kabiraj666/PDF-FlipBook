import React from "react";

export default function LoadingScreen({ done, total, onCancel }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-void-950 text-paper px-6">
      <p className="font-mono text-xs tracking-[0.3em] text-beam-300 uppercase mb-6">Opening</p>
      <div className="w-full max-w-sm h-1.5 bg-void-700/60 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-beam-400 shadow-glow transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="font-mono text-sm text-void-200/60 mb-8">
        {done} / {total}
      </p>
      {onCancel && (
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-void-600/60 rounded-lg text-xs font-mono tracking-widest text-beam-300 hover:bg-void-800 hover:border-beam-400/40 hover:text-void-50 transition-colors uppercase cursor-pointer"
        >
          Cancel & Go Back
        </button>
      )}
    </div>
  );
}

