// ExportButton.jsx — Export merged WAV file
import { useState } from 'react';
import { sliceAudioBuffer, createSilenceBuffer, concatenateBuffers, encodeWAV } from '../utils/audioUtils';

export default function ExportButton({ clips, audioFiles, gapSeconds, onError, onClearProject }) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  async function handleExport() {
    if (clips.length === 0) {
      onError('No clips in the timeline. Add some clips before exporting.');
      return;
    }

    // Validate all source files exist and are decoded
    for (const clip of clips) {
      const af = audioFiles.find((f) => f.file.name === clip.sourceFileName);
      if (!af) {
        onError(`Source file "${clip.sourceFileName}" is not in the audio library.`);
        return;
      }
      if (!af.buffer) {
        onError(`Source file "${clip.sourceFileName}" has not finished loading. Please wait.`);
        return;
      }
    }

    setExporting(true);
    setProgress('Preparing audio segments…');

    try {
      const sampleRate = audioFiles[0].buffer.sampleRate;
      const numChannels = Math.max(...audioFiles.filter((af) => af.buffer).map((af) => af.buffer.numberOfChannels));
      const silenceBuffer = gapSeconds > 0
        ? createSilenceBuffer(gapSeconds, sampleRate, numChannels)
        : null;

      const bufferParts = [];

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        setProgress(`Processing clip ${i + 1} / ${clips.length}: ${clip.sourceFileName.replace(/\.[^/.]+$/, '')}…`);

        const af = audioFiles.find((f) => f.file.name === clip.sourceFileName);
        const sliced = clip.buffer || (af?.buffer ? sliceAudioBuffer(af.buffer, clip.start, clip.end) : null);
        if (sliced) bufferParts.push(sliced);

        if (silenceBuffer && i < clips.length - 1) {
          bufferParts.push(silenceBuffer);
        }

        // Yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }

      setProgress('Concatenating clips…');
      await new Promise((r) => setTimeout(r, 0));
      const merged = concatenateBuffers(bufferParts);

      setProgress('Encoding WAV…');
      await new Promise((r) => setTimeout(r, 0));
      const wavBlob = encodeWAV(merged);

      setProgress('Downloading…');
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'story_final.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExporting(false);
      setProgress('');
      setShowSuccessModal(true);
    } catch (err) {
      setExporting(false);
      setProgress('');
      onError('Export failed: ' + err.message);
    }
  }

  return (
    <>
      <button
        id="export-btn"
        className="btn btn-export"
        onClick={handleExport}
        disabled={exporting || clips.length === 0}
        title={clips.length === 0 ? 'Add clips to the timeline first' : 'Export merged WAV'}
      >
        {exporting ? '⏳ Exporting…' : '⬇ Export WAV'}
      </button>

      {/* Export progress overlay */}
      {exporting && (
        <div className="export-overlay">
          <div className="export-card">
            <div className="export-spinner" />
            <div className="export-title">Exporting Story Audio</div>
            <div className="export-subtitle">{progress}</div>
          </div>
        </div>
      )}

      {/* Export success & Clear Database dialog */}
      {showSuccessModal && (
        <div className="export-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="export-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <div className="export-title" style={{ fontSize: 18, color: '#fff', marginBottom: 8 }}>
              Export Complete!
            </div>
            <div className="export-subtitle" style={{ marginBottom: 20, lineHeight: 1.6 }}>
              Your merged audio (<strong>story_final.wav</strong>) has been downloaded to your computer.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                id="clear-after-export-btn"
                className="btn btn-danger"
                style={{ background: 'var(--danger-dim)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: 10, borderRadius: 8 }}
                onClick={() => {
                  setShowSuccessModal(false);
                  onClearProject && onClearProject();
                }}
              >
                🗑️ Delete Stored Audio from IndexedDB & Start Fresh
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: 10, borderRadius: 8 }}
                onClick={() => setShowSuccessModal(false)}
              >
                Keep Project in Storage
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
