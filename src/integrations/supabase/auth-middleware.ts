import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_ANON_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
      ];
      throw new Error(`Missing env: ${missing.join(', ')}`);
    }

    // Extract JWT from Authorization header or cookie
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization") ?? "";
    const cookieHeader = request?.headers?.get("cookie") ?? "";
    let token = "";

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const cookieMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
      if (cookieMatch) {
        try {
          const decoded = JSON.parse(atob(cookieMatch[1]));
          token = decoded?.access_token ?? "";
        } catch { /* ignore */ }
      }
    }

    // NO TOKEN = NO ACCESS. Always required, no exceptions, no dev bypass.
    if (!token) {
      throw new Error("Authentication required. Please log in.");
    }

    // Verify the JWT using the anon client
    const anonSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await anonSupabase.auth.getUser(token);

    // INVALID TOKEN = NO ACCESS. Always required, no exceptions, no dev bypass.
    if (error || !user) {
      throw new Error("Invalid or expired session. Please log in again.");
    }

    // Valid session — create a user-scoped client (carries the user's JWT, respects RLS)
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const userId = user.id;
    const claims = { sub: user.id, email: user.email ?? "" };

    return next({
      context: { supabase, userId, claims },
    });
  },
);