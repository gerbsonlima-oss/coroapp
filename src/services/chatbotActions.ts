import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileToBucket } from "@/utils/storageUpload";
import { compressEventCoverImage } from "@/utils/imageCompression";
import { createCombinedImage, convertPdfToImages } from "@/utils/pdfToImage";
import type {
  EventChatDraft,
  NaipeKey,
  SongAudioDraft,
  SongChatDraft,
  UploadChatDraft,
} from "@/types/chatbot";

const eventSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  date: z.string().min(1, "Data é obrigatória"),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

const songSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  type: z.string().min(1, "Tipo é obrigatório"),
  lyrics: z.string().max(25000).optional(),
  chords: z.string().max(25000).optional(),
});

export interface ChatActionContext {
  userId: string;
  tenantId: string;
}

export interface UploadedChatAssets {
  coverImageUrl?: string | null;
  sheetMusicUrl?: string | null;
  sheetMusicPdfUrl?: string | null;
  lyricsContent?: string | null;
  songAudios?: {
    naipe: NaipeKey;
    name: string;
    audio_url: string;
  }[];
}

export function sanitizeFileName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

  const sanitized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return sanitized + extension;
}

async function uploadEventCoverIfAny(
  userId: string,
  coverImageFile?: File | null
): Promise<string | null> {
  if (!coverImageFile) return null;

  const compressedFile = await compressEventCoverImage(coverImageFile);
  const fileName = `${userId}/${Date.now()}_${sanitizeFileName(compressedFile.name).replace(/\.[^.]+$/, ".webp")}`;

  const { error: uploadError } = await supabase.storage
    .from("event-covers")
    .upload(fileName, compressedFile, {
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Erro ao enviar capa do evento: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("event-covers").getPublicUrl(fileName);

  return publicUrl;
}

async function uploadSongFilesIfAny(
  userId: string,
  sheetMusicFile?: File | null,
  lyricsTxtFile?: File | null
): Promise<Pick<UploadedChatAssets, "sheetMusicUrl" | "sheetMusicPdfUrl" | "lyricsContent">> {
  const result: Pick<UploadedChatAssets, "sheetMusicUrl" | "sheetMusicPdfUrl" | "lyricsContent"> = {};

  if (sheetMusicFile) {
    if (sheetMusicFile.type === "application/pdf") {
      const pages = await convertPdfToImages(sheetMusicFile);
      const combinedImageBlob = await createCombinedImage(pages);
      const imageFile = new File(
        [combinedImageBlob],
        sheetMusicFile.name.replace(/\.pdf$/i, ".jpg"),
        { type: "image/jpeg" }
      );

      const sanitizedImageName = sanitizeFileName(imageFile.name);
      const imagePath = `${userId}/${Date.now()}_${sanitizedImageName}`;
      result.sheetMusicUrl = await uploadFileToBucket(imageFile, "sheet-music", imagePath);

      const sanitizedPdfName = sanitizeFileName(sheetMusicFile.name);
      const pdfPath = `${userId}/${Date.now()}_original_${sanitizedPdfName}`;
      result.sheetMusicPdfUrl = await uploadFileToBucket(sheetMusicFile, "sheet-music", pdfPath);
    } else {
      const sanitizedSheetName = sanitizeFileName(sheetMusicFile.name);
      const sheetPath = `${userId}/${Date.now()}_${sanitizedSheetName}`;
      result.sheetMusicUrl = await uploadFileToBucket(sheetMusicFile, "sheet-music", sheetPath);
    }
  }

  if (lyricsTxtFile) {
    result.lyricsContent = await lyricsTxtFile.text();
  }

  return result;
}

async function uploadSongAudiosIfAny(
  userId: string,
  audioDrafts: SongAudioDraft[]
): Promise<UploadedChatAssets["songAudios"]> {
  if (audioDrafts.length === 0) return [];

  const uploads: NonNullable<UploadedChatAssets["songAudios"]> = [];
  for (const audio of audioDrafts) {
    const sanitizedAudioName = sanitizeFileName(audio.file.name);
    const audioPath = `${userId}/${audio.naipe}_${Date.now()}_${sanitizedAudioName}`;
    const audioUrl = await uploadFileToBucket(audio.file, "audio-files", audioPath);

    uploads.push({
      naipe: audio.naipe,
      name: audio.name || audio.file.name,
      audio_url: audioUrl,
    });
  }

  return uploads;
}

export async function uploadChatAssets(
  context: ChatActionContext,
  payload: UploadChatDraft
): Promise<UploadedChatAssets> {
  const { userId } = context;
  const assets: UploadedChatAssets = {};

  if (payload.target === "evento") {
    assets.coverImageUrl = await uploadEventCoverIfAny(userId, payload.coverImageFile);
    return assets;
  }

  const songFiles = await uploadSongFilesIfAny(userId, payload.sheetMusicFile, payload.lyricsTxtFile);
  const audios = await uploadSongAudiosIfAny(userId, payload.audioDrafts);

  assets.sheetMusicUrl = songFiles.sheetMusicUrl;
  assets.sheetMusicPdfUrl = songFiles.sheetMusicPdfUrl;
  assets.lyricsContent = songFiles.lyricsContent;
  assets.songAudios = audios;
  return assets;
}

export async function createEventFromChat(
  context: ChatActionContext,
  payload: EventChatDraft
): Promise<{ id: string; name: string }> {
  eventSchema.parse(payload);

  const coverImageUrl = await uploadEventCoverIfAny(context.userId, payload.coverImageFile);
  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        user_id: context.userId,
        tenant_id: context.tenantId,
        name: payload.name,
        date: payload.date,
        location: payload.location || null,
        notes: payload.notes || null,
        cover_image_url: coverImageUrl,
      },
    ])
    .select("id, name")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Erro ao criar evento");
  }

  return { id: data.id, name: data.name };
}

export async function createSongFromChat(
  context: ChatActionContext,
  payload: SongChatDraft
): Promise<{ id: string; name: string }> {
  songSchema.parse(payload);

  const songFiles = await uploadSongFilesIfAny(
    context.userId,
    payload.sheetMusicFile,
    payload.lyricsTxtFile
  );
  const songAudios = await uploadSongAudiosIfAny(context.userId, payload.audioDrafts);

  const { data: songData, error: songError } = await supabase
    .from("songs")
    .insert([
      {
        user_id: context.userId,
        tenant_id: context.tenantId,
        name: payload.name,
        type: payload.type,
        sheet_music_url: songFiles.sheetMusicUrl || null,
        sheet_music_pdf_url: songFiles.sheetMusicPdfUrl || null,
        lyrics: payload.lyrics || songFiles.lyricsContent || null,
        chords: payload.chords || null,
      },
    ])
    .select("id, name")
    .single();

  if (songError || !songData) {
    throw new Error(songError?.message || "Erro ao criar música");
  }

  if (songAudios && songAudios.length > 0) {
    const { error: audiosError } = await supabase.from("song_audios").insert(
      songAudios.map((audio) => ({
        song_id: songData.id,
        tenant_id: context.tenantId,
        naipe: audio.naipe,
        audio_url: audio.audio_url,
        name: audio.name,
      }))
    );

    if (audiosError) {
      throw new Error(audiosError.message || "Erro ao salvar áudios da música");
    }
  }

  return { id: songData.id, name: songData.name };
}

export async function linkSongToEvent(
  context: ChatActionContext,
  payload: { eventId: string; songId: string; type?: string }
): Promise<void> {
  if (!payload.eventId || !payload.songId) {
    throw new Error("Dados inválidos para vínculo");
  }

  const { data: eventData, error: eventLookupError } = await supabase
    .from("events")
    .select("id")
    .eq("id", payload.eventId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  if (eventLookupError || !eventData) {
    throw new Error("Evento não encontrado no tenant atual");
  }

  const { data: songData, error: songLookupError } = await supabase
    .from("songs")
    .select("id")
    .eq("id", payload.songId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  if (songLookupError || !songData) {
    throw new Error("Música não encontrada no tenant atual");
  }

  const { error } = await supabase.from("event_songs").insert([
    {
      event_id: payload.eventId,
      song_id: payload.songId,
      type: payload.type || null,
    },
  ]);

  if (error) {
    throw new Error(error.message || "Erro ao vincular música ao evento");
  }
}
