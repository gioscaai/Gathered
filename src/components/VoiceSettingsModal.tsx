import React, { useState, useEffect } from 'react';
import { X, Volume2, Sparkles, Check, Play, Sliders } from 'lucide-react';
import { speechManager, RankedVoice } from '../services/speechSynthesisService';
import { LanguageOption } from '../types';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: string;
  languages: LanguageOption[];
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage,
  languages,
}) => {
  const [rankedVoices, setRankedVoices] = useState<RankedVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [useAiVoice, setUseAiVoice] = useState<boolean>(false);
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  const langObj = languages.find((l) => l.code === selectedLanguage) || languages[0];

  useEffect(() => {
    if (isOpen) {
      setUseAiVoice(speechManager.getUseAiVoice());
      const voices = speechManager.getRankedVoicesForLanguage(selectedLanguage);
      setRankedVoices(voices);

      const current = speechManager.getCurrentVoice();
      if (current) {
        setSelectedVoiceURI(current.voiceURI);
      } else if (voices.length > 0) {
        setSelectedVoiceURI(voices[0].voice.voiceURI);
      }
    }
  }, [isOpen, selectedLanguage]);

  if (!isOpen) return null;

  const handleSelectVoice = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    speechManager.setVoiceByURI(voiceURI);
  };

  const handleToggleAiVoice = (enabled: boolean) => {
    setUseAiVoice(enabled);
    speechManager.setUseAiVoice(enabled);
    if (enabled) {
      speechManager.playTestSample(selectedLanguage);
    }
  };

  const handlePreviewVoice = (voice: SpeechSynthesisVoice) => {
    setPreviewingURI(voice.voiceURI);
    speechManager.unlockMobileAudio();
    speechManager.setVoiceByURI(voice.voiceURI);
    speechManager.playTestSample(selectedLanguage);
    setTimeout(() => setPreviewingURI(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0e1320] border border-white/10 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                Qualità & Selezione Voce
              </h3>
              <p className="text-xs text-slate-400">
                Lingua: {langObj.flag} {langObj.nativeName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Voice Option (Studio Quality Gemini 3.8 Flash TTS) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-cyan-950/40 border border-cyan-500/30 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-bold text-white">
                Voce Studio AI (Gemini HD)
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAiVoice(!useAiVoice)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                useAiVoice
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-md shadow-cyan-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-300'
              }`}
            >
              {useAiVoice ? 'Attiva (Consigliata)' : 'Disattivata'}
            </button>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Genera audio 24kHz ultra-naturale ad altissima fedeltà per inglese, spagnolo e altre lingue, eliminando qualsiasi timbro metallico o robotico.
          </p>
        </div>

        {/* Browser Native Voices Section */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Voci del Dispositivo ({rankedVoices.length})
            </label>
            <span className="text-[10px] text-slate-500">
              Google, Apple & Microsoft Natural
            </span>
          </div>

          {rankedVoices.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
              Nessuna voce locale trovata per questa lingua nel browser. Si consiglia di attivare la "Voce Studio AI".
            </div>
          ) : (
            <div className="space-y-1.5">
              {rankedVoices.map((item) => {
                const isSelected = !useAiVoice && (selectedVoiceURI === item.voice.voiceURI || selectedVoiceURI === item.voice.name);
                return (
                  <div
                    key={item.voice.voiceURI || item.voice.name}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-400/60 text-white shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleAiVoice(false);
                        handleSelectVoice(item.voice.voiceURI);
                      }}
                      className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold truncate text-white">
                          {item.voice.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                            item.score >= 70
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.score >= 40
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {item.tag}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.voice.lang} · {item.voice.localService ? 'Locale' : 'Online Alta Resa'}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewVoice(item.voice)}
                        title="Ascolta anteprima di questa voce"
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center text-xs gap-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[11px] hidden xs:inline">Prova</span>
                      </button>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center shrink-0 ml-1">
                          <Check className="w-3 h-3 text-black stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            La preferenza viene memorizzata sul dispositivo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer min-h-[38px]"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
};
