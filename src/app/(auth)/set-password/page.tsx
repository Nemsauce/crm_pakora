import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

import { setPassword } from "./actions";

type SetPasswordPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SetPasswordPage({
  searchParams,
}: SetPasswordPageProps) {
  let hasSession = false;
  const hasSupabaseEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
  }

  const params = await searchParams;
  const error = getSearchParam(params?.error);

  if (!hasSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-text-primary">
        <Card className="w-full max-w-sm rounded-2xl border-border bg-bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-2xl text-text-primary">
              Enlace no válido
            </CardTitle>
            <CardDescription className="font-body text-text-secondary">
              El enlace de invitación es inválido o ya expiró.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-bg-surface shadow-sm hover:opacity-90"
            >
              <Link href="/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-text-primary">
      <Card className="w-full max-w-sm rounded-2xl border-border bg-bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-text-primary">
            Define tu contraseña
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Completa la invitación para entrar al CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setPassword} className="space-y-4">
            {error ? (
              <p className="rounded-full bg-risk-high-bg px-4 py-2 font-body text-sm text-risk-high">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-primary">
                Nueva contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className="rounded-lg border-border bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:border-accent focus-visible:ring-accent/20"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="passwordConfirmation"
                className="text-text-primary"
              >
                Confirmar contraseña
              </Label>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                className="rounded-lg border-border bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:border-accent focus-visible:ring-accent/20"
                minLength={8}
                required
              />
            </div>
            <Button
              className="w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-bg-surface shadow-sm hover:opacity-90"
              type="submit"
            >
              Guardar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
