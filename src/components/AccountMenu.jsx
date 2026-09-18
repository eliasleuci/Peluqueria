import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import ChangePasswordModal from './ChangePasswordModal';

export default function AccountMenu() {
  const { profile, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <>
      <button
        className="btn btn-ghost btn-sm account-menu-trigger"
        onClick={() => setShowMenu(true)}
        aria-label="Cuenta"
        title="Cuenta"
      >
        👤
      </button>

      {showMenu && (
        <Modal title={profile?.nombre ?? 'Mi cuenta'} onClose={() => setShowMenu(false)}>
          <div className="stack-gap">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowMenu(false);
                setShowChangePassword(true);
              }}
            >
              🔑 Cambiar contraseña
            </button>
            <button className="btn btn-danger" onClick={signOut}>
              🚪 Cerrar sesión
            </button>
          </div>
        </Modal>
      )}

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}
