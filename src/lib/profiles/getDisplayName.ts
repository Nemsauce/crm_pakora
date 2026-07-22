import type { Tables } from "@/lib/supabase/database.types";

export type DisplayNameProfile = Pick<Tables<"profiles">, "nombre"> & {
  email: Tables<"profiles">["email"] | null;
};

export function getDisplayName(
  profiles: readonly DisplayNameProfile[],
  rawIdentity: string,
) {
  const matchingProfile = profiles.find(
    (profile) => profile.email === rawIdentity,
  );
  const displayName = matchingProfile?.nombre?.trim();

  return displayName || rawIdentity;
}
