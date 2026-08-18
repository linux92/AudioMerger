// StoryTimeline.jsx — Ordered clip list with playback and reordering
import { useRef, useState, useEffect } from 'react';
import { formatTime, sliceAudioBuffer, createSilenceBuffer, concatenateBuffers } from '../utils/audioUtils';

const CHAR_COLORS = [
  'char-0', 'char-1', 'char-2', 'char-3',
  'char-4', 'char-5', 'char-6', 'char-7',
];

function getCharColorClass(fileName, audioFiles) {
  const idx = audioFiles.findIndex((af) => af.file.name === fileName);
  return CHAR_COLORS[Math.max(0, idx) % CHAR_COLORS.length];
}

export default function StoryTimeline({
  clips,
  audioFiles,
  gapSeconds,
  onGapChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onError,
}) {
  const [playingClipId, setPlayingClipId] = useState(null);
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const sourceRef = useRef(null);
  const audioCtxRef = useRef(null);
  const storySourcesRef = useRef([]);
  const storyCtxRef = useRef(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  async function stopAll() {
    // Stop single clip
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) {}
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try { await audioCtxRef.current.close(); } catch (_) {}
      audioCtxRef.current = null;
    }
    // Stop story
    for (const s of storySourcesRef.current) {
      try { s.stop(); } catch (_) {}
    }
    storySourcesRef.current = [];
    if (storyCtxRef.current) {
      try { await storyCtxRef.current.close(); } catch (_) {}
      storyCtxRef.current = null;
    }
    setPlayingClipId(null);
    setIsPlayingStory(false);
  }

  // ─── Play a single clip ───
  async function handlePlayClip(clip) {
    await stopAll();

    const af = audioFiles.find((f) => f.file.name === clip.sourceFileName);
    if (!clip.buffer && !af?.buffer) { onError('Source audio not found or not decoded yet.'); return; }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createBufferSource();
      sourceRef.current = source;
      source.buffer = clip.buffer || af.buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlayingClipId(null);
        sourceRef.current = null;
      };
      if (clip.buffer) {
        source.start(0, 0, clip.buffer.duration);
      } else {
        source.start(0, clip.start, clip.duration);
      }
      setPlayingClipId(clip.id);
    } catch (err) {
      onError('Playback failed: ' + err.message);
    }
  }

  // ─── Play entire story ───
  async function handlePlayStory() {
    if (clips.length === 0) { onError('No clips in the timeline to play.'); return; }
    await stopAll();

    // Gather all needed AudioBuffers
    const missing = clips.filter((c) => {
      const af = audioFiles.find((f) => f.file.name === c.sourceFileName);
      return !af?.buffer;
    });
    if (missing.length > 0) {
      onError(`Some source files are not loaded: ${missing.map((c) => c.sourceFileName).join(', ')}`);
      return;
    }

    try {
      const sampleRate = audioFiles[0].buffer.sampleRate;
      const numChannels = Math.max(...audioFiles.map((af) => af.buffer?.numberOfChannels || 1));

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      storyCtxRef.current = ctx;

      let when = ctx.currentTime + 0.1;

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const af = audioFiles.find((f) => f.file.name === clip.sourceFileName);
        const source = ctx.createBufferSource();
        storySourcesRef.current.push(source);
        source.buffer = clip.buffer || af?.buffer;
        source.connect(ctx.destination);
        if (clip.buffer) {
          source.start(when, 0, clip.buffer.duration);
        } else {
          source.start(when, clip.start, clip.duration);
        }
        when += clip.duration;
        if (i < clips.length - 1) when += gapSeconds;
      }

      // Mark as finished after estimated total time
      const totalDuration = clips.reduce((s, c) => s + c.duration, 0) + gapSeconds * Math.max(0, clips.length - 1);
      setIsPlayingStory(true);
      setTimeout(() => {
        setIsPlayingStory(false);
        storySourcesRef.current = [];
      }, (totalDuration + 0.5) * 1000);
    } catch (err) {
      onError('Story playback failed: ' + err.message);
      setIsPlayingStory(false);
    }
  }

  const totalDuration = clips.reduce((s, c) => s + c.duration, 0) + gapSeconds * Math.max(0, clips.length - 1);

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="panel-title">
            Story Timeline
            {clips.length > 0 && <span className="badge">{clips.length}</span>}
          </span>
          {clips.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ~{formatTime(totalDuration)}
            </span>
          )}
        </div>
      </div>

      <div className="panel-body">
        {clips.length === 0 ? (
          <div className="timeline-empty">
            <div className="timeline-empty-icon">📋</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              No clips yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Trim audio in the center panel and click "Add Clip to Story"
            </div>
          </div>
        ) : (
          <div className="timeline-list" id="story-timeline-list">
            {clips.map((clip, idx) => {
              const colorClass = getCharColorClass(clip.sourceFileName, audioFiles);
              const displayName = clip.sourceFileName.replace(/\.[^/.]+$/, '');
              const isPlaying = playingClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  className="clip-card"
                  id={`clip-card-${clip.id}`}
                  style={isPlaying ? { borderColor: 'var(--border-active)', background: 'var(--accent-dim2)' } : {}}
                >
                  <div className="clip-card-header">
                    <span className="clip-index">#{idx + 1}</span>
                    <div className={`clip-avatar ${colorClass}`}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="clip-name" title={displayName}>{displayName}</span>
                    <div className="clip-actions">
                      <button
                        className={`btn btn-icon${isPlaying ? ' active' : ''}`}
                        id={`play-clip-btn-${clip.id}`}
                        onClick={() => isPlaying ? stopAll() : handlePlayClip(clip)}
                        title={isPlaying ? 'Stop' : 'Play clip'}
                      >
                        {isPlaying ? '⏹' : '▶'}
                      </button>
                      <button
                        className="btn btn-icon"
                        id={`move-up-btn-${clip.id}`}
                        onClick={() => onMoveUp(idx)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="btn btn-icon"
                        id={`move-down-btn-${clip.id}`}
                        onClick={() => onMoveDown(idx)}
                        disabled={idx === clips.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="btn btn-icon btn-danger"
                        id={`delete-clip-btn-${clip.id}`}
                        onClick={() => onDelete(clip.id)}
                        title="Delete clip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="clip-times">
                    <div className="clip-time-range">
                      <span>{formatTime(clip.start)}</span>
                      <span className="clip-arrow">→</span>
                      <span>{formatTime(clip.end)}</span>
                    </div>
                    <span className="clip-duration">{clip.duration.toFixed(2)}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel-footer">
        {/* Gap control */}
        <div className="gap-control" style={{ marginBottom: 10 }}>
          <label className="gap-label" htmlFor="gap-slider">Gap between clips:</label>
          <input
            id="gap-slider"
            type="range"
            className="gap-slider"
            min="0"
            max="2"
            step="0.1"
            value={gapSeconds}
            onChange={(e) => onGapChange(parseFloat(e.target.value))}
          />
          <span className="gap-value">{gapSeconds.toFixed(1)}s</span>
        </div>

        {/* Playback buttons */}
        <div className="playback-btn-row">
          <button
            id="play-story-btn"
            className={`btn btn-full${isPlayingStory ? ' btn-secondary' : ' btn-success'}`}
            onClick={isPlayingStory ? stopAll : handlePlayStory}
            disabled={clips.length === 0}
          >
            {isPlayingStory ? '⏹ Stop' : '▶ Play Story'}
          </button>
        </div>
      </div>
    </>
  );
}
