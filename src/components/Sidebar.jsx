import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { rutasPermitidas } from '../config/permisos';
import { useAuth } from '../context/AuthContext';
import { Scissors } from 'lucide-react';

export default function Sidebar() {
  const { role, salon, profile } = useAuth();
  const permitidas = rutasPermitidas(role);
  const items = NAV_ITEMS.filter((item) => permitidas.includes(item.key));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        {salon?.logoUrl ? (
          <img
            src={salon.logoUrl}
            alt=""
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span className="brand-icon">
            <Scissors size={20} strokeWidth={2} />
          </span>
        )}
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
            <span className="icon">
              <item.icon size={20} strokeWidth={1.8} />
            </span>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
