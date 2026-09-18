import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(key) {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  const line = envFile.split('\n').find((l) => l.startsWith(key + '='));
  if (!line) throw new Error(`Falta ${key} en .env.local`);
  return line.slice(key.length + 1).trim();
}

const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
const SERVICE_ROLE_KEY = readEnv('SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'TestTDB!2026';

async function createAuthUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) {
    // si ya existe de una corrida anterior, lo buscamos y seguimos
    if (String(error.message).toLowerCase().includes('already')) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list.users.find((u) => u.email === email);
      if (found) return found;
    }
    throw error;
  }
  return data.user;
}

async function insertOne(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function seedSalon(label, { salonNombre, localesNombres, dueñoEmail, peluquerosDef }) {
  console.log(`\n--- Sembrando ${label} ---`);
  const salon = await insertOne('salones', { nombre: salonNombre, slug: salonNombre.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() });
  console.log('salón:', salon.id, salon.nombre);

  const locales = [];
  for (const nombre of localesNombres) {
    const local = await insertOne('locales', { salon_id: salon.id, nombre, meta_mensual: 100000 });
    locales.push(local);
  }
  console.log('locales:', locales.map((l) => l.nombre).join(', '));

  const servicio = await insertOne('servicios', { salon_id: salon.id, nombre: 'Corte clásico', precio: 3500 });

  const dueñoUser = await createAuthUser(dueñoEmail);
  await insertOne('profiles', { id: dueñoUser.id, salon_id: salon.id, role: 'DUENO', nombre: 'Dueño ' + label });
  console.log('dueño:', dueñoEmail, '/', PASSWORD);

  const peluqueros = [];
  for (const def of peluquerosDef) {
    const pel = await insertOne('peluqueros', {
      salon_id: salon.id,
      local_id: locales[0].id,
      nombre: def.nombre,
      comision: 40,
      email: def.email,
    });
    const pelUser = await createAuthUser(def.email);
    await insertOne('profiles', {
      id: pelUser.id,
      salon_id: salon.id,
      role: 'PELUQUERO',
      peluquero_id: pel.id,
      nombre: def.nombre,
    });
    await admin.from('peluqueros').update({ auth_user_id: pelUser.id }).eq('id', pel.id);
    peluqueros.push(pel);
    console.log('peluquero:', def.email, '/', PASSWORD, '->', pel.nombre);
  }

  // un par de cortes de ejemplo, uno por peluquero
  for (const pel of peluqueros) {
    await insertOne('cortes', {
      salon_id: salon.id,
      local_id: locales[0].id,
      peluquero_id: pel.id,
      servicio_id: servicio.id,
      fecha: '2026-09-15',
      hora: '10:00',
      precio: 3500,
      descuento: 0,
      monto: 3500,
      pago: 'efectivo',
    });
  }

  return { salon, locales, servicio, peluqueros };
}

const salonA = await seedSalon('Salón A', {
  salonNombre: 'Barbería Test A',
  localesNombres: ['Sucursal A1'],
  dueñoEmail: 'dueno.a@test.tdb',
  peluquerosDef: [
    { nombre: 'Peluquero A1', email: 'peluquero.a1@test.tdb' },
    { nombre: 'Peluquero A2', email: 'peluquero.a2@test.tdb' },
  ],
});

const salonB = await seedSalon('Salón B', {
  salonNombre: 'Barbería Test B',
  localesNombres: ['Sucursal B1'],
  dueñoEmail: 'dueno.b@test.tdb',
  peluquerosDef: [{ nombre: 'Peluquero B1', email: 'peluquero.b1@test.tdb' }],
});

console.log('\nListo. IDs para el script de verificación:');
console.log(
  JSON.stringify(
    {
      salonA: { id: salonA.salon.id, local: salonA.locales[0].id, pelA1: salonA.peluqueros[0].id, pelA2: salonA.peluqueros[1].id },
      salonB: { id: salonB.salon.id, local: salonB.locales[0].id, pelB1: salonB.peluqueros[0].id },
    },
    null,
    2
  )
);
