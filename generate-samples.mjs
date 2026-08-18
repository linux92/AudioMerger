/**
 * generate-samples.mjs
 * Generates synthetic WAV audio files for testing:
 *   - NarratorFullAudio.wav  (60s, 220 Hz tone)
 *   - RamuFullAudio.wav      (60s, 330 Hz tone)
 *   - ShopkeeperFullAudio.wav (60s, 440 Hz tone)
 *
 * Run: node generate-samples.mjs
 */
import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const DURATION_SECS = 60;

function generateToneWAV(frequency, durationSecs, outputPath) {
  const numFrames = SAMPLE_RATE * durationSecs;
  const dataSize = numFrames * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const bufferSize = 44 + dataSize;

  const buffer = Buffer.alloc(bufferSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;           // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;            // PCM
  buffer.writeUInt16LE(NUM_CHANNELS, offset); offset += 2;
  buffer.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), offset); offset += 4;
  buffer.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), offset); offset += 2;
  buffer.writeUInt16LE(BITS_PER_SAMPLE, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Generate tones with amplitude envelope to make them sound natural
  const amplitude = 0.5;
  for (let i = 0; i < numFrames; i++) {
    // Add gentle fade in/out at the boundaries (0.5s each)
    let env = 1.0;
    const fadeFrames = SAMPLE_RATE * 0.5;
    if (i < fadeFrames) env = i / fadeFrames;
    else if (i > numFrames - fadeFrames) env = (numFrames - i) / fadeFrames;

    // Mix in harmonics to make it sound like speech-like tones
    const t = i / SAMPLE_RATE;
    const sample = env * amplitude * (
      Math.sin(2 * Math.PI * frequency * t) * 0.6 +
      Math.sin(2 * Math.PI * frequency * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * frequency * 3 * t) * 0.1 +
      Math.sin(2 * Math.PI * frequency * 0.5 * t) * 0.1
    );

    const pcm = Math.round(sample * 32767);
    const clamped = Math.max(-32768, Math.min(32767, pcm));

    for (let ch = 0; ch < NUM_CHANNELS; ch++) {
      buffer.writeInt16LE(clamped, offset);
      offset += 2;
    }
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated: ${outputPath} (${durationSecs}s @ ${frequency}Hz)`);
}

const outputDir = path.resolve('./public/samples');
fs.mkdirSync(outputDir, { recursive: true });

generateToneWAV(220, DURATION_SECS, path.join(outputDir, 'NarratorFullAudio.wav'));
generateToneWAV(330, DURATION_SECS, path.join(outputDir, 'RamuFullAudio.wav'));
generateToneWAV(440, DURATION_SECS, path.join(outputDir, 'ShopkeeperFullAudio.wav'));

console.log('\n✅ Sample WAV files generated in public/samples/');
console.log('Open http://localhost:5173 and import them from the Audio Library panel.');
