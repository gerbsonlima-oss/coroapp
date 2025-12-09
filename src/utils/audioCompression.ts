import lamejs from 'lamejs';

interface CompressionOptions {
  bitrate?: number;
  quality?: number;
}

const DEFAULT_BITRATE = 128;
const DEFAULT_QUALITY = 5;

export async function compressAudio(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const bitrate = options.bitrate || DEFAULT_BITRATE;
  const quality = options.quality || DEFAULT_QUALITY;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wav = audioBufferToWav(audioBuffer);
        const mp3 = audioToMp3(wav, audioBuffer.sampleRate, bitrate, quality);

        const mp3Blob = new Blob([mp3], { type: 'audio/mp3' });
        const originalSize = file.size;
        const compressedSize = mp3Blob.size;
        
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(
          `Audio compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`
        );

        const compressedFile = new File(
          [mp3Blob],
          file.name.replace(/\.[^.]+$/, '.mp3'),
          { type: 'audio/mp3' }
        );

        resolve(compressedFile);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo de áudio'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function audioBufferToWav(audioBuffer: AudioBuffer): Int16Array {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  const samples: number[] = [];
  
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      samples.push(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
    }
  }

  const wavData = new Int16Array(samples);
  return wavData;
}

function audioToMp3(
  wav: Int16Array,
  sampleRate: number,
  bitrate: number,
  quality: number
): Uint8Array {
  const encoder = new lamejs.Mp3Encoder(
    1,
    sampleRate,
    bitrate
  );

  const samples = new Int16Array(wav);
  const maxSamples = 1152;
  const mp3Data: number[] = [];

  for (let i = 0; i < samples.length; i += maxSamples) {
    const sampleChunk = samples.slice(i, i + maxSamples);
    const mp3buf = encoder.encodeBuffer(sampleChunk);
    for (let j = 0; j < mp3buf.length; j++) {
      mp3Data.push(mp3buf[j]);
    }
  }

  const mp3buf = encoder.flush();
  for (let i = 0; i < mp3buf.length; i++) {
    mp3Data.push(mp3buf[i]);
  }

  return new Uint8Array(mp3Data);
}

export function getCompressionInfo(
  originalSize: number,
  compressedSize: number
): {
  originalSizeMB: string;
  compressedSizeMB: string;
  compressionRatio: string;
} {
  const originalMB = (originalSize / 1024 / 1024).toFixed(2);
  const compressedMB = (compressedSize / 1024 / 1024).toFixed(2);
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  return {
    originalSizeMB: originalMB,
    compressedSizeMB: compressedMB,
    compressionRatio: ratio,
  };
}
