"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function setPasswordError(message: string) {
  redirect(`/set-password?error=${encodeURIComponent(message)}`);
}

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (password.length < 8) {
    setPasswordError("La contraseña debe tener al menos 8 caracteres.");
  }

  if (password !== passwordConfirmation) {
    setPasswordError("Las contraseñas no coinciden.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    setPasswordError(
      "No pudimos guardar la contraseña. El enlace puede estar vencido.",
    );
  }

  redirect("/");
}
