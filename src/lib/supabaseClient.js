import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);

// supabase-js no expone el body de una Edge Function que respondió con error
// (data queda en null); el mensaje real hay que leerlo de error.context (la Response cruda).
export async function extractFunctionError(error) {
  try {
    const body = await error.context.json();
    if (body?.error) return body.error;
  } catch {
    // el body no era JSON o ya se consumió; seguimos al mensaje genérico
  }
  return error.message ?? String(error);
}
