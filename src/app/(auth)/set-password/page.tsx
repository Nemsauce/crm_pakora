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
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Enlace no válido</CardTitle>
            <CardDescription>
              El enlace de invitación es inválido o ya expiró.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Define tu contraseña</CardTitle>
          <CardDescription>
            Completa la invitación para entrar al CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setPassword} className="space-y-4">
            {error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirmation">
                Confirmar contraseña
              </Label>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button className="w-full" type="submit">
              Guardar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
