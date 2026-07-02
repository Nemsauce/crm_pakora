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
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-[var(--foreground)]">
      <Card className="w-full max-w-sm rounded-2xl border-border bg-bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-[var(--foreground)]">
            CRM Pakora
          </CardTitle>
          <CardDescription className="font-body text-[var(--muted-foreground)]">
            Ingresa con tu cuenta invitada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            {error ? (
              <p className="rounded-full bg-risk-high-bg px-4 py-2 font-body text-sm text-risk-high">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--foreground)]">
                Correo
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="rounded-lg border-border bg-bg-surface text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--foreground)]">
                Contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="rounded-lg border-border bg-bg-surface text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>
            <Button
              className="w-full rounded-full bg-gradient-to-r from-accent-from to-accent-to text-bg-surface shadow-sm hover:opacity-90"
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
