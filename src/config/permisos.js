// Mapa único rol -> rutas permitidas. Se usa tanto en el router (niega por defecto)
// como en Sidebar/BottomNav (solo muestran lo que el rol puede ver).
export const PERMISOS = {
  SUPER_ADMIN: ['admin'],
  DUENO: ['dashboard', 'registrar', 'agenda', 'peluqueros', 'inventario', 'configuracion'],
  PELUQUERO: ['registrar'],
};

export function rutasPermitidas(role) {
  return PERMISOS[role] ?? [];
}

export function puedeVer(role, routeKey) {
  return rutasPermitidas(role).includes(routeKey);
}

// Ruta a la que se manda a cada rol apenas loguea (o si intenta entrar a algo que no le corresponde).
export function rutaPorDefecto(role) {
  if (role === 'SUPER_ADMIN') return '/admin';
  if (role === 'DUENO') return '/dashboard';
  if (role === 'PELUQUERO') return '/registrar';
  return '/login';
}
