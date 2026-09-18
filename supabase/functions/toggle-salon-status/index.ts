// Pausa o reactiva un cliente (salón) — típicamente por falta de pago. No borra nada:
// solo bloquea o restaura el acceso, tanto a nivel de datos (salones.activo, ya
// enforced por RLS vía get_my_salon_id()/get_my_peluquero_id()) como el login en sí
// de todos sus usuarios (dueño + peluqueros), para que ni puedan volver a entrar.
// Solo puede invocarla un SUPER_ADMIN.
//
// Body esperado: { salonId: string, activo: boolean }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const { salonId, activo } = await req.json();
  if (!salonId || typeof activo !== 'boolean') {
    return jsonResponse({ error: 'Faltan datos: salonId (string) y activo (boolean)' }, 400);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Sesión inválida' }, 401);

  const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', userData.user.id).single();
  if (callerProfile?.role !== 'SUPER_ADMIN') {
    return jsonResponse({ error: 'No tenés permiso para hacer esto' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { error: updateError } = await admin.from('salones').update({ activo }).eq('id', salonId);
  if (updateError) return jsonResponse({ error: `No se pudo actualizar el salón: ${updateError.message}` }, 400);

  const { data: profiles } = await admin.from('profiles').select('id').eq('salon_id', salonId);
  let afectados = 0;
  for (const p of profiles ?? []) {
    const { error: banError } = await admin.auth.admin.updateUserById(p.id, {
      ban_duration: activo ? 'none' : '876000h',
    });
    if (!banError) afectados++;
  }

  return jsonResponse({ ok: true, activo, usuariosAfectados: afectados });
});
