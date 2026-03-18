export type ChatIntent =
  | "criar_evento"
  | "criar_musica"
  | "upload_arquivo"
  | "vincular_musica_evento";

export type ChatStepStatus =
  | "collecting"
  | "review"
  | "confirmed"
  | "executing"
  | "done"
  | "error";

export type ChatMessageRole = "assistant" | "user" | "system";
export type ChatMessageType = "text" | "status" | "review" | "action";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type: ChatMessageType;
  content: string;
  action?: string;
  timestamp: string;
}

export type NaipeKey = "soprano" | "contralto" | "tenor" | "baixo" | "unissono";

export interface EventChatDraft {
  name: string;
  date: string;
  location?: string;
  notes?: string;
  coverImageFile?: File | null;
}

export interface SongAudioDraft {
  naipe: NaipeKey;
  name: string;
  file: File;
}

export interface SongChatDraft {
  name: string;
  type: string;
  lyrics?: string;
  chords?: string;
  sheetMusicFile?: File | null;
  lyricsTxtFile?: File | null;
  audioDrafts: SongAudioDraft[];
}

export interface UploadChatDraft {
  target: "evento" | "musica";
  coverImageFile?: File | null;
  sheetMusicFile?: File | null;
  lyricsTxtFile?: File | null;
  audioDrafts: SongAudioDraft[];
}
