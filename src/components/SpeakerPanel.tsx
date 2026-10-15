import React, { useState, useEffect } from 'react';
import {
  Radio,
  Mic,
  ShieldCheck,
  Activity,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ShazamOrb } from './ShazamOrb';
import { LanguageOption, TranslatedChunk } from '../types';
import { audioRecorder } from '../services/audioRecorderService';

interface SpeakerPanelProps {
  roomCode: string;
  languages: LanguageOption[];
  onUploadChunk: (chunkData: {
    chunkIndex: number;
    audioBase64: string;
    mimeType: string;
    speakerName: string;
  }) => Promise<void>;
  recentChunks: TranslatedChunk[];
  onTriggerDemo?: () => void;
  isProcessingChunk: boolean;
}

export const SpeakerPanel: React.FC<SpeakerPanelProps> = ({
  roomCode,
  languages,
  onUploadChunk,
  recentChunks,
  onTriggerDemo,
  isProcessingChunk,
}) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0);
  const [chunkDuration, setChunkDuration] = useState<number>(7); // 7s default
  const [progress, setProgress] = useState<{ elapsedSeconds: number; totalSeconds: number; percent: number }>({
    elapsedSeconds: 0,
    totalSeconds: 7,
    percent: 0,
  });
  const [speakerName, setSpeakerName] = useState<string>('Oratore');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalChunksSent, setTotalChunksSent] = useState<number>(0);

  // Stop recording if component unmounts
  useEffect(() => {
    return () => {
      audioRecorder.stopStreaming();
    };
  }, []);

  const handleToggleStreaming = async () => {
    if (isStreaming) {
      audioRecorder.stopStreaming();
      setIsStreaming(false);
      setProgress({ elapsedSeconds: 0, totalSeconds: chunkDuration, percent: 0 });
      setVolume(0);
    } else {
      setErrorMsg(null);
      try {
        await audioRecorder.startStreaming({
          chunkDurationSeconds: chunkDuration,
          onChunkReady: async (chunk) => {
            setTotalChunksSent((prev) => prev + 1);
            try {
              await onUploadChunk({
                chunkIndex: chunk.chunkIndex,
                audioBase64: chunk.audioBase64,
                mimeType: chunk.mimeType,
                speakerName: speakerName || 'Oratore',
              });
            } catch (err: any) {
              console.error('Errore invio chunk:', err);
              setErrorMsg(err?.message || 'Errore durante l\'elaborazione del chunk');
            }
          },
          onVolume: (v) => setVolume(v),
          onProgress: (p) => setProgress(p),
        });
        setIsStreaming(true);
      } catch (err: any) {
        console.error('Impossibile accedere al microfono:', err);
        setErrorMsg(
          'Accesso al microfono non concesso. Verifica i permessi del browser o usa la modalità simulata.'
        );
      }
    }
  };

  const latestChunk = recentChunks.length > 0 ? recentChunks[recentChunks.length - 1] : null;
  const secondsLeft = Math.max(0, chunkDuration - progress.elapsedSeconds);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-3 sm:px-4 py-2 space-y-4 sm:space-y-6">
      {/* Central Magnetic Shazam Orb */}
      <div className="w-full flex flex-col items-center">
        <ShazamOrb
          role="speaker"
          isActive={isStreaming}
          isProcessing={isProcessingChunk}
          volume={volume}
          progressPercent={progress.percent}
          secondsLeft={secondsLeft}
          onClick={handleToggleStreaming}
          statusLabel={isStreaming ? 'Streaming Audio in Corso' : 'Tocca per Trasmettere'}
          subLabel={
            isStreaming
              ? `Invio automatico blocchi ogni ${chunkDuration}s a Gemini Flash`
              : 'Tocca per iniziare a catturare il microfono dello smartphone o mixer'
          }
        />

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 max-w-md w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Free Tier Rate-Limit Safety & Configuration Card */}
      <div className="w-full bg-[#0d121c]/80 border border-white/5 rounded-2xl p-4 sm:p-5 backdrop-blur-md space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Consumo Free Tier Gemini (Basso Rate-Limit)</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Blocchi da {chunkDuration}s generano ~{Math.round(60 / chunkDuration)} chiamate/min (sotto il limite di 15 RPM).
            </p>
          </div>

          {/* Chunk Interval Selector with generous touch targets */}
          <div className="flex items-center gap-1 self-start sm:self-auto bg-white/[0.04] border border-white/10 rounded-xl p-1">
            <span className="text-[11px] text-slate-400 px-1.5 font-medium">Blocco:</span>
            {[6, 7, 8].map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={isStreaming}
                onClick={() => setChunkDuration(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                  chunkDuration === sec
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white disabled:opacity-50'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Live Audio Meter & Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/5 text-xs">
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <span className="text-slate-400 shrink-0 text-[11px]">Livello Mic:</span>
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-75 rounded-full"
                style={{ width: `${Math.min(100, volume * 140)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:justify-center">
            <span className="text-slate-400 text-[11px]">Chunk inviati:</span>
            <span className="font-mono font-bold text-slate-200 tabular-nums">{totalChunksSent}</span>
          </div>

          <div className="flex items-center justify-end">
            {onTriggerDemo && (
              <button
                type="button"
                onClick={onTriggerDemo}
                className="flex items-center gap-1 text-cyan-400 active:text-cyan-200 text-xs font-medium transition-colors cursor-pointer py-1 px-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 min-h-[36px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simula chunk</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Feedback of Last Transcribed Chunk */}
      <div className="w-full bg-gradient-to-b from-[#111726]/95 to-[#0c101b]/95 border border-blue-500/20 rounded-2xl p-4 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-2.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
            <Activity className="w-3.5 h-3.5" />
            <span>Ultima Trascrizione Rilevata</span>
          </span>
          {latestChunk && (
            <span className="font-mono text-slate-500 text-[10px] sm:text-[11px] tabular-nums">
              #{latestChunk.chunkIndex} · {latestChunk.processingTimeMs}ms
            </span>
          )}
        </div>

        {latestChunk ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm sm:text-lg font-medium text-white leading-relaxed">
                "{latestChunk.originalText || '(Silenzio o rumore non verbale)'}"
              </p>
              <span className="text-[11px] text-slate-400 mt-1 inline-block">
                Lingua rilevata: <span className="font-semibold uppercase text-cyan-400">{latestChunk.detectedLanguage}</span>
              </span>
            </div>

            {/* Mobile-optimized Translations preview grid */}
            <div className="pt-2.5 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {['en', 'es', 'fr', 'de'].map((code) => {
                const text = latestChunk.translations?.[code];
                const lang = languages.find((l) => l.code === code);
                if (!text) return null;
                return (
                  <div key={code} className="p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] sm:text-xs">
                    <span className="text-slate-400 font-medium mr-1">{lang?.flag} {lang?.name}:</span>
                    <span className="text-slate-200">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-slate-500 italic py-3">
            In attesa del primo blocco. Tocca il cerchio centrale per iniziare lo streaming.
          </p>
        )}
      </div>
    </div>
  );
};
