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

import { login } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = getSearchParam(params?.error);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-surface-base)] px-6 py-12 text-text-primary">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] shadow-sm ring-0">
        <CardHeader className="gap-2">
          <CardTitle className="font-display text-2xl font-semibold text-text-primary">
            CRM Pakora
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Ingresa con tu cuenta invitada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            {error ? (
              <p className="rounded-xl border border-transparent bg-risk-high-bg px-4 py-3 font-body text-sm text-risk-high">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-body text-sm font-semibold text-text-primary"
              >
                Correo
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="h-[var(--density-row-height-compact)] rounded-xl border-border bg-[var(--color-bg-surface-subtle)] px-3 text-text-primary transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] placeholder:text-text-secondary hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="font-body text-sm font-semibold text-text-primary"
              >
                Contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-[var(--density-row-height-compact)] rounded-xl border-border bg-[var(--color-bg-surface-subtle)] px-3 text-text-primary transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] placeholder:text-text-secondary hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>
            <Button
              className="min-h-[var(--density-row-height-compact)] w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)] shadow-sm transition-opacity duration-[var(--motion-duration-hover-focus)] hover:opacity-90"
              type="submit"
            >
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
