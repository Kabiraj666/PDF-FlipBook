import React, { useCallback, useState, useEffect, useRef } from "react";
import UploadScreen from "./components/UploadScreen.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import FlipbookReader from "./components/FlipbookReader.jsx";
import {
  loadPdfDocument,
  renderPageToDataUrl,
  getTableOfContents,
  fetchPdfFromUrl
} from "./utils/pdfEngine.js";
import { useLocalStorage, fileIdentity } from "./hooks/useLocalStorage.js";
import { saveBook, loadBook, deleteBook } from "./utils/db.js";

const RENDER_SCALE = 2.2;

export default function App() {
  const [stage, setStage] = useState("upload"); // upload | loading | reading
  const [fileName, setFileName] = useState("");
  const [bookId, setBookId] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [toc, setToc] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [urlError, setUrlError] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  const [library, setLibrary] = useLocalStorage("leaflet:library", {});
  const safeLibrary = (library && typeof library === "object") ? library : {};

  const [lastReadBookId, setLastReadBookId] = useLocalStorage("leaflet:lastBookId", null);

  const openBuffer = useCallback(async (arrayBuffer, name, identity) => {
    setFileName(name);
    setStage("loading");
    setBookId(identity);
    setProgress({ done: 0, total: 0 });

    try {
      // Async background cache the PDF data inside browser IndexedDB
      saveBook(identity, name, arrayBuffer).catch((err) =>
        console.warn("Failed to cache book in database:", err)
      );

      const doc = await loadPdfDocument(arrayBuffer);
      setPdfDoc(doc);

      // Retrieve lastPage from library or default to 1
      const storedState = safeLibrary[identity] || { bookmarks: [], lastPage: 1 };
      const lastPage = storedState.lastPage || 1;

      // Render outline
      const outline = await getTableOfContents(doc);
      setToc(outline);

      // Create sparse pages array of size doc.numPages
      const initialPages = Array(doc.numPages).fill(null);

      // Render first page (to get aspect ratio) and lastPage (so it is ready to display)
      const targetPagesToRender = new Set([1]);
      if (lastPage > 1 && lastPage <= doc.numPages) {
        targetPagesToRender.add(lastPage);
      }

      const totalToRender = targetPagesToRender.size;
      setProgress({ done: 0, total: totalToRender });

      let completedCount = 0;
      for (const pageNum of targetPagesToRender) {
        const rendered = await renderPageToDataUrl(doc, pageNum, RENDER_SCALE);
        initialPages[pageNum - 1] = rendered;
        completedCount++;
        setProgress({ done: completedCount, total: totalToRender });
      }

      setPages(initialPages);
      setStage("reading");
      setLastReadBookId(identity);
    } catch (err) {
      console.error("Error opening PDF book:", err);
      alert(`Failed to load PDF: ${err.message || err}`);
      setStage("upload");
    }
  }, [safeLibrary]);

  const handleFileSelected = useCallback(
    (file) => {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const buffer = e.target.result;
            if (!buffer) throw new Error("File reader returned empty buffer.");
            await openBuffer(buffer, file.name, fileIdentity(file));
          } catch (err) {
            console.error("Error processing file buffer:", err);
            alert(`Failed to parse PDF file: ${err.message || err}`);
          }
        };
        reader.onerror = (err) => {
          console.error("FileReader error event:", err);
          alert("Failed to read the file from disk.");
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error("Error initiating FileReader:", err);
        alert(`Failed to read file: ${err.message || err}`);
      }
    },
    [openBuffer]
  );

  const handleUrlSelected = useCallback(
    async (url) => {
      setUrlError("");
      setUrlLoading(true);
      try {
        const { arrayBuffer, suggestedName } = await fetchPdfFromUrl(url);
        await openBuffer(arrayBuffer, suggestedName, `url:${url}`);
      } catch (err) {
        setUrlError(err.message || "Couldn't load a PDF from that link.");
      } finally {
        setUrlLoading(false);
      }
    },
    [openBuffer]
  );

  const bookState = bookId && safeLibrary[bookId] && typeof safeLibrary[bookId] === "object"
    ? safeLibrary[bookId]
    : { bookmarks: [], lastPage: 1 };

  const safeBookmarks = Array.isArray(bookState.bookmarks) ? bookState.bookmarks : [];

  function updateBookState(patch) {
    if (!bookId) return;
    setLibrary((lib) => {
      const currentLib = lib && typeof lib === "object" ? lib : {};
      const currentBookState =
        currentLib[bookId] && typeof currentLib[bookId] === "object"
          ? currentLib[bookId]
          : { bookmarks: [], lastPage: 1 };
      return {
        ...currentLib,
        [bookId]: { ...currentBookState, ...patch, name: fileName }
      };
    });
  }

  function toggleBookmark(page) {
    const exists = safeBookmarks.some((b) => b.page === page);
    const bookmarks = exists
      ? safeBookmarks.filter((b) => b.page !== page)
      : [...safeBookmarks, { page }];
    updateBookState({ bookmarks });
  }

  const handleBookSelected = useCallback(
    async (id, name) => {
      try {
        setStage("loading");
        const buffer = await loadBook(id);
        if (!buffer) throw new Error("Cached book data not found.");
        await openBuffer(buffer, name, id);
      } catch (err) {
        console.error("Error opening cached book:", err);
        alert(`Failed to load cached book: ${err.message || err}`);
        setStage("upload");
      }
    },
    [openBuffer]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current && lastReadBookId && safeLibrary[lastReadBookId]) {
      initialLoadDone.current = true;
      handleBookSelected(lastReadBookId, safeLibrary[lastReadBookId].name);
    } else {
      initialLoadDone.current = true;
    }
  }, [lastReadBookId, safeLibrary, handleBookSelected]);

  const handleBookDeleted = useCallback(
    async (id) => {
      try {
        await deleteBook(id);
        setLibrary((lib) => {
          const nextLib = lib && typeof lib === "object" ? { ...lib } : {};
          delete nextLib[id];
          return nextLib;
        });
      } catch (err) {
        console.error("Failed to delete book from IndexedDB:", err);
      }
    },
    [setLibrary]
  );

  function handleExit() {
    setStage("upload");
    setPdfDoc(null);
    setPages([]);
    setToc([]);
    setBookId(null);
    setLastReadBookId(null);
  }

  if (stage === "upload") {
    return (
      <UploadScreen
        onFileSelected={handleFileSelected}
        onUrlSelected={handleUrlSelected}
        urlError={urlError}
        urlLoading={urlLoading}
        library={safeLibrary}
        onBookSelected={handleBookSelected}
        onBookDeleted={handleBookDeleted}
      />
    );
  }

  if (stage === "loading") {
    return <LoadingScreen done={progress.done} total={progress.total} onCancel={handleExit} />;
  }

  return (
    <FlipbookReader
      fileName={fileName}
      pdfDoc={pdfDoc}
      pages={pages}
      toc={toc}
      bookmarks={safeBookmarks}
      onToggleBookmark={toggleBookmark}
      lastPage={bookState.lastPage || 1}
      onPageChange={(page) => updateBookState({ lastPage: page })}
      onExit={handleExit}
    />
  );
}
