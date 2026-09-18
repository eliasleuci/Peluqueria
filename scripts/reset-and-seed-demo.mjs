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

const SUPER_ADMIN_EMAIL = 'sistemadepeluqueria@gmail.com';

console.log('=== 1. Borrando todo excepto el SUPER_ADMIN ===');

const { data: superAdminUser } = await admin.auth.admin
  .listUsers()
  .then((r) => ({ data: r.data.users.find((u) => u.email === SUPER_ADMIN_EMAIL) }));
if (!superAdminUser) throw new Error('No encontré el usuario SUPER_ADMIN, aborto por seguridad.');
console.log('Conservando:', superAdminUser.email, superAdminUser.id);

// Borrar todos los salones borra en cascada locales/servicios/peluqueros/productos/cortes/salon_config.
const { data: salones } = await admin.from('salones').select('id,nombre');
for (const s of salones) {
  await admin.from('salones').delete().eq('id', s.id);
  console.log('salón borrado:', s.nombre);
}

// Borrar profiles que no sean el super admin (por si quedó alguno sin salon_id, ej. otro super admin de prueba)
await admin.from('profiles').delete().neq('id', superAdminUser.id);

// Borrar todos los auth users salvo el super admin
const { data: allUsers } = await admin.auth.admin.listUsers();
for (const u of allUsers.users) {
  if (u.id === superAdminUser.id) continue;
  await admin.auth.admin.deleteUser(u.id);
  console.log('usuario borrado:', u.email);
}

console.log('\n=== 2. Creando el salón demo ===');

const { data: salon, error: salonError } = await admin
  .from('salones')
  .insert({ nombre: 'Peluquería Demo', slug: 'peluqueria-demo' })
  .select()
  .single();
if (salonError) throw salonError;
console.log('salón:', salon.id, salon.nombre);

const { data: localCentro } = await admin
  .from('locales')
  .insert({ salon_id: salon.id, nombre: 'Local Centro', direccion: 'Av. Corrientes 1234', telefono: '11-4444-1111', horario: 'Lun a Sáb 9:00 - 20:00', meta_mensual: 300000 })
  .select()
  .single();
const { data: localNorte } = await admin
  .from('locales')
  .insert({ salon_id: salon.id, nombre: 'Local Norte', direccion: 'Av. Cabildo 2456', telefono: '11-4444-2222', horario: 'Lun a Sáb 9:00 - 20:00', meta_mensual: 260000 })
  .select()
  .single();
console.log('locales:', localCentro.nombre, localNorte.nombre);

const serviciosDef = [
  { nombre: 'Corte clásico', precio: 3500 },
  { nombre: 'Fade / degradé', precio: 4200 },
  { nombre: 'Barba completa', precio: 2800 },
  { nombre: 'Corte + barba', precio: 5800 },
  { nombre: 'Tintura', precio: 7500 },
];
const servicios = [];
for (const s of serviciosDef) {
  const { data } = await admin.from('servicios').insert({ salon_id: salon.id, nombre: s.nombre, precio: s.precio, activo: true }).select().single();
  servicios.push(data);
}
console.log('servicios:', servicios.length);

await admin.from('salon_config').insert({ salon_id: salon.id, meta_peluquero: 80000 });

console.log('\n=== 3. Creando los dos accesos demo ===');

const { data: duenoUser, error: duenoError } = await admin.auth.admin.createUser({
  email: 'duenodemo@gmail.com',
  password: 'Demo123',
  email_confirm: true,
});
if (duenoError) throw duenoError;
await admin.from('profiles').insert({ id: duenoUser.user.id, salon_id: salon.id, role: 'DUENO', nombre: 'Dueño Demo' });
console.log('dueño demo creado:', duenoUser.user.email);

const { data: anaDemo } = await admin
  .from('peluqueros')
  .insert({ salon_id: salon.id, local_id: localCentro.id, nombre: 'Ana Demo', comision: 40, fecha_ingreso: '2024-03-01', telefono: '11-5555-0001' })
  .select()
  .single();

const { data: peluqueroUser, error: peluqueroError } = await admin.auth.admin.createUser({
  email: 'peluquerodemo@gmail.com',
  password: 'Demo123',
  email_confirm: true,
});
if (peluqueroError) throw peluqueroError;
await admin.from('profiles').insert({
  id: peluqueroUser.user.id,
  salon_id: salon.id,
  role: 'PELUQUERO',
  peluquero_id: anaDemo.id,
  nombre: 'Ana Demo',
});
await admin.from('peluqueros').update({ auth_user_id: peluqueroUser.user.id, email: 'peluquerodemo@gmail.com' }).eq('id', anaDemo.id);
console.log('peluquero demo creado:', peluqueroUser.user.email, '-> ligado a', anaDemo.nombre);

// un segundo peluquero sin login, solo para que el ranking/comparativa se vea real
const { data: brunoDemo } = await admin
  .from('peluqueros')
  .insert({ salon_id: salon.id, local_id: localNorte.id, nombre: 'Bruno Demo', comision: 40, fecha_ingreso: '2024-06-15', telefono: '11-5555-0002' })
  .select()
  .single();

console.log('\n=== 4. Sembrando cortes de los últimos 7 días ===');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const cortesDef = [
  { dias: 0, local: localCentro, pel: anaDemo, serv: servicios[1], hora: '10:15', pago: 'efectivo' },
  { dias: 0, local: localNorte, pel: brunoDemo, serv: servicios[3], hora: '11:30', pago: 'transferencia' },
  { dias: 1, local: localCentro, pel: anaDemo, serv: servicios[0], hora: '09:45', pago: 'efectivo' },
  { dias: 1, local: localNorte, pel: brunoDemo, serv: servicios[4], hora: '15:00', pago: 'transferencia' },
  { dias: 2, local: localCentro, pel: anaDemo, serv: servicios[2], hora: '17:20', pago: 'efectivo' },
  { dias: 2, local: localNorte, pel: brunoDemo, serv: servicios[3], hora: '12:00', pago: 'transferencia' },
  { dias: 3, local: localCentro, pel: anaDemo, serv: servicios[1], hora: '16:10', pago: 'efectivo' },
  { dias: 4, local: localNorte, pel: brunoDemo, serv: servicios[0], hora: '14:30', pago: 'transferencia' },
  { dias: 5, local: localCentro, pel: anaDemo, serv: servicios[3], hora: '10:50', pago: 'efectivo' },
  { dias: 6, local: localNorte, pel: brunoDemo, serv: servicios[2], hora: '11:00', pago: 'transferencia' },
];
for (const c of cortesDef) {
  await admin.from('cortes').insert({
    salon_id: salon.id,
    local_id: c.local.id,
    peluquero_id: c.pel.id,
    servicio_id: c.serv.id,
    fecha: daysAgo(c.dias),
    hora: c.hora,
    precio: c.serv.precio,
    descuento: 0,
    monto: c.serv.precio,
    pago: c.pago,
    created_by: duenoUser.user.id,
  });
}
console.log('cortes creados:', cortesDef.length);

console.log('\n=== 5. Sembrando inventario demo ===');
const productosDef = [
  { nombre: 'Cera fijadora', categoria: 'Styling', stock: 10, unidad: 'unidades', stock_minimo: 3 },
  { nombre: 'Pomada mate', categoria: 'Styling', stock: 8, unidad: 'unidades', stock_minimo: 2 },
  { nombre: 'Navaja descartable', categoria: 'Insumos', stock: 50, unidad: 'unidades', stock_minimo: 20 },
  { nombre: 'Tintura negro', categoria: 'Color', stock: 2, unidad: 'unidades', stock_minimo: 2 },
];
for (const p of productosDef) {
  await admin.from('productos').insert({ salon_id: salon.id, ...p });
}
console.log('productos creados:', productosDef.length);

console.log('\n✅ Listo. Accesos demo:');
console.log('  Dueño:     duenodemo@gmail.com / Demo123');
console.log('  Peluquero: peluquerodemo@gmail.com / Demo123');
