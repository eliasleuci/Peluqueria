import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { cortesOfMonth, currentMonthKey, sumMonto } from '../utils/stats';

function emptyPeluquero(localId) {
  return { nombre: '', localId, comision: 40, fechaIngreso: '', telefono: '', email: '' };
}

export default function Peluqueros() {
  const { data, activeLocal, addPeluquero, updatePeluquero, deletePeluquero, crearAccesoPeluquero } = useApp();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const localesActivos = data.locales.filter((l) => l.activo);
  const [form, setForm] = useState(() => emptyPeluquero(localesActivos[0]?.id ?? ''));
  const [selected, setSelected] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [credenciales, setCredenciales] = useState(null);
  const [accesoEmail, setAccesoEmail] = useState('');
  const [creandoAcceso, setCreandoAcceso] = useState(false);

  const peluquerosActivos = data.peluqueros.filter((p) => p.activo);
  const scopedPeluqueros =
    activeLocal === 'all' ? peluquerosActivos : peluquerosActivos.filter((p) => String(p.localId) === String(activeLocal));

  const monthKey = currentMonthKey(0);

  function metricsFor(peluquero) {
    const suyos = cortesOfMonth(
      data.cortes.filter((c) => c.peluqueroId === peluquero.id),
      monthKey
    );
    const monto = sumMonto(suyos);
    const porServicio = {};
    for (const c of suyos) {
      porServicio[c.servicioId] = (porServicio[c.servicioId] || 0) + 1;
    }
    const servicioTopId = Object.entries(porServicio).sort((a, b) => b[1] - a[1])[0]?.[0];
    const servicioTop = data.servicios.find((s) => s.id === servicioTopId)?.nombre ?? '—';
    return { cortes: suyos, cantidad: suyos.length, monto, servicioTop };
  }

  function localName(id) {
    return data.locales.find((l) => l.id === id)?.nombre ?? '—';
  }

  function openNewModal() {
    setEditTarget(null);
    setForm(emptyPeluquero(localesActivos[0]?.id ?? ''));
    setShowModal(true);
  }

  function openEditModal(peluquero) {
    setEditTarget(peluquero);
    setForm({
      nombre: peluquero.nombre,
      localId: String(peluquero.localId),
      comision: peluquero.comision,
      fechaIngreso: peluquero.fechaIngreso || '',
      telefono: peluquero.telefono || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.localId) return;
    const patch = {
      nombre: form.nombre.trim(),
      localId: form.localId,
      comision: Number(form.comision) || 0,
      fechaIngreso: form.fechaIngreso,
      telefono: form.telefono,
    };
    try {
      if (editTarget) {
        await updatePeluquero(editTarget.id, patch);
        setSelected((prev) => (prev && prev.id === editTarget.id ? { ...prev, ...patch } : prev));
        showToast('✓ Peluquero actualizado');
        setShowModal(false);
        setEditTarget(null);
        setForm(emptyPeluquero(localesActivos[0]?.id ?? ''));
      } else {
        const creado = await addPeluquero(patch);
        showToast('✓ Peluquero agregado');
        setShowModal(false);
        setForm(emptyPeluquero(localesActivos[0]?.id ?? ''));
        if (form.email.trim()) {
          const cred = await crearAccesoPeluquero(creado.id, form.email.trim());
          setCredenciales(cred);
        }
      }
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleCrearAcceso() {
    if (!accesoEmail.trim()) return;
    setCreandoAcceso(true);
    try {
      const cred = await crearAccesoPeluquero(selected.id, accesoEmail.trim());
      setCredenciales(cred);
      setAccesoEmail('');
      setSelected((prev) => (prev ? { ...prev, authUserId: 'activo', email: accesoEmail.trim() } : prev));
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setCreandoAcceso(false);
    }
  }

  async function handleDelete() {
    try {
      await deletePeluquero(toDelete.id);
      showToast('✓ Peluquero eliminado');
      setToDelete(null);
      setSelected(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={openNewModal}>
          + Nuevo peluquero
        </button>
      </div>

      <div className="grid grid-3">
        {scopedPeluqueros.map((p) => {
          const m = metricsFor(p);
          const meta = data.config.metaPeluquero || 1;
          const pct = Math.min(100, (m.monto / meta) * 100);
          return (
            <div
              className="card"
              key={p.id}
              style={{ cursor: 'pointer', position: 'relative' }}
              onClick={() => {
                setSelected(p);
                setAccesoEmail('');
              }}
            >
              <button
                className="modal-close"
                style={{ position: 'absolute', top: 12, right: 12 }}
                title="Eliminar peluquero"
                onClick={(e) => {
                  e.stopPropagation();
                  setToDelete(p);
                }}
              >
                ×
              </button>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <Avatar name={p.nombre} size={48} />
                <div>
                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                  <div className="hint">{localName(p.localId)}</div>
                </div>
              </div>
              <div className="stack-gap" style={{ gap: 6, marginBottom: 12 }}>
                <div className="flex-between">
                  <span className="hint">Cortes del mes</span>
                  <strong>{m.cantidad}</strong>
                </div>
                <div className="flex-between">
                  <span className="hint">Ingresos generados</span>
                  <strong>{formatCurrency(m.monto)}</strong>
                </div>
                <div className="flex-between">
                  <span className="hint">Servicio más frecuente</span>
                  <span>{m.servicioTop}</span>
                </div>
              </div>
              <div>
                <div className="flex-between hint" style={{ marginBottom: 4 }}>
                  <span>Meta mensual</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
        {scopedPeluqueros.length === 0 && <p className="text-secondary">No hay peluqueros en este local.</p>}
      </div>

      {showModal && (
        <Modal
          title={editTarget ? 'Editar peluquero' : 'Nuevo peluquero'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                Guardar
              </button>
            </>
          }
        >
          <form className="stack-gap" onSubmit={handleSubmit}>
            <div className="field">
              <label>Nombre completo</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Local asignado</label>
              <select value={form.localId} onChange={(e) => setForm({ ...form, localId: e.target.value })}>
                {localesActivos.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Comisión (%)</label>
                <input
                  type="number"
                  value={form.comision}
                  onChange={(e) => setForm({ ...form, comision: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Fecha de ingreso</label>
                <input
                  type="date"
                  value={form.fechaIngreso}
                  onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Teléfono (opcional)</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            {!editTarget && (
              <div className="field">
                <label>Email (opcional — si lo completás, le creamos el acceso al sistema)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            )}
          </form>
        </Modal>
      )}

      {credenciales && (
        <Modal
          title="✓ Acceso creado"
          onClose={() => setCredenciales(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setCredenciales(null)}>
              Listo
            </button>
          }
        >
          <p className="hint" style={{ marginBottom: 12 }}>
            Pasale estos datos al peluquero para que entre desde su celular. Esta contraseña no se vuelve a mostrar.
          </p>
          <div className="stack-gap" style={{ gap: 10 }}>
            <div className="field">
              <label>Usuario</label>
              <input readOnly value={credenciales.email} />
            </div>
            <div className="field">
              <label>Contraseña provisoria</label>
              <input readOnly value={credenciales.password} style={{ color: 'var(--gold)', fontWeight: 700 }} />
            </div>
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="¿Eliminar peluquero?"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Sí, eliminar
              </button>
            </>
          }
        >
          <p>
            Se eliminará a <strong>{toDelete.nombre}</strong>. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}

      {selected && (
        <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="drawer-box">
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar name={selected.nombre} size={48} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.nombre}</div>
                  <div className="hint">{localName(selected.localId)}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Acceso al sistema</div>
              {selected.authUserId ? (
                <div className="flex-between">
                  <span className="hint">{selected.email || 'Login activo'}</span>
                  <span className="badge badge-green">Activo</span>
                </div>
              ) : (
                <div className="stack-gap" style={{ gap: 10 }}>
                  <p className="hint">Todavía no tiene acceso. Creale un login para que pueda entrar desde su celular.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      placeholder="email@ejemplo.com"
                      value={accesoEmail}
                      onChange={(e) => setAccesoEmail(e.target.value)}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handleCrearAcceso} disabled={creandoAcceso}>
                      {creandoAcceso ? 'Creando…' : 'Crear acceso'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <DrawerContent peluquero={selected} data={data} metricsFor={metricsFor} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEditModal(selected)}>
                Editar
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setToDelete(selected)}>
                Eliminar peluquero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerContent({ peluquero, data, metricsFor }) {
  const m = metricsFor(peluquero);
  const comisionMonto = m.monto * ((peluquero.comision || 0) / 100);
  const porServicio = {};
  for (const c of m.cortes) {
    porServicio[c.servicioId] = (porServicio[c.servicioId] || 0) + 1;
  }
  const servicioName = (id) => data.servicios.find((s) => s.id === id)?.nombre ?? '—';

  return (
    <div className="stack-gap">
      <div className="card">
        <div className="card-title">Comisión del mes</div>
        <div className="flex-between">
          <span className="hint">
            {formatCurrency(m.monto)} × {peluquero.comision}%
          </span>
          <strong style={{ color: 'var(--gold)', fontSize: 18 }}>{formatCurrency(comisionMonto)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Resumen por servicio</div>
        <div className="stack-gap" style={{ gap: 8 }}>
          {Object.entries(porServicio)
            .sort((a, b) => b[1] - a[1])
            .map(([sid, count]) => (
              <div className="flex-between" key={sid}>
                <span>{servicioName(sid)}</span>
                <span className="hint">{count} veces</span>
              </div>
            ))}
          {Object.keys(porServicio).length === 0 && <p className="text-secondary">Sin registros este mes.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Historial del mes</div>
        <div className="table-wrap">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {[...m.cortes]
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map((c) => (
                  <tr key={c.id}>
                    <td data-label="Fecha">{formatDate(c.fecha)}</td>
                    <td data-label="Servicio">{servicioName(c.servicioId)}</td>
                    <td data-label="Monto">{formatCurrency(c.monto)}</td>
                  </tr>
                ))}
              {m.cortes.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-secondary">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
