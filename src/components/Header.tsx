import React, { useState } from 'react';
import { Radio, Headphones, Copy, Check, Users, ArrowLeft } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  roomCode: string;
  role: UserRole;
  listenerCount: number;
  isConnected: boolean;
  onExitToWelcome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  role,
  listenerCount,
  isConnected,
  onExitToWelcome,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#07090e]/85 backdrop-blur-xl transition-all">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Back to Welcome / Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onExitToWelcome}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer min-h-[38px]"
            title="Torna alla schermata principale"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">Esci</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Gathered
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-cyan-300 border border-white/5 hidden sm:inline">
              {role === 'speaker' ? 'Oratore' : 'Ascolto'}
            </span>
          </div>
        </div>

        {/* Zone 2: Room Metadata & Single-Line Info */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Room Code Badge with 1-click copy */}
          <div className="flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">
            <span className="text-slate-400 font-medium hidden xs:inline">Stanza:</span>
            <button
              onClick={handleCopyLink}
              title="Copia link stanza da condividere"
              className="flex items-center gap-1 font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer min-h-[32px]"
            >
              <span>{roomCode}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
              )}
            </button>
          </div>

          {/* Live Listener count */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono tabular-nums text-slate-300">{listenerCount}</span>
            <span className="hidden sm:inline">in ascolto</span>
          </div>
        </div>

        {/* Zone 3: Active Status Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              role === 'speaker'
                ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
            }`}
          >
            {role === 'speaker' ? (
              <>
                <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                <span className="hidden xs:inline">Trasmissione</span>
              </>
            ) : (
              <>
                <Headphones className="w-3 h-3 text-cyan-400" />
                <span className="hidden xs:inline">Ascolto Cuffia</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
