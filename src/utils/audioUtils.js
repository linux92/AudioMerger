// audioUtils.js — Pure Web Audio API utilities for the Audio Story Merger

/**
 * Decodes an audio File object into an AudioBuffer.
 * @param {File} file
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await ctx.decodeAudioData(e.target.result.slice(0));
        await ctx.close();
        resolve(buffer);
      } catch (err) {
        reject(new Error(`Failed to decode "${file.name}": ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Slices an AudioBuffer from startSec to endSec.
 * @param {AudioBuffer} buffer
 * @param {number} startSec
 * @param {number} endSec
 * @returns {AudioBuffer}
 */
export function sliceAudioBuffer(buffer, startSec, endSec) {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(Math.ceil(endSec * sampleRate), buffer.length);
  const frameCount = Math.max(0, endSample - startSample);

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, Math.max(1, frameCount), sampleRate);
  const sliced = ctx.createBuffer(buffer.numberOfChannels, Math.max(1, frameCount), sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    sliced.copyToChannel(channelData.slice(startSample, endSample), ch);
  }
  return sliced;
}

/**
 * Creates a silent AudioBuffer of given duration.
 * @param {number} durationSec
 * @param {number} sampleRate
 * @param {number} channels
 * @returns {AudioBuffer}
 */
export function createSilenceBuffer(durationSec, sampleRate = 44100, channels = 2) {
  const frameCount = Math.max(1, Math.floor(durationSec * sampleRate));
  const ctx = new OfflineAudioContext(channels, frameCount, sampleRate);
  return ctx.createBuffer(channels, frameCount, sampleRate);
}

/**
 * Concatenates an array of AudioBuffers into one.
 * All buffers are resampled/padded to match the first buffer's properties.
 * @param {AudioBuffer[]} buffers
 * @returns {AudioBuffer}
 */
export function concatenateBuffers(buffers) {
  if (!buffers || buffers.length === 0) throw new Error('No buffers to concatenate');

  const sampleRate = buffers[0].sampleRate;
  const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalFrames = buffers.reduce((sum, b) => sum + b.length, 0);

  const ctx = new OfflineAudioContext(numChannels, Math.max(1, totalFrames), sampleRate);
  const output = ctx.createBuffer(numChannels, Math.max(1, totalFrames), sampleRate);

  let offset = 0;
  for (const buf of buffers) {
    for (let ch = 0; ch < numChannels; ch++) {
      const src = ch < buf.numberOfChannels ? buf.getChannelData(ch) : new Float32Array(buf.length);
      output.copyToChannel(src, ch, offset);
    }
    offset += buf.length;
  }
  return output;
}

/**
 * Encodes an AudioBuffer as a 16-bit PCM WAV Blob.
 * @param {AudioBuffer} buffer
 * @returns {Blob}
 */
export function encodeWAV(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       // PCM chunk size
  view.setUint16(20, 1, true);        // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);       // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel data and write as 16-bit PCM
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Draws a professional DAW-style waveform on a canvas element from an AudioBuffer.
 * Includes time ruler, gradient peaks, and center axis.
 * @param {HTMLCanvasElement} canvas
 * @param {AudioBuffer} buffer
 * @param {number} [customWidth]
 * @param {number} [customHeight]
 * @param {number} [zoom=1]
 */
export function drawWaveform(canvas, buffer, customWidth, customHeight, zoom = 1) {
  const ctx = canvas.getContext('2d');
  const width = customWidth || canvas.offsetWidth || canvas.width;
  const height = customHeight || canvas.offsetHeight || canvas.height;
  const duration = buffer.duration;
  const data = buffer.getChannelData(0);

  ctx.clearRect(0, 0, width, height);

  // 1. Sleek DAW Background
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, width, height);

  const rulerH = 20;
  const waveTop = rulerH;
  const waveH = height - rulerH;
  const amp = waveH / 2;
  const midY = waveTop + amp;

  // 2. Time Ruler Header
  ctx.fillStyle = '#10141f';
  ctx.fillRect(0, 0, width, rulerH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, rulerH);
  ctx.lineTo(width, rulerH);
  ctx.stroke();

  // Dynamic time tick interval based on zoom and duration
  const pxPerSec = width / Math.max(0.1, duration);
  let tickInterval = 1;
  if (pxPerSec < 15) tickInterval = 10;
  else if (pxPerSec < 40) tickInterval = 5;
  else if (pxPerSec < 90) tickInterval = 2;
  else if (pxPerSec < 180) tickInterval = 1;
  else if (pxPerSec < 400) tickInterval = 0.5;
  else tickInterval = 0.2;

  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';

  const numTicks = Math.ceil(duration / tickInterval);
  for (let i = 0; i <= numTicks; i++) {
    const t = i * tickInterval;
    if (t > duration) break;
    const x = (t / duration) * width;

    // Major tick
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(x, rulerH - 6);
    ctx.lineTo(x, rulerH);
    ctx.stroke();

    // Subtle vertical grid line down the wave track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.moveTo(x, rulerH);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Time label
    const label = t < 60 ? `${t.toFixed(t % 1 === 0 ? 0 : 1)}s` : formatTime(t).slice(0, 5);
    ctx.fillText(label, x, rulerH - 8);

    // Minor sub-ticks
    const minorT = t + tickInterval / 2;
    if (minorT < duration) {
      const mx = (minorT / duration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(mx, rulerH - 3);
      ctx.lineTo(mx, rulerH);
      ctx.stroke();
    }
  }

  // 3. Center Zero Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // 4. Waveform Audio Peaks (Luminous Neon Gradient)
  const gradient = ctx.createLinearGradient(0, waveTop, 0, height);
  gradient.addColorStop(0, '#06b6d4');   // Bright Cyan
  gradient.addColorStop(0.3, '#3b82f6'); // Royal Blue
  gradient.addColorStop(0.5, '#6366f1'); // Electric Indigo
  gradient.addColorStop(0.7, '#8b5cf6'); // Purple
  gradient.addColorStop(1, '#06b6d4');   // Cyan Bottom
  ctx.fillStyle = gradient;

  const barWidth = 2;
  const barGap = 1;
  const totalBarSlot = barWidth + barGap;
  const numBars = Math.floor(width / totalBarSlot);
  const samplesPerBar = Math.max(1, Math.floor(data.length / numBars));

  for (let b = 0; b < numBars; b++) {
    const x = b * totalBarSlot;
    const startSample = b * samplesPerBar;
    const endSample = Math.min(startSample + samplesPerBar, data.length);

    let min = 1.0;
    let max = -1.0;
    for (let j = startSample; j < endSample; j++) {
      const datum = data[j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }

    if (min > max) { min = 0; max = 0; }

    const peak = Math.max(Math.abs(min), Math.abs(max));
    const barH = Math.max(2, peak * amp * 0.95);

    // Draw rounded soundwave bar
    const yTop = midY - barH;
    const yBottom = barH * 2;
    ctx.fillRect(x, yTop, barWidth, yBottom);
  }
}

/**
 * Draws a selection overlay on a canvas for start/end range.
 * @param {HTMLCanvasElement} canvas
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} totalDuration
 * @param {number} currentTime
 */
export function drawSelection(canvas, startSec, endSec, totalDuration, currentTime) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  if (totalDuration <= 0) return;

  // Selection highlight
  const sx = (startSec / totalDuration) * width;
  const ex = (endSec / totalDuration) * width;

  ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
  ctx.fillRect(sx, 0, ex - sx, height);

  // Selection borders
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex, 0);
  ctx.lineTo(ex, height);
  ctx.stroke();

  // Playhead
  if (currentTime >= 0) {
    const px = (currentTime / totalDuration) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
  }
}

/**
 * Formats seconds to mm:ss.SSS string.
 * @param {number} secs
 * @returns {string}
 */
export function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return '00:00.000';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/**
 * Parses mm:ss.SSS string to seconds.
 * @param {string} str
 * @returns {number}
 */
export function parseTime(str) {
  if (typeof str === 'number') return str;
  const parts = str.trim().split(':');
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return parseFloat(str) || 0;
}
