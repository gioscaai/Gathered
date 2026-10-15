/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ListenerPanel } from './components/ListenerPanel';
import { SpeakerPanel } from './components/SpeakerPanel';
import { TranscriptHistory } from './components/TranscriptHistory';
import { LanguageOption, TranslatedChunk, UserRole } from './types';
import { speechManager } from './services/speechSynthesisService';

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', ttsLocale: 'it-IT' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', ttsLocale: 'en-US' },
  { code: 'es', name: 'Spagnolo', nativeName: 'Español', flag: '🇪🇸', ttsLocale: 'es-ES' },
  { code: 'fr', name: 'Francese', nativeName: 'Français', flag: '🇫🇷', ttsLocale: 'fr-FR' },
  { code: 'de', name: 'Tedesco', nativeName: 'Deutsch', flag: '🇩🇪', ttsLocale: 'de-DE' },
  { code: 'pt', name: 'Portoghese', nativeName: 'Português', flag: '🇵🇹', ttsLocale: 'pt-PT' },
  { code: 'ro', name: 'Rumeno', nativeName: 'Română', flag: '🇷🇴', ttsLocale: 'ro-RO' },
  { code: 'uk', name: 'Ucraino', nativeName: 'Українська', flag: '🇺🇦', ttsLocale: 'uk-UA' },
  { code: 'zh', name: 'Cinese', nativeName: '中文', flag: '🇨🇳', ttsLocale: 'zh-CN' },
  { code: 'ar', name: 'Arabo', nativeName: 'العربية', flag: '🇸🇦', ttsLocale: 'ar-SA' },
];

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlRoom = urlParams?.get('room') || urlParams?.get('key');
  const urlRole = urlParams?.get('role') as UserRole | null;
  const urlLang = urlParams?.get('lang');

  // Permanent Room Key from server or storage
  const [defaultRoomKey, setDefaultRoomKey] = useState<string>(
    urlRoom || (typeof window !== 'undefined' ? localStorage.getItem('gathered_room_key') : null) || 'COMUNITA'
  );

  // Active Screen: 'welcome' | 'speaker' | 'listener'
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'speaker' | 'listener'>(
    urlRole ? urlRole : 'welcome'
  );

  const [roomCode, setRoomCode] = useState<string>(
    urlRoom ? urlRoom.toUpperCase() : defaultRoomKey
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    urlLang || (typeof window !== 'undefined' ? localStorage.getItem('gathered_pref_lang') : null) || 'it'
  );
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [recentChunks, setRecentChunks] = useState<TranslatedChunk[]>([]);
  const [speakerActive, setSpeakerActive] = useState<boolean>(false);
  const [speakerName, setSpeakerName] = useState<string>('Oratore');
  const [listenerCount, setListenerCount] = useState<number>(1);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessingChunk, setIsProcessingChunk] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const listenerIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? sessionStorage.getItem('gathered_listener_id') || `lis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      : `lis_${Date.now()}`
  );
  const latestIndexRef = useRef<number>(0);
  const sseFailedRef = useRef<boolean>(false);

  // Fetch server configuration (permanent room key & languages catalog)
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.defaultRoomKey) {
          setDefaultRoomKey(cfg.defaultRoomKey);
          if (!urlRoom) {
            setRoomCode(cfg.defaultRoomKey);
          }
        }
      })
      .catch(() => {});

    fetch('/api/languages')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLanguages(data);
        }
      })
      .catch(() => {});
  }, []);

  // Sync state to storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gathered_listener_id', listenerIdRef.current);
      localStorage.setItem('gathered_pref_lang', selectedLanguage);
      if (roomCode) {
        localStorage.setItem('gathered_room_key', roomCode);
      }
    }
  }, [selectedLanguage, roomCode]);

  // Keep URL parameters updated for easy sharing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (currentScreen !== 'welcome') {
        url.searchParams.set('room', roomCode);
        url.searchParams.set('role', currentScreen);
        url.searchParams.set('lang', selectedLanguage);
      } else {
        url.searchParams.delete('role');
        if (roomCode && roomCode !== defaultRoomKey) {
          url.searchParams.set('room', roomCode);
        } else {
          url.searchParams.delete('room');
        }
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [roomCode, currentScreen, selectedLanguage, defaultRoomKey]);

  // Track latest chunk index
  useEffect(() => {
    if (recentChunks.length > 0) {
      const maxIdx = Math.max(...recentChunks.map((c) => c.chunkIndex));
      if (maxIdx > latestIndexRef.current) {
        latestIndexRef.current = maxIdx;
      }
    }
  }, [recentChunks]);

  // Connect to Room Server-Sent Events (SSE) only when in speaker or listener screen
  useEffect(() => {
    if (currentScreen === 'welcome') {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    sseFailedRef.current = false;

    const sseUrl = `/api/rooms/${encodeURIComponent(roomCode)}/events?lang=${encodeURIComponent(selectedLanguage)}&listenerId=${encodeURIComponent(listenerIdRef.current)}`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        sseFailedRef.current = false;
      };

      es.onerror = () => {
        setIsConnected(false);
        sseFailedRef.current = true;
      };

      es.addEventListener('room-state', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.listenerCount !== undefined) setListenerCount(data.listenerCount);
          if (data.speaker) {
            setSpeakerActive(Boolean(data.speaker.isActive));
            setSpeakerName(data.speaker.name || 'Oratore');
          }
          if (Array.isArray(data.recentChunks)) {
            setRecentChunks(data.recentChunks);
          }
        } catch (e) {
          console.error('Error parsing room-state:', e);
        }
      });

      es.addEventListener('chunk-translated', (event: any) => {
        try {
          const chunk: TranslatedChunk = JSON.parse(event.data);
          setRecentChunks((prev) => {
            if (prev.some((c) => c.chunkId === chunk.chunkId)) return prev;
            return [...prev, chunk].slice(-50);
          });
          setSpeakerActive(true);
        } catch (e) {
          console.error('Error parsing chunk-translated event:', e);
        }
      });

      es.addEventListener('listener-count', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.listenerCount !== undefined) {
            setListenerCount(data.listenerCount);
          }
        } catch (e) {
          console.error('Error parsing listener-count:', e);
        }
      });

      es.addEventListener('speaker-status', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.speaker) {
            setSpeakerActive(Boolean(data.speaker.isActive));
            setSpeakerName(data.speaker.name || 'Oratore');
          }
        } catch (e) {
          console.error('Error parsing speaker-status:', e);
        }
      });
    } catch (e) {
      sseFailedRef.current = true;
    }

    return () => {
      if (es) es.close();
      eventSourceRef.current = null;
    };
  }, [roomCode, currentScreen, selectedLanguage]);

  // Vercel-compatible in-memory polling sync engine (active in speaker/listener screens)
  useEffect(() => {
    if (currentScreen === 'welcome') return;

    let isCancelled = false;
    let pollTimer: any = null;

    const runSync = async () => {
      if (isCancelled) return;

      try {
        const url = `/api/rooms/${encodeURIComponent(roomCode)}/sync?sinceIndex=${latestIndexRef.current}&listenerId=${encodeURIComponent(listenerIdRef.current)}&wait=${sseFailedRef.current ? 'true' : 'false'}`;
        const res = await fetch(url);

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setIsConnected(true);
            if (data.listenerCount !== undefined) {
              setListenerCount(data.listenerCount);
            }
            if (data.speaker) {
              setSpeakerActive(Boolean(data.speaker.isActive));
              setSpeakerName(data.speaker.name || 'Oratore');
            }
            if (Array.isArray(data.newChunks) && data.newChunks.length > 0) {
              setRecentChunks((prev) => {
                const combined = [...prev];
                data.newChunks.forEach((nc: TranslatedChunk) => {
                  if (!combined.some((c) => c.chunkId === nc.chunkId)) {
                    combined.push(nc);
                  }
                });
                return combined.slice(-50);
              });
              setSpeakerActive(true);
            }
          }
        }
      } catch (err) {
        // network retry
      } finally {
        if (!isCancelled) {
          const nextDelay = sseFailedRef.current ? 1600 : 6000;
          pollTimer = setTimeout(runSync, nextDelay);
        }
      }
    };

    runSync();

    return () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [roomCode, currentScreen]);

  // Handle uploading chunk from Speaker
  const handleUploadChunk = async (chunkData: {
    chunkIndex: number;
    audioBase64: string;
    mimeType: string;
    speakerName: string;
  }) => {
    setIsProcessingChunk(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...chunkData,
          customTargetLanguages: languages.map((l) => l.code),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
    } finally {
      setIsProcessingChunk(false);
    }
  };

  // Trigger simulated demo chunk
  const handleTriggerDemo = async () => {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/demo-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speakerName: currentScreen === 'speaker' ? 'Oratore' : 'Relatore Riunione',
        }),
      });
    } catch (err) {
      console.error('Errore durante la simulazione:', err);
    }
  };

  // Flow Navigation Handlers
  const handleEnterAsListener = (key: string, lang: string) => {
    setRoomCode(key);
    setSelectedLanguage(lang);
    setCurrentScreen('listener');
    speechManager.unlockMobileAudio();
  };

  const handleEnterAsSpeaker = (key: string) => {
    setRoomCode(key);
    setCurrentScreen('speaker');
  };

  const handleExitToWelcome = () => {
    speechManager.cancel();
    setCurrentScreen('welcome');
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20">
      {/* Top Header shown only when inside a session (Speaker or Listener) */}
      {currentScreen !== 'welcome' && (
        <Header
          roomCode={roomCode}
          role={currentScreen}
          listenerCount={listenerCount}
          isConnected={isConnected}
          onExitToWelcome={handleExitToWelcome}
        />
      )}

      {/* Main Viewport Content according to active screen */}
      <main className="flex-1 flex flex-col justify-start items-center w-full py-2 sm:py-6">
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            defaultRoomKey={defaultRoomKey}
            languages={languages}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
            onEnterAsListener={handleEnterAsListener}
            onEnterAsSpeaker={handleEnterAsSpeaker}
          />
        )}

        {currentScreen === 'listener' && (
          <>
            <ListenerPanel
              roomCode={roomCode}
              languages={languages}
              selectedLanguage={selectedLanguage}
              onSelectLanguage={setSelectedLanguage}
              recentChunks={recentChunks}
              speakerActive={speakerActive}
              speakerName={speakerName}
              onTriggerDemo={handleTriggerDemo}
            />

            <TranscriptHistory
              chunks={recentChunks}
              selectedLanguage={selectedLanguage}
              languages={languages}
            />
          </>
        )}

        {currentScreen === 'speaker' && (
          <>
            <SpeakerPanel
              roomCode={roomCode}
              languages={languages}
              onUploadChunk={handleUploadChunk}
              recentChunks={recentChunks}
              onTriggerDemo={handleTriggerDemo}
              isProcessingChunk={isProcessingChunk}
            />

            <TranscriptHistory
              chunks={recentChunks}
              selectedLanguage={selectedLanguage}
              languages={languages}
            />
          </>
        )}
      </main>

      {/* Clean Unboxed Footer */}
      <footer className="w-full border-t border-white/5 py-4 sm:py-5 px-3 sm:px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Gathered</span>
            <span aria-hidden="true">·</span>
            <span>Traduzione Simultanea con Gemini Flash</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Chunk 7s (Low-Rate Limit)</span>
            <span aria-hidden="true">·</span>
            <span>Sintesi Vocale TTS</span>
            <span aria-hidden="true">·</span>
            <span>In-Memory</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
