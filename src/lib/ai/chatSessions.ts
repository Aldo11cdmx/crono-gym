/**
 * chatSessions.ts — persistencia de conversaciones con el asistente IA en Supabase.
 *
 * Cada atleta puede tener varias sesiones independientes. Las escrituras pasan por
 * el cliente de Supabase y RLS las aísla por `auth.uid()`; borrar una sesión arrastra
 * sus mensajes mediante `ON DELETE CASCADE` definido en la migración.
 *
 * Todo falla a `null`/`false` sin reventar la pantalla: una sesión que no se puede
 * crear o leer sigue siendo usable en memoria, y el chat nunca bloquea por un fallo
 * de red en la persistencia.
 */

import { supabase } from "@/lib/supabase";
import type { ChatSessionRow, ChatMessageRow } from "@/types/supabase";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: "user" | "assistant" | "error";
  content: string;
  createdAt: string;
}

function toSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

/** Crea una sesión vacía y devuelve su id, o null si falla. */
export async function createSession(
  userId: string,
  title: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

/** Lista las sesiones de un usuario, más reciente primero. */
export async function listSessions(userId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map(toSession);
}

/** Carga los mensajes de una sesión, más antiguo primero. */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(toMessage);
}

/** Inserta un mensaje y devuelve su id, o null si falla. */
export async function sendMessage({
  sessionId,
  userId,
  role,
  content,
}: {
  sessionId: string;
  userId: string;
  role: "user" | "assistant" | "error";
  content: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, user_id: userId, role, content })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

/** Borra una sesión y sus mensajes (cascade). Devuelve si se eliminó algo. */
export async function deleteSession(sessionId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .match({ id: sessionId, user_id: userId });

  return !error;
}

/** Actualiza el título y la fecha de modificación de una sesión. */
export async function touchSession(
  sessionId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .match({ id: sessionId, user_id: userId });

  return !error;
}
