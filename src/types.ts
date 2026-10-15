export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  ttsLocale: string;
}

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

export interface RoomMetadata {
  code: string;
  name: string;
  createdAt: number;
  speaker?: {
    name: string;
    isActive: boolean;
    lastChunkAt: number;
  } | null;
  listenerCount: number;
  chunkCount: number;
  recentChunks?: TranslatedChunk[];
}

export type UserRole = 'listener' | 'speaker';

export interface TTSVoiceOption {
  name: string;
  lang: string;
  default: boolean;
}
