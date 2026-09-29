// Crea (o regenera) el login de un peluquero que YA existe como fila en `peluqueros`.
// Solo puede invocarla un DUEÑO (limitado a su propio salón) o un SUPER_ADMIN (cualquier salón).
//
// Body:
//   { peluqueroId, email }            -> crea el acceso. Si el email ya pertenece a un usuario de
//                                        un peluquero DADO DE BAJA del mismo salón (o a un usuario
//                                        huérfano sin perfil), lo reutiliza: lo desbloquea, le pone
//                                        contraseña nueva y lo vincula a este peluquero. El historial
//                                        del peluquero viejo se conserva.
//   { peluqueroId, regenerar: true }  -> genera una contraseña provisoria nueva para un peluquero
//                                        que ya tiene acceso (y lo desbloquea si estaba bloqueado).
// Devuelve: { email, password } — la contraseña provisoria, solo se muestra una vez.

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

// deno-lint-ignore no-explicit-any
async function buscarUsuarioPorEmail(admin: any, email: string) {
  // La API admin no filtra por email: se recorre paginado (volumen chico por salón).
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u: { email?: string }) => (u.email ?? '').toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Falta autenticación' }, 401);

  const { peluqueroId, email: rawEmail, regenerar } = await req.json();
  if (!peluqueroId || (!regenerar && !rawEmail)) {
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
    .select('id, nombre, salon_id, auth_user_id, activo')
    .eq('id', peluqueroId)
    .single();

  if (peluqueroError || !peluquero) return jsonResponse({ error: 'Peluquero no encontrado' }, 404);

  if (callerProfile.role === 'DUENO' && peluquero.salon_id !== callerProfile.salon_id) {
    return jsonResponse({ error: 'Ese peluquero no pertenece a tu salón' }, 403);
  }

  const password = generarPassword();

  // --- Regenerar contraseña de un acceso existente ---
  if (regenerar) {
    if (!peluquero.auth_user_id) {
      return jsonResponse({ error: 'Este peluquero todavía no tiene acceso. Creale uno primero.' }, 409);
    }
    if (peluquero.activo === false) {
      return jsonResponse({ error: 'El peluquero está dado de baja.' }, 409);
    }
    const { data: upd, error: updError } = await admin.auth.admin.updateUserById(peluquero.auth_user_id, {
      password,
      ban_duration: 'none',
    });
    if (updError || !upd?.user) {
      return jsonResponse({ error: `No se pudo generar la contraseña: ${updError?.message ?? 'error desconocido'}` }, 400);
    }
    return jsonResponse({ email: upd.user.email, password });
  }

  // --- Crear acceso ---
  if (peluquero.auth_user_id) {
    return jsonResponse({ error: 'Este peluquero ya tiene un acceso creado' }, 409);
  }

  const email = String(rawEmail).trim().toLowerCase();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createError && created?.user) {
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
  }

  // El email ya existe: ver si se puede reutilizar ese usuario.
  let existente;
  try {
    existente = await buscarUsuarioPorEmail(admin, email);
  } catch (e) {
    return jsonResponse({ error: `No se pudo verificar el email: ${(e as Error).message}` }, 400);
  }
  if (!existente) {
    return jsonResponse({ error: `No se pudo crear el usuario: ${createError?.message ?? 'error desconocido'}` }, 400);
  }

  const { data: perfilExistente } = await admin
    .from('profiles')
    .select('id, role, salon_id, peluquero_id')
    .eq('id', existente.id)
    .maybeSingle();

  let peluqueroViejo: { id: string; activo: boolean } | null = null;
  if (perfilExistente) {
    if (perfilExistente.role !== 'PELUQUERO' || perfilExistente.salon_id !== peluquero.salon_id) {
      return jsonResponse(
        { error: 'Ese email ya lo usa otra cuenta del sistema (dueño u otro salón). Usá otro email.' },
        409
      );
    }
    if (perfilExistente.peluquero_id) {
      const { data: pv } = await admin
        .from('peluqueros')
        .select('id, activo')
        .eq('id', perfilExistente.peluquero_id)
        .maybeSingle();
      peluqueroViejo = pv ?? null;
      if (pv && pv.activo !== false && pv.id !== peluquero.id) {
        return jsonResponse({ error: 'Ese email ya lo usa otro peluquero activo. Usá otro email.' }, 409);
      }
    }
  }

  // Reutilizar: contraseña nueva + desbloquear (la baja lo había bloqueado).
  const { error: reuseError } = await admin.auth.admin.updateUserById(existente.id, {
    password,
    ban_duration: 'none',
    email_confirm: true,
  });
  if (reuseError) {
    return jsonResponse({ error: `No se pudo reactivar el usuario: ${reuseError.message}` }, 400);
  }

  const perfil = {
    id: existente.id,
    salon_id: peluquero.salon_id,
    role: 'PELUQUERO',
    peluquero_id: peluquero.id,
    nombre: peluquero.nombre,
  };
  const { error: perfilError } = perfilExistente
    ? await admin.from('profiles').update(perfil).eq('id', existente.id)
    : await admin.from('profiles').insert(perfil);
  if (perfilError) {
    return jsonResponse({ error: `No se pudo vincular el perfil: ${perfilError.message}` }, 400);
  }

  // El peluquero dado de baja conserva su historial, pero ya no queda atado a este login.
  if (peluqueroViejo && peluqueroViejo.id !== peluquero.id) {
    await admin.from('peluqueros').update({ auth_user_id: null }).eq('id', peluqueroViejo.id);
  }
  await admin.from('peluqueros').update({ auth_user_id: existente.id, email }).eq('id', peluquero.id);

  return jsonResponse({ email, password, reutilizado: true });
});
