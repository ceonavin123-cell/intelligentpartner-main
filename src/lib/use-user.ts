import type { User } from "@supabase/supabase-js";

export function useUser() {
  const mockUser: User = {
    id: "00000000-0000-0000-0000-000000000000",
    email: "developer@studio.local",
    role: "authenticated",
    aud: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: "Developer User" },
  } as any;

  return { user: mockUser, loading: false };
}
