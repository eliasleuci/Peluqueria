import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { rutasPermitidas } from '../config/permisos';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { role, salon, profile } = useAuth();
  const permitidas = rutasPermitidas(role);
  const items = NAV_ITEMS.filter((item) => permitidas.includes(item.key));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span>✂️</span>
        <span className="label brand-text">
          <span className="brand-name">{salon?.nombre ?? 'MiPeluquería'}</span>
          <span className="brand-tagline">{profile?.nombre}</span>
        </span>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
