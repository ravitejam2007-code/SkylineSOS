import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

// Environment variables loaded strictly from .env
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error('CRITICAL: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be configured in .env');
  }
}

/**
 * Standard browser client for React Islands and client-side interactions.
 * Uses a strict window singleton pattern to prevent multiple GoTrueClient instances in the browser context.
 */
export function getBrowserClient() {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  const win = window as any;
  if (!win.__supabase_browser_client__) {
    win.__supabase_browser_client__ = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return win.__supabase_browser_client__;
}

/**
 * Server SSR client for Astro endpoints and server-rendered pages.
 * Handles secure session cookies via AstroCookies.
 */
export function getServerClient(cookies: AstroCookies, request?: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (request) {
          const cookieHeader = request.headers.get('Cookie') ?? '';
          return parseCookieHeader(cookieHeader);
        }
        // Fallback for Astro cookies
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
