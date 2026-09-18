// Elimina un cliente (salón) por completo: su fila en 'salones' (que ahora cascadea
// correctamente a locales/servicios/peluqueros/productos/cortes/salon_config/profiles),
// y además los logins de Auth de su dueño y sus peluqueros (esos no cascadean solos).
// Acción destructiva e irreversible. Solo puede invocarla un SUPER_ADMIN.
//
// Body esperado: { salonId: string }

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

  const { salonId } = await req.json();
  if (!salonId) return jsonResponse({ error: 'Falta salonId' }, 400);

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

  const { data: salon, error: salonError } = await admin.from('salones').select('id, nombre').eq('id', salonId).single();
  if (salonError || !salon) return jsonResponse({ error: 'Salón no encontrado' }, 404);

  // Los logins (auth.users) de este salón no cascadean solos al borrar el salón —
  // hay que borrarlos explícitamente antes.
  const { data: profiles } = await admin.from('profiles').select('id').eq('salon_id', salonId);
  let usuariosBorrados = 0;
  for (const p of profiles ?? []) {
    const { error } = await admin.auth.admin.deleteUser(p.id);
    if (!error) usuariosBorrados++;
  }

  const { error: deleteError } = await admin.from('salones').delete().eq('id', salonId);
  if (deleteError) return jsonResponse({ error: `No se pudo borrar el salón: ${deleteError.message}` }, 400);

  return jsonResponse({ ok: true, salonNombre: salon.nombre, usuariosBorrados });
});
