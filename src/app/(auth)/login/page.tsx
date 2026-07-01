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
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 text-text-primary">
      <div className="pointer-events-none absolute inset-x-6 top-16 -z-10 h-48 rounded-full bg-gradient-to-r from-accent-from/20 to-accent-to/20 blur-3xl" />
      <Card className="w-full max-w-sm border-border bg-bg-surface/75 shadow-2xl shadow-accent-from/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-text-primary">
            CRM Pakora
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Ingresa con tu cuenta invitada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            {error ? (
              <p className="rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-primary">
                Correo
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="border-border bg-bg-base/60 text-text-primary placeholder:text-text-secondary focus-visible:border-accent-to focus-visible:ring-accent-to/30"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-primary">
                Contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="border-border bg-bg-base/60 text-text-primary placeholder:text-text-secondary focus-visible:border-accent-to focus-visible:ring-accent-to/30"
                required
              />
            </div>
            <Button
              className="w-full bg-accent-to text-bg-base hover:bg-accent-to/90"
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
