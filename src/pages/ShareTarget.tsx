import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant, useTenantPath } from "@/contexts/TenantContext";
import { uploadFileToBucket } from "@/utils/storageUpload";
import { naipeLabels } from "@/constants/naipes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileAudio, FileText, Music, Upload } from "lucide-react";

type SupportedShareType = "audio" | "pdf" | "unknown";

interface SongOption {
  id: string;
  name: string;
  sheet_music_url: string | null;
}

const SHARE_CACHE_NAME = "share-target-cache-v1";
const SHARE_CACHE_KEY = "/shared-target-payload";

const NAIPES = ["soprano", "contralto", "tenor", "baixo", "todos"] as const;

const sanitizeFileName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf(".");
  const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

  const sanitized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${sanitized}${extension}`;
};

const detectSharedType = (file: File | null): SupportedShareType => {
  if (!file) return "unknown";
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (mime.includes("pdf") || lowerName.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  return "unknown";
};

const readSharedFileFromCache = async (): Promise<File | null> => {
  if (typeof window === "undefined" || !("caches" in window)) return null;

  const cache = await caches.open(SHARE_CACHE_NAME);
  const response = await cache.match(SHARE_CACHE_KEY);
  if (!response) return null;

  const blob = await response.blob();
  const encodedName = response.headers.get("x-shared-name") || "arquivo-compartilhado";
  const fileName = decodeURIComponent(encodedName);
  const contentType = response.headers.get("content-type") || blob.type || "application/octet-stream";

  await cache.delete(SHARE_CACHE_KEY);

  return new File([blob], fileName, { type: contentType });
};

export default function ShareTarget() {
  const navigate = useNavigate();
  const { buildPath, buildAuthPath } = useTenantPath();
  const { user, loading: authLoading } = useAuth();
  const { tenantId, loading: tenantLoading } = useTenant();

  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [search, setSearch] = useState("");
  const [naipe, setNaipe] = useState<(typeof NAIPES)[number]>("todos");
  const [saving, setSaving] = useState(false);
  const [loadingSharedFile, setLoadingSharedFile] = useState(true);

  useEffect(() => {
    const loadSharedFile = async () => {
      try {
        const file = await readSharedFileFromCache();
        if (file) {
          setSharedFile(file);
        }
      } catch (error) {
        console.error("Erro ao ler arquivo compartilhado:", error);
      } finally {
        setLoadingSharedFile(false);
      }
    };

    loadSharedFile();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      if (!tenantId) {
        setSongs([]);
        return;
      }

      const filter = `tenant_id.is.null,tenant_id.eq.${tenantId}`;

      const { data, error } = await supabase
        .from("songs")
        .select("id, name, sheet_music_url")
        .or(filter)
        .order("name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar músicas:", error);
        toast.error("Não foi possível carregar as músicas");
        return;
      }

      setSongs(data || []);
    };

    fetchSongs();
  }, [tenantId]);

  const sharedType = useMemo(() => detectSharedType(sharedFile), [sharedFile]);

  const filteredSongs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return songs;
    return songs.filter((song) => song.name.toLowerCase().includes(normalized));
  }, [songs, search]);

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) || null,
    [songs, selectedSongId]
  );

  const handlePickManualFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSharedFile(file);
  };

  const handleSave = async () => {
    if (!user) {
      navigate(buildAuthPath());
      return;
    }

    if (!tenantId) {
      toast.error("Selecione um coro antes de importar");
      return;
    }

    if (!sharedFile) {
      toast.error("Nenhum arquivo encontrado para importar");
      return;
    }

    if (!selectedSong) {
      toast.error("Selecione uma música");
      return;
    }

    if (sharedType === "unknown") {
      toast.error("Formato não suportado. Use áudio ou PDF.");
      return;
    }

    setSaving(true);

    try {
      const safeName = sanitizeFileName(sharedFile.name);

      if (sharedType === "pdf") {
        const path = `${user.id}/share_pdf_${Date.now()}_${safeName}`;
        const pdfUrl = await uploadFileToBucket(sharedFile, "sheet-music", path);

        const updates: { sheet_music_pdf_url: string; sheet_music_url?: string } = {
          sheet_music_pdf_url: pdfUrl,
        };

        if (!selectedSong.sheet_music_url) {
          updates.sheet_music_url = pdfUrl;
        }

        const { error } = await supabase.from("songs").update(updates).eq("id", selectedSong.id);
        if (error) throw error;

        toast.success("Partitura vinculada com sucesso!");
      }

      if (sharedType === "audio") {
        const path = `${user.id}/share_audio_${Date.now()}_${safeName}`;
        const audioUrl = await uploadFileToBucket(sharedFile, "audio-files", path);

        const baseName = sharedFile.name.replace(/\.[^/.]+$/, "");
        const { error } = await supabase.from("song_audios").insert({
          song_id: selectedSong.id,
          tenant_id: tenantId,
          naipe,
          audio_url: audioUrl,
          name: baseName,
        });
        if (error) throw error;

        toast.success("Áudio vinculado com sucesso!");
      }

      navigate(buildPath(`/songs/${selectedSong.id}`));
    } catch (error) {
      console.error("Erro ao salvar compartilhamento:", error);
      toast.error("Não foi possível concluir a importação");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || tenantLoading || loadingSharedFile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="mx-auto mt-8 max-w-xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Importar do WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Faça login para concluir a importação do áudio ou da partitura compartilhada.
          </p>
          <Button onClick={() => navigate(buildAuthPath())} className="w-full">
            Entrar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <Card className="mx-auto mt-4 max-w-2xl p-4 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Importar Arquivo Compartilhado</h1>
          <p className="text-sm text-muted-foreground">
            Busque a música e vincule o arquivo recebido do WhatsApp.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Arquivo recebido</Label>
          {sharedFile ? (
            <div className="rounded-md border border-border p-3 flex items-center gap-2">
              {sharedType === "pdf" ? (
                <FileText className="h-4 w-4 text-primary" />
              ) : sharedType === "audio" ? (
                <FileAudio className="h-4 w-4 text-primary" />
              ) : (
                <Upload className="h-4 w-4 text-primary" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sharedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sharedType === "pdf"
                    ? "Partitura (PDF)"
                    : sharedType === "audio"
                      ? "Áudio"
                      : "Formato não suportado"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum arquivo foi recebido automaticamente.
              </p>
              <Input type="file" accept="audio/*,application/pdf" onChange={handlePickManualFile} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-song">Buscar música</Label>
          <Input
            id="search-song"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite o nome da música"
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {filteredSongs.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma música encontrada.</p>
          ) : (
            filteredSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => setSelectedSongId(song.id)}
                className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 transition-colors ${
                  selectedSongId === song.id ? "bg-primary/10" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate">{song.name}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {sharedType === "audio" && (
          <div className="space-y-2">
            <Label htmlFor="naipe">Naipe do áudio</Label>
            <select
              id="naipe"
              value={naipe}
              onChange={(event) => setNaipe(event.target.value as (typeof NAIPES)[number])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {NAIPES.map((option) => (
                <option key={option} value={option}>
                  {naipeLabels[option]}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || !sharedFile || !selectedSongId} className="w-full">
          {saving
            ? "Salvando..."
            : sharedType === "audio"
              ? `Vincular Áudio (${naipeLabels[naipe]})`
              : "Vincular Partitura"}
        </Button>
      </Card>
    </div>
  );
}
