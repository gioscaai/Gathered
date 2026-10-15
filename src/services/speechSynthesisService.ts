// Speech Synthesis Service with Smart Quality Voice Scoring & Optional Gemini AI Audio

export interface RankedVoice {
  voice: SpeechSynthesisVoice;
  score: number;
  isNatural: boolean;
  tag: string;
}

export function scoreVoiceQuality(voice: SpeechSynthesisVoice, langCode: string): number {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const targetPrefix = langCode.toLowerCase().split('-')[0];

  // Penalize robotic legacy voices
  if (
    name.includes('espeak') ||
    name.includes('klatt') ||
    name.includes('robotic') ||
    name.includes('desktop legacy') ||
    name.includes('compact') ||
    name.includes('zira desktop') ||
    name.includes('david desktop')
  ) {
    return -100;
  }

  // Dialect matching
  if (targetPrefix === 'en') {
    if (lang === 'en-us' || lang === 'en-gb') score += 25;
  } else if (targetPrefix === 'es') {
    if (lang === 'es-es' || lang === 'es-us' || lang === 'es-mx') score += 25;
  } else if (targetPrefix === 'it') {
    if (lang === 'it-it') score += 25;
  }

  // Neural / Natural models (Edge, Windows, macOS, Chrome)
  if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
    score += 80;
  }
  if (name.includes('premium') || name.includes('enhanced') || name.includes('siri')) {
    score += 75;
  }

  // Google voices (vastly superior to default Android/desktop synthesizers)
  if (name.includes('google')) {
    score += 65;
  }

  // High quality Apple voices
  if (
    name.includes('samantha') ||
    name.includes('daniel') ||
    name.includes('jorge') ||
    name.includes('monica') ||
    name.includes('paulina') ||
    name.includes('alice') ||
    name.includes('federica') ||
    name.includes('karen')
  ) {
    score += 60;
  }

  // High quality Microsoft modern voices
  if (
    name.includes('jenny') ||
    name.includes('guy') ||
    name.includes('aria') ||
    name.includes('helena') ||
    name.includes('laura') ||
    name.includes('alvaro') ||
    name.includes('elsa')
  ) {
    score += 70;
  }

  return score;
}

class SpeechSynthesisManager {
  private queue: string[] = [];
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private selectedLanguageCode: string = 'en';
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private rate: number = 1.05;
  private volume: number = 1.0;
  private isMuted: boolean = false;
  private useAiVoice: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private onStatusChangeCallbacks: Set<(status: { isSpeaking: boolean; queueLength: number }) => void> = new Set();
  private heartbeatInterval: any = null;
  private unlockedMobileAudio = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.useAiVoice = localStorage.getItem('gathered_use_ai_voice') === 'true';

      if ('speechSynthesis' in window) {
        this.loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            this.loadVoices();
          };
        }
      }
    }
  }

  public unlockMobileAudio(): void {
    if (this.unlockedMobileAudio || typeof window === 'undefined') return;
    this.unlockedMobileAudio = true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        ctx.resume().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
    this.updateVoiceForCurrentLanguage();
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  public getVoicesForLanguage(langCode: string): SpeechSynthesisVoice[] {
    const all = this.getAvailableVoices();
    const normalized = langCode.toLowerCase().split('-')[0];
    return all.filter((v) => v.lang.toLowerCase().startsWith(normalized));
  }

  public getRankedVoicesForLanguage(langCode: string): RankedVoice[] {
    const voices = this.getVoicesForLanguage(langCode);
    return voices
      .map((v) => {
        const score = scoreVoiceQuality(v, langCode);
        const isNatural = score >= 50;
        let tag = 'Standard';
        if (score >= 70) tag = '⭐ Naturale HD';
        else if (score >= 40) tag = 'Buona Qualità';
        else if (score < 0) tag = 'Sintetica/Robotica';

        return { voice: v, score, isNatural, tag };
      })
      .sort((a, b) => b.score - a.score);
  }

  public setLanguage(langCode: string): void {
    this.selectedLanguageCode = langCode;
    this.updateVoiceForCurrentLanguage();
  }

  public setVoiceByURI(voiceURI: string): void {
    const all = this.getAvailableVoices();
    const found = all.find((v) => v.voiceURI === voiceURI || v.name === voiceURI);
    if (found) {
      this.selectedVoice = found;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`gathered_voice_${this.selectedLanguageCode}`, found.voiceURI);
      }
    }
  }

  public getCurrentVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  public setUseAiVoice(enabled: boolean): void {
    this.useAiVoice = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gathered_use_ai_voice', enabled ? 'true' : 'false');
    }
  }

  public getUseAiVoice(): boolean {
    return this.useAiVoice;
  }

  private updateVoiceForCurrentLanguage(): void {
    const ranked = this.getRankedVoicesForLanguage(this.selectedLanguageCode);
    if (ranked.length === 0) {
      this.selectedVoice = null;
      return;
    }

    // Check user preference in localStorage
    if (typeof window !== 'undefined') {
      const savedURI = localStorage.getItem(`gathered_voice_${this.selectedLanguageCode}`);
      if (savedURI) {
        const foundSaved = ranked.find((r) => r.voice.voiceURI === savedURI || r.voice.name === savedURI);
        if (foundSaved) {
          this.selectedVoice = foundSaved.voice;
          return;
        }
      }
    }

    // Automatically pick the highest scored natural voice!
    this.selectedVoice = ranked[0].voice;
  }

  public setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1.0, volume));
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.cancel();
    }
  }

  public subscribeStatus(cb: (status: { isSpeaking: boolean; queueLength: number }) => void): () => void {
    this.onStatusChangeCallbacks.add(cb);
    cb({ isSpeaking: this.isSpeaking, queueLength: this.queue.length });
    return () => this.onStatusChangeCallbacks.delete(cb);
  }

  private notifyStatus(): void {
    const status = { isSpeaking: this.isSpeaking, queueLength: this.queue.length };
    this.onStatusChangeCallbacks.forEach((cb) => cb(status));
  }

  // Enqueue a translated text segment
  public speak(text: string): void {
    if (this.isMuted || !text || !text.trim()) return;

    const cleanText = text.replace(/[*_#`~[\]]/g, '').trim();
    if (!cleanText) return;

    this.queue.push(cleanText);
    this.notifyStatus();

    if (this.queue.length > 3) {
      this.queue = this.queue.slice(-2);
    }

    if (!this.isSpeaking) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.currentAudioElement = null;
      this.stopHeartbeat();
      this.notifyStatus();
      return;
    }

    const text = this.queue.shift()!;
    this.isSpeaking = true;
    this.notifyStatus();

    // Mode A: High-Definition Gemini AI Audio
    if (this.useAiVoice) {
      try {
        const audioBlob = await this.fetchGeminiTtsAudio(text);
        if (audioBlob) {
          await this.playAudioBlob(audioBlob);
          this.isSpeaking = false;
          this.notifyStatus();
          setTimeout(() => this.processQueue(), 120);
          return;
        }
      } catch (err) {
        console.warn('[Speech] Fallback to natural browser voice:', err);
      }
    }

    // Mode B: High-Quality Browser Speech Synthesis
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.isSpeaking = false;
        this.notifyStatus();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang;
      } else {
        utterance.lang = this.selectedLanguageCode;
      }

      utterance.rate = this.rate;
      utterance.volume = this.volume;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.notifyStatus();
        setTimeout(() => this.processQueue(), 120);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.warn('Speech synthesis utterance error:', e.error);
        }
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.notifyStatus();
        setTimeout(() => this.processQueue(), 100);
      };

      this.startHeartbeat();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Errore durante la riproduzione vocale:', err);
      this.isSpeaking = false;
      this.notifyStatus();
    }
  }

  private async fetchGeminiTtsAudio(text: string): Promise<Blob | null> {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang: this.selectedLanguageCode,
        voiceName: 'Kore',
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioBase64) return null;

    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: data.mimeType || 'audio/wav' });
  }

  private playAudioBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudioElement = audio;
      audio.volume = this.volume;
      audio.playbackRate = this.rate;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudioElement = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudioElement = null;
        resolve();
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        this.currentAudioElement = null;
        resolve();
      });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public cancel(): void {
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement = null;
    }
    this.stopHeartbeat();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
    this.notifyStatus();
  }

  public playTestSample(langCode: string, sampleText?: string): void {
    const defaultSamples: Record<string, string> = {
      en: 'Welcome. Simultaneous interpretation is loud and clear.',
      es: 'Bienvenidos. La interpretación simultánea se escucha con total claridad.',
      it: 'Benvenuti. La traduzione simultanea è attiva e si sente perfettamente.',
      fr: 'Bienvenue. La traduction simultanée est claire et active.',
      de: 'Herzlich willkommen. Die Simultanübersetzung ist deutlich hörbar.',
      pt: 'Bem-vindos. A tradução simultânea está clara e ativa.',
      ro: 'Bun venit. Traducerea simultană este clară și activă.',
      uk: 'Ласкаво просимо. Синхронний переклад чіткий та активний.',
      zh: '欢迎。同声传译清晰流畅。',
      ar: 'أهلاً بكم. الترجمة الفورية واضحة ونشطة.',
    };

    const textToSpeak = sampleText || defaultSamples[langCode] || defaultSamples.en;
    this.cancel();
    this.setLanguage(langCode);
    this.speak(textToSpeak);
  }
}

export const speechManager = new SpeechSynthesisManager();
