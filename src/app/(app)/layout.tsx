import { redirect } from "next/navigation";

import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/nav/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <div className="min-h-screen p-4 text-text-primary md:p-6">
      <div className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-bg-surface shadow-xl md:min-h-[calc(100vh-3rem)] lg:flex">
        <div className="lg:w-72 lg:shrink-0">
          <Sidebar userEmail={user.email ?? null} />
        </div>
        <main className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col bg-bg-surface md:min-h-[calc(100vh-3rem)]">
          <TopBar userEmail={user.email ?? null} />
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
