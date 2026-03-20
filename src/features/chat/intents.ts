import type { ChatIntent } from "./types";

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function detectIntent(rawText: string): ChatIntent {
  const text = normalize(rawText);
  if (!text) return "unknown";

  if (["oi", "ola", "hello", "hi", "e ai", "eai", "bom dia", "boa tarde", "boa noite"].some((w) => text === w || text.startsWith(`${w} `))) {
    return "greeting";
  }

  if (text.includes("ajuda") || text.includes("help") || text.includes("o que voce faz")) {
    return "help";
  }

  if (text === "cancelar" || text === "cancela" || text === "cancel") {
    return "cancel";
  }

  if (text === "reiniciar" || text === "restart" || text === "recomecar" || text === "recomecar") {
    return "restart";
  }

  if (text.includes("criar evento") || text === "evento") {
    return "create_event";
  }

  if (text.includes("criar musica") || text.includes("criar música") || text === "musica" || text === "música") {
    return "create_song";
  }

  if (text.includes("audio") || text.includes("áudio")) {
    return "upload_audio";
  }

  if (text.includes("partitura") || text.includes("sheet")) {
    return "upload_sheet";
  }

  if (text.includes("vincular") || text.includes("anexar")) {
    return "link_song_to_event";
  }

  return "unknown";
}

export function normalizeFreeText(rawText: string): string {
  return normalize(rawText);
}

export function isAffirmative(rawText: string): boolean {
  const text = normalize(rawText);
  return ["sim", "s", "yes", "ok", "confirmar", "pode ser", "confirmo"].includes(text);
}

export function isNegative(rawText: string): boolean {
  const text = normalize(rawText);
  return ["nao", "não", "n", "no", "cancelar", "voltar"].includes(text);
}
