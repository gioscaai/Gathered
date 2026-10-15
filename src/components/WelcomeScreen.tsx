import React, { useState } from 'react';
import { Radio, Headphones, Key, Globe, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageOption } from '../types';

interface WelcomeScreenProps {
  defaultRoomKey: string;
  languages: LanguageOption[];
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  onEnterAsListener: (roomKey: string, lang: string) => void;
  onEnterAsSpeaker: (roomKey: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  defaultRoomKey,
  languages,
  selectedLanguage,
  onSelectLanguage,
  onEnterAsListener,
  onEnterAsSpeaker,
}) => {
  const [roomKey, setRoomKey] = useState<string>(defaultRoomKey);
  const [error, setError] = useState<string | null>(null);

  const handleListenerClick = () => {
    const key = roomKey.trim().toUpperCase();
    if (!key) {
      setError('Inserisci una chiave stanza per accedere');
      return;
    }
    setError(null);
    onEnterAsListener(key, selectedLanguage);
  };

  const handleSpeakerClick = () => {
    const key = roomKey.trim().toUpperCase();
    if (!key) {
      setError('Inserisci una chiave stanza per accedere');
      return;
    }
    setError(null);
    onEnterAsSpeaker(key);
  };

  const selectedLangObj = languages.find((l) => l.code === selectedLanguage) || languages[0];

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center px-4 py-8 max-w-xl mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-8 sm:mb-10 space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-xl shadow-cyan-500/20 mb-3">
          <Radio className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Gathered
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          Traduzione e trascrizione simultanea in tempo reale per la comunità
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="w-full bg-[#0d121c]/90 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl space-y-5">
        {/* Field 1: Codice Stanza (Canale Riunione) */}
        <div className="space-y-1.5">
          <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Codice Stanza (Canale Riunione)</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-normal">Preimpostato per la comunità</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={roomKey}
              onChange={(e) => {
                setRoomKey(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="es. COMUNITA"
              className="w-full bg-white/[0.04] border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-base sm:text-sm font-mono uppercase tracking-wider text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            È il canale comune che connette l'oratore agli ascoltatori. È già impostato su <strong>COMUNITA</strong>, puoi lasciarlo così ed entrare direttamente.
          </p>
        </div>

        {/* Field 2: Lingua di Destinazione (per Ascoltatori) */}
        <div className="space-y-1.5">
          <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lingua di Ascolto (in cuffia)</span>
            </span>
            <span className="text-[10px] text-slate-500 font-normal">Per chi ascolta</span>
          </label>

          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="w-full appearance-none bg-white/[0.04] border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-sm font-medium text-white focus:outline-none transition-all cursor-pointer"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#0e1320] text-white py-2">
                  {lang.flag} {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
              ▼
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium text-center">
            {error}
          </p>
        )}

        {/* Two Main Direct Action Buttons */}
        <div className="pt-2 space-y-3">
          {/* Main Button 1: ASCOLTA */}
          <button
            type="button"
            onClick={handleListenerClick}
            className="group w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-base transition-all shadow-lg shadow-cyan-500/25 active:scale-[0.98] cursor-pointer min-h-[56px]"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="leading-tight">Ascolta in Cuffia</div>
                <div className="text-[11px] font-normal text-cyan-100/90 leading-tight">
                  Ricevi la traduzione vocale in {selectedLangObj.nativeName}
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Main Button 2: TRASMETTI */}
          <button
            type="button"
            onClick={handleSpeakerClick}
            className="group w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer min-h-[52px]"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10">
                <Radio className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-left">
                <div className="leading-tight text-white font-medium">Trasmetti Audio</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Per l'oratore o il mixer della riunione
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Subtle Bottom Architectural Trust Badges */}
      <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-2 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Gestione stanza 100% in memoria · Nessun database</span>
        </div>
        <p className="text-[10px] text-slate-600">
          Chiamate audio a blocchi di 7s · Ottimizzato per Gemini Flash Free Tier
        </p>
      </div>
    </div>
  );
};
