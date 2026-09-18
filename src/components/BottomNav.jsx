import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { rutasPermitidas } from '../config/permisos';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { role } = useAuth();
  const permitidas = rutasPermitidas(role);
  const items = NAV_ITEMS.filter((item) => permitidas.includes(item.key));

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label.split(' ')[0]}</span>
        </NavLink>
      ))}
    </nav>
  );
}
