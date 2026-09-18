import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(key) {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  const line = envFile.split('\n').find((l) => l.startsWith(key + '='));
  return line.slice(key.length + 1).trim();
}
const admin = createClient(readEnv('VITE_SUPABASE_URL'), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KEEP_SALON_NAME = 'Peluquería Demo';
const SUPER_ADMIN_EMAIL = 'sistemadepeluqueria@gmail.com';

const { data: users } = await admin.auth.admin.listUsers();
const superAdmin = users.users.find((u) => u.email === SUPER_ADMIN_EMAIL);
if (!superAdmin) throw new Error('No encontré el SUPER_ADMIN, aborto.');

const { data: keepSalon } = await admin.from('salones').select('id').eq('nombre', KEEP_SALON_NAME).single();
if (!keepSalon) throw new Error('No encontré el salón demo a conservar, aborto.');
console.log('Conservando SUPER_ADMIN:', superAdmin.email, '| salón demo:', keepSalon.id);

console.log('\n=== Borrando salones que no sean el demo ===');
const { data: salones } = await admin.from('salones').select('id,nombre').neq('id', keepSalon.id);
for (const s of salones) {
  const { error } = await admin.from('salones').delete().eq('id', s.id);
  if (error) console.log('❌ FALLÓ borrando salón', s.nombre, '->', error.message);
  else console.log('✅ salón borrado:', s.nombre);
}

console.log('\n=== Borrando profiles sueltos (sin salón válido, y que no sean el super admin) ===');
const { data: keepProfiles } = await admin.from('profiles').select('id').eq('salon_id', keepSalon.id);
const keepIds = new Set([superAdmin.id, ...keepProfiles.map((p) => p.id)]);
const { data: allProfiles } = await admin.from('profiles').select('id');
for (const p of allProfiles) {
  if (keepIds.has(p.id)) continue;
  const { error } = await admin.from('profiles').delete().eq('id', p.id);
  if (error) console.log('❌ FALLÓ borrando profile', p.id, '->', error.message);
}

console.log('\n=== Borrando auth.users que no sean el super admin ni los dos demo ===');
const { data: demoProfiles } = await admin.from('profiles').select('id').eq('salon_id', keepSalon.id);
const keepUserIds = new Set([superAdmin.id, ...demoProfiles.map((p) => p.id)]);
for (const u of users.users) {
  if (keepUserIds.has(u.id)) continue;
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) console.log('❌ FALLÓ borrando usuario', u.email, '->', error.message);
  else console.log('✅ usuario borrado:', u.email);
}

console.log('\n=== Verificación final ===');
const { data: finalSalones } = await admin.from('salones').select('nombre');
const { data: finalUsers } = await admin.auth.admin.listUsers();
console.log('salones que quedan:', finalSalones.map((s) => s.nombre));
console.log('usuarios que quedan:', finalUsers.users.map((u) => u.email));
