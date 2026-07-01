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
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold text-foreground">CRM Pakora</h1>
      <p className="mt-4 text-base text-muted-foreground">Sesión iniciada</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.email ? `Sesión iniciada como ${user.email}` : "Usuario activo"}
      </p>
      <form action={logout} className="mt-8">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
