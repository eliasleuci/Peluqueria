import {
  LayoutDashboard,
  Scissors,
  ShoppingBag,
  Clock,
  Wallet,
  CalendarDays,
  Users,
  ClipboardCheck,
  SprayCan,
  Settings,
} from 'lucide-react';

// label: título completo (sidebar y topbar). short: etiqueta corta y única para la barra inferior del celular.
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Panel de control', short: 'Panel', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'registrar', label: 'Registrar corte', short: 'Corte', icon: Scissors, path: '/registrar' },
  { key: 'registrarventa', label: 'Registrar venta', short: 'Venta', icon: ShoppingBag, path: '/registrar-venta' },
  { key: 'mihorario', label: 'Mi horario', short: 'Horario', icon: Clock, path: '/mi-horario' },
  { key: 'misfinanzas', label: 'Mis finanzas', short: 'Finanzas', icon: Wallet, path: '/mis-finanzas' },
  { key: 'agenda', label: 'Agenda del día', short: 'Agenda', icon: CalendarDays, path: '/agenda' },
  { key: 'peluqueros', label: 'Peluqueros', short: 'Equipo', icon: Users, path: '/peluqueros' },
  { key: 'asistencias', label: 'Asistencias', short: 'Asistencia', icon: ClipboardCheck, path: '/asistencias' },
  { key: 'inventario', label: 'Inventario', short: 'Stock', icon: SprayCan, path: '/inventario' },
  { key: 'configuracion', label: 'Configuración', short: 'Ajustes', icon: Settings, path: '/configuracion' },
];
