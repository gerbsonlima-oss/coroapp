import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, CalendarPlus, Link2, Music2, Paperclip, Send, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTenant, useTenantPath } from "@/contexts/TenantContext";
import {
  createEventFromChat,
  createSongFromChat,
  linkSongToEvent,
  uploadChatAssets,
} from "@/services/chatbotActions";
import type {
  ChatIntent,
  ChatMessage,
  ChatStepStatus,
  EventChatDraft,
  NaipeKey,
  SongAudioDraft,
  SongChatDraft,
  UploadChatDraft,
} from "@/types/chatbot";

interface SongTypeOption {
  id: string;
  slug: string;
  name: string;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
}

type QuestionKey =
  | "event_name"
  | "event_date"
  | "event_location"
  | "event_notes"
  | "event_cover"
  | "song_name"
  | "song_type"
  | "song_lyrics"
  | "song_chords"
  | "song_sheet"
  | "song_lyrics_txt"
  | "song_audio_more"
  | "song_audio_naipe"
  | "song_audio_name"
  | "song_audio_file"
  | "upload_target"
  | "upload_cover"
  | "upload_sheet"
  | "upload_lyrics_txt"
  | "upload_audio_more"
  | "upload_audio_naipe"
  | "upload_audio_name"
  | "upload_audio_file"
  | "link_event"
  | "link_type";

const EMPTY_EVENT_DRAFT: EventChatDraft = {
  name: "",
  date: "",
  location: "",
  notes: "",
  coverImageFile: null,
};

const EMPTY_SONG_DRAFT: SongChatDraft = {
  name: "",
  type: "",
  lyrics: "",
  chords: "",
  sheetMusicFile: null,
  lyricsTxtFile: null,
  audioDrafts: [],
};

const EMPTY_UPLOAD_DRAFT: UploadChatDraft = {
  target: "musica",
  coverImageFile: null,
  sheetMusicFile: null,
  lyricsTxtFile: null,
  audioDrafts: [],
};

const NAIPE_OPTIONS: { key: NaipeKey; label: string }[] = [
  { key: "soprano", label: "Soprano" },
  { key: "contralto", label: "Contralto" },
  { key: "tenor", label: "Tenor" },
  { key: "baixo", label: "Baixo" },
  { key: "unissono", label: "Original" },
];

function createMessage(
  role: ChatMessage["role"],
  content: string,
  type: ChatMessage["type"] = "text",
  action?: string
): ChatMessage {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role,
    type,
    content,
    action,
    timestamp: new Date().toISOString(),
  };
}

function isSkip(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "pular" || normalized === "skip";
}

export function ChatbotAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [intent, setIntent] = useState<ChatIntent | null>(null);
  const [stepStatus, setStepStatus] = useState<ChatStepStatus>("collecting");
  const [working, setWorking] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey | null>(null);
  const [composer, setComposer] = useState("");
  const [eventDraft, setEventDraft] = useState<EventChatDraft>(EMPTY_EVENT_DRAFT);
  const [songDraft, setSongDraft] = useState<SongChatDraft>(EMPTY_SONG_DRAFT);
  const [uploadDraft, setUploadDraft] = useState<UploadChatDraft>(EMPTY_UPLOAD_DRAFT);
  const [songTypes, setSongTypes] = useState<SongTypeOption[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [pendingLinkSongId, setPendingLinkSongId] = useState<string | null>(null);
  const [linkEventId, setLinkEventId] = useState("");
  const [linkType, setLinkType] = useState("");
  const [audioNaipe, setAudioNaipe] = useState<NaipeKey>("soprano");
  const [audioName, setAudioName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { tenantId } = useTenant();
  const { buildPath } = useTenantPath();
  const canWrite = Boolean(user?.id && tenantId && isAdmin);

  const waitingFile = useMemo(
    () =>
      activeQuestion === "event_cover" ||
      activeQuestion === "song_sheet" ||
      activeQuestion === "song_lyrics_txt" ||
      activeQuestion === "song_audio_file" ||
      activeQuestion === "upload_cover" ||
      activeQuestion === "upload_sheet" ||
      activeQuestion === "upload_lyrics_txt" ||
      activeQuestion === "upload_audio_file",
    [activeQuestion]
  );

  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([
      createMessage(
        "assistant",
        "Oi! Vamos conversar no estilo WhatsApp. Me diz o que quer fazer e eu te guio passo a passo."
      ),
      createMessage(
        "assistant",
        canWrite
          ? "Eu só salvo depois da sua confirmação final."
          : "Você pode conversar comigo, mas criação/upload fica disponível para admins."
      ),
    ]);
  }, [open, messages.length, canWrite]);

  useEffect(() => {
    async function loadSongTypes() {
      const { data } = await supabase
        .from("song_types")
        .select("id, slug, name")
        .is("tenant_id", null)
        .order("order_index");
      setSongTypes(data || []);
    }
    loadSongTypes();
  }, []);

  useEffect(() => {
    async function loadUpcomingEvents() {
      if (!tenantId) return;
      const { data } = await supabase
        .from("events")
        .select("id, name, date")
        .eq("tenant_id", tenantId)
        .gte("date", format(new Date(), "yyyy-MM-dd"))
        .order("date", { ascending: true })
        .limit(10);
      setUpcomingEvents((data as UpcomingEvent[]) || []);
    }
    loadUpcomingEvents();
  }, [tenantId, working]);

  function pushAssistant(content: string, type: ChatMessage["type"] = "text", action?: string) {
    setMessages((prev) => [...prev, createMessage("assistant", content, type, action)]);
  }

  function pushUser(content: string, type: ChatMessage["type"] = "text") {
    setMessages((prev) => [...prev, createMessage("user", content, type)]);
  }

  function ask(question: QuestionKey, prompt: string) {
    setActiveQuestion(question);
    pushAssistant(prompt);
  }

  function resetFlow() {
    setIntent(null);
    setStepStatus("collecting");
    setActiveQuestion(null);
    setComposer("");
    setEventDraft(EMPTY_EVENT_DRAFT);
    setSongDraft(EMPTY_SONG_DRAFT);
    setUploadDraft(EMPTY_UPLOAD_DRAFT);
    setAudioName("");
    setAudioNaipe("soprano");
    setLinkEventId("");
    setLinkType("");
  }

  function startIntent(nextIntent: ChatIntent) {
    pushUser(nextIntent.replaceAll("_", " "));
    if (!canWrite) {
      pushAssistant("Sem permissão de escrita no momento. Um admin pode executar esse fluxo.", "status");
      return;
    }
    if (nextIntent === "vincular_musica_evento" && !pendingLinkSongId) {
      pushAssistant("Ainda não existe música recém-criada para vincular.");
      return;
    }

    resetFlow();
    setIntent(nextIntent);

    if (nextIntent === "criar_evento") ask("event_name", "Qual o nome do evento?");
    if (nextIntent === "criar_musica") ask("song_name", "Qual o nome da música?");
    if (nextIntent === "upload_arquivo") ask("upload_target", "Upload para evento ou música?");
    if (nextIntent === "vincular_musica_evento") ask("link_event", "Escolha o evento para vincular a música.");
  }

  function quickReply(value: string) {
    setComposer("");
    handleAnswer(value);
  }

  function validateDate(dateText: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateText.trim());
  }

  function handleAnswer(rawValue: string) {
    if (!activeQuestion || stepStatus !== "collecting") return;
    const value = rawValue.trim();
    if (!value && !waitingFile) return;

    if (value) pushUser(value);

    if (activeQuestion === "event_name") {
      if (value.length < 3) return pushAssistant("Nome muito curto. Digite ao menos 3 caracteres.");
      setEventDraft((p) => ({ ...p, name: value }));
      return ask("event_date", "Agora a data no formato YYYY-MM-DD.");
    }

    if (activeQuestion === "event_date") {
      if (!validateDate(value)) return pushAssistant("Data inválida. Exemplo: 2026-03-18.");
      setEventDraft((p) => ({ ...p, date: value }));
      return ask("event_location", "Local do evento? (ou digite 'pular')");
    }

    if (activeQuestion === "event_location") {
      setEventDraft((p) => ({ ...p, location: isSkip(value) ? "" : value }));
      return ask("event_notes", "Alguma observação? (ou 'pular')");
    }

    if (activeQuestion === "event_notes") {
      setEventDraft((p) => ({ ...p, notes: isSkip(value) ? "" : value }));
      return ask("event_cover", "Quer anexar uma capa? Use o clipe ou digite 'pular'.");
    }

    if (activeQuestion === "event_cover") {
      if (!isSkip(value)) return pushAssistant("Use o botão de clipe para enviar arquivo, ou digite 'pular'.");
      setStepStatus("review");
      setActiveQuestion(null);
      return pushAssistant("Perfeito. Revise e confirme para criar o evento.", "review");
    }

    if (activeQuestion === "song_name") {
      if (value.length < 3) return pushAssistant("Nome muito curto. Digite ao menos 3 caracteres.");
      setSongDraft((p) => ({ ...p, name: value }));
      return ask("song_type", "Qual tipo da música? Você pode clicar numa opção.");
    }

    if (activeQuestion === "song_type") {
      const selected =
        songTypes.find((t) => t.slug === value.toLowerCase()) ||
        songTypes.find((t) => t.name.toLowerCase() === value.toLowerCase());
      if (!selected) return pushAssistant("Tipo não encontrado. Escolha pelas opções rápidas.");
      setSongDraft((p) => ({ ...p, type: selected.slug }));
      return ask("song_lyrics", "Quer adicionar letra agora? (texto ou 'pular')");
    }

    if (activeQuestion === "song_lyrics") {
      setSongDraft((p) => ({ ...p, lyrics: isSkip(value) ? "" : value }));
      return ask("song_chords", "Quer adicionar cifra? (texto ou 'pular')");
    }

    if (activeQuestion === "song_chords") {
      setSongDraft((p) => ({ ...p, chords: isSkip(value) ? "" : value }));
      return ask("song_sheet", "Quer anexar partitura (PDF/imagem)? Use clipe ou 'pular'.");
    }

    if (activeQuestion === "song_sheet") {
      if (!isSkip(value)) return pushAssistant("Use o clipe para anexar a partitura, ou digite 'pular'.");
      return ask("song_lyrics_txt", "Quer anexar letra em .txt? Use clipe ou 'pular'.");
    }

    if (activeQuestion === "song_lyrics_txt") {
      if (!isSkip(value)) return pushAssistant("Use o clipe para anexar .txt, ou digite 'pular'.");
      return ask("song_audio_more", "Deseja adicionar áudio por naipe? (sim/não)");
    }

    if (activeQuestion === "song_audio_more") {
      if (["sim", "s", "yes"].includes(value.toLowerCase())) {
        return ask("song_audio_naipe", "Qual naipe? (soprano, contralto, tenor, baixo, unissono)");
      }
      setStepStatus("review");
      setActiveQuestion(null);
      return pushAssistant("Ótimo. Revise e confirme para criar a música.", "review");
    }

    if (activeQuestion === "song_audio_naipe") {
      const found = NAIPE_OPTIONS.find((n) => n.key === value.toLowerCase());
      if (!found) return pushAssistant("Naipe inválido. Escolha uma opção rápida.");
      setAudioNaipe(found.key);
      return ask("song_audio_name", "Nome do áudio? (ou 'pular' para usar o nome do arquivo)");
    }

    if (activeQuestion === "song_audio_name") {
      setAudioName(isSkip(value) ? "" : value);
      return ask("song_audio_file", "Agora envie o arquivo de áudio pelo clipe.");
    }

    if (activeQuestion === "song_audio_file") {
      return pushAssistant("Use o clipe para enviar o áudio.");
    }

    if (activeQuestion === "upload_target") {
      const normalized = value.toLowerCase();
      if (!["evento", "musica", "música"].includes(normalized)) {
        return pushAssistant("Responda com: evento ou música.");
      }
      const target = normalized === "evento" ? "evento" : "musica";
      setUploadDraft((p) => ({ ...p, target }));
      if (target === "evento") return ask("upload_cover", "Envie a capa do evento pelo clipe.");
      return ask("upload_sheet", "Quer anexar partitura (PDF/imagem)? Use clipe ou 'pular'.");
    }

    if (activeQuestion === "upload_cover") {
      return pushAssistant("Use o clipe para enviar a capa.");
    }

    if (activeQuestion === "upload_sheet") {
      if (!isSkip(value)) return pushAssistant("Use o clipe para anexar, ou 'pular'.");
      return ask("upload_lyrics_txt", "Quer anexar letra .txt? (clipe ou 'pular')");
    }

    if (activeQuestion === "upload_lyrics_txt") {
      if (!isSkip(value)) return pushAssistant("Use o clipe para anexar .txt, ou 'pular'.");
      return ask("upload_audio_more", "Quer adicionar áudio por naipe? (sim/não)");
    }

    if (activeQuestion === "upload_audio_more") {
      if (["sim", "s", "yes"].includes(value.toLowerCase())) {
        return ask("upload_audio_naipe", "Qual naipe do áudio?");
      }
      setStepStatus("review");
      setActiveQuestion(null);
      return pushAssistant("Beleza. Revise e confirme para executar o upload.", "review");
    }

    if (activeQuestion === "upload_audio_naipe") {
      const found = NAIPE_OPTIONS.find((n) => n.key === value.toLowerCase());
      if (!found) return pushAssistant("Naipe inválido. Use uma opção rápida.");
      setAudioNaipe(found.key);
      return ask("upload_audio_name", "Nome do áudio? (ou 'pular')");
    }

    if (activeQuestion === "upload_audio_name") {
      setAudioName(isSkip(value) ? "" : value);
      return ask("upload_audio_file", "Envie o áudio pelo clipe.");
    }

    if (activeQuestion === "upload_audio_file") {
      return pushAssistant("Use o clipe para enviar o áudio.");
    }

    if (activeQuestion === "link_event") {
      const event = upcomingEvents.find((e) => e.id === value) || upcomingEvents[Number(value) - 1];
      if (!event) return pushAssistant("Evento não encontrado. Escolha pelas opções rápidas.");
      setLinkEventId(event.id);
      return ask("link_type", "Tipo no evento (opcional). Digite ou 'pular'.");
    }

    if (activeQuestion === "link_type") {
      setLinkType(isSkip(value) ? "" : value);
      setStepStatus("review");
      setActiveQuestion(null);
      pushAssistant("Revise o vínculo e confirme.", "review");
    }
  }

  function onSend() {
    if (!composer.trim()) return;
    handleAnswer(composer);
    setComposer("");
  }

  function addAudioAndContinue(target: "song" | "upload", file: File) {
    if (!file.type.startsWith("audio/")) {
      toast.error("Arquivo precisa ser de áudio");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Áudio acima de 20MB");
      return;
    }

    const draft: SongAudioDraft = {
      naipe: audioNaipe,
      name: audioName.trim() || `${audioNaipe} - ${file.name}`,
      file,
    };

    if (target === "song") {
      setSongDraft((p) => ({ ...p, audioDrafts: [...p.audioDrafts, draft] }));
      pushAssistant(`Áudio recebido (${draft.naipe}). Quer adicionar mais?`, "status");
      ask("song_audio_more", "Adicionar mais um áudio? (sim/não)");
      return;
    }

    setUploadDraft((p) => ({ ...p, audioDrafts: [...p.audioDrafts, draft] }));
    pushAssistant(`Áudio recebido (${draft.naipe}). Quer adicionar mais?`, "status");
    ask("upload_audio_more", "Adicionar mais um áudio? (sim/não)");
  }

  function onFilePicked(file: File | null) {
    if (!file || !activeQuestion) return;

    if (activeQuestion === "event_cover") {
      if (!file.type.startsWith("image/")) return toast.error("Selecione imagem válida");
      if (file.size > 5 * 1024 * 1024) return toast.error("Imagem acima de 5MB");
      setEventDraft((p) => ({ ...p, coverImageFile: file }));
      pushUser(`[arquivo] ${file.name}`);
      setStepStatus("review");
      setActiveQuestion(null);
      return pushAssistant("Capa recebida. Revise e confirme.", "review");
    }

    if (activeQuestion === "song_sheet" || activeQuestion === "upload_sheet") {
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) return toast.error("Use PDF ou imagem");
      if (file.size > 25 * 1024 * 1024) return toast.error("Arquivo acima de 25MB");
      pushUser(`[arquivo] ${file.name}`);

      if (activeQuestion === "song_sheet") {
        setSongDraft((p) => ({ ...p, sheetMusicFile: file }));
        return ask("song_lyrics_txt", "Quer anexar letra .txt? (clipe ou 'pular')");
      }
      setUploadDraft((p) => ({ ...p, sheetMusicFile: file }));
      return ask("upload_lyrics_txt", "Quer anexar letra .txt? (clipe ou 'pular')");
    }

    if (activeQuestion === "song_lyrics_txt" || activeQuestion === "upload_lyrics_txt") {
      if (!file.name.toLowerCase().endsWith(".txt")) return toast.error("Envie arquivo .txt");
      if (file.size > 2 * 1024 * 1024) return toast.error("TXT acima de 2MB");
      pushUser(`[arquivo] ${file.name}`);

      if (activeQuestion === "song_lyrics_txt") {
        setSongDraft((p) => ({ ...p, lyricsTxtFile: file }));
        return ask("song_audio_more", "Quer adicionar áudio por naipe? (sim/não)");
      }
      setUploadDraft((p) => ({ ...p, lyricsTxtFile: file }));
      return ask("upload_audio_more", "Quer adicionar áudio por naipe? (sim/não)");
    }

    if (activeQuestion === "song_audio_file") {
      pushUser(`[arquivo] ${file.name}`);
      return addAudioAndContinue("song", file);
    }

    if (activeQuestion === "upload_audio_file") {
      pushUser(`[arquivo] ${file.name}`);
      return addAudioAndContinue("upload", file);
    }

    if (activeQuestion === "upload_cover") {
      if (!file.type.startsWith("image/")) return toast.error("Selecione imagem válida");
      if (file.size > 5 * 1024 * 1024) return toast.error("Imagem acima de 5MB");
      setUploadDraft((p) => ({ ...p, coverImageFile: file }));
      pushUser(`[arquivo] ${file.name}`);
      setStepStatus("review");
      setActiveQuestion(null);
      return pushAssistant("Arquivo recebido. Revise e confirme o upload.", "review");
    }
  }

  async function executeIntent() {
    if (!intent || !user?.id || !tenantId) {
      toast.error("Sessão inválida");
      return;
    }

    try {
      setWorking(true);
      setStepStatus("executing");
      pushUser("Confirmar");

      if (intent === "criar_evento") {
        if (eventDraft.name.trim().length < 3 || !eventDraft.date) {
          throw new Error("Faltam dados obrigatórios do evento.");
        }
        const created = await createEventFromChat({ userId: user.id, tenantId }, eventDraft);
        pushAssistant(`Evento criado: ${created.name}`, "status");
        pushAssistant(`Abrir: ${buildPath(`/events/${created.id}`)}`, "action");
      }

      if (intent === "criar_musica") {
        if (songDraft.name.trim().length < 3 || !songDraft.type) {
          throw new Error("Faltam dados obrigatórios da música.");
        }
        const created = await createSongFromChat({ userId: user.id, tenantId }, songDraft);
        setPendingLinkSongId(created.id);
        pushAssistant(`Música criada: ${created.name}`, "status");
        pushAssistant("Quer vincular essa música em um evento agora?", "action");
      }

      if (intent === "upload_arquivo") {
        const uploaded = await uploadChatAssets({ userId: user.id, tenantId }, uploadDraft);
        const resume = [
          uploaded.coverImageUrl ? "capa" : "",
          uploaded.sheetMusicUrl ? "partitura" : "",
          uploaded.sheetMusicPdfUrl ? "pdf original" : "",
          uploaded.lyricsContent ? "letra txt" : "",
          uploaded.songAudios?.length ? `${uploaded.songAudios.length} áudio(s)` : "",
        ]
          .filter(Boolean)
          .join(", ");
        pushAssistant(`Upload concluído: ${resume || "nenhum arquivo"}`, "status");
      }

      if (intent === "vincular_musica_evento") {
        if (!pendingLinkSongId || !linkEventId) throw new Error("Faltam dados para vínculo.");
        await linkSongToEvent(
          { userId: user.id, tenantId },
          { eventId: linkEventId, songId: pendingLinkSongId, type: linkType || undefined }
        );
        setPendingLinkSongId(null);
        pushAssistant("Música vinculada com sucesso.", "status");
      }

      setStepStatus("done");
      toast.success("Concluído");
      resetFlow();
    } catch (error: any) {
      setStepStatus("error");
      pushAssistant(`Falha: ${error?.message || "erro inesperado"}`, "status");
      toast.error(error?.message || "Erro na execução");
    } finally {
      setWorking(false);
    }
  }

  function reviewText() {
    if (!intent) return "";
    if (intent === "criar_evento") {
      return `Resumo do evento:\n• Nome: ${eventDraft.name}\n• Data: ${eventDraft.date}\n• Local: ${
        eventDraft.location || "-"
      }\n• Notas: ${eventDraft.notes || "-"}\n• Capa: ${eventDraft.coverImageFile?.name || "não enviada"}`;
    }
    if (intent === "criar_musica") {
      return `Resumo da música:\n• Nome: ${songDraft.name}\n• Tipo: ${songDraft.type}\n• Partitura: ${
        songDraft.sheetMusicFile?.name || "não enviada"
      }\n• Letra txt: ${songDraft.lyricsTxtFile?.name || "não enviada"}\n• Letra texto: ${
        songDraft.lyrics?.trim() ? "sim" : "não"
      }\n• Cifra: ${songDraft.chords?.trim() ? "sim" : "não"}\n• Áudios: ${songDraft.audioDrafts.length}`;
    }
    if (intent === "upload_arquivo") {
      return `Resumo do upload:\n• Destino: ${uploadDraft.target}\n• Capa: ${
        uploadDraft.coverImageFile?.name || "-"
      }\n• Partitura: ${uploadDraft.sheetMusicFile?.name || "-"}\n• Letra txt: ${
        uploadDraft.lyricsTxtFile?.name || "-"
      }\n• Áudios: ${uploadDraft.audioDrafts.length}`;
    }
    return `Resumo do vínculo:\n• Música: ${pendingLinkSongId}\n• Evento: ${linkEventId}\n• Tipo: ${linkType || "-"}`;
  }

  const quickOptions = useMemo(() => {
    if (stepStatus === "review") return ["confirmar", "cancelar"];
    if (!activeQuestion) return [];
    if (activeQuestion === "upload_target") return ["evento", "música"];
    if (activeQuestion === "song_audio_more" || activeQuestion === "upload_audio_more") return ["sim", "não"];
    if (activeQuestion === "song_type") return songTypes.slice(0, 8).map((t) => t.slug);
    if (activeQuestion === "song_audio_naipe" || activeQuestion === "upload_audio_naipe") {
      return NAIPE_OPTIONS.map((n) => n.key);
    }
    if (activeQuestion === "link_event") {
      return upcomingEvents.slice(0, 6).map((e, idx) => `${idx + 1}. ${e.name}`);
    }
    if (
      activeQuestion === "event_location" ||
      activeQuestion === "event_notes" ||
      activeQuestion === "song_lyrics" ||
      activeQuestion === "song_chords" ||
      activeQuestion === "song_sheet" ||
      activeQuestion === "song_lyrics_txt" ||
      activeQuestion === "song_audio_name" ||
      activeQuestion === "upload_sheet" ||
      activeQuestion === "upload_lyrics_txt" ||
      activeQuestion === "upload_audio_name" ||
      activeQuestion === "link_type" ||
      activeQuestion === "event_cover"
    ) {
      return ["pular"];
    }
    return [];
  }, [activeQuestion, stepStatus, songTypes, upcomingEvents]);

  function onQuickOptionClick(opt: string) {
    if (stepStatus === "review") {
      if (opt === "cancelar") {
        pushUser("Cancelar");
        pushAssistant("Fluxo cancelado. Você pode começar outro.");
        resetFlow();
        return;
      }
      if (opt === "confirmar") {
        void executeIntent();
        return;
      }
    }

    if (activeQuestion === "link_event" && /^\d+\./.test(opt)) {
      const idx = Number(opt.split(".")[0]);
      const event = upcomingEvents[idx - 1];
      if (event) return quickReply(event.id);
    }

    quickReply(opt);
  }

  return (
    <>
      <Card className="p-4 border-primary/25 bg-gradient-to-br from-primary/10 to-background">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Assistente de Cadastro
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Estilo WhatsApp: perguntas rápidas, respostas curtas e confirmação antes de salvar.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} size="sm">
            Abrir assistente
          </Button>
        </div>
      </Card>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Assistente Conversacional</DrawerTitle>
            <DrawerDescription>Mais conversa, menos formulário.</DrawerDescription>
          </DrawerHeader>

          <div className="px-3 pb-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => startIntent("criar_evento")}>
                <CalendarPlus className="h-4 w-4 mr-1" />
                Evento
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => startIntent("criar_musica")}>
                <Music2 className="h-4 w-4 mr-1" />
                Música
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => startIntent("upload_arquivo")}>
                <UploadCloud className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => startIntent("vincular_musica_evento")}>
                <Link2 className="h-4 w-4 mr-1" />
                Vincular
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetFlow}>
                Limpar
              </Button>
            </div>

            <div className="h-[48vh] overflow-y-auto rounded-xl border bg-[#e5ddd5] dark:bg-muted/20 p-3 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-line shadow-sm ${
                      msg.role === "assistant"
                        ? "bg-white text-foreground rounded-bl-sm"
                        : "bg-green-100 text-foreground rounded-br-sm"
                    }`}
                  >
                    {msg.content}
                    <div className="text-[10px] opacity-60 mt-1 text-right">
                      {format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}

              {stepStatus === "review" && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-line shadow-sm bg-white rounded-bl-sm">
                    {reviewText()}
                  </div>
                </div>
              )}
            </div>

            {quickOptions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {quickOptions.map((opt) => (
                  <Button key={opt} type="button" variant="secondary" size="sm" onClick={() => onQuickOptionClick(opt)}>
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept={
                  activeQuestion === "event_cover" || activeQuestion === "upload_cover"
                    ? "image/*"
                    : activeQuestion === "song_sheet" || activeQuestion === "upload_sheet"
                      ? ".pdf,image/*"
                      : activeQuestion === "song_lyrics_txt" || activeQuestion === "upload_lyrics_txt"
                        ? ".txt"
                        : "audio/*"
                }
                onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!waitingFile || working}
                title={waitingFile ? "Anexar arquivo" : "Anexo disponível quando solicitado"}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={waitingFile ? "Anexe arquivo ou digite 'pular'" : "Digite sua resposta..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSend();
                  }
                }}
                disabled={working || !activeQuestion}
              />
              <Button type="button" onClick={onSend} disabled={working || !activeQuestion}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
