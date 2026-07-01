"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const loginError =
  "No pudimos iniciar sesión. Revisa el correo y la contraseña.";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent(loginError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(loginError)}`);
  }

  redirect("/");
}
