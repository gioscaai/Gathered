import React from 'react';
import { Mic, Headphones, Volume2, Radio, Sparkles } from 'lucide-react';

interface ShazamOrbProps {
  role: 'speaker' | 'listener';
  isActive: boolean;
  isProcessing?: boolean;
  volume?: number; // 0 to 1
  progressPercent?: number; // 0 to 100 for chunk cycle
  secondsLeft?: number;
  onClick: () => void;
  statusLabel?: string;
  subLabel?: string;
  disabled?: boolean;
}

export const ShazamOrb: React.FC<ShazamOrbProps> = ({
  role,
  isActive,
  isProcessing = false,
  volume = 0,
  progressPercent = 0,
  secondsLeft,
  onClick,
  statusLabel,
  subLabel,
  disabled = false,
}) => {
  // Dynamic scale based on volume amplitude
  const dynamicScale = isActive ? 1 + Math.min(volume * 0.18, 0.2) : 1;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-3 sm:py-8 w-full overflow-hidden">
      {/* Ambient background glow */}
      <div
        className={`absolute w-56 h-56 sm:w-96 sm:h-96 rounded-full blur-3xl transition-opacity duration-1000 pointer-events-none ${
          isActive
            ? 'opacity-35 bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600'
            : 'opacity-15 bg-gradient-to-tr from-blue-900 to-indigo-950'
        }`}
      />

      {/* Outer Shazam Ripple Waves (Active State) */}
      {isActive && (
        <>
          <div
            className="absolute rounded-full border border-cyan-400/25 animate-shazam-1 pointer-events-none"
            style={{
              width: `${190 + volume * 60}px`,
              height: `${190 + volume * 60}px`,
            }}
          />
          <div
            className="absolute rounded-full border border-blue-400/20 animate-shazam-2 pointer-events-none"
            style={{
              width: `${230 + volume * 80}px`,
              height: `${230 + volume * 80}px`,
            }}
          />
          <div
            className="absolute rounded-full border border-indigo-400/15 animate-shazam-3 pointer-events-none hidden sm:block"
            style={{
              width: `${280 + volume * 100}px`,
              height: `${280 + volume * 100}px`,
            }}
          />
        </>
      )}

      {/* Main Interactive Orb Button */}
      <div className="relative z-10 flex items-center justify-center">
        {/* SVG Circular Countdown Ring (for speaker mode chunks) */}
        {role === 'speaker' && isActive && (
          <svg
            className="absolute w-[172px] h-[172px] sm:w-[224px] sm:h-[224px] -rotate-90 pointer-events-none transition-all duration-100"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2.5"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="url(#shazamGradient)"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-[stroke-dashoffset] duration-150 ease-linear"
            />
            <defs>
              <linearGradient id="shazamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        )}

        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={{ transform: `scale(${dynamicScale})` }}
          aria-label={role === 'speaker' ? (isActive ? 'Interrompi trasmissione' : 'Avvia trasmissione audio') : (isActive ? 'Disattiva ascolto cuffia' : 'Attiva ascolto in cuffia')}
          className={`group relative flex flex-col items-center justify-center w-38 h-38 sm:w-50 sm:h-50 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 transition-all duration-300 active:scale-95 cursor-pointer shadow-2xl ${
            isActive
              ? 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-cyan-500/30'
              : 'bg-gradient-to-b from-[#151b28] to-[#0c101a] border border-white/10 hover:border-cyan-500/40 text-slate-200 hover:text-white shadow-black/80 hover:shadow-cyan-900/20'
          }`}
        >
          {/* Inner glass highlight */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

          {/* Central Icon */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {role === 'speaker' ? (
              <>
                {isActive ? (
                  <Radio className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-pulse" />
                ) : (
                  <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                )}
              </>
            ) : (
              <>
                {isActive ? (
                  <Volume2 className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-pulse" />
                ) : (
                  <Headphones className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                )}
              </>
            )}

            {/* Countdown / Status display inside orb */}
            {role === 'speaker' && isActive && secondsLeft !== undefined && (
              <span className="mt-1 sm:mt-2 text-[11px] sm:text-xs font-mono font-bold tracking-wider text-cyan-100 uppercase tabular-nums">
                {secondsLeft.toFixed(1)}s
              </span>
            )}

            {isProcessing && (
              <div className="absolute -bottom-6 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[9px] sm:text-[10px] text-cyan-300 font-mono">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin text-cyan-400" />
                <span>Gemini Flash</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Clean unboxed typography below the centerpiece */}
      <div className="mt-4 sm:mt-7 text-center max-w-sm px-4">
        <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight">
          {statusLabel || (role === 'speaker' ? (isActive ? 'Trasmissione in corso...' : 'Tocca per Trasmettere') : (isActive ? 'In ascolto con sintesi vocale' : 'Tocca per Ascoltare in Cuffia'))}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-snug">
          {subLabel || (role === 'speaker'
            ? 'Cattura audio continuo in blocchi da 7s e distribuisce traduzioni'
            : 'Riceve la traduzione e la legge istantaneamente in cuffia')}
        </p>
      </div>
    </div>
  );
};
