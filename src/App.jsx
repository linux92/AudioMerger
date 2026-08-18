// App.jsx — Audio Story Merger root component with IndexedDB auto-save persistence
import { useState, useCallback, useRef, useEffect } from 'react';
import AudioLibrary from './components/AudioLibrary';
import AudioTrimmer from './components/AudioTrimmer';
import StoryTimeline from './components/StoryTimeline';
import StoryScript from './components/StoryScript';
import ExportButton from './components/ExportButton';
import { decodeAudioFile } from './utils/audioUtils';
import { saveProjectToStorage, loadProjectFromStorage, clearProjectStorage } from './utils/storageUtils';

let fileIdCounter = Date.now();

export default function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [clips, setClips] = useState([]);
  const [gapSeconds, setGapSeconds] = useState(0.3);
  const [script, setScript] = useState('');
  const [error, setError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Object URLs to revoke on unmount
  const objectUrlsRef = useRef([]);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // ─── 1. Restore Project on Initial Mount from IndexedDB ───
  useEffect(() => {
    let isMounted = true;

    async function restore() {
      try {
        const saved = await loadProjectFromStorage();
        if (!isMounted || !saved) {
          setIsRestoring(false);
          return;
        }

        if (saved.audioFiles && saved.audioFiles.length > 0) {
          // Decode all restored audio files in parallel
          const decodedFiles = await Promise.all(
            saved.audioFiles.map(async (af) => {
              const objectUrl = URL.createObjectURL(af.file);
              objectUrlsRef.current.push(objectUrl);
              try {
                const buffer = await decodeAudioFile(af.file);
                return { ...af, buffer, objectUrl, loading: false };
              } catch (err) {
                return { ...af, error: err.message, objectUrl, loading: false };
              }
            })
          );

          if (isMounted) {
            setAudioFiles(decodedFiles);
            if (saved.selectedFileId) {
              const sel = decodedFiles.find((f) => f.id === saved.selectedFileId);
              setSelectedFile(sel || decodedFiles[0]);
            } else if (decodedFiles.length > 0) {
              setSelectedFile(decodedFiles[0]);
            }
          }
        }

        if (isMounted) {
          if (saved.clips) setClips(saved.clips);
          if (typeof saved.gapSeconds === 'number') setGapSeconds(saved.gapSeconds);
          if (saved.script) setScript(saved.script);
        }
      } catch (err) {
        console.error('Failed to restore project from IndexedDB:', err);
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    }

    restore();

    return () => {
      isMounted = false;
    };
  }, []);

  // ─── 2. Auto-save Project State to IndexedDB on Changes ───
  useEffect(() => {
    if (isRestoring) return; // Do not overwrite state while restoring

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      await saveProjectToStorage({
        audioFiles,
        clips,
        gapSeconds,
        script,
        selectedFileId: selectedFile?.id || null,
      });
      setSaveStatus('saved');
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [audioFiles, clips, gapSeconds, script, selectedFile?.id, isRestoring]);

  // ─── Clear All / New Project ───
  async function handleNewProject() {
    if (audioFiles.length > 0 || clips.length > 0 || script) {
      const confirmed = window.confirm('Start a new project? This will clear all imported audio files, clips, and script.');
      if (!confirmed) return;
    }
    await clearProjectStorage();
    setAudioFiles([]);
    setSelectedFile(null);
    setClips([]);
    setScript('');
    setGapSeconds(0.3);
    setSaveStatus('saved');
  }

  // ─── Import audio files ───
  const handleAddFiles = useCallback(async (files) => {
    const newEntries = files.map((file) => ({
      id: `af-${++fileIdCounter}`,
      file,
      buffer: null,
      objectUrl: null,
      loading: true,
      error: null,
    }));

    setAudioFiles((prev) => {
      const existingNames = new Set(prev.map((af) => af.file.name));
      const filtered = newEntries.filter((e) => !existingNames.has(e.file.name));
      const nextList = [...prev, ...filtered];
      if (!selectedFile && nextList.length > 0) {
        setSelectedFile(nextList[0]);
      }
      return nextList;
    });

    // Decode each file asynchronously
    for (const entry of newEntries) {
      const objectUrl = URL.createObjectURL(entry.file);
      objectUrlsRef.current.push(objectUrl);

      try {
        const buffer = await decodeAudioFile(entry.file);
        setAudioFiles((prev) =>
          prev.map((af) =>
            af.id === entry.id ? { ...af, buffer, objectUrl, loading: false } : af
          )
        );
      } catch (err) {
        setAudioFiles((prev) =>
          prev.map((af) =>
            af.id === entry.id
              ? { ...af, loading: false, error: err.message, objectUrl }
              : af
          )
        );
        setError(err.message);
      }
    }
  }, [selectedFile]);

  // ─── Clip management ───
  function handleAddClip(clip) {
    setClips((prev) => [...prev, clip]);
  }

  function handleDeleteClip(clipId) {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
  }

  function handleMoveUp(idx) {
    if (idx === 0) return;
    setClips((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function handleMoveDown(idx) {
    setClips((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function handleError(msg) {
    setError(msg);
  }

  return (
    <div className="app-root">
      {/* ─── Header ─── */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🎙</div>
          <div className="app-logo-text">
            Audio<span>Merger</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>📁 {audioFiles.length} file{audioFiles.length !== 1 ? 's' : ''}</span>
            <span>✂️ {clips.length} clip{clips.length !== 1 ? 's' : ''}</span>

            {/* Persistent auto-save status indicator */}
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: saveStatus === 'saving' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: saveStatus === 'saving' ? '#fbbf24' : '#34d399',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'monospace',
              }}
              title="Everything is automatically saved in your browser storage"
            >
              {saveStatus === 'saving' ? '⏳ Saving…' : '💾 Auto-saved'}
            </span>
          </div>
        </div>

        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            id="clear-storage-btn"
            className="btn btn-sm btn-danger"
            onClick={handleNewProject}
            title="Delete all stored audio files and reset database"
            style={{ background: 'var(--danger-dim)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
          >
            🗑️ Clear Data
          </button>

          <ExportButton
            clips={clips}
            audioFiles={audioFiles}
            gapSeconds={gapSeconds}
            onError={handleError}
            onClearProject={handleNewProject}
          />
        </div>
      </header>

      {/* ─── Main 3-column layout ─── */}
      <main className="app-main">
        {/* Column 1: Audio Library */}
        <div className="panel">
          <AudioLibrary
            audioFiles={audioFiles}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            onAddFiles={handleAddFiles}
          />
        </div>

        {/* Column 2: Audio Trimmer */}
        <div className="panel" style={{ borderRight: '1px solid var(--border)' }}>
          <AudioTrimmer
            audioFile={selectedFile}
            audioFiles={audioFiles}
            clips={clips}
            onAddClip={handleAddClip}
            onError={handleError}
          />
          {/* Story Script below trimmer */}
          <StoryScript script={script} onScriptChange={setScript} />
        </div>

        {/* Column 3: Story Timeline */}
        <div className="panel">
          <StoryTimeline
            clips={clips}
            audioFiles={audioFiles}
            gapSeconds={gapSeconds}
            onGapChange={setGapSeconds}
            onDelete={handleDeleteClip}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onError={handleError}
          />
        </div>
      </main>

      {/* ─── Error bar ─── */}
      {error && (
        <div className="error-bar" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            className="error-bar-dismiss"
            onClick={() => setError(null)}
            id="dismiss-error-btn"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

