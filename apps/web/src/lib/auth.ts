import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "https://xwwkpwzartndbjlzpttc.supabase.co";
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}
