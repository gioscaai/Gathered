// Audio Recorder Service for slicing microphone audio into 6-8s standalone chunks

export interface ChunkReadyEvent {
  chunkIndex: number;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
}

export type ChunkReadyCallback = (chunk: ChunkReadyEvent) => void;
export type VolumeCallback = (volume: number) => void;
export type ProgressCallback = (progress: { elapsedSeconds: number; totalSeconds: number; percent: number }) => void;

class AudioRecorderManager {
  private mediaStream: MediaStream | null = null;
  private currentRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private chunkTimer: any = null;
  private progressTimer: any = null;

  private isRecording: boolean = false;
  private chunkIndex: number = 0;
  private chunkDurationMs: number = 7000; // 7 seconds default (optimized for 6-8s window)
  private chunkStartTime: number = 0;

  private onChunkReadyCb: ChunkReadyCallback | null = null;
  private onVolumeCb: VolumeCallback | null = null;
  private onProgressCb: ProgressCallback | null = null;

  public getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  public async startStreaming(options: {
    chunkDurationSeconds?: number;
    onChunkReady: ChunkReadyCallback;
    onVolume?: VolumeCallback;
    onProgress?: ProgressCallback;
  }): Promise<boolean> {
    if (this.isRecording) return true;

    this.chunkDurationMs = (options.chunkDurationSeconds || 7) * 1000;
    this.onChunkReadyCb = options.onChunkReady;
    this.onVolumeCb = options.onVolume || null;
    this.onProgressCb = options.onProgress || null;
    this.chunkIndex = 0;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Audio analysis for Shazam visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      this.startVolumeMonitoring();

      this.isRecording = true;
      this.startNextChunk();
      return true;
    } catch (err: any) {
      console.error('[AudioRecorder] Errore accesso microfono:', err);
      this.stopStreaming();
      throw err;
    }
  }

  private startNextChunk(): void {
    if (!this.isRecording || !this.mediaStream) return;

    this.chunkIndex += 1;
    const currentChunkNumber = this.chunkIndex;
    const mimeType = this.getSupportedMimeType();
    const recordedBlobs: Blob[] = [];

    try {
      this.currentRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      console.warn('[AudioRecorder] Fallback default MediaRecorder:', e);
      this.currentRecorder = new MediaRecorder(this.mediaStream);
    }

    this.currentRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    };

    this.currentRecorder.onstop = async () => {
      const actualDuration = Date.now() - this.chunkStartTime;
      if (recordedBlobs.length > 0 && this.onChunkReadyCb) {
        const fullBlob = new Blob(recordedBlobs, { type: this.currentRecorder?.mimeType || 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const base64Audio = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          if (this.onChunkReadyCb && base64Audio) {
            this.onChunkReadyCb({
              chunkIndex: currentChunkNumber,
              audioBase64: base64Audio,
              mimeType: fullBlob.type || 'audio/webm',
              durationMs: actualDuration,
            });
          }
        };
        reader.readAsDataURL(fullBlob);
      }
    };

    // Start recording
    this.chunkStartTime = Date.now();
    this.currentRecorder.start(250);

    // Schedule next chunk stop and transition
    this.chunkTimer = setTimeout(() => {
      if (this.isRecording && this.currentRecorder && this.currentRecorder.state !== 'inactive') {
        this.currentRecorder.stop();
        // Immediately start next slice without losing words
        this.startNextChunk();
      }
    }, this.chunkDurationMs);

    // Progress updates for UI radial countdown
    this.startProgressTicker();
  }

  private startProgressTicker(): void {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(this.progressTimer);
        return;
      }
      const elapsed = Date.now() - this.chunkStartTime;
      const total = this.chunkDurationMs;
      const percent = Math.min(100, (elapsed / total) * 100);
      if (this.onProgressCb) {
        this.onProgressCb({
          elapsedSeconds: elapsed / 1000,
          totalSeconds: total / 1000,
          percent,
        });
      }
    }, 100);
  }

  private startVolumeMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!this.isRecording || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedVolume = Math.min(1.0, average / 128);

      if (this.onVolumeCb) {
        this.onVolumeCb(normalizedVolume);
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  public stopStreaming(): void {
    this.isRecording = false;

    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = null;
    }

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.currentRecorder && this.currentRecorder.state !== 'inactive') {
      try {
        this.currentRecorder.stop();
      } catch (e) {
        // ignore
      }
      this.currentRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.onProgressCb) {
      this.onProgressCb({ elapsedSeconds: 0, totalSeconds: this.chunkDurationMs / 1000, percent: 0 });
    }
    if (this.onVolumeCb) {
      this.onVolumeCb(0);
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}

export const audioRecorder = new AudioRecorderManager();
