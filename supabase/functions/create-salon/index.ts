// Da de alta un nuevo cliente (salón) + su primer usuario DUEÑO.
// Solo puede invocarla un SUPER_ADMIN.
//
// Body esperado: { salonNombre: string, duenoEmail: string, duenoNombre: string }
// Devuelve: { salonId, salonNombre, email, password } — la contraseña provisoria, solo se muestra una vez.

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

  const { salonNombre, duenoEmail, duenoNombre } = await req.json();
  if (!salonNombre || !duenoEmail) {
    return jsonResponse({ error: 'Faltan datos: salonNombre y duenoEmail son requeridos' }, 400);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Sesión inválida' }, 401);

  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || callerProfile?.role !== 'SUPER_ADMIN') {
    return jsonResponse({ error: 'No tenés permiso para crear salones' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: salon, error: salonError } = await admin
    .from('salones')
    .insert({ nombre: salonNombre, slug: salonNombre.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() })
    .select()
    .single();

  if (salonError || !salon) {
    return jsonResponse({ error: `No se pudo crear el salón: ${salonError?.message ?? 'error desconocido'}` }, 400);
  }

  const password = generarPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: duenoEmail,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    await admin.from('salones').delete().eq('id', salon.id);
    return jsonResponse({ error: `No se pudo crear el usuario: ${createError?.message ?? 'error desconocido'}` }, 400);
  }

  const { error: insertProfileError } = await admin.from('profiles').insert({
    id: created.user.id,
    salon_id: salon.id,
    role: 'DUENO',
    nombre: duenoNombre || null,
  });

  if (insertProfileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from('salones').delete().eq('id', salon.id);
    return jsonResponse({ error: `No se pudo crear el perfil: ${insertProfileError.message}` }, 400);
  }

  return jsonResponse({ salonId: salon.id, salonNombre: salon.nombre, email: duenoEmail, password });
});
