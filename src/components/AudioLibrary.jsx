// AudioLibrary.jsx — Import panel with file list
import { useRef, useState } from 'react';
import { formatTime } from '../utils/audioUtils';

const CHAR_COLORS = [
  'char-0', 'char-1', 'char-2', 'char-3',
  'char-4', 'char-5', 'char-6', 'char-7',
];

function getInitial(name) {
  return name.trim().charAt(0).toUpperCase();
}

function getDisplayName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

export default function AudioLibrary({ audioFiles, selectedFile, onSelect, onAddFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files) {
    const validFiles = Array.from(files).filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac'].includes(ext);
    });
    if (validFiles.length > 0) onAddFiles(validFiles);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleZoneClick() {
    inputRef.current?.click();
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">
          Audio Library
          {audioFiles.length > 0 && <span className="badge">{audioFiles.length}</span>}
        </span>
      </div>

      <div className="panel-body">
        {/* Drop Zone */}
        <div
          className={`import-zone${dragging ? ' dragging' : ''}`}
          onClick={handleZoneClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          id="import-drop-zone"
          aria-label="Import audio files"
          onKeyDown={(e) => e.key === 'Enter' && handleZoneClick()}
        >
          <div className="import-zone-icon">🎵</div>
          <div className="import-zone-text">Drop audio files here</div>
          <div className="import-zone-sub">or click to browse — WAV, MP3, OGG, M4A</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.mp3,.ogg,.flac,.m4a,.aac,audio/*"
          multiple
          className="file-input-hidden"
          onChange={handleInputChange}
          id="audio-file-input"
        />

        {/* File List */}
        {audioFiles.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
            No audio files imported yet.
          </div>
        ) : (
          <div className="audio-file-list">
            {audioFiles.map((af, idx) => {
              const displayName = getDisplayName(af.file.name);
              const colorClass = CHAR_COLORS[idx % CHAR_COLORS.length];
              const isActive = selectedFile?.id === af.id;

              return (
                <div
                  key={af.id}
                  className={`audio-file-card${isActive ? ' active' : ''}`}
                  onClick={() => onSelect(af)}
                  id={`audio-file-card-${af.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(af)}
                  aria-selected={isActive}
                >
                  <div className={`audio-file-avatar ${colorClass}`}>
                    {getInitial(displayName)}
                  </div>
                  <div className="audio-file-info">
                    <div className="audio-file-name" title={af.file.name}>{displayName}</div>
                    <div className="audio-file-meta">
                      {af.buffer
                        ? formatTime(af.buffer.duration)
                        : af.loading
                        ? 'Loading…'
                        : af.error
                        ? '⚠ Error'
                        : '—'}
                    </div>
                  </div>
                  <div className="audio-file-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-sm btn-secondary"
                      id={`edit-btn-${af.id}`}
                      onClick={(e) => { e.stopPropagation(); onSelect(af); }}
                      title="Open in trimmer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
