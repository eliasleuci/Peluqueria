// Crea el login (usuario de Supabase Auth + profile) de un peluquero que YA existe
// como fila en la tabla `peluqueros` (creada desde la UI normal de "Peluqueros").
// Solo puede invocarla un DUEÑO (limitado a su propio salón) o un SUPER_ADMIN (cualquier salón).
//
// Body esperado: { peluqueroId: string, email: string }
// Devuelve: { email, password } — la contraseña provisoria, solo se muestra una vez.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function generarPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
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

  const { peluqueroId, email } = await req.json();
  if (!peluqueroId || !email) {
    return jsonResponse({ error: 'Faltan datos: peluqueroId y email son requeridos' }, 400);
  }

  // Cliente atado al JWT de quien llama, para saber quién es (respeta RLS).
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
    return jsonResponse({ error: 'No tenés permiso para crear logins' }, 403);
  }

  // Cliente con service_role: bypassa RLS para las operaciones privilegiadas de acá en más.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: peluquero, error: peluqueroError } = await admin
    .from('peluqueros')
    .select('id, nombre, salon_id, auth_user_id')
    .eq('id', peluqueroId)
    .single();

  if (peluqueroError || !peluquero) return jsonResponse({ error: 'Peluquero no encontrado' }, 404);

  if (callerProfile.role === 'DUENO' && peluquero.salon_id !== callerProfile.salon_id) {
    return jsonResponse({ error: 'Ese peluquero no pertenece a tu salón' }, 403);
  }

  if (peluquero.auth_user_id) {
    return jsonResponse({ error: 'Este peluquero ya tiene un acceso creado' }, 409);
  }

  const password = generarPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    return jsonResponse({ error: `No se pudo crear el usuario: ${createError?.message ?? 'error desconocido'}` }, 400);
  }

  const { error: insertProfileError } = await admin.from('profiles').insert({
    id: created.user.id,
    salon_id: peluquero.salon_id,
    role: 'PELUQUERO',
    peluquero_id: peluquero.id,
    nombre: peluquero.nombre,
  });

  if (insertProfileError) {
    // si falla, no dejamos un usuario de Auth huérfano sin profile
    await admin.auth.admin.deleteUser(created.user.id);
    return jsonResponse({ error: `No se pudo crear el perfil: ${insertProfileError.message}` }, 400);
  }

  await admin.from('peluqueros').update({ auth_user_id: created.user.id, email }).eq('id', peluquero.id);

  return jsonResponse({ email, password });
});
