// AudioTrimmer.jsx — Professional DAW-style audio trimmer with dynamic source slicing
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { drawWaveform, formatTime, sliceAudioBuffer, encodeWAV } from '../utils/audioUtils';

const CHAR_COLORS = [
  'char-0', 'char-1', 'char-2', 'char-3',
  'char-4', 'char-5', 'char-6', 'char-7',
];

export default function AudioTrimmer({ audioFile, audioFiles, clips = [], onAddClip, onError }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const waveformDrawnRef = useRef(false);
  const animFrameRef = useRef(null);
  const previewSourceRef = useRef(null);
  const previewCtxRef = useRef(null);
  const workingUrlRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [zoom, setZoom] = useState(1); // 1x, 2x, 4x, 8x
  const [workingUrl, setWorkingUrl] = useState(null);

  // Clips associated with this specific audio file
  const fileClips = useMemo(() => {
    return clips.filter(
      (c) => c.sourceFileId === audioFile?.id || c.sourceFileName === audioFile?.file?.name
    );
  }, [clips, audioFile]);

  // Total seconds consumed from the beginning of the original source audio
  const consumedSecs = useMemo(() => {
    return fileClips.reduce((sum, c) => sum + c.duration, 0);
  }, [fileClips]);

  // The active remaining working audio buffer (sliced from originalBuffer)
  const workingBuffer = useMemo(() => {
    if (!audioFile?.buffer) return null;
    if (consumedSecs <= 0) return audioFile.buffer;
    if (consumedSecs >= audioFile.buffer.duration - 0.01) return null; // fully consumed
    return sliceAudioBuffer(audioFile.buffer, consumedSecs, audioFile.buffer.duration);
  }, [audioFile?.buffer, consumedSecs]);

  const duration = workingBuffer ? workingBuffer.duration : 0;

  // Generate an audio ObjectURL whenever the remaining working buffer updates
  useEffect(() => {
    if (workingUrlRef.current) {
      URL.revokeObjectURL(workingUrlRef.current);
      workingUrlRef.current = null;
    }

    if (!workingBuffer) {
      setWorkingUrl(null);
      setStartTime(0);
      setEndTime(0);
      setCurrentTime(0);
      return;
    }

    try {
      const wavBlob = encodeWAV(workingBuffer);
      const url = URL.createObjectURL(wavBlob);
      workingUrlRef.current = url;
      setWorkingUrl(url);
      setStartTime(0);
      setEndTime(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsPreviewing(false);
    } catch (e) {
      console.error('Failed to create working audio URL:', e);
    }

    return () => {
      if (workingUrlRef.current) {
        URL.revokeObjectURL(workingUrlRef.current);
        workingUrlRef.current = null;
      }
    };
  }, [workingBuffer]);

  // Color index for this file
  const colorIdx = audioFile
    ? audioFiles.findIndex((af) => af.id === audioFile.id) % CHAR_COLORS.length
    : 0;

  // ─── Render Waveform & Selection Overlays with Zoom ───
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !workingBuffer) return;

    const visibleWidth = container.clientWidth || 600;
    const totalWidth = Math.max(visibleWidth, Math.round(visibleWidth * zoom));
    const totalHeight = 120;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== totalWidth * dpr || canvas.height !== totalHeight * dpr) {
      canvas.width = totalWidth * dpr;
      canvas.height = totalHeight * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw DAW Waveform with Time Ruler
    drawWaveform(canvas, workingBuffer, totalWidth, totalHeight, zoom);

    // 2. Draw Selection Overlays & Playhead Needle
    drawSelectionOverlay(ctx, totalWidth, totalHeight, startTime, endTime, duration, currentTime);

    ctx.restore();
    waveformDrawnRef.current = true;
  }, [workingBuffer, startTime, endTime, duration, currentTime, zoom]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ─── Draw Playhead Overlay (Single Main Red Line) ───
  function drawSelectionOverlay(ctx2d, w, h, s, e, dur, cur) {
    if (dur <= 0) return;

    // Main Red Line (The single prominent focal needle across the entire track)
    if (cur >= 0 && cur <= dur) {
      const px = (cur / dur) * w;

      ctx2d.strokeStyle = '#ef4444';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(px, 0);
      ctx2d.lineTo(px, h);
      ctx2d.stroke();

      // Top indicator pointer cap
      ctx2d.fillStyle = '#ef4444';
      ctx2d.beginPath();
      ctx2d.moveTo(px - 5, 0);
      ctx2d.lineTo(px + 5, 0);
      ctx2d.lineTo(px, 8);
      ctx2d.closePath();
      ctx2d.fill();
    }
  }

  // ─── HTML audio element event handlers ───
  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const cur = audio.currentTime;
    setCurrentTime(cur);

    // Auto-scroll container to keep playhead visible when zoomed in
    if (zoom > 1 && containerRef.current && duration > 0) {
      const container = containerRef.current;
      const visibleWidth = container.clientWidth;
      const totalWidth = visibleWidth * zoom;
      const playheadX = (cur / duration) * totalWidth;
      const scrollL = container.scrollLeft;

      if (playheadX > scrollL + visibleWidth - 60 || playheadX < scrollL + 20) {
        container.scrollLeft = Math.max(0, playheadX - visibleWidth / 2);
      }
    }
  }

  function handleAudioEnded() {
    setIsPlaying(false);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
    }
  }

  // ─── Zoom Change Handler ───
  function handleZoomChange(newZoom) {
    setZoom(newZoom);
    requestAnimationFrame(() => {
      if (containerRef.current && duration > 0) {
        const container = containerRef.current;
        const visibleWidth = container.clientWidth;
        const totalWidth = visibleWidth * newZoom;
        const playheadX = (currentTime / duration) * totalWidth;
        container.scrollLeft = Math.max(0, playheadX - visibleWidth / 2);
      }
    });
  }

  // ─── Real-time Swipe / Drag Scrubbing on Waveform ───
  const isDraggingRef = useRef(false);

  function seekFromClientX(clientX) {
    if (!duration || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = parseFloat((frac * duration).toFixed(3));

    setCurrentTime(seekTime);
    setEndTime(seekTime);

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seekTime;
    }
  }

  function handlePointerDown(e) {
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    seekFromClientX(e.clientX);
  }

  function handlePointerMove(e) {
    if (!isDraggingRef.current) return;
    seekFromClientX(e.clientX);
  }

  function handlePointerUp(e) {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      seekFromClientX(e.clientX);
    }
  }

  // ─── Playback controls ───
  function handlePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setIsPlaying(true)).catch((e) => onError(e.message));
  }

  function handlePause() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    // ── Auto-set End time to wherever the user paused ──
    const pausedAt = parseFloat(audio.currentTime.toFixed(3));
    setEndTime(pausedAt);
  }

  function handleStop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = startTime;   // seek back to start of current selection
    setCurrentTime(startTime);
    setIsPlaying(false);
  }

  // ─── Set start/end from current time ───
  function handleSetStart() {
    setStartTime(parseFloat(currentTime.toFixed(3)));
  }

  function handleSetEnd() {
    setEndTime(parseFloat(currentTime.toFixed(3)));
  }

  // ─── Preview Selection using Web Audio API ───
  async function stopPreview() {
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch (_) {}
      previewSourceRef.current = null;
    }
    if (previewCtxRef.current) {
      try { await previewCtxRef.current.close(); } catch (_) {}
      previewCtxRef.current = null;
    }
    setIsPreviewing(false);
  }

  async function handlePreview() {
    if (!workingBuffer) return;
    await stopPreview();

    const s = Math.min(startTime, endTime);
    const e = Math.max(startTime, endTime);
    if (e - s < 0.01) { onError('Selection too short to preview.'); return; }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      previewCtxRef.current = ctx;
      const source = ctx.createBufferSource();
      previewSourceRef.current = source;
      source.buffer = workingBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPreviewing(false);
        previewSourceRef.current = null;
      };
      source.start(0, s, e - s);
      setIsPreviewing(true);

      const startWall = ctx.currentTime;
      const startSec = s;
      function tick() {
        if (!previewSourceRef.current) return;
        const elapsed = ctx.currentTime - startWall;
        setCurrentTime(startSec + elapsed);
        animFrameRef.current = requestAnimationFrame(tick);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      onError('Preview failed: ' + err.message);
      setIsPreviewing(false);
    }
  }

  // ─── Add Clip to Story (Cuts dialogue at EXACT RED LINE position) ───
  function handleAddClip() {
    if (!workingBuffer) return;

    // The cut point is wherever the red line currently sits
    const currentRedLine = audioRef.current ? audioRef.current.currentTime : currentTime;
    const cutEnd = currentRedLine > startTime ? currentRedLine : (endTime > startTime ? endTime : currentRedLine);

    const s = parseFloat(Math.max(0, startTime).toFixed(3));
    const e = parseFloat(Math.min(workingBuffer.duration, cutEnd).toFixed(3));

    if (e <= s || e - s < 0.05) {
      onError('Play or seek to dialogue end (red line) before adding clip.');
      return;
    }

    // Extract the audio slice for this clip from start to exact red line
    const clipBuffer = sliceAudioBuffer(workingBuffer, s, e);

    const clip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceFileId: audioFile.id,
      sourceFileName: audioFile.file.name,
      start: s,
      end: e,
      duration: parseFloat((e - s).toFixed(3)),
      buffer: clipBuffer,
    };

    onAddClip(clip);
  }

  if (!audioFile) {
    return (
      <div className="trimmer-empty">
        <div className="trimmer-empty-icon">✂️</div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Select a file to trim</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Click a character audio file in the library to start trimming.
        </div>
      </div>
    );
  }

  if (audioFile.loading) {
    return (
      <div className="trimmer-empty">
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Decoding audio…</div>
      </div>
    );
  }

  if (audioFile.error) {
    return (
      <div className="trimmer-empty" style={{ color: 'var(--danger)' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div>{audioFile.error}</div>
      </div>
    );
  }

  if (!workingBuffer || duration <= 0.05) {
    return (
      <div className="trimmer-empty">
        <div style={{ fontSize: 36 }}>🎉</div>
        <div style={{ color: 'var(--success)', fontWeight: 600 }}>All dialogues trimmed from this file!</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>
          All audio from "{audioFile.file.name}" has been added to your story timeline. Delete clips from the timeline if you want to restore any part.
        </div>
      </div>
    );
  }

  const displayName = audioFile.file.name.replace(/\.[^/.]+$/, '');
  const activeCutEnd = currentTime > startTime ? currentTime : (endTime > startTime ? endTime : currentTime);
  const selDuration = Math.max(0, activeCutEnd - startTime).toFixed(3);
  const canAdd = activeCutEnd > startTime + 0.04 && activeCutEnd <= duration + 0.001;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Panel Header */}
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`audio-file-avatar ${CHAR_COLORS[colorIdx]}`} style={{ width: 22, height: 22, fontSize: 10 }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="panel-title" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          {fileClips.length > 0 && (
            <span style={{ fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
              {fileClips.length} clip{fileClips.length > 1 ? 's' : ''} taken
            </span>
          )}
        </div>

        {/* ─── Zoom Controls: 1x, 2x, 4x, 8x ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-surface)', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 2 }}>Zoom:</span>
          {[1, 2, 4, 8].map((z) => (
            <button
              key={z}
              id={`zoom-btn-${z}x`}
              className={`btn btn-sm ${zoom === z ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '2px 6px', height: 20, fontSize: 10, minWidth: 24, fontWeight: zoom === z ? 700 : 400 }}
              onClick={() => handleZoomChange(z)}
              title={`Zoom ${z}x`}
            >
              {z}x
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          Remaining: {formatTime(duration)}
        </span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ─── DAW Waveform Canvas with Real-time Touch/Mouse Scrubbing ─── */}
        <div
          ref={containerRef}
          className="waveform-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            cursor: 'ew-resize',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative',
            background: '#0a0d14',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
          }}
        >
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            style={{
              height: 120,
              display: 'block',
              width: `${zoom * 100}%`,
              minWidth: '100%',
            }}
          />
          {zoom > 1 && (
            <div
              style={{
                position: 'sticky',
                left: 8,
                bottom: 4,
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(10, 13, 20, 0.85)',
                border: '1px solid var(--border)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                color: 'var(--accent-light)',
                fontFamily: 'JetBrains Mono, monospace',
                pointerEvents: 'none',
                width: 'fit-content',
                marginTop: -20,
              }}
            >
              🔍 {zoom}x Zoom • Scroll to pan
            </div>
          )}
        </div>

        {/* Hidden HTML audio element for main playback of remaining audio */}
        {workingUrl && (
          <audio
            ref={audioRef}
            src={workingUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleAudioEnded}
            onLoadedMetadata={handleLoadedMetadata}
            style={{ display: 'none' }}
          />
        )}

        {/* Current time display + play controls */}
        <div className="playback-row">
          <button
            id="trimmer-play-btn"
            className={`btn btn-icon ${isPlaying ? 'active' : ''}`}
            onClick={isPlaying ? handlePause : handlePlay}
            title={isPlaying ? 'Pause (sets End time)' : 'Play from Start'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="trimmer-stop-btn"
            className="btn btn-icon"
            onClick={handleStop}
            title="Stop & Return to Start"
          >
            ⏹
          </button>
          <div className="current-time-display" id="trimmer-current-time">
            {formatTime(currentTime)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            / {formatTime(duration)}
          </span>
        </div>

        {/* Time Inputs */}
        <div className="time-inputs">
          <div className="time-input-group">
            <label className="time-input-label" htmlFor="start-time-input" style={{ color: '#06b6d4' }}>
              Start Time
            </label>
            <input
              id="start-time-input"
              className="time-input"
              type="number"
              step="0.001"
              min="0"
              max={duration}
              value={startTime}
              onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="time-input-group">
            <label className="time-input-label" htmlFor="end-time-input" style={{ color: '#ef4444' }}>
              End Time (Set on Pause)
            </label>
            <input
              id="end-time-input"
              className="time-input"
              type="number"
              step="0.001"
              min="0"
              max={duration}
              value={endTime}
              onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Set Start / Set End / Reset */}
        <div className="set-btn-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <button
            id="set-start-btn"
            className="btn btn-secondary btn-full"
            onClick={handleSetStart}
          >
            ← Set Start
          </button>
          <button
            id="set-end-btn"
            className="btn btn-secondary btn-full"
            onClick={handleSetEnd}
          >
            Set End →
          </button>
          <button
            id="reset-cursor-btn"
            className="btn btn-icon"
            title="Reset playhead to beginning of remaining audio"
            onClick={() => {
              setStartTime(0);
              setEndTime(0);
              setCurrentTime(0);
              const audio = audioRef.current;
              if (audio) audio.currentTime = 0;
            }}
          >
            ↩
          </button>
        </div>

        {/* Selection info */}
        <div className="selection-info" id="selection-info">
          <span>Clip: <strong style={{ color: '#06b6d4' }}>{formatTime(startTime)}</strong> → <strong style={{ color: '#ef4444' }}>{formatTime(activeCutEnd)}</strong></span>
          <span style={{ marginLeft: 'auto', color: 'var(--accent-light)', fontWeight: 600 }}>
            Length: {selDuration}s
          </span>
        </div>

        {/* Preview + Add Clip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
          <button
            id="preview-btn"
            className={`btn btn-secondary ${isPreviewing ? 'active' : ''}`}
            onClick={isPreviewing ? stopPreview : handlePreview}
            disabled={!canAdd}
          >
            {isPreviewing ? '⏹ Stop Preview' : '▶ Preview Selection'}
          </button>

          <button
            id="add-clip-btn"
            className="btn btn-primary add-clip-btn"
            onClick={handleAddClip}
            disabled={!canAdd}
            style={{ fontWeight: 700 }}
          >
            ＋ Add Clip to Story
          </button>
        </div>
      </div>
    </div>
  );
}
