import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// chat_messages and chat_sessions tables are not yet in the generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { convertPdfToImages, createCombinedImage } from "@/utils/pdfToImage";
import { uploadFileToBucket } from "@/utils/storageUpload";
import { detectIntent, isAffirmative, isNegative, normalizeFreeText } from "./intents";
import type {
  ChatFlowState,
  ChatMessage,
  ChatMessagePayload,
  ChatQuickReply,
  ChatSession,
  ChatStep,
} from "./types";

const AUDIO_NAIPES = ["soprano", "contralto", "tenor", "baixo", "4 vozes"] as const;

const INITIAL_STATE: ChatFlowState = {
  flow: "idle",
  step: "idle",
};

const HELP_QUICK_REPLIES: ChatQuickReply[] = [
  { label: "Criar evento + música", action: "start_flow" },
  { label: "Criar música (form)", action: "open_music_form" },
  { label: "Reiniciar", action: "restart" },
  { label: "Cancelar", action: "cancel" },
];

function nowFilenamePrefix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isValidDate(input: string): boolean {
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const date = new Date(`${trimmed}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function parseActionInput(raw: string): { action: string | null; payload: string | null } {
  if (!raw.startsWith("__action:")) return { action: null, payload: null };
  const content = raw.replace("__action:", "");
  const [action, payload] = content.split("|", 2);
  return { action: action || null, payload: payload || null };
}

function createBotMessage(
  text: string,
  metadata?: ChatMessagePayload["metadata"]
): ChatMessagePayload {
  return { role: "bot", text, metadata };
}

function asFlowState(value: Json | null): ChatFlowState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...INITIAL_STATE };
  const source = value as Record<string, unknown>;
  return {
    flow: (source.flow as ChatFlowState["flow"]) || "idle",
    step: (source.step as ChatStep) || "idle",
    draft_event: (source.draft_event as ChatFlowState["draft_event"]) || undefined,
    draft_song: (source.draft_song as ChatFlowState["draft_song"]) || undefined,
    pending_files: (source.pending_files as ChatFlowState["pending_files"]) || undefined,
    last_action: (source.last_action as string | undefined) || undefined,
  };
}

async function checkIsAdmin(userId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_tenant_admin", {
    _user_id: userId,
    _tenant_id: tenantId,
  });
  if (error) return false;
  return !!data;
}

async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as ChatMessage[];
}

export class ChatCommandService {
  static async startOrResumeSession(tenantId: string, userId: string): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
  }> {
    const { data: existing, error: existingError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let session = existing as ChatSession | null;
    if (!session) {
      const { data: created, error: createError } = await supabase
        .from("chat_sessions")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          status: "active",
          current_flow: "idle",
          current_step: "idle",
          flow_state: INITIAL_STATE as unknown as Json,
        })
        .select("*")
        .single();

      if (createError) throw createError;
      session = created as ChatSession;
    }

    const messages = await listMessages(session.id);
    return { session, messages };
  }

  static async executeStepAction(sessionId: string, action: string): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
    botMessages: ChatMessagePayload[];
  }> {
    return this.handleUserMessage(sessionId, `__action:${action}`);
  }

  static async cancelFlow(sessionId: string): Promise<void> {
    await supabase
      .from("chat_sessions")
      .update({
        current_flow: "idle",
        current_step: "idle",
        flow_state: { ...INITIAL_STATE, last_action: "cancel" } as unknown as Json,
      })
      .eq("id", sessionId);
  }

  static async restartFlow(sessionId: string): Promise<void> {
    await supabase
      .from("chat_sessions")
      .update({
        current_flow: "idle",
        current_step: "idle",
        flow_state: { ...INITIAL_STATE, last_action: "restart" } as unknown as Json,
      })
      .eq("id", sessionId);
  }

  static async handleUserMessage(
    sessionId: string,
    text: string,
    files?: File[]
  ): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
    botMessages: ChatMessagePayload[];
  }> {
    const { data: sessionData, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;
    const session = sessionData as ChatSession;
    const state = asFlowState(session.flow_state as unknown as Json);

    const normalizedText = text.trim();
    const { action, payload: actionPayload } = parseActionInput(normalizedText);
    const intent = action
      ? action === "restart"
        ? "restart"
        : action === "cancel"
          ? "cancel"
          : "unknown"
      : detectIntent(normalizedText);

    const userMessageMetadata = {
      intent,
      action: action || undefined,
      attachments:
        files?.map((file) => ({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })) || undefined,
    } satisfies ChatMessagePayload["metadata"];

    if (normalizedText && !normalizedText.startsWith("__action:")) {
      const { error: userMsgError } = await db.from("chat_messages").insert({
        session_id: session.id,
        tenant_id: session.tenant_id,
        user_id: session.user_id,
        role: "user",
        content: normalizedText,
        metadata: userMessageMetadata as unknown as Json,
      });
      if (userMsgError) throw userMsgError;
    }

    const isAdmin = await checkIsAdmin(session.user_id, session.tenant_id);
    const botMessages: ChatMessagePayload[] = [];
    let nextState: ChatFlowState = { ...state };

    const push = (message: ChatMessagePayload) => botMessages.push(message);

    const pushHelp = () => {
      push(
        createBotMessage(
          "Posso te ajudar a criar evento, cadastrar música, subir áudio e partitura, e vincular tudo no evento. Me diga: quer começar agora?",
          { quickReplies: HELP_QUICK_REPLIES, step: nextState.step, intent: "help" }
        )
      );
    };

    if (intent === "cancel") {
      nextState = { ...INITIAL_STATE, last_action: "cancel" };
      push(
        createBotMessage("Fluxo cancelado. Quando quiser, me chama com 'oi' ou toque em 'Criar evento + música'.", {
          quickReplies: HELP_QUICK_REPLIES,
          step: "idle",
          intent: "cancel",
        })
      );
    } else if (intent === "restart") {
      nextState = { ...INITIAL_STATE, last_action: "restart" };
      push(
        createBotMessage("Fechado, recomeçando do zero. O que você quer fazer agora?", {
          quickReplies: HELP_QUICK_REPLIES,
          step: "idle",
          intent: "restart",
        })
      );
    } else if (!isAdmin && (state.step !== "idle" || action === "start_flow" || action === "open_music_form" || action === "music_form_submit" || intent === "create_event" || intent === "create_song")) {
      nextState = { ...INITIAL_STATE, step: "blocked_non_admin", last_action: "blocked_non_admin" };
      push(
        createBotMessage(
          "Você está sem permissão de administrador para criar evento, música ou fazer upload. Peça acesso de admin e eu continuo o passo a passo com você.",
          { quickReplies: [{ label: "Ajuda", action: "help" }], step: "blocked_non_admin" }
        )
      );
    } else {
      const effectiveText = action || normalizedText;
      nextState = await this.processStateStep({
        state: nextState,
        tenantId: session.tenant_id,
        userId: session.user_id,
        text: effectiveText,
        files: files || [],
        intent,
        action,
        actionPayload,
        push,
      });
    }

    if (intent === "help") {
      pushHelp();
    }

    const { error: sessionUpdateError } = await supabase
      .from("chat_sessions")
      .update({
        current_flow: nextState.flow,
        current_step: nextState.step,
        flow_state: nextState as unknown as Json,
      })
      .eq("id", session.id);
    if (sessionUpdateError) throw sessionUpdateError;

    if (botMessages.length > 0) {
      const payload = botMessages.map((msg) => ({
        session_id: session.id,
        tenant_id: session.tenant_id,
        user_id: session.user_id,
        role: msg.role,
        content: msg.text,
        metadata: (msg.metadata || {}) as unknown as Json,
      }));
      const { error: botInsertError } = await db.from("chat_messages").insert(payload);
      if (botInsertError) throw botInsertError;
    }

    const { data: refreshed, error: refreshedError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", session.id)
      .single();
    if (refreshedError) throw refreshedError;

    const messages = await listMessages(session.id);
    return { session: refreshed as ChatSession, messages, botMessages };
  }

  private static async processStateStep(params: {
    state: ChatFlowState;
    tenantId: string;
    userId: string;
    text: string;
    files: File[];
    intent: string;
    action: string | null;
    actionPayload: string | null;
    push: (message: ChatMessagePayload) => void;
  }): Promise<ChatFlowState> {
    const { state, tenantId, userId, text, files, intent, action, actionPayload, push } = params;
    const normalized = normalizeFreeText(text);
    let nextState = { ...state };

    if (intent === "greeting" && (state.step === "idle" || state.step === "completed" || state.step === "blocked_non_admin")) {
      push(
        createBotMessage(
          "Oi! Eu consigo te ajudar com: criar evento, criar música, subir áudio, subir partitura e vincular música no evento. Quer começar pelo fluxo completo?",
          {
            quickReplies: [
              { label: "Criar evento + música", action: "start_flow" },
              { label: "Criar música (form)", action: "open_music_form" },
              { label: "Ajuda", action: "help" },
              { label: "Reiniciar", action: "restart" },
            ],
            step: "awaiting_start_choice",
            intent: "greeting",
          }
        )
      );
      return { ...INITIAL_STATE, step: "awaiting_start_choice", last_action: "greeting" };
    }

    if (
      normalized === "start_flow" ||
      normalized === "criar evento + musica" ||
      normalized === "criar evento + música" ||
      intent === "create_event"
    ) {
      push(createBotMessage("Perfeito. Vamos criar seu evento. Primeiro: qual é o nome do evento?"));
      return {
        flow: "create_event_song",
        step: "awaiting_event_name",
        draft_event: {},
        draft_song: {},
        pending_files: {},
        last_action: "start_flow",
      };
    }

    if (normalized === "open_music_form" || action === "open_music_form" || intent === "create_song") {
      push(
        createBotMessage(
          "Beleza. Preencha o formulário de música abaixo para cadastrar e fazer todos os uploads de uma vez.",
          {
            step: "awaiting_song_form",
            quickReplies: [{ label: "Reiniciar", action: "restart" }],
          }
        )
      );
      return {
        ...state,
        flow: "create_event_song",
        step: "awaiting_song_form",
        draft_song: {},
        last_action: "open_music_form",
      };
    }

    switch (state.step) {
      case "awaiting_start_choice": {
        push(
          createBotMessage("Escolha como quer começar:", {
            quickReplies: [
              { label: "Criar evento + música", action: "start_flow" },
              { label: "Criar música (form)", action: "open_music_form" },
            ],
          })
        );
        return state;
      }
      case "awaiting_event_name": {
        if (text.trim().length < 3) {
          push(createBotMessage("O nome precisa ter pelo menos 3 caracteres. Me envie um nome válido do evento."));
          return state;
        }
        nextState = {
          ...state,
          draft_event: { ...(state.draft_event || {}), name: text.trim() },
          step: "awaiting_event_date",
          last_action: "event_name_set",
        };
        push(createBotMessage("Ótimo. Agora me envie a data no formato `YYYY-MM-DD` (ex.: 2026-04-12)."));
        return nextState;
      }
      case "awaiting_event_date": {
        if (!isValidDate(text.trim())) {
          push(createBotMessage("Data inválida. Use o formato `YYYY-MM-DD` (ex.: 2026-04-12)."));
          return state;
        }
        nextState = {
          ...state,
          draft_event: { ...(state.draft_event || {}), date: text.trim() },
          step: "awaiting_event_location",
          last_action: "event_date_set",
        };
        push(
          createBotMessage("Quer informar local? Se sim, digite agora. Se não, toque em pular.", {
            quickReplies: [{ label: "Pular local", action: "skip_location" }],
          })
        );
        return nextState;
      }
      case "awaiting_event_location": {
        const location = normalized === "skip_location" ? null : text.trim();
        nextState = {
          ...state,
          draft_event: { ...(state.draft_event || {}), location: location || null },
          step: "awaiting_event_notes",
          last_action: "event_location_set",
        };
        push(
          createBotMessage("Quer adicionar observações do evento? Se não quiser, toque em pular.", {
            quickReplies: [{ label: "Pular observações", action: "skip_notes" }],
          })
        );
        return nextState;
      }
      case "awaiting_event_notes": {
        const notes = normalized === "skip_notes" ? null : text.trim();
        nextState = {
          ...state,
          draft_event: { ...(state.draft_event || {}), notes: notes || null },
          step: "confirm_event",
          last_action: "event_notes_set",
        };
        const draft = nextState.draft_event || {};
        push(
          createBotMessage(
            `Confirma criação do evento?\nNome: ${draft.name}\nData: ${draft.date}\nLocal: ${draft.location || "não informado"}`,
            {
              quickReplies: [
                { label: "Confirmar evento", action: "confirm_event_yes" },
                { label: "Reiniciar", action: "restart" },
              ],
            }
          )
        );
        return nextState;
      }
      case "confirm_event": {
        if (!(normalized === "confirm_event_yes" || isAffirmative(text))) {
          if (isNegative(text)) {
            push(createBotMessage("Sem problemas. Toque em reiniciar para ajustar os dados do evento.", { quickReplies: [{ label: "Reiniciar", action: "restart" }] }));
            return state;
          }
          push(createBotMessage("Para continuar, confirme a criação do evento."));
          return state;
        }

        const draftEvent = state.draft_event || {};
        const { data: createdEvent, error: eventError } = await supabase
          .from("events")
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            name: draftEvent.name || "",
            date: draftEvent.date || "",
            location: draftEvent.location || null,
            notes: draftEvent.notes || null,
          })
          .select("id, name")
          .single();
        if (eventError) {
          push(createBotMessage(`Não consegui criar o evento agora (${eventError.message}). Tente novamente.`));
          return state;
        }

        nextState = {
          ...state,
          draft_event: { ...draftEvent, id: createdEvent.id },
          step: "awaiting_song_name",
          last_action: "event_created",
        };
        push(createBotMessage(`Evento criado com sucesso: ${createdEvent.name}. Agora vamos para a música. Qual o nome da música?`));
        return nextState;
      }
      case "awaiting_song_name": {
        if (text.trim().length < 3) {
          push(createBotMessage("Nome da música muito curto. Envie um nome com pelo menos 3 caracteres."));
          return state;
        }
        const { data: typesData, error: typesError } = await supabase
          .from("song_types")
          .select("name, slug")
          .order("order_index", { ascending: true });
        if (typesError) {
          push(createBotMessage("Erro ao carregar tipos de música. Tente novamente."));
          return state;
        }

        nextState = {
          ...state,
          draft_song: { ...(state.draft_song || {}), name: text.trim() },
          step: "awaiting_song_type",
          last_action: "song_name_set",
        };

        const quickReplies = (typesData || []).slice(0, 5).map((t) => ({
          label: t.name,
          action: `song_type:${t.slug}`,
        }));

        push(
          createBotMessage(
            "Escolha o tipo litúrgico da música. Você pode tocar numa opção ou digitar o nome do tipo.",
            { quickReplies }
          )
        );
        return nextState;
      }
      case "awaiting_song_type": {
        const { data: typesData, error: typesError } = await supabase
          .from("song_types")
          .select("name, slug")
          .order("order_index", { ascending: true });
        if (typesError) {
          push(createBotMessage("Erro ao validar tipo de música. Tente novamente."));
          return state;
        }

        const selectedByAction = normalized.startsWith("song_type:") ? normalized.split(":")[1] : "";
        const normalizedInput = normalizeFreeText(text);
        const selectedType = (typesData || []).find((type) => {
          const typeSlug = normalizeFreeText(type.slug);
          const typeName = normalizeFreeText(type.name);
          return typeSlug === selectedByAction || typeSlug === normalizedInput || typeName === normalizedInput;
        });

        if (!selectedType) {
          push(createBotMessage("Não reconheci esse tipo. Digite exatamente o nome do tipo litúrgico ou toque em uma sugestão."));
          return state;
        }

        nextState = {
          ...state,
          draft_song: { ...(state.draft_song || {}), type: selectedType.name },
          step: "confirm_song",
          last_action: "song_type_set",
        };
        push(
          createBotMessage(
            `Confirma criação da música?\nNome: ${nextState.draft_song?.name}\nTipo: ${nextState.draft_song?.type}`,
            { quickReplies: [{ label: "Confirmar música", action: "confirm_song_yes" }] }
          )
        );
        return nextState;
      }
      case "awaiting_song_form": {
        if (action !== "music_form_submit") {
          push(
            createBotMessage("Preencha o formulário e toque em 'Criar música com uploads'.", {
              step: "awaiting_song_form",
            })
          );
          return state;
        }

        if (!actionPayload) {
          push(createBotMessage("Não recebi os dados do formulário. Tente enviar novamente."));
          return state;
        }

        let formData: { name?: string; type?: string; eventId?: string | null } = {};
        try {
          formData = JSON.parse(decodeURIComponent(actionPayload));
        } catch {
          push(createBotMessage("Não consegui ler os dados do formulário. Tente novamente."));
          return state;
        }

        const songName = (formData.name || "").trim();
        const songType = (formData.type || "").trim();
        const eventId = formData.eventId || null;

        if (songName.length < 3 || !songType) {
          push(createBotMessage("Preencha nome da música (mín. 3) e tipo litúrgico antes de enviar."));
          return state;
        }

        const { data: createdSong, error: songError } = await supabase
          .from("songs")
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            name: songName,
            type: songType,
          })
          .select("id, name")
          .single();
        if (songError) {
          push(createBotMessage(`Não consegui criar a música (${songError.message}).`));
          return state;
        }

        const songId = createdSong.id;
        const filesList = files || [];
        const audioFiles = filesList.filter((file) => file.name.startsWith("audio_"));
        const sheetFile =
          filesList.find((file) => file.name.startsWith("sheet__")) ||
          filesList.find((file) => file.type === "application/pdf" || file.type.startsWith("image/"));

        for (const audioFile of audioFiles) {
          const naipeMatch = audioFile.name.match(/^audio_(.+?)__/);
          const naipe = naipeMatch?.[1];
          if (!naipe || !AUDIO_NAIPES.includes(naipe as (typeof AUDIO_NAIPES)[number])) {
            continue;
          }

          const audioPath = `${userId}/${nowFilenamePrefix()}_${audioFile.name.replace(/^audio_.+?__/, "")}`;
          const audioUrl = await uploadFileToBucket(audioFile, "audio-files", audioPath);
          const { error: audioInsertError } = await supabase.from("song_audios").insert({
            song_id: songId,
            tenant_id: tenantId,
            naipe,
            audio_url: audioUrl,
            name: `${songName} - ${naipe}`,
          });
          if (audioInsertError) {
            push(createBotMessage(`Música criada, mas houve erro em um áudio (${audioInsertError.message}).`));
            return {
              ...state,
              draft_song: { id: songId, name: songName, type: songType },
              step: "completed",
              flow: "idle",
              last_action: "music_form_partial",
            };
          }
        }

        if (sheetFile) {
          const isPdf = sheetFile.type === "application/pdf" || sheetFile.name.toLowerCase().endsWith(".pdf");
          let sheetMusicUrl: string | null = null;
          let sheetMusicPdfUrl: string | null = null;

          if (isPdf) {
            const pdfPath = `${userId}/${nowFilenamePrefix()}_original_${sheetFile.name.replace(/^sheet__/, "")}`;
            sheetMusicPdfUrl = await uploadFileToBucket(sheetFile, "sheet-music", pdfPath);
            const pages = await convertPdfToImages(sheetFile);
            const combined = await createCombinedImage(pages);
            const imageFile = new File([combined], sheetFile.name.replace(/^sheet__/, "").replace(/\.pdf$/i, ".jpg"), {
              type: "image/jpeg",
            });
            const imagePath = `${userId}/${nowFilenamePrefix()}_${imageFile.name}`;
            sheetMusicUrl = await uploadFileToBucket(imageFile, "sheet-music", imagePath);
          } else {
            const imagePath = `${userId}/${nowFilenamePrefix()}_${sheetFile.name.replace(/^sheet__/, "")}`;
            sheetMusicUrl = await uploadFileToBucket(sheetFile, "sheet-music", imagePath);
          }

          const updateData: { sheet_music_url?: string; sheet_music_pdf_url?: string } = {};
          if (sheetMusicUrl) updateData.sheet_music_url = sheetMusicUrl;
          if (sheetMusicPdfUrl) updateData.sheet_music_pdf_url = sheetMusicPdfUrl;
          const { error: songUpdateError } = await supabase.from("songs").update(updateData).eq("id", songId);
          if (songUpdateError) {
            push(createBotMessage(`Música criada, mas não consegui salvar partitura (${songUpdateError.message}).`));
          }
        }

        if (eventId) {
          const { data: existingLinks } = await supabase
            .from("event_songs")
            .select("order_index")
            .eq("event_id", eventId)
            .order("order_index", { ascending: false })
            .limit(1);
          const nextOrder = (existingLinks?.[0]?.order_index || 0) + 1;
          const { error: linkError } = await supabase.from("event_songs").insert({
            event_id: eventId,
            song_id: songId,
            type: songType,
            order_index: nextOrder,
          });
          if (linkError) {
            push(createBotMessage(`Música criada, mas não consegui vincular ao evento (${linkError.message}).`));
            return {
              ...state,
              draft_song: { id: songId, name: songName, type: songType },
              step: "completed",
              flow: "idle",
              last_action: "music_form_link_failed",
            };
          }
        }

        push(
          createBotMessage("Perfeito. Música criada com uploads concluídos com sucesso.", {
            quickReplies: [
              { label: "Criar outra música (form)", action: "open_music_form" },
              { label: "Criar evento + música", action: "start_flow" },
            ],
          })
        );
        return {
          ...state,
          draft_song: { id: songId, name: songName, type: songType },
          step: "completed",
          flow: "idle",
          last_action: "music_form_completed",
        };
      }
      case "confirm_song": {
        if (!(normalized === "confirm_song_yes" || isAffirmative(text))) {
          if (isNegative(text)) {
            push(createBotMessage("Beleza. Toque em reiniciar para corrigir os dados da música.", { quickReplies: [{ label: "Reiniciar", action: "restart" }] }));
            return state;
          }
          push(createBotMessage("Para continuar, confirme a criação da música."));
          return state;
        }

        const draftSong = state.draft_song || {};
        const { data: createdSong, error: songError } = await supabase
          .from("songs")
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            name: draftSong.name || "",
            type: draftSong.type || "",
          })
          .select("id, name")
          .single();
        if (songError) {
          push(createBotMessage(`Não consegui criar a música agora (${songError.message}). Tente novamente.`));
          return state;
        }

        nextState = {
          ...state,
          draft_song: { ...draftSong, id: createdSong.id },
          step: "awaiting_audio_naipe",
          last_action: "song_created",
        };
        push(
          createBotMessage("Música criada. Agora escolha o naipe do áudio que você vai enviar.", {
            quickReplies: AUDIO_NAIPES.map((naipe) => ({ label: naipe, action: `audio_naipe:${naipe}` })),
          })
        );
        return nextState;
      }
      case "awaiting_audio_naipe": {
        const selectedFromAction = normalized.startsWith("audio_naipe:") ? normalized.slice("audio_naipe:".length) : normalized;
        const matchedNaipe = AUDIO_NAIPES.find((naipe) => normalizeFreeText(naipe) === selectedFromAction);
        if (!matchedNaipe) {
          push(createBotMessage("Naipe inválido. Escolha uma opção: soprano, contralto, tenor, baixo ou 4 vozes."));
          return state;
        }
        nextState = {
          ...state,
          pending_files: { ...(state.pending_files || {}), audio_naipe: matchedNaipe },
          step: "awaiting_audio_file",
          last_action: "audio_naipe_set",
        };
        push(createBotMessage(`Perfeito. Agora anexe o arquivo de áudio para o naipe ${matchedNaipe}.`));
        return nextState;
      }
      case "awaiting_audio_file": {
        if (!files.length) {
          push(createBotMessage("Estou aguardando o arquivo de áudio. Toque no clipe para anexar."));
          return state;
        }
        const audioFile = files[0];
        if (!audioFile.type.startsWith("audio/")) {
          push(createBotMessage("O arquivo enviado não parece ser de áudio. Envie um arquivo de áudio válido (mp3, wav, m4a...)."));
          return state;
        }
        const songId = state.draft_song?.id;
        const naipe = state.pending_files?.audio_naipe;
        if (!songId || !naipe) {
          push(createBotMessage("Perdi o contexto do upload. Vamos reiniciar esse trecho.", { quickReplies: [{ label: "Reiniciar", action: "restart" }] }));
          return state;
        }

        const path = `${userId}/${nowFilenamePrefix()}_${audioFile.name}`;
        const audioUrl = await uploadFileToBucket(audioFile, "audio-files", path);

        const { error: audioInsertError } = await supabase.from("song_audios").insert({
          song_id: songId,
          tenant_id: tenantId,
          naipe,
          audio_url: audioUrl,
          name: `${state.draft_song?.name || "Áudio"} - ${naipe}`,
        });

        if (audioInsertError) {
          push(createBotMessage(`Erro ao salvar áudio (${audioInsertError.message}). Tente anexar novamente.`));
          return state;
        }

        nextState = {
          ...state,
          step: "awaiting_sheet_file_or_skip",
          last_action: "audio_uploaded",
        };
        push(
          createBotMessage("Áudio salvo com sucesso. Agora envie a partitura (imagem ou PDF). Se quiser pular, toque abaixo.", {
            quickReplies: [{ label: "Pular partitura", action: "skip_sheet" }],
            attachments: [
              {
                file_name: audioFile.name,
                file_type: audioFile.type,
                file_size: audioFile.size,
                bucket: "audio-files",
                url: audioUrl,
              },
            ],
          })
        );
        return nextState;
      }
      case "awaiting_sheet_file_or_skip": {
        const songId = state.draft_song?.id;
        if (!songId) {
          push(createBotMessage("Perdi o contexto da música. Reinicie para continuar.", { quickReplies: [{ label: "Reiniciar", action: "restart" }] }));
          return state;
        }

        if (normalized === "skip_sheet" || normalized === "pular partitura" || normalized === "pular") {
          nextState = { ...state, step: "confirm_link", last_action: "sheet_skipped" };
          push(createBotMessage("Tudo certo, partitura pulada. Quer que eu vincule essa música ao evento criado?", { quickReplies: [{ label: "Vincular agora", action: "confirm_link_yes" }] }));
          return nextState;
        }

        if (!files.length) {
          push(createBotMessage("Estou aguardando a partitura (imagem ou PDF)."));
          return state;
        }

        const sheetFile = files[0];
        const isPdf = sheetFile.type === "application/pdf" || sheetFile.name.toLowerCase().endsWith(".pdf");
        const isImage = sheetFile.type.startsWith("image/");
        if (!isPdf && !isImage) {
          push(createBotMessage("Formato inválido. Envie uma imagem ou PDF."));
          return state;
        }

        let sheetMusicUrl: string | null = null;
        let sheetMusicPdfUrl: string | null = null;

        if (isPdf) {
          const pdfPath = `${userId}/${nowFilenamePrefix()}_original_${sheetFile.name}`;
          sheetMusicPdfUrl = await uploadFileToBucket(sheetFile, "sheet-music", pdfPath);

          const pages = await convertPdfToImages(sheetFile);
          const combined = await createCombinedImage(pages);
          const imageFile = new File([combined], sheetFile.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
          const imagePath = `${userId}/${nowFilenamePrefix()}_${imageFile.name}`;
          sheetMusicUrl = await uploadFileToBucket(imageFile, "sheet-music", imagePath);
        } else {
          const imagePath = `${userId}/${nowFilenamePrefix()}_${sheetFile.name}`;
          sheetMusicUrl = await uploadFileToBucket(sheetFile, "sheet-music", imagePath);
        }

        const updateData: { sheet_music_url?: string; sheet_music_pdf_url?: string } = {};
        if (sheetMusicUrl) updateData.sheet_music_url = sheetMusicUrl;
        if (sheetMusicPdfUrl) updateData.sheet_music_pdf_url = sheetMusicPdfUrl;

        const { error: songUpdateError } = await supabase
          .from("songs")
          .update(updateData)
          .eq("id", songId);
        if (songUpdateError) {
          push(createBotMessage(`Partitura enviada, mas não consegui salvar na música (${songUpdateError.message}). Tente de novo.`));
          return state;
        }

        nextState = { ...state, step: "confirm_link", last_action: "sheet_uploaded" };
        push(
          createBotMessage("Partitura salva com sucesso. Quer que eu vincule essa música ao evento criado agora?", {
            quickReplies: [{ label: "Vincular agora", action: "confirm_link_yes" }],
            attachments: [
              {
                file_name: sheetFile.name,
                file_type: sheetFile.type,
                file_size: sheetFile.size,
                bucket: "sheet-music",
                url: sheetMusicPdfUrl || sheetMusicUrl || undefined,
              },
            ],
          })
        );
        return nextState;
      }
      case "confirm_link": {
        if (!(normalized === "confirm_link_yes" || isAffirmative(text))) {
          if (isNegative(text)) {
            push(createBotMessage("Tudo bem. O evento e a música já estão criados. Quando quiser, posso te guiar de novo.", { quickReplies: [{ label: "Criar outro fluxo", action: "start_flow" }] }));
            return { ...state, step: "completed", flow: "idle", last_action: "link_skipped" };
          }
          push(createBotMessage("Para concluir o fluxo, confirme se devo vincular a música ao evento."));
          return state;
        }

        const eventId = state.draft_event?.id;
        const songId = state.draft_song?.id;
        if (!eventId || !songId) {
          push(createBotMessage("Perdi o contexto do vínculo. Vamos reiniciar para garantir.", { quickReplies: [{ label: "Reiniciar", action: "restart" }] }));
          return state;
        }

        const { data: existingLinks, error: linkQueryError } = await supabase
          .from("event_songs")
          .select("id, order_index")
          .eq("event_id", eventId)
          .order("order_index", { ascending: false })
          .limit(1);
        if (linkQueryError) {
          push(createBotMessage(`Erro ao preparar vínculo (${linkQueryError.message}).`));
          return state;
        }
        const nextOrder = (existingLinks?.[0]?.order_index || 0) + 1;

        const { error: linkError } = await supabase.from("event_songs").insert({
          event_id: eventId,
          song_id: songId,
          type: state.draft_song?.type || null,
          order_index: nextOrder,
        });
        if (linkError) {
          push(createBotMessage(`Erro ao vincular música no evento (${linkError.message}).`));
          return state;
        }

        push(
          createBotMessage(
            `Concluído. Evento, música, áudio/partitura e vínculo foram finalizados. Quer começar outro?`,
            { quickReplies: [{ label: "Criar outro fluxo", action: "start_flow" }, { label: "Ajuda", action: "help" }] }
          )
        );
        return { ...state, flow: "idle", step: "completed", last_action: "link_completed" };
      }
      default: {
        push(
          createBotMessage("Posso iniciar seu fluxo completo agora.", {
            quickReplies: [
              { label: "Criar evento + música", action: "start_flow" },
              { label: "Criar música (form)", action: "open_music_form" },
            ],
          })
        );
        return { ...INITIAL_STATE, step: "awaiting_start_choice", last_action: "fallback_idle" };
      }
    }
  }
}
