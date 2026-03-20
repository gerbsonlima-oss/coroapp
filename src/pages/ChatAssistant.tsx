import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Paperclip, MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useTenant, useTenantPath } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChatCommandService } from "@/features/chat/chatCommandService";
import type { ChatMessage, ChatQuickReply, ChatSession } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SongTypeOption = { id: string; name: string };
type EventOption = { id: string; name: string; date: string };
type SessionFlowState = { step?: string };

export default function ChatAssistant() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenantId, tenant } = useTenant();
  const { user } = useAuth();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [songTypes, setSongTypes] = useState<SongTypeOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formEventId, setFormEventId] = useState("");
  const [formSheetFile, setFormSheetFile] = useState<File | null>(null);
  const [audioByNaipe, setAudioByNaipe] = useState<Record<string, File | null>>({
    soprano: null,
    contralto: null,
    tenor: null,
    baixo: null,
    "4 vozes": null,
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tenantId || !tenant) return;
    if (tenant.chat_enabled) return;

    toast.error("Chat desativado para esta organizacao");
    navigate(buildPath("/"), { replace: true });
  }, [tenantId, tenant, navigate, buildPath]);

  useEffect(() => {
    async function bootstrap() {
      if (!tenantId || !user?.id) return;
      if (tenant && !tenant.chat_enabled) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const result = await ChatCommandService.startOrResumeSession(tenantId, user.id);
        setSession(result.session);
        setMessages(result.messages);
      } catch (error: any) {
        console.error("Erro ao iniciar chat:", error);
        toast.error(`Não foi possível abrir o chat: ${error?.message || "erro desconhecido"}`);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [tenantId, user?.id, tenant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    async function loadFormOptions() {
      if (!tenantId) return;
      try {
        const [{ data: typesData }, { data: eventsData }] = await Promise.all([
          supabase.from("song_types").select("id, name").order("order_index", { ascending: true }),
          supabase
            .from("events")
            .select("id, name, date")
            .eq("tenant_id", tenantId)
            .order("date", { ascending: false })
            .limit(20),
        ]);
        setSongTypes((typesData || []) as SongTypeOption[]);
        setEvents((eventsData || []) as EventOption[]);
      } catch (error) {
        console.error("Erro ao carregar opções do formulário:", error);
      }
    }
    loadFormOptions();
  }, [tenantId]);

  const quickReplies = useMemo<ChatQuickReply[]>(() => {
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    if (!lastBot?.metadata || typeof lastBot.metadata !== "object") return [];
    const meta = lastBot.metadata as unknown as { quickReplies?: ChatQuickReply[] };
    return meta.quickReplies || [];
  }, [messages]);

  const sessionStep = useMemo(() => {
    const flowState = (session?.flow_state as SessionFlowState | undefined) || {};
    return flowState.step || session?.current_step || "idle";
  }, [session]);

  const showMusicForm = useMemo(() => {
    if (sessionStep === "awaiting_song_form") return true;
    return quickReplies.some((reply) => reply.action === "open_music_form");
  }, [quickReplies, sessionStep]);

  const sendMessage = async (text: string, file?: File | null) => {
    if (!session) return;
    if (!text.trim() && !file) return;
    try {
      setSending(true);
      const result = await ChatCommandService.handleUserMessage(session.id, text, file ? [file] : []);
      setSession(result.session);
      setMessages(result.messages);
      setInputText("");
      setPendingFile(null);
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(`Falha ao enviar mensagem: ${error?.message || "erro desconhecido"}`);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = async (action: string) => {
    if (!session) return;
    try {
      setSending(true);
      const result = await ChatCommandService.executeStepAction(session.id, action);
      setSession(result.session);
      setMessages(result.messages);
      setPendingFile(null);
      setInputText("");
    } catch (error: any) {
      console.error("Erro na ação rápida:", error);
      toast.error(`Falha ao executar ação: ${error?.message || "erro desconhecido"}`);
    } finally {
      setSending(false);
    }
  };

  const handleMusicFormSubmit = async () => {
    if (!session) return;
    if (formName.trim().length < 3) {
      toast.error("Nome da música precisa ter pelo menos 3 caracteres");
      return;
    }
    if (!formType) {
      toast.error("Selecione o tipo litúrgico");
      return;
    }

    const filesToSend: File[] = [];
    if (formSheetFile) {
      filesToSend.push(
        new File([formSheetFile], `sheet__${formSheetFile.name}`, {
          type: formSheetFile.type,
          lastModified: formSheetFile.lastModified,
        })
      );
    }

    for (const [naipe, file] of Object.entries(audioByNaipe)) {
      if (!file) continue;
      filesToSend.push(
        new File([file], `audio_${naipe}__${file.name}`, {
          type: file.type,
          lastModified: file.lastModified,
        })
      );
    }

    const payload = encodeURIComponent(
      JSON.stringify({
        name: formName.trim(),
        type: formType,
        eventId: formEventId || null,
      })
    );

    try {
      setSending(true);
      const result = await ChatCommandService.handleUserMessage(
        session.id,
        `__action:music_form_submit|${payload}`,
        filesToSend
      );
      setSession(result.session);
      setMessages(result.messages);
      setFormName("");
      setFormType("");
      setFormEventId("");
      setFormSheetFile(null);
      setAudioByNaipe({
        soprano: null,
        contralto: null,
        tenor: null,
        baixo: null,
        "4 vozes": null,
      });
      toast.success("Música enviada pelo formulário");
    } catch (error: any) {
      console.error("Erro ao enviar formulário de música:", error);
      toast.error(`Falha no formulário: ${error?.message || "erro desconhecido"}`);
    } finally {
      setSending(false);
    }
  };

  const renderMessageText = (message: ChatMessage) => {
    const lines = message.content.split("\n");
    return (
      <div className="space-y-0.5">
        {lines.map((line, index) => (
          <p
            key={`${message.id}_${index}`}
            className="whitespace-pre-wrap leading-relaxed text-slate-900"
          >
            {line}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4efe6] pb-28">
      <header className="sticky top-0 z-20 border-b bg-[#1f6f5f] text-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(buildPath("/"))}
            className="rounded-full p-1.5 transition hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-full bg-white/10 p-2">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Assistente do Coral</h1>
            <p className="text-xs text-white/80">Fluxo guiado estilo bate-papo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-4">
        {loading ? (
          <Card className="flex items-center gap-2 p-4 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando conversa...
          </Card>
        ) : messages.length === 0 ? (
          <Card className="border-dashed p-4 text-sm text-slate-700">
            Diga "oi" para começar. Eu vou te guiar passo a passo.
          </Card>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    isUser ? "bg-[#dcf8c6] text-black" : "bg-white text-black"
                  )}
                >
                  {renderMessageText(message)}
                  <p className="mt-1 text-[10px] text-black/50">
                    {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {showMusicForm && (
          <Card className="border-emerald-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Criar música com uploads</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Nome da música</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-white text-slate-900"
                  placeholder="Ex.: Canto de Entrada"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Tipo litúrgico</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">Selecione...</option>
                  {songTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Vincular em evento (opcional)</label>
                <select
                  value={formEventId}
                  onChange={(e) => setFormEventId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">Sem vínculo</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} ({event.date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Partitura (imagem ou PDF)</label>
                <Input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => setFormSheetFile(e.target.files?.[0] || null)}
                  className="bg-white text-slate-900 file:text-slate-900"
                />
              </div>

              {Object.keys(audioByNaipe).map((naipe) => (
                <div key={naipe}>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Áudio {naipe}</label>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) =>
                      setAudioByNaipe((prev) => ({
                        ...prev,
                        [naipe]: e.target.files?.[0] || null,
                      }))
                    }
                    className="bg-white text-slate-900 file:text-slate-900"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={handleMusicFormSubmit} disabled={sending}>
                {sending ? "Enviando..." : "Criar música com uploads"}
              </Button>
            </div>
          </Card>
        )}

        {quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply.action}
                onClick={() => handleQuickReply(reply.action)}
                disabled={sending}
                className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-[#1f6f5f] hover:bg-[#e8f5ef] disabled:opacity-60"
              >
                {reply.label}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-3">
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => handleQuickReply("restart")}
            disabled={sending}
          >
            Início
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={pendingFile ? `Arquivo: ${pendingFile.name}` : "Digite sua mensagem..."}
            className="bg-white text-slate-900 placeholder:text-slate-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage(inputText, pendingFile);
              }
            }}
            disabled={sending}
          />
          <Button
            type="button"
            onClick={() => sendMessage(inputText, pendingFile)}
            disabled={sending || (!inputText.trim() && !pendingFile)}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
