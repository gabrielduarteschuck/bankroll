"use client";

import { supabaseReal } from "@/lib/supabaseClient";

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------
export type RoomStatus = "lobby" | "playing" | "finished";

export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  dealer_seat: number | null;
  target_score: number;
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  name: string;
  seat: number | null;
  team: number | null;
  is_host: boolean;
  joined_at: string;
};

export type JoinResult = { room_code: string; room_id: string; player_id: string };

// ---------------------------------------------------------------------
// Identidade local (sem login): token persistido + player_id por sala
// ---------------------------------------------------------------------
const TOKEN_KEY = "canastra_token";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function getStoredPlayerId(code: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`canastra_pid_${code.toUpperCase()}`);
}

export function setStoredPlayerId(code: string, pid: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`canastra_pid_${code.toUpperCase()}`, pid);
}

// ---------------------------------------------------------------------
// Acesso ao Supabase
// ---------------------------------------------------------------------
function client() {
  if (!supabaseReal) throw new Error("Supabase não configurado");
  return supabaseReal;
}

export async function createRoom(name: string): Promise<JoinResult> {
  const { data, error } = await client().rpc("canastra_create_room", {
    p_name: name,
    p_token: getToken(),
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as JoinResult;
  setStoredPlayerId(row.room_code, row.player_id);
  return row;
}

export async function joinRoom(code: string, name: string): Promise<JoinResult> {
  const { data, error } = await client().rpc("canastra_join_room", {
    p_code: code.toUpperCase().trim(),
    p_name: name,
    p_token: getToken(),
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as JoinResult;
  setStoredPlayerId(row.room_code, row.player_id);
  return row;
}

export async function fetchRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await client()
    .from("canastra_rooms")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Room) ?? null;
}

export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await client()
    .from("canastra_players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Player[];
}

// ---------------------------------------------------------------------
// Jogo (Etapa 2+): tipos e ações
// ---------------------------------------------------------------------
export type Meld = {
  id: string;
  cards: string[];
  size: number;
  clean: boolean;
  is_canastra: boolean;
  points: number;
};

export type PlayerView = {
  player_id: string;
  name: string;
  seat: number;
  team: number;
  is_host: boolean;
  hand_count: number;
  is_turn: boolean;
};

export type GameView = {
  status: RoomStatus;
  version: number;
  round: number;
  dealer_seat: number;
  turn_seat: number;
  phase: "draw" | "play" | "over";
  target_score: number;
  scores: Record<string, number>;
  obrigada: Record<string, number>;
  opened: Record<string, boolean>;
  you: { player_id: string; seat: number; team: number; is_host: boolean };
  your_hand: string[];
  players: PlayerView[];
  stock_count: number;
  discard_count: number;
  discard_top: string | null;
  discard_locked: boolean;
  red3: Record<string, number>;
  melds: Record<string, Meld[]>;
  last_round: {
    bater_team: number;
    breakdown: Record<string, Record<string, number>>;
    score_after: Record<string, number>;
  } | null;
};

async function rpc(fn: string, params: Record<string, unknown>) {
  const { error } = await client().rpc(fn, { p_token: getToken(), ...params });
  if (error) throw new Error(error.message);
}

export async function getView(): Promise<GameView | null> {
  const { data, error } = await client().rpc("canastra_get_view", { p_token: getToken() });
  if (error) throw new Error(error.message);
  return (data as GameView) ?? null;
}

export const startGame = () => rpc("canastra_start_game", {});
export const drawCard = () => rpc("canastra_draw", {});
export const discardCard = (card: string) => rpc("canastra_discard", { p_card: card });
export const meldCards = (cards: string[]) => rpc("canastra_meld", { p_cards: cards });
export const addToMeld = (meldId: string, cards: string[]) =>
  rpc("canastra_add", { p_meld_id: meldId, p_cards: cards });
export const takePile = (mode: "new" | "add", cards: string[], meldId: string | null) =>
  rpc("canastra_take_pile", { p_mode: mode, p_cards: cards, p_meld_id: meldId });
export const bate = (card: string | null) => rpc("canastra_bate", { p_card: card });
export const nextRound = () => rpc("canastra_next_round", {});

// Helpers de carta: "<rank><suit>-<deck>", ex.: "TH-1" = 10 de copas, 2º baralho
export const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function parseCard(card: string) {
  const rank = card[0];
  const suit = card[1];
  return {
    rank,
    suit,
    label: rank === "T" ? "10" : rank,
    symbol: SUIT_SYMBOL[suit] ?? "?",
    isRed: suit === "H" || suit === "D",
    isWild: rank === "2",
    isBlack3: rank === "3" && (suit === "S" || suit === "C"),
  };
}

// Inscreve em mudanças de jogadores e da sala. Retorna função de unsubscribe.
export function subscribeRoom(roomId: string, onChange: () => void): () => void {
  const ch = client()
    .channel(`canastra_room_${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "canastra_players", filter: `room_id=eq.${roomId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "canastra_rooms", filter: `id=eq.${roomId}` },
      onChange
    )
    .subscribe();

  return () => {
    client().removeChannel(ch);
  };
}
