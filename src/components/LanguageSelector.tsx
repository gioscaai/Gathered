import React, { useRef, useEffect } from 'react';
import { Volume2, Check } from 'lucide-react';
import { LanguageOption } from '../types';

interface LanguageSelectorProps {
  languages: LanguageOption[];
  selectedLanguage: string;
  onSelectLanguage: (code: string) => void;
  onTestVoice?: (code: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages,
  selectedLanguage,
  onSelectLanguage,
  onTestVoice,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the selected language into view on mobile
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedLanguage]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lingua Traduzione
          </label>
          <span className="text-[10px] text-cyan-400 font-mono hidden sm:inline">
            (in cuffia)
          </span>
        </div>

        {onTestVoice && (
          <button
            type="button"
            onClick={() => onTestVoice(selectedLanguage)}
            className="flex items-center gap-1 text-[11px] sm:text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors py-1 px-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20 active:scale-95 cursor-pointer min-h-[36px]"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Voce</span>
          </button>
        )}
      </div>

      {/* Horizontal smooth touch scroller on mobile, responsive grid on desktop */}
      <div
        ref={scrollContainerRef}
        className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory -mx-1 px-1"
      >
        {languages.map((lang) => {
          const isSelected = lang.code === selectedLanguage;
          return (
            <button
              key={lang.code}
              type="button"
              data-selected={isSelected}
              onClick={() => onSelectLanguage(lang.code)}
              className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-left transition-all shrink-0 snap-center min-w-[130px] sm:min-w-0 min-h-[46px] cursor-pointer select-none active:scale-[0.98] ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-950/70 to-blue-950/70 border-cyan-400/80 text-white shadow-md shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                  : 'bg-white/[0.03] border-white/5 text-slate-300 active:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl sm:text-lg leading-none shrink-0" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold truncate leading-tight text-white">{lang.nativeName}</div>
                  <div className="text-[10px] text-slate-400 truncate leading-tight">{lang.name}</div>
                </div>
              </div>

              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center shrink-0 ml-1">
                  <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
