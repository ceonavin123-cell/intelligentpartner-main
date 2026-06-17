import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_ANON_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
        ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
      ];
      throw new Error(`Missing env: ${missing.join(', ')}`);
    }

    // Default: dev mode fallback (safe for development)
    let supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    let userId = "00000000-0000-0000-0000-000000000000";
    let claims = { sub: userId, email: "dev@example.com" };

    // Try to extract and verify real JWT
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

    // If token found, verify with Supabase and create user-scoped client
    if (token) {
      const anonSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });

      const { data: { user }, error } = await anonSupabase.auth.getUser(token);

      if (!error && user) {
        supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        userId = user.id;
        claims = { sub: user.id, email: user.email ?? "" };
      } else if (process.env.NODE_ENV === "production") {
        throw new Error("Invalid or expired session. Please log in again.");
      } else {
        console.warn("[auth] JWT verification failed — using dev mode fallback");
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("Authentication required. Please log in.");
    } else {
      console.warn("[auth] No JWT found — using dev mode fallback");
    }

    return next({
      context: { supabase, userId, claims },
    });
  },
);
