import React, { useState } from 'react';
import { X, Copy, Check, QrCode, Share2, ArrowRight } from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomCode: string;
  onJoinRoom: (newCode: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomCode,
  onJoinRoom,
}) => {
  const [inputCode, setInputCode] = useState(currentRoomCode);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen) return null;

  const roomUrl = `${window.location.origin}?room=${currentRoomCode}`;
  const inviteMessage = `Partecipa alla riunione con traduzione e trascrizione simultanea in tempo reale (ascolta nella tua lingua in cuffia):\n${roomUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onJoinRoom(inputCode.trim().toUpperCase());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#0e1320] border border-white/10 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Stanza & Condivisione</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Change or Join Room Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Codice Stanza
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="es. GAT-123"
              className="flex-1 bg-white/[0.05] border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-mono uppercase tracking-wider text-white placeholder-slate-500 focus:outline-none min-h-[44px]"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-black font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1 min-h-[44px]"
            >
              <span>Accedi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Share Link Section */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="text-xs font-semibold text-slate-300">Link diretto per i partecipanti</div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs font-mono text-cyan-300 truncate">
            <span className="truncate">{roomUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ml-2 text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copiedMessage ? 'Messaggio d\'invito copiato!' : 'Copia messaggio d\'invito completo'}</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 text-center leading-relaxed">
          Tutti i partecipanti connessi a questa stanza riceveranno la traduzione contemporaneamente e potranno ascoltarla in cuffia.
        </div>
      </div>
    </div>
  );
};
