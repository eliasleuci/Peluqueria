// Bloquea el login de un peluquero (además de la baja lógica que ya se hace en la tabla
// 'peluqueros'). Sin esto, el peluquero dado de baja podía seguir entrando con su
// contraseña — la RLS ya le bloquea los datos, pero esto además le corta el acceso.
// Solo puede invocarla un DUEÑO (limitado a su propio salón) o un SUPER_ADMIN.
//
// Body esperado: { peluqueroId: string }

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

  const { peluqueroId } = await req.json();
  if (!peluqueroId) return jsonResponse({ error: 'Falta peluqueroId' }, 400);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Sesión inválida' }, 401);

  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('role, salon_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !callerProfile) return jsonResponse({ error: 'No se encontró tu perfil' }, 403);
  if (callerProfile.role !== 'DUENO' && callerProfile.role !== 'SUPER_ADMIN') {
    return jsonResponse({ error: 'No tenés permiso para hacer esto' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: peluquero, error: peluqueroError } = await admin
    .from('peluqueros')
    .select('id, salon_id, auth_user_id')
    .eq('id', peluqueroId)
    .single();

  if (peluqueroError || !peluquero) return jsonResponse({ error: 'Peluquero no encontrado' }, 404);

  if (callerProfile.role === 'DUENO' && peluquero.salon_id !== callerProfile.salon_id) {
    return jsonResponse({ error: 'Ese peluquero no pertenece a tu salón' }, 403);
  }

  if (!peluquero.auth_user_id) {
    // nunca tuvo login creado, no hay nada que bloquear
    return jsonResponse({ ok: true, sinLogin: true });
  }

  const { error: banError } = await admin.auth.admin.updateUserById(peluquero.auth_user_id, {
    ban_duration: '876000h', // ~100 años: en la práctica, para siempre
  });

  if (banError) {
    return jsonResponse({ error: `No se pudo bloquear el acceso: ${banError.message}` }, 400);
  }

  return jsonResponse({ ok: true });
});
