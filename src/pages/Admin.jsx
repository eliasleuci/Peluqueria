import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, extractFunctionError } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import CredencialesModal from '../components/CredencialesModal';

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
  const [subiendoId, setSubiendoId] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);
  const [toReset, setToReset] = useState(null);
  const [reseteando, setReseteando] = useState(false);
  const [credReset, setCredReset] = useState(null);

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

  async function handleLogo(salon, file) {
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      showToast('El logo debe ser una imagen PNG o JPG cuadrada.', 'error');
      return;
    }
    setSubiendoId(salon.id);
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${salon.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
      const logoUrl = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: updErr } = await supabase.from('salones').update({ logo_url: logoUrl }).eq('id', salon.id);
      if (updErr) throw updErr;
      showToast('✓ Logo actualizado');
      await cargarSalones();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setSubiendoId(null);
    }
  }

  async function copiarUrl(salon) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${salon.slug}`);
      setCopiadoId(salon.id);
      setTimeout(() => setCopiadoId((c) => (c === salon.id ? null : c)), 1500);
    } catch {
      showToast('No se pudo copiar.', 'error');
    }
  }

  async function handleResetDueno() {
    setReseteando(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('reset-dueno-password', {
        body: { salonId: toReset.id },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError));
      if (data?.error) throw new Error(data.error);
      setToReset(null);
      setCredReset(data);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setReseteando(false);
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
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: 'var(--surface-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    🏪
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{s.nombre}</div>
                  <div className="hint">Alta: {new Date(s.created_at).toLocaleDateString('es-AR')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
                    <code
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      /p/{s.slug}
                    </code>
                    <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => copiarUrl(s)}>
                      {copiadoId === s.id ? '✓ Copiado' : 'Copiar link'}
                    </button>
                  </div>
                </div>
                <Badge color={s.activo ? 'green' : 'yellow'}>{s.activo ? 'Activo' : 'Pausado'}</Badge>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    {subiendoId === s.id ? 'Subiendo…' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      disabled={subiendoId === s.id}
                      onChange={(e) => {
                        handleLogo(s, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button className="btn btn-secondary btn-sm" onClick={() => setToReset(s)}>
                    Nueva clave del dueño
                  </button>
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
        <CredencialesModal title="✓ Cliente creado" credenciales={credenciales} onClose={() => setCredenciales(null)} />
      )}

      {credReset && (
        <CredencialesModal
          title="✓ Nueva contraseña del dueño"
          credenciales={credReset}
          onClose={() => setCredReset(null)}
        />
      )}

      {toReset && (
        <Modal
          title="¿Generar nueva contraseña?"
          width={420}
          onClose={() => setToReset(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setToReset(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleResetDueno} disabled={reseteando}>
                {reseteando ? 'Generando…' : 'Sí, generar'}
              </button>
            </>
          }
        >
          <p>
            Se va a generar una contraseña nueva para el dueño de <strong>{toReset.nombre}</strong>. La contraseña
            actual deja de funcionar. Después te la mostramos para que se la pases.
          </p>
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
