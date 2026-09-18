import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(key) {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  const line = envFile.split('\n').find((l) => l.startsWith(key + '='));
  if (!line) throw new Error(`Falta ${key} en .env.local`);
  return line.slice(key.length + 1).trim();
}

const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
const ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const PASSWORD = 'TestTDB!2026';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// IDs de la corrida de seed-test-tenants.mjs
const IDS = {
  salonA: '2ab8486b-9d3d-41a7-baca-794a35331158',
  localA: 'abeccb95-d928-4424-9d01-cefc70620b69',
  pelA1: '4a1d4bd4-2e2d-43a8-9cdd-30d5593ce7ee',
  pelA2: '0d464a47-7908-4101-a044-a486322f00e1',
  salonB: 'fa9fbb5b-4ac2-4e31-9b0e-f868f52ef0c2',
  localB: '1e33601d-31c4-40ab-8552-2737ddc01f04',
  pelB1: '1f2c6910-bafb-4052-8f65-40f08c4e18cf',
};

async function loginAs(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

let pass = 0;
let fail = 0;
function check(label, condition, extra = '') {
  if (condition) {
    console.log(`✅ ${label}`);
    pass++;
  } else {
    console.log(`❌ ${label} ${extra}`);
    fail++;
  }
}

const duenoA = await loginAs('dueno.a@test.tdb');
const pelA1 = await loginAs('peluquero.a1@test.tdb');
const duenoB = await loginAs('dueno.b@test.tdb');

// 1. DUEÑO A solo ve cortes de su propio salón
{
  const { data, error } = await duenoA.from('cortes').select('*');
  const soloSalonA = !error && data.every((c) => c.salon_id === IDS.salonA);
  check('DUEÑO A: select cortes -> solo Salón A', soloSalonA && data.length > 0, JSON.stringify({ error, count: data?.length }));
}

// 2. PELUQUERO A1 solo ve sus propios cortes (no los de A2)
{
  const { data, error } = await pelA1.from('cortes').select('*');
  const soloPropios = !error && data.length > 0 && data.every((c) => c.peluquero_id === IDS.pelA1);
  check('PELUQUERO A1: select cortes -> solo los suyos (no ve los de A2)', soloPropios, JSON.stringify({ error, data }));
}

// 3. PELUQUERO A1 NO puede insertar un corte a nombre de A2
{
  const { error } = await pelA1.from('cortes').insert({
    salon_id: IDS.salonA,
    local_id: IDS.localA,
    peluquero_id: IDS.pelA2, // <- intenta cargar a nombre de otro
    servicio_id: (await duenoA.from('servicios').select('id').limit(1).single()).data.id,
    fecha: '2026-09-16',
    hora: '11:00',
    precio: 1000,
    monto: 1000,
    pago: 'efectivo',
  });
  check('PELUQUERO A1: insert corte a nombre de A2 -> RECHAZADO', !!error, JSON.stringify({ error }));
}

// 4. PELUQUERO A1 NO puede leer la tabla peluqueros (comisiones de compañeros)
{
  const { data, error } = await pelA1.from('peluqueros').select('*');
  check('PELUQUERO A1: select peluqueros -> vacío/denegado', !error && data.length === 0, JSON.stringify({ error, count: data?.length }));
}

// 5. DUEÑO A no puede ver locales del Salón B
{
  const { data, error } = await duenoA.from('locales').select('*').eq('salon_id', IDS.salonB);
  check('DUEÑO A: select locales de Salón B -> vacío', !error && data.length === 0, JSON.stringify({ error, count: data?.length }));
}

// 6. DUEÑO A no puede ver cortes del Salón B
{
  const { data, error } = await duenoA.from('cortes').select('*').eq('salon_id', IDS.salonB);
  check('DUEÑO A: select cortes de Salón B -> vacío', !error && data.length === 0, JSON.stringify({ error, count: data?.length }));
}

// 7. Nadie (ni DUEÑO) puede auto-promoverse a SUPER_ADMIN
// Nota: sin política de UPDATE en 'profiles', PostgREST no tira error — simplemente
// actualiza 0 filas. Por eso verificamos el estado real después, no si hubo excepción.
{
  const { data: myProfile } = await duenoA.from('profiles').select('id,role').eq('role', 'DUENO').limit(1).single();
  await duenoA.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', myProfile?.id ?? '00000000-0000-0000-0000-000000000000');
  const { data: after } = await admin.from('profiles').select('role').eq('id', myProfile.id).single();
  check('DUEÑO A: update profiles.role a SUPER_ADMIN -> RECHAZADO (sigue en DUENO)', after.role === 'DUENO', JSON.stringify({ after }));
}

// 8. PELUQUERO A1 puede editar/borrar su propio corte, pero no el de A2
{
  const { data: propio } = await pelA1.from('cortes').select('id').eq('peluquero_id', IDS.pelA1).limit(1).single();
  const { error: errPropio } = await pelA1.from('cortes').update({ notas: 'corrigiendo mi propio corte' }).eq('id', propio.id);
  check('PELUQUERO A1: update SU propio corte -> permitido', !errPropio, JSON.stringify({ errPropio }));

  const { data: ajeno } = await duenoA.from('cortes').select('id').eq('peluquero_id', IDS.pelA2).limit(1).single();
  const { data: intentoAjeno, error: errAjeno } = await pelA1
    .from('cortes')
    .update({ notas: 'intento tocar el de otro' })
    .eq('id', ajeno.id)
    .select();
  const bloqueado = !!errAjeno || !intentoAjeno || intentoAjeno.length === 0;
  check('PELUQUERO A1: update corte de A2 -> RECHAZADO/0 filas', bloqueado, JSON.stringify({ errAjeno, intentoAjeno }));
}

console.log(`\n${pass} OK / ${fail} FALLOS`);
if (fail > 0) process.exit(1);
