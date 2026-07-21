"use server";

import { createClient } from "@/lib/supabase/server";

export type NotificationActionResult = {
  error: string | null;
};

export async function markNotificationRead(
  notificationId: number,
): Promise<NotificationActionResult> {
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { error: "Notificación inválida." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return { error: "No se pudo identificar el usuario activo." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    return { error: "No se pudo marcar la notificación como leída." };
  }

  return { error: null };
}

export async function markNotificationUnread(
  notificationId: number,
): Promise<NotificationActionResult> {
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { error: "Notificación inválida." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return { error: "No se pudo identificar el usuario activo." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ leida: false })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    return { error: "No se pudo marcar la notificación como no leída." };
  }

  return { error: null };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return { error: "No se pudo identificar el usuario activo." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("user_id", userId)
    .eq("leida", false);

  if (error) {
    return { error: "No se pudieron marcar las notificaciones como leídas." };
  }

  return { error: null };
}
