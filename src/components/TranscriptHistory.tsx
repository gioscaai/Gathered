import React, { useState } from 'react';
import { Copy, Check, Download, History, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { TranslatedChunk, LanguageOption } from '../types';
import { speechManager } from '../services/speechSynthesisService';

interface TranscriptHistoryProps {
  chunks: TranslatedChunk[];
  selectedLanguage: string;
  languages: LanguageOption[];
}

export const TranscriptHistory: React.FC<TranscriptHistoryProps> = ({
  chunks,
  selectedLanguage,
  languages,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default on mobile to save vertical space
  const [activeLangFilter] = useState(selectedLanguage);

  const validChunks = chunks.filter((c) => !c.isSilence && c.originalText);
  const currentLang = languages.find((l) => l.code === activeLangFilter);

  const handleCopyAll = () => {
    if (validChunks.length === 0) return;
    const text = validChunks
      .map((c) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        const trans = c.translations?.[activeLangFilter] || c.originalText;
        return `[${time}] ${c.speakerName} (${c.detectedLanguage}): "${c.originalText}"\n-> (${activeLangFilter}): "${trans}"\n`;
      })
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownload = () => {
    if (validChunks.length === 0) return;
    const text = validChunks
      .map((c) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        const trans = c.translations?.[activeLangFilter] || c.originalText;
        return `[${time}] ${c.speakerName} (${c.detectedLanguage}): "${c.originalText}"\n-> (${activeLangFilter}): "${trans}"\n`;
      })
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gathered-verbale-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (validChunks.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6 pb-8">
      <div className="bg-[#0b0f19]/85 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
        {/* Header bar */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/5 gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white hover:text-cyan-400 transition-colors cursor-pointer min-h-[40px] text-left"
          >
            <History className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">Cronologia ({validChunks.length})</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          </button>

          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              type="button"
              onClick={handleCopyAll}
              title="Copia tutti gli interventi"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[36px]"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedAll ? 'Copiato' : 'Copia'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Scarica trascrizione in TXT"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TXT</span>
            </button>
          </div>
        </div>

        {/* Content stream */}
        {isOpen && (
          <div className="divide-y divide-white/5 max-h-72 sm:max-h-96 overflow-y-auto p-1.5 sm:p-2">
            {validChunks.map((chunk) => {
              const translated = chunk.translations?.[activeLangFilter] || chunk.originalText;
              const timeString = new Date(chunk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={chunk.chunkId} className="p-3 hover:bg-white/[0.02] transition-colors rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-300">{chunk.speakerName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{timeString}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        speechManager.unlockMobileAudio();
                        speechManager.speak(translated);
                      }}
                      title="Riascolta con sintesi vocale"
                      className="flex items-center gap-1 text-slate-400 active:text-cyan-400 transition-colors cursor-pointer p-1 rounded-md min-h-[32px]"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Riascolta</span>
                    </button>
                  </div>

                  {/* Translated main text */}
                  <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                    {translated}
                  </p>

                  {/* Original text context */}
                  {chunk.originalText && chunk.originalText !== translated && (
                    <p className="text-[11px] text-slate-400 italic">
                      <span className="text-slate-500 uppercase not-italic text-[9px] mr-1">{chunk.detectedLanguage}:</span>
                      "{chunk.originalText}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
