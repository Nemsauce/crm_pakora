import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const authError =
  "El enlace de autenticación es inválido o expiró. Solicita una nueva invitación.";

function redirectWithError(request: NextRequest, message = authError) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const callbackError = searchParams.get("error_description");
  const redirectTo = request.nextUrl.clone();

  redirectTo.search = "";

  if (callbackError) {
    return redirectWithError(request, callbackError);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectWithError(request);
    }

    redirectTo.pathname = type === "invite" ? "/set-password" : "/";
    return NextResponse.redirect(redirectTo);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      return redirectWithError(request);
    }

    redirectTo.pathname = type === "invite" ? "/set-password" : "/";
    return NextResponse.redirect(redirectTo);
  }

  return redirectWithError(request);
}
