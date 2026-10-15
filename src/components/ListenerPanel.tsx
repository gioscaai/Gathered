import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { ShazamOrb } from './ShazamOrb';
import { LanguageSelector } from './LanguageSelector';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import { LanguageOption, TranslatedChunk } from '../types';
import { speechManager } from '../services/speechSynthesisService';

interface ListenerPanelProps {
  roomCode: string;
  languages: LanguageOption[];
  selectedLanguage: string;
  onSelectLanguage: (code: string) => void;
  recentChunks: TranslatedChunk[];
  speakerActive: boolean;
  speakerName?: string;
  onTriggerDemo?: () => void;
}

export const ListenerPanel: React.FC<ListenerPanelProps> = ({
  roomCode,
  languages,
  selectedLanguage,
  onSelectLanguage,
  recentChunks,
  speakerActive,
  speakerName = 'Oratore',
  onTriggerDemo,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [ttsStatus, setTtsStatus] = useState<{ isSpeaking: boolean; queueLength: number }>({
    isSpeaking: false,
    queueLength: 0,
  });
  const [rate, setRate] = useState<number>(1.05);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [activeVoiceName, setActiveVoiceName] = useState<string>('');
  const [isAiVoiceActive, setIsAiVoiceActive] = useState<boolean>(false);

  // Subscribe to speech synthesis status
  useEffect(() => {
    const unsubscribe = speechManager.subscribeStatus(setTtsStatus);
    return () => unsubscribe();
  }, []);

  // Update speech manager whenever language changes
  useEffect(() => {
    speechManager.setLanguage(selectedLanguage);
    const cur = speechManager.getCurrentVoice();
    setActiveVoiceName(cur?.name || '');
    setIsAiVoiceActive(speechManager.getUseAiVoice());
  }, [selectedLanguage]);

  // Handle incoming chunks: when a new chunk arrives and listening is enabled, speak it!
  const latestChunk = recentChunks.length > 0 ? recentChunks[recentChunks.length - 1] : null;

  useEffect(() => {
    if (!latestChunk || !isListening || isMuted || latestChunk.isSilence) return;

    // Get translation for selected language
    const translatedText = latestChunk.translations?.[selectedLanguage] || latestChunk.originalText;
    if (translatedText && translatedText.trim()) {
      speechManager.speak(translatedText);
    }
  }, [latestChunk?.chunkId, isListening, selectedLanguage, isMuted]);

  const handleToggleListening = () => {
    speechManager.unlockMobileAudio();

    if (!isListening) {
      setIsListening(true);
      speechManager.setMuted(false);
      speechManager.playTestSample(selectedLanguage);
    } else {
      setIsListening(false);
      speechManager.cancel();
    }
  };

  const handleTestVoice = (code: string) => {
    speechManager.unlockMobileAudio();
    speechManager.playTestSample(code);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReplayLatest = () => {
    if (currentTranslation) {
      speechManager.unlockMobileAudio();
      speechManager.speak(currentTranslation);
    }
  };

  const currentTranslation = latestChunk?.translations?.[selectedLanguage] || latestChunk?.originalText || '';
  const currentLangObj = languages.find((l) => l.code === selectedLanguage);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-3 sm:px-4 py-2 space-y-4 sm:space-y-6">
      {/* Central Magnetic Shazam Orb (Touch Hero) */}
      <div className="w-full flex flex-col items-center">
        <ShazamOrb
          role="listener"
          isActive={isListening}
          onClick={handleToggleListening}
          statusLabel={
            isListening
              ? ttsStatus.isSpeaking
                ? 'Riproduzione in cuffia...'
                : 'In ascolto del relatore'
              : 'Tocca per Ascoltare in Cuffia'
          }
          subLabel={
            isListening
              ? `Traduzione automatica in ${currentLangObj?.nativeName || 'lingua selezionata'}`
              : 'Abilita la voce sincronizzata in tempo reale nelle cuffie'
          }
        />

        {/* Real-time Speaker Status Indicator */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                speakerActive ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-600'
              }`}
            />
            <span className="truncate max-w-[190px] sm:max-w-none">
              {speakerActive ? `${speakerName} trasmette` : 'In attesa dell\'oratore'}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Stanza {roomCode}</span>
        </div>
      </div>

      {/* Target Language Selection (Horizontal Swipeable Strip on Mobile) */}
      <div className="w-full bg-[#0d121c]/80 border border-white/5 rounded-2xl p-3.5 sm:p-5 backdrop-blur-md">
        <LanguageSelector
          languages={languages}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={(code) => {
            onSelectLanguage(code);
            if (isListening) {
              speechManager.unlockMobileAudio();
              speechManager.playTestSample(code);
            }
          }}
          onTestVoice={handleTestVoice}
        />

        {/* Thumb-friendly Mobile Audio Preferences Strip */}
        <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Mute button */}
            <button
              type="button"
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                speechManager.setMuted(nextMute);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors cursor-pointer min-h-[42px] ${
                isMuted
                  ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  : 'bg-white/[0.04] border-white/10 text-slate-300 active:bg-white/[0.08]'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              <span className="text-xs font-medium">{isMuted ? 'Muto' : 'Audio ON'}</span>
            </button>

            {/* Voice Settings & Quality Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 active:bg-cyan-900/60 transition-all cursor-pointer min-h-[42px]"
              title="Cambia o migliora la voce del sintetizzatore"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold">
                {isAiVoiceActive ? 'Voce AI HD' : 'Cambia Voce'}
              </span>
            </button>

            {/* Speed Multiplier segmented tabs */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/10 rounded-xl p-1 min-h-[42px]">
              {[0.9, 1.05, 1.2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setRate(s);
                    speechManager.setRate(s);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium tabular-nums transition-colors cursor-pointer min-h-[34px] ${
                    rate === s ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.toFixed(2)}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerDemo && (
              <button
                type="button"
                onClick={() => {
                  speechManager.unlockMobileAudio();
                  onTriggerDemo();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-cyan-400 active:text-cyan-200 text-xs font-medium transition-colors cursor-pointer min-h-[40px] bg-cyan-950/30 border border-cyan-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simula frase</span>
              </button>
            )}

            {ttsStatus.queueLength > 0 && (
              <span className="text-[11px] text-cyan-300 font-mono bg-cyan-950/60 border border-cyan-500/30 px-2 py-1 rounded-md tabular-nums">
                {ttsStatus.queueLength} in coda
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Subtitle Display (High Contrast Subtitle Card) */}
      <div className="w-full bg-gradient-to-b from-[#111726]/95 to-[#0c101b]/95 border border-cyan-500/25 rounded-2xl p-4 sm:p-7 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <span role="img" aria-label="flag" className="text-base sm:text-sm">
              {currentLangObj?.flag}
            </span>
            <span>Trascrizione Tradotta ({currentLangObj?.nativeName})</span>
          </div>

          <div className="flex items-center gap-2">
            {currentTranslation && (
              <>
                <button
                  type="button"
                  onClick={handleReplayLatest}
                  title="Riascolta questa frase"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors p-1.5 rounded-lg min-h-[36px] min-w-[36px] justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Riascolta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyText(currentTranslation, 'latest')}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg min-h-[36px] min-w-[36px] justify-center cursor-pointer"
                >
                  {copiedId === 'latest' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{copiedId === 'latest' ? 'Copiato' : 'Copia'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* The Live Translated Text */}
        <div className="min-h-[85px] sm:min-h-[110px] flex items-center">
          {currentTranslation ? (
            <p className="text-lg sm:text-2xl md:text-3xl font-medium tracking-tight text-white leading-relaxed select-text">
              "{currentTranslation}"
            </p>
          ) : (
            <p className="text-sm sm:text-base text-slate-500 italic">
              In attesa che l'oratore parli... I sottotitoli e la sintesi vocale compariranno qui.
            </p>
          )}
        </div>

        {/* Original Speech Context Below */}
        {latestChunk && latestChunk.originalText && (
          <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-slate-500 shrink-0 uppercase text-[10px]">Orig ({latestChunk.detectedLanguage}):</span>
              <span className="italic text-slate-300 truncate">"{latestChunk.originalText}"</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono shrink-0 self-end sm:self-auto">
              {latestChunk.processingTimeMs}ms · Gemini Flash
            </div>
          </div>
        )}
      </div>

      {/* Voice Settings & Selection Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => {
          setIsVoiceModalOpen(false);
          const cur = speechManager.getCurrentVoice();
          setActiveVoiceName(cur?.name || '');
          setIsAiVoiceActive(speechManager.getUseAiVoice());
        }}
        selectedLanguage={selectedLanguage}
        languages={languages}
      />
    </div>
  );
};
