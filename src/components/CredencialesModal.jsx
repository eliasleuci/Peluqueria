import { useState } from 'react';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

// Muestra usuario + contraseña provisoria con botones de copiar. No se cierra al tocar afuera
// (la contraseña se muestra una sola vez). Opcional: `salonNombre` para el mensaje a enviar.
export default function CredencialesModal({ title, credenciales, onClose }) {
  const { showToast } = useToast();
  const [copiado, setCopiado] = useState('');

  async function copiar(texto, key) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(key);
      showToast('✓ Copiado');
      setTimeout(() => setCopiado((c) => (c === key ? '' : c)), 1500);
    } catch {
      showToast('No se pudo copiar. Copialo a mano.', 'error');
    }
  }

  const mensaje = [
    credenciales.salonNombre ? `Acceso a ${credenciales.salonNombre}:` : 'Acceso a tu cuenta:',
    `Usuario: ${credenciales.email}`,
    `Contraseña: ${credenciales.password}`,
    `Entrá desde: ${window.location.origin}`,
    'Te recomendamos cambiar la contraseña al ingresar.',
  ].join('\n');

  return (
    <Modal
      title={title}
      width={460}
      closeOnOverlay={false}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-primary" onClick={() => copiar(mensaje, 'todo')}>
            {copiado === 'todo' ? '✓ Copiado' : 'Copiar para enviar'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Listo
          </button>
        </>
      }
    >
      <div className="alert-banner" style={{ marginBottom: 14 }}>
        Guardá o copiá estos datos ahora. La contraseña no se vuelve a mostrar.
      </div>
      <div className="stack-gap" style={{ gap: 12 }}>
        {credenciales.salonNombre && (
          <div className="field">
            <label>Peluquería</label>
            <input readOnly value={credenciales.salonNombre} />
          </div>
        )}
        <div className="field">
          <label>Usuario</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={credenciales.email} style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={() => copiar(credenciales.email, 'email')}>
              {copiado === 'email' ? '✓' : 'Copiar'}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Contraseña provisoria</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={credenciales.password}
              style={{ flex: 1, color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => copiar(credenciales.password, 'pass')}>
              {copiado === 'pass' ? '✓' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
