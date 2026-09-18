import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, extractFunctionError } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

function emptyForm() {
  return { salonNombre: '', duenoNombre: '', duenoEmail: '' };
}

export default function Admin() {
  const { signOut, profile } = useAuth();
  const { showToast } = useToast();
  const [salones, setSalones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [credenciales, setCredenciales] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const cargarSalones = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('salones').select('*').order('created_at', { ascending: false });
    setSalones(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarSalones();
  }, [cargarSalones]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.salonNombre.trim() || !form.duenoEmail.trim()) return;
    setCreando(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-salon', {
        body: {
          salonNombre: form.salonNombre.trim(),
          duenoEmail: form.duenoEmail.trim(),
          duenoNombre: form.duenoNombre.trim(),
        },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError));
      if (data?.error) throw new Error(data.error);
      setCredenciales(data);
      setForm(emptyForm());
      await cargarSalones();
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setCreando(false);
    }
  }

  async function handleToggleActivo(salon) {
    setBusyId(salon.id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('toggle-salon-status', {
        body: { salonId: salon.id, activo: !salon.activo },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError));
      if (data?.error) throw new Error(data.error);
      showToast(salon.activo ? '✓ Cliente pausado' : '✓ Cliente reactivado');
      await cargarSalones();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('delete-salon', {
        body: { salonId: toDelete.id },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError));
      if (data?.error) throw new Error(data.error);
      showToast('✓ Cliente eliminado');
      setToDelete(null);
      await cargarSalones();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Panel de administración</h1>
          <p className="hint">{profile?.nombre}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setShowChangePassword(true)}>
            Cambiar contraseña
          </button>
          <button className="btn btn-ghost" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <div className="stack-gap">
        <div className="card">
          <div className="card-title">Nuevo cliente</div>
          <form className="stack-gap" onSubmit={handleSubmit}>
            <div className="grid grid-3">
              <div className="field">
                <label>Nombre de la peluquería</label>
                <input
                  value={form.salonNombre}
                  onChange={(e) => setForm({ ...form, salonNombre: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nombre del dueño</label>
                <input
                  value={form.duenoNombre}
                  onChange={(e) => setForm({ ...form, duenoNombre: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Email del dueño</label>
                <input
                  type="email"
                  value={form.duenoEmail}
                  onChange={(e) => setForm({ ...form, duenoEmail: e.target.value })}
                />
              </div>
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={creando} style={{ alignSelf: 'flex-start' }}>
              {creando ? 'Creando…' : 'Crear cliente'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Clientes ({salones.length})</div>
          {loading && <p className="text-secondary">Cargando…</p>}
          <div className="stack-gap">
            {salones.map((s) => (
              <div key={s.id} className="list-item-card" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{s.nombre}</div>
                  <div className="hint">Alta: {new Date(s.created_at).toLocaleDateString('es-AR')}</div>
                </div>
                <Badge color={s.activo ? 'green' : 'yellow'}>{s.activo ? 'Activo' : 'Pausado'}</Badge>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === s.id}
                    onClick={() => handleToggleActivo(s)}
                  >
                    {busyId === s.id ? '...' : s.activo ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setToDelete(s)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {!loading && salones.length === 0 && <p className="text-secondary">Todavía no hay clientes.</p>}
          </div>
        </div>
      </div>

      {credenciales && (
        <Modal
          title="✓ Cliente creado"
          width={420}
          onClose={() => setCredenciales(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setCredenciales(null)}>
              Listo
            </button>
          }
        >
          <p className="hint" style={{ marginBottom: 12 }}>
            Pasale estos datos al dueño para que entre por primera vez. Esta contraseña no se vuelve a mostrar.
          </p>
          <div className="stack-gap" style={{ gap: 10 }}>
            <div className="field">
              <label>Peluquería</label>
              <input readOnly value={credenciales.salonNombre} />
            </div>
            <div className="field">
              <label>Usuario</label>
              <input readOnly value={credenciales.email} />
            </div>
            <div className="field">
              <label>Contraseña provisoria</label>
              <input readOnly value={credenciales.password} style={{ color: 'var(--accent)', fontWeight: 700 }} />
            </div>
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="¿Eliminar cliente?"
          width={420}
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Sí, eliminar todo'}
              </button>
            </>
          }
        >
          <p>
            Se eliminará <strong>{toDelete.nombre}</strong> por completo: sus locales, peluqueros, cortes,
            inventario y todos los accesos (dueño y peluqueros). Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}
