// Genera una contraseña provisoria nueva para el DUEÑO de un salón (p. ej. si se la olvidó y
// el mail de recuperación no le llega). También lo desbloquea si estaba bloqueado.
// Solo puede invocarla un SUPER_ADMIN.
//
// Body esperado: { salonId: string }
// Devuelve: { salonNombre, email, password } — la contraseña se muestra una sola vez.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function generarPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  let pass = '';
  for (const b of bytes) pass += chars[b % chars.length];
  return pass + '!';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Falta autenticación' }, 401);

  const { salonId } = await req.json();
  if (!salonId) return jsonResponse({ error: 'Falta salonId' }, 400);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Sesión inválida' }, 401);

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (callerProfile?.role !== 'SUPER_ADMIN') {
    return jsonResponse({ error: 'No tenés permiso para hacer esto' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: salon } = await admin.from('salones').select('id, nombre').eq('id', salonId).maybeSingle();
  if (!salon) return jsonResponse({ error: 'Cliente no encontrado' }, 404);

  const { data: duenos, error: duenosError } = await admin
    .from('profiles')
    .select('id')
    .eq('salon_id', salonId)
    .eq('role', 'DUENO');
  if (duenosError) return jsonResponse({ error: duenosError.message }, 400);
  if (!duenos?.length) return jsonResponse({ error: 'Este cliente no tiene un dueño con acceso' }, 404);
  if (duenos.length > 1) {
    return jsonResponse({ error: 'Este cliente tiene más de un dueño; resetealo desde Supabase' }, 409);
  }

  const password = generarPassword();
  const { data: upd, error: updError } = await admin.auth.admin.updateUserById(duenos[0].id, {
    password,
    ban_duration: 'none',
  });
  if (updError || !upd?.user) {
    return jsonResponse({ error: `No se pudo generar la contraseña: ${updError?.message ?? 'error desconocido'}` }, 400);
  }

  return jsonResponse({ salonNombre: salon.nombre, email: upd.user.email, password });
});
