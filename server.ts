import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Supported Languages Definition
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  ttsLocale: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
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

export interface TranslatedChunk {
  chunkId: string;
  chunkIndex: number;
  timestamp: number;
  speakerName: string;
  detectedLanguage: string;
  originalText: string;
  translations: Record<string, string>;
  isSilence: boolean;
  processingTimeMs: number;
}

interface RoomListener {
  id: string;
  targetLanguage: string;
  res?: Response;
  joinedAt: number;
}

interface Room {
  code: string;
  name: string;
  createdAt: number;
  speaker: {
    name: string;
    isActive: boolean;
    lastChunkAt: number;
  } | null;
  listeners: Map<string, RoomListener>;
  listenerPresence: Map<string, number>; // maps listenerId -> lastSeen timestamp (Vercel-compatible)
  chunks: TranslatedChunk[];
  lastChunkTime: number;
  chunkWaiters: Set<(chunk: TranslatedChunk) => void>; // Long-poll waiters for Vercel sync
}

// In-Memory Rooms Store (Zero external database required)
const rooms = new Map<string, Room>();

// Auto-cleanup for rooms idle for > 3 hours to prevent memory bloat
if (!process.env.VERCEL) {
  setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, code) => {
      const isExpired = now - room.createdAt > 8 * 3600 * 1000 && now - room.lastChunkTime > 2 * 3600 * 1000;
      if (isExpired) {
        rooms.delete(code);
      }
    });
  }, 30 * 60 * 1000);
}

function getActiveListenerCount(room: Room): number {
  const now = Date.now();
  // Purge presence older than 14 seconds
  room.listenerPresence.forEach((lastSeen, id) => {
    if (now - lastSeen > 14000) {
      room.listenerPresence.delete(id);
      room.listeners.delete(id);
    }
  });
  return Math.max(1, room.listenerPresence.size);
}

function getOrCreateRoom(code: string, roomName?: string): Room {
  const normalized = code.trim().toUpperCase();
  let room = rooms.get(normalized);
  if (!room) {
    room = {
      code: normalized,
      name: roomName || `Stanza ${normalized}`,
      createdAt: Date.now(),
      speaker: null,
      listeners: new Map(),
      listenerPresence: new Map(),
      chunks: [],
      lastChunkTime: 0,
      chunkWaiters: new Set(),
    };
    rooms.set(normalized, room);
  }
  return room;
}

// Broadcast SSE event and notify Vercel long-polling waiters
function broadcastToRoom(roomCode: string, event: string, data: any) {
  const room = rooms.get(roomCode.trim().toUpperCase());
  if (!room) return;

  // 1. Notify SSE streams (persistent Node servers)
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  room.listeners.forEach((listener, id) => {
    if (listener.res) {
      try {
        listener.res.write(payload);
      } catch (err) {
        room.listeners.delete(id);
        room.listenerPresence.delete(id);
      }
    }
  });

  // 2. Resolve Vercel serverless long-polling waiters if it's a translated chunk
  if (event === 'chunk-translated' && data) {
    room.chunkWaiters.forEach((resolve) => {
      try {
        resolve(data as TranslatedChunk);
      } catch (e) {
        // ignore
      }
    });
    room.chunkWaiters.clear();
  }
}

export const app = express();

// Middleware
app.use(express.json({ limit: '25mb' }));

// Permanent Room Key from Environment or default for the community
export const PERMANENT_ROOM_KEY = (process.env.PERMANENT_ROOM_KEY || process.env.DEFAULT_ROOM_KEY || 'COMUNITA').trim().toUpperCase();

// System Config Endpoint (provides permanent room key and app info)
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    appName: 'Gathered',
    defaultRoomKey: PERMANENT_ROOM_KEY,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

// Health and System Status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    activeRooms: rooms.size,
    isVercel: Boolean(process.env.VERCEL),
    defaultRoomKey: PERMANENT_ROOM_KEY,
    time: Date.now(),
  });
});

// Languages catalog endpoint
app.get('/api/languages', (req: Request, res: Response) => {
  res.json(SUPPORTED_LANGUAGES);
});

// Create or retrieve Room in-memory
app.post('/api/rooms/create', (req: Request, res: Response) => {
  const { code, name } = req.body || {};
  const roomCode = code ? code.trim().toUpperCase() : `GAT-${Math.floor(100 + Math.random() * 900)}`;
  const room = getOrCreateRoom(roomCode, name);
  res.json({
    code: room.code,
    name: room.name,
    createdAt: room.createdAt,
    listenerCount: getActiveListenerCount(room),
  });
});

// Room metadata & recent history
app.get('/api/rooms/:code', (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ error: 'Stanza non trovata' });
  }

  res.json({
    code: room.code,
    name: room.name,
    createdAt: room.createdAt,
    speaker: room.speaker,
    listenerCount: getActiveListenerCount(room),
    chunkCount: room.chunks.length,
    recentChunks: room.chunks.slice(-15),
  });
});

/**
 * LIGHTWEIGHT VERCEL-COMPATIBLE SYNC ENDPOINT
 * Stateless, fast polling / long-polling mechanism that requires zero database or WebSockets.
 * Supported on all serverless runtimes (Vercel, AWS Lambda, Cloudflare, etc.)
 */
app.get('/api/rooms/:code/sync', async (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const sinceIndex = Number(req.query.sinceIndex) || 0;
  const listenerId = (req.query.listenerId as string) || `lis_${Date.now()}`;
  const shouldWait = req.query.wait === 'true';

  const room = getOrCreateRoom(roomCode);

  // Update listener presence in memory
  room.listenerPresence.set(listenerId, Date.now());

  // Check if we already have newer chunks than sinceIndex
  const newChunks = room.chunks.filter((c) => c.chunkIndex > sinceIndex);

  if (newChunks.length > 0 || !shouldWait) {
    return res.json({
      roomCode: room.code,
      speaker: room.speaker,
      listenerCount: getActiveListenerCount(room),
      newChunks,
      latestIndex: room.chunks.length > 0 ? room.chunks[room.chunks.length - 1].chunkIndex : 0,
      serverTime: Date.now(),
    });
  }

  // Long-poll: wait up to 5 seconds for a new chunk before safely timing out (well within Vercel's 10-15s Hobby limit)
  let timer: any = null;
  const waiter = (chunk: TranslatedChunk) => {
    if (timer) clearTimeout(timer);
    room.chunkWaiters.delete(waiter);
    res.json({
      roomCode: room.code,
      speaker: room.speaker,
      listenerCount: getActiveListenerCount(room),
      newChunks: [chunk],
      latestIndex: chunk.chunkIndex,
      serverTime: Date.now(),
    });
  };

  room.chunkWaiters.add(waiter);

  // Timeout after 5.5s
  timer = setTimeout(() => {
    room.chunkWaiters.delete(waiter);
    res.json({
      roomCode: room.code,
      speaker: room.speaker,
      listenerCount: getActiveListenerCount(room),
      newChunks: [],
      latestIndex: room.chunks.length > 0 ? room.chunks[room.chunks.length - 1].chunkIndex : 0,
      serverTime: Date.now(),
    });
  }, 5500);

  req.on('close', () => {
    if (timer) clearTimeout(timer);
    room.chunkWaiters.delete(waiter);
  });
});

// Update speaker active state
app.post('/api/rooms/:code/speaker-status', (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const { name, isActive } = req.body;
  const room = getOrCreateRoom(roomCode);

  room.speaker = {
    name: name || 'Oratore',
    isActive: Boolean(isActive),
    lastChunkAt: Date.now(),
  };

  broadcastToRoom(roomCode, 'speaker-status', {
    speaker: room.speaker,
  });

  res.json({ success: true, speaker: room.speaker });
});

// SSE Stream for Room Listeners (Used when persistent connections are available)
app.get('/api/rooms/:code/events', (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const targetLanguage = (req.query.lang as string) || 'it';
  const listenerId = (req.query.listenerId as string) || `lis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const room = getOrCreateRoom(roomCode);

  // Setup SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Track presence
  room.listenerPresence.set(listenerId, Date.now());

  // Register Listener
  room.listeners.set(listenerId, {
    id: listenerId,
    targetLanguage,
    res,
    joinedAt: Date.now(),
  });

  // Send initial handshake
  const initialPayload = {
    type: 'connected',
    listenerId,
    roomCode: room.code,
    speaker: room.speaker,
    listenerCount: getActiveListenerCount(room),
    recentChunks: room.chunks.slice(-10),
  };
  res.write(`event: room-state\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  broadcastToRoom(roomCode, 'listener-count', {
    listenerCount: getActiveListenerCount(room),
  });

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
      room.listenerPresence.set(listenerId, Date.now());
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    room.listeners.delete(listenerId);
    room.listenerPresence.delete(listenerId);
    broadcastToRoom(roomCode, 'listener-count', {
      listenerCount: getActiveListenerCount(room),
    });
  });
});

// Update listener's target language on the fly
app.post('/api/rooms/:code/listener-language', (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const { listenerId, targetLanguage } = req.body;
  const room = rooms.get(roomCode);

  if (room && listenerId) {
    room.listenerPresence.set(listenerId, Date.now());
    if (room.listeners.has(listenerId)) {
      const listener = room.listeners.get(listenerId)!;
      listener.targetLanguage = targetLanguage || 'it';
    }
  }
  res.json({ success: true });
});

// Audio Chunk Processing via Gemini 3.8 Flash
app.post('/api/rooms/:code/chunk', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const roomCode = req.params.code.trim().toUpperCase();
  const {
    chunkIndex = 1,
    audioBase64,
    mimeType = 'audio/webm',
    speakerName = 'Oratore',
    customTargetLanguages,
  } = req.body;

  const room = getOrCreateRoom(roomCode);

  // Update speaker activity
  room.speaker = {
    name: speakerName,
    isActive: true,
    lastChunkAt: Date.now(),
  };

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Nessun dato audio fornito' });
  }

  // Rate-limit safety: ensure at least 4s between chunks per room to safeguard the free tier
  const now = Date.now();
  if (now - room.lastChunkTime < 3500) {
    console.warn(`[Gathered] Chunk received too quickly for room ${roomCode} (${now - room.lastChunkTime}ms). Skipping to preserve rate limit.`);
    return res.status(429).json({ error: 'Frequenza chunk troppo elevata. Rispetta la finestra di 6-8 secondi.' });
  }
  room.lastChunkTime = now;

  // Collect active target languages
  const targetLanguagesSet = new Set<string>();
  room.listeners.forEach((l) => {
    if (l.targetLanguage) targetLanguagesSet.add(l.targetLanguage);
  });

  if (Array.isArray(customTargetLanguages) && customTargetLanguages.length > 0) {
    customTargetLanguages.forEach((lang: string) => targetLanguagesSet.add(lang));
  } else {
    ['it', 'en', 'es', 'fr', 'de'].forEach((l) => targetLanguagesSet.add(l));
  }

  const targetLanguages = Array.from(targetLanguagesSet);
  const cleanMimeType = mimeType.split(';')[0].trim() || 'audio/webm';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY non configurata nei Secrets del server.');
    }

    const prompt = `You are a world-class real-time simultaneous interpreter and conference transcription system for live community meetings.
Listen attentively to this ~6-8 second audio chunk.

Tasks:
1. Accurately transcribe the spoken audio into "originalText" with correct punctuation and capitalization.
2. Identify the language code of the speaker in "detectedLanguage" (e.g. 'it', 'en', 'es', 'fr', 'de', 'pt', 'ro', 'uk', 'zh', 'ar').
3. If the audio is silent, just breathing, background hum, or unintelligible noise, set "isSilence": true, "originalText": "", and leave translation values as "".
4. Translate the transcription accurately and naturally into EACH of the following requested target languages: ${targetLanguages.join(', ')}.
   Make each translation concise, natural, spoken-style, and ready for immediate Text-To-Speech (TTS) reading in listeners' earphones.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "detectedLanguage": "it",
  "originalText": "Benvenuti a tutti alla riunione di oggi.",
  "translations": {
    ${targetLanguages.map((l) => `"${l}": "..."`).join(',\n    ')}
  },
  "isSilence": false
}`;

    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [audioPart, { text: prompt }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '{}';
    let parsedResult: any = {};
    try {
      parsedResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON response:', responseText);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    }

    const originalText = (parsedResult.originalText || '').trim();
    const detectedLanguage = parsedResult.detectedLanguage || 'it';
    const isSilence = Boolean(parsedResult.isSilence) || originalText.length === 0;
    const translations: Record<string, string> = parsedResult.translations || {};

    for (const lang of targetLanguages) {
      if (!translations[lang] && originalText) {
        translations[lang] = originalText;
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const chunkId = `chk_${Date.now()}_${chunkIndex}`;

    const translatedChunk: TranslatedChunk = {
      chunkId,
      chunkIndex,
      timestamp: Date.now(),
      speakerName,
      detectedLanguage,
      originalText,
      translations,
      isSilence,
      processingTimeMs,
    };

    // Store in in-memory room history (keep last 50 chunks)
    room.chunks.push(translatedChunk);
    if (room.chunks.length > 50) {
      room.chunks.shift();
    }

    // Broadcast chunk to SSE listeners & Vercel sync long-pollers
    broadcastToRoom(roomCode, 'chunk-translated', translatedChunk);

    return res.json({
      success: true,
      chunk: translatedChunk,
    });
  } catch (error: any) {
    console.error(`[Gathered] Error processing chunk ${chunkIndex}:`, error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Errore durante la traduzione del chunk audio',
      processingTimeMs: Date.now() - startTime,
    });
  }
});

// Simulated Demo Chunk
app.post('/api/rooms/:code/demo-chunk', async (req: Request, res: Response) => {
  const roomCode = req.params.code.trim().toUpperCase();
  const { text, lang = 'it', speakerName = 'Oratore (Demo)' } = req.body;
  const room = getOrCreateRoom(roomCode);

  const demoPhrases = [
    {
      it: 'Benvenuti a tutti al nostro incontro settimanale della comunità. Oggi parleremo dei progressi del nostro progetto.',
      en: 'Welcome everyone to our weekly community meeting. Today we will discuss our project progress.',
      es: 'Bienvenidos a todos a nuestra reunión semanal comunitaria. Hoy hablaremos sobre el progreso de nuestro proyecto.',
      fr: "Bienvenue à tous à notre réunion hebdomadaire de la communauté. Aujourd'hui, nous parlerons de l'avancement de notre projet.",
      de: 'Herzlich willkommen zu unserem wöchentlichen Gemeinschaftstreffen. Heute besprechen wir den Fortschritt unseres Projekts.',
      pt: 'Bem-vindos a todos ao nosso encontro semanal da comunidade. Hoje falaremos sobre o progresso do nosso projeto.',
      ro: 'Bun venit tuturor la întâlnirea noastră săptămânală a comunității. Astăzi vom discuta despre progresul proiectului nostru.',
      uk: 'Ласкаво просимо всіх на нашу щотижневу зустріч спільноти. Сьогодні ми обговоримо прогрес нашого проекту.',
      zh: '欢迎大家参加我们每周的社区会议。今天我们将讨论项目的进展。',
      ar: 'أهلاً بالجميع في اجتماع مجتمعنا الأسبوعي. سنتحدث اليوم عن تقدم مشروعنا.',
    },
    {
      it: 'La traduzione simultanea viene inviata a tutti i partecipanti in tempo reale e riprodotta direttamente in cuffia.',
      en: 'Simultaneous translation is sent to all participants in real time and played directly in their headphones.',
      es: 'La traducción simultánea se envía a todos los participantes en tiempo real y se reproduce directamente en sus auriculares.',
      fr: 'La traduction simultanée est envoyée à tous les participants en temps réel et diffusée directement dans leurs écouteurs.',
      de: 'Die Simultanübersetzung wird in Echtzeit an alle Teilnehmer gesendet und direkt über Kopfhörer wiedergegeben.',
      pt: 'A tradução simultânea é enviada a todos os participantes em tempo real e reproduzida diretamente nos fones de ouvido.',
      ro: 'Traducerea simultană este trimisă tuturor participanților în timp real și redată direct în căști.',
      uk: 'Синхронний переклад транслюється всім учасникам у реальному часі та відтворюється безпосередньо в навушниках.',
      zh: '同步翻译实时发送给所有参与者，并直接在耳机中播放。',
      ar: 'يتم إرسال الترجمة الفورية لجميع المشاركين في الوقت الفعلي وتشغيلها مباشرة في سماعات الرأس.',
    },
    {
      it: 'Grazie alla gestione delle stanze in memoria e al sync leggero, questa applicazione funziona perfettamente anche su Vercel.',
      en: 'Thanks to in-memory room management and lightweight sync, this app runs seamlessly on Vercel.',
      es: 'Gracias a la gestión de salas en memoria y la sincronización ligera, esta aplicación funciona perfectamente en Vercel.',
      fr: 'Grâce à la gestion des salles en mémoire et à la synchronisation légère, cette application fonctionne parfaitement sur Vercel.',
      de: 'Dank speicherbasierter Raumverwaltung und leichtem Sync läuft diese App nahtlos auf Vercel.',
      pt: 'Graças ao gerenciamento de salas na memória e ao sync leve, este aplicativo funciona perfeitamente na Vercel.',
      ro: 'Datorită gestionării camerelor în memorie și sincronizării ușoare, această aplicație funcționează perfect pe Vercel.',
      uk: 'Завдяки керуванню кімнатами в пам’яті та легкому синхронізуванню ця програма ідеально працює на Vercel.',
      zh: '得益于内存中的房间管理和轻量级同步，该应用程序在Vercel上完美运行。',
      ar: 'بفضل إدارة الغرف في الذاكرة والمزامنة الخفيفة، يعمل هذا التطبيق بسلاسة على Vercel.',
    },
  ];

  const randomIndex = Math.floor(Math.random() * demoPhrases.length);
  const selected = demoPhrases[randomIndex];
  const chunkIndex = room.chunks.length + 1;

  const chunk: TranslatedChunk = {
    chunkId: `demo_${Date.now()}_${chunkIndex}`,
    chunkIndex,
    timestamp: Date.now(),
    speakerName,
    detectedLanguage: lang,
    originalText: text || selected.it,
    translations: selected,
    isSilence: false,
    processingTimeMs: 380,
  };

  room.chunks.push(chunk);
  if (room.chunks.length > 50) room.chunks.shift();

  broadcastToRoom(roomCode, 'chunk-translated', chunk);

  res.json({ success: true, chunk });
});

// In-Memory cache for studio Gemini TTS audio
const ttsAudioCache = new Map<string, string>();

// Studio-Quality AI TTS Endpoint via Gemini 3.8 Flash Lite TTS
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, lang = 'en', voiceName = 'Kore' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Nessun testo fornito per la sintesi vocale' });
  }

  const cleanText = text.trim();
  const cacheKey = `${lang}_${voiceName}_${cleanText}`;
  if (ttsAudioCache.has(cacheKey)) {
    return res.json({
      audioBase64: ttsAudioCache.get(cacheKey),
      mimeType: 'audio/wav',
      cached: true,
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({ error: 'GEMINI_API_KEY non configurata' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: 'Clear, natural, warm conference interpreter voice',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Nessun dato audio generato da Gemini TTS');
    }

    if (ttsAudioCache.size > 200) {
      const firstKey = ttsAudioCache.keys().next().value;
      if (firstKey) ttsAudioCache.delete(firstKey);
    }
    ttsAudioCache.set(cacheKey, base64Audio);

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      cached: false,
    });
  } catch (err: any) {
    console.error('[Gathered] Errore generazione Gemini TTS:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Errore durante la sintesi vocale Gemini' });
  }
});

// Vite dev server mounting or static prod serving
async function setupFrontend() {
  if (!process.env.VERCEL) {
    if (!isProd) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }
  }
}

// Start HTTP server in standalone Node environments
if (!process.env.VERCEL) {
  setupFrontend()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Gathered] Server active and listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[Gathered] Fatal server startup error:', err);
    });
}

export default app;
