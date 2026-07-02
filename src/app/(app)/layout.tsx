import { redirect } from "next/navigation";

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
    <div className="min-h-screen bg-bg-base text-text-primary lg:flex">
      <div className="lg:fixed lg:inset-y-0 lg:left-0 lg:w-72">
        <Sidebar userEmail={user.email ?? null} />
      </div>
      <main className="min-h-screen flex-1 bg-bg-surface lg:ml-72">
        {children}
      </main>
    </div>
  );
}
