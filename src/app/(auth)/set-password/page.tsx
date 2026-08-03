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
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
      <main className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-surface-base)] px-6 py-12 text-text-primary">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-sm rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] shadow-sm ring-0">
          <CardHeader className="gap-2">
            <CardTitle className="font-display text-2xl font-semibold text-text-primary">
              Enlace no válido
            </CardTitle>
            <CardDescription className="font-body text-text-secondary">
              El enlace de invitación es inválido o ya expiró.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="min-h-[var(--density-row-height-compact)] w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)] shadow-sm transition-opacity duration-[var(--motion-duration-hover-focus)] hover:opacity-90"
            >
              <Link href="/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-surface-base)] px-6 py-12 text-text-primary">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] shadow-sm ring-0">
        <CardHeader className="gap-2">
          <CardTitle className="font-display text-2xl font-semibold text-text-primary">
            Define tu contraseña
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Completa la invitación para entrar al CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setPassword} className="space-y-4">
            {error ? (
              <p className="rounded-xl border border-transparent bg-risk-high-bg px-4 py-3 font-body text-sm text-risk-high">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="font-body text-sm font-semibold text-text-primary"
              >
                Nueva contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className="h-[var(--density-row-height-compact)] rounded-xl border-border bg-[var(--color-bg-surface-subtle)] px-3 text-text-primary transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] placeholder:text-text-secondary hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="passwordConfirmation"
                className="font-body text-sm font-semibold text-text-primary"
              >
                Confirmar contraseña
              </Label>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                className="h-[var(--density-row-height-compact)] rounded-xl border-border bg-[var(--color-bg-surface-subtle)] px-3 text-text-primary transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] placeholder:text-text-secondary hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                minLength={8}
                required
              />
            </div>
            <Button
              className="min-h-[var(--density-row-height-compact)] w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)] shadow-sm transition-opacity duration-[var(--motion-duration-hover-focus)] hover:opacity-90"
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
