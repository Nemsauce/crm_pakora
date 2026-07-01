import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

async function logout() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login");
}

export default function Home() {
  return <AuthenticatedHome />;
}

async function AuthenticatedHome() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Supabase no está configurado para esta sesión.",
      )}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center text-text-primary">
      <div className="pointer-events-none absolute inset-x-8 top-20 -z-10 h-56 rounded-full bg-gradient-to-r from-accent-from/20 to-accent-to/20 blur-3xl" />
      <section className="rounded-xl border border-border bg-bg-surface/70 px-8 py-7 shadow-2xl shadow-accent-from/10 backdrop-blur-xl">
        <h1 className="font-display text-4xl font-semibold text-text-primary">
          CRM Pakora
        </h1>
        <p className="mt-4 font-body text-base text-text-secondary">
          Sesión iniciada
        </p>
        <p className="mt-2 font-mono text-sm text-text-secondary">
          {user.email ? `Sesión iniciada como ${user.email}` : "Usuario activo"}
        </p>
        <form action={logout} className="mt-8">
          <Button
            type="submit"
            variant="outline"
            className="border-border bg-bg-surface/80 text-text-primary hover:bg-bg-surface hover:text-text-primary"
          >
            Cerrar sesión
          </Button>
        </form>
      </section>
    </main>
  );
}
