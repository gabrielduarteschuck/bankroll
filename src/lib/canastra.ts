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
