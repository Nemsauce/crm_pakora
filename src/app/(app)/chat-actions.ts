"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type InternalMessage = {
  id: number;
  remitente_id: string;
  destinatario_id: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
};

type InternalMessagesTable = {
  Row: InternalMessage;
  Insert: {
    id?: never;
    remitente_id: string;
    destinatario_id: string;
    mensaje: string;
    leido?: boolean;
    created_at?: string;
  };
  Update: {
    id?: never;
    remitente_id?: string;
    destinatario_id?: string;
    mensaje?: string;
    leido?: boolean;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "internal_messages_destinatario_id_fkey";
      columns: ["destinatario_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "internal_messages_remitente_id_fkey";
      columns: ["remitente_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
  ];
};

export type InternalChatDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      internal_messages: InternalMessagesTable;
    };
  };
};

export type SendMessageResult = {
  error: string | null;
  message: InternalMessage | null;
};

export type MarkAsReadResult = {
  error: string | null;
  markedMessageIds: number[];
};

const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 4_000;

function isValidProfileId(value: unknown): value is string {
  return typeof value === "string" && PROFILE_ID_PATTERN.test(value);
}

function getInternalChatClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<InternalChatDatabase>;
}

export async function sendMessage(
  destinatarioId: string,
  rawMessage: string,
): Promise<SendMessageResult> {
  if (!isValidProfileId(destinatarioId)) {
    return { error: "Destinatario inválido.", message: null };
  }

  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

  if (!message) {
    return { error: "Escribe un mensaje antes de enviarlo.", message: null };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`,
      message: null,
    };
  }

  const supabase = getInternalChatClient(await createClient());
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return {
      error: "No se pudo identificar el usuario activo.",
      message: null,
    };
  }

  if (destinatarioId === userId) {
    return { error: "No puedes enviarte mensajes a ti mismo.", message: null };
  }

  const { data: activeProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("activo", true)
    .in("id", [userId, destinatarioId]);

  const activeProfileIds = new Set(
    (activeProfiles ?? []).map((profile) => profile.id),
  );

  if (profilesError || !activeProfileIds.has(userId)) {
    return {
      error: "Tu perfil no está habilitado para enviar mensajes.",
      message: null,
    };
  }

  if (!activeProfileIds.has(destinatarioId)) {
    return {
      error: "El destinatario no está disponible.",
      message: null,
    };
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from("internal_messages")
    .insert({
      remitente_id: userId,
      destinatario_id: destinatarioId,
      mensaje: message,
    })
    .select("id,remitente_id,destinatario_id,mensaje,leido,created_at")
    .single();

  if (insertError || !insertedMessage) {
    return { error: "No se pudo enviar el mensaje.", message: null };
  }

  return { error: null, message: insertedMessage };
}

export async function markAsRead(
  remitenteId: string,
  throughMessageId: number,
): Promise<MarkAsReadResult> {
  if (!isValidProfileId(remitenteId)) {
    return { error: "Conversación inválida.", markedMessageIds: [] };
  }

  if (!Number.isSafeInteger(throughMessageId) || throughMessageId <= 0) {
    return { error: "Mensaje inválido.", markedMessageIds: [] };
  }

  const supabase = getInternalChatClient(await createClient());
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return {
      error: "No se pudo identificar el usuario activo.",
      markedMessageIds: [],
    };
  }

  if (remitenteId === userId) {
    return { error: "Conversación inválida.", markedMessageIds: [] };
  }

  const { data: activeProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .eq("activo", true)
    .maybeSingle();

  if (profileError || !activeProfile) {
    return {
      error: "Tu perfil no está habilitado para usar el chat.",
      markedMessageIds: [],
    };
  }

  const { data: markedMessages, error } = await supabase
    .from("internal_messages")
    .update({ leido: true })
    .eq("remitente_id", remitenteId)
    .eq("destinatario_id", userId)
    .eq("leido", false)
    .lte("id", throughMessageId)
    .select("id");

  if (error) {
    return {
      error: "No se pudieron marcar los mensajes como leídos.",
      markedMessageIds: [],
    };
  }

  const { count: remainingCount, error: remainingError } = await supabase
    .from("internal_messages")
    .select("id", { count: "exact", head: true })
    .eq("remitente_id", remitenteId)
    .eq("destinatario_id", userId)
    .eq("leido", false)
    .lte("id", throughMessageId);

  if (remainingError || (remainingCount ?? 0) > 0) {
    return {
      error: "No se pudieron confirmar los mensajes como leídos.",
      markedMessageIds: [],
    };
  }

  return {
    error: null,
    markedMessageIds: (markedMessages ?? []).map((message) => message.id),
  };
}
