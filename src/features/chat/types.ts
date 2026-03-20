import type { Json } from "@/integrations/supabase/types";

export type ChatRole = "user" | "bot" | "system";

export type ChatIntent =
  | "greeting"
  | "create_event"
  | "create_song"
  | "upload_audio"
  | "upload_sheet"
  | "link_song_to_event"
  | "help"
  | "cancel"
  | "restart"
  | "unknown";

export type ChatFlow = "idle" | "create_event_song";

export type ChatStep =
  | "idle"
  | "awaiting_start_choice"
  | "awaiting_event_name"
  | "awaiting_event_date"
  | "awaiting_event_location"
  | "awaiting_event_notes"
  | "confirm_event"
  | "awaiting_song_name"
  | "awaiting_song_type"
  | "awaiting_song_form"
  | "confirm_song"
  | "awaiting_audio_naipe"
  | "awaiting_audio_file"
  | "awaiting_sheet_file_or_skip"
  | "confirm_link"
  | "completed"
  | "blocked_non_admin";

export interface ChatQuickReply {
  label: string;
  action: string;
}

export interface ChatAttachmentMetadata {
  file_name: string;
  file_type?: string;
  file_size?: number;
  bucket?: string;
  url?: string;
}

export interface ChatMessagePayload {
  text: string;
  role: ChatRole;
  metadata?: {
    quickReplies?: ChatQuickReply[];
    attachments?: ChatAttachmentMetadata[];
    step?: ChatStep;
    intent?: ChatIntent;
    action?: string;
  };
}

export interface ChatFlowState {
  flow: ChatFlow;
  step: ChatStep;
  draft_event?: {
    id?: string;
    name?: string;
    date?: string;
    location?: string | null;
    notes?: string | null;
  };
  draft_song?: {
    id?: string;
    name?: string;
    type?: string;
  };
  pending_files?: {
    audio_naipe?: string;
  };
  last_action?: string;
}

export interface ChatSession {
  id: string;
  tenant_id: string;
  user_id: string;
  status: "active" | "closed" | "cancelled";
  current_flow: string;
  current_step: string;
  flow_state: Json;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  metadata: Json;
  created_at: string;
}
