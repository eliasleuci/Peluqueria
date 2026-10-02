import { useState } from 'react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/format';
import { precioServicioEnLocal } from '../utils/precios';
import { pctComisionCorte, pctComisionVigente } from '../utils/stats';

// Editar o borrar un corte ya registrado (para corregir errores).
// El dueño puede cambiar también el peluquero; el peluquero solo sus propios cortes (RLS).
export default function EditarCorteModal({ corte, onClose }) {
  const { data, updateCorte, deleteCorte } = useApp();
  const { role } = useAuth();
  const { showToast } = useToast();
  const esDueno = role === 'DUENO' || role === 'SUPER_ADMIN';

  const [form, setForm] = useState({
    peluqueroId: corte.peluqueroId,
    servicioId: corte.servicioId,
    precio: corte.monto,
    pago: corte.pago,
    fecha: corte.fecha,
    hora: corte.hora,
  });
  const [guardando, setGuardando] = useState(false);
  const [usarPctVigente, setUsarPctVigente] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const peluquero = data.peluqueros.find((p) => p.id === form.peluqueroId);
  const localId = peluquero?.localId ?? corte.localId;
  const servicios = data.servicios.filter((s) => s.activo || s.id === corte.servicioId);
  const peluquerosElegibles = data.peluqueros.filter((p) => p.activo || p.id === corte.peluqueroId);
  const precio = Number(form.precio) || 0;

  // Comisión: queda congelada en el corte. Si cambia el servicio o el peluquero se recalcula con
  // el % vigente; si no, se mantiene, salvo que se pida actualizarla a mano.
  const cambioServicioOPeluquero = form.servicioId !== corte.servicioId || form.peluqueroId !== corte.peluqueroId;
  const pctCongelado = pctComisionCorte(corte, data.peluqueros.find((p) => p.id === corte.peluqueroId), data.servicios);
  const pctVigente = pctComisionVigente(form.servicioId, peluquero, data.servicios);
  const pctFinal = cambioServicioOPeluquero || usarPctVigente ? pctVigente : pctCongelado;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  function cambiarServicio(id) {
    const s = data.servicios.find((x) => x.id === id);
    update({ servicioId: id, precio: s ? precioServicioEnLocal(s, localId) : form.precio });
  }

  async function guardar() {
    if (!form.servicioId || precio <= 0 || !form.fecha || !form.hora) {
      showToast('Completá servicio, precio, fecha y hora.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const patch = {
        servicioId: form.servicioId,
        precio,
        descuento: 0,
        monto: precio,
        pago: form.pago,
        fecha: form.fecha,
        hora: form.hora,
      };
      if (usarPctVigente && !cambioServicioOPeluquero) patch.comisionPct = pctVigente;
      if (esDueno && form.peluqueroId !== corte.peluqueroId) {
        patch.peluqueroId = form.peluqueroId;
        patch.localId = localId;
      }
      await updateCorte(corte.id, patch);
      showToast('✓ Corte actualizado');
      onClose();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    setGuardando(true);
    try {
      await deleteCorte(corte.id);
      showToast('✓ Corte eliminado');
      onClose();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
      setGuardando(false);
    }
  }

  if (confirmarBorrado) {
    return (
      <Modal
        title="¿Eliminar corte?"
        onClose={() => setConfirmarBorrado(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmarBorrado(false)} disabled={guardando}>
              Volver
            </button>
            <button className="btn btn-danger" onClick={borrar} disabled={guardando}>
              {guardando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }
      >
        <p>
          Se eliminará el corte de <strong>{data.peluqueros.find((p) => p.id === corte.peluqueroId)?.nombre ?? '—'}</strong>{' '}
          del {formatDate(corte.fecha)} a las {corte.hora} por <strong>{formatCurrency(corte.monto)}</strong>. Deja de
          contar en la facturación y las comisiones. No se puede deshacer.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Editar corte"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={() => setConfirmarBorrado(true)}
            disabled={guardando}
          >
            Eliminar
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="stack-gap">
        <div className="field">
          <label>Peluquero</label>
          {esDueno ? (
            <select value={form.peluqueroId} onChange={(e) => update({ peluqueroId: e.target.value })}>
              {peluquerosElegibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input readOnly value={peluquero?.nombre ?? ''} />
          )}
        </div>

        <div className="field">
          <label>Servicio</label>
          <select value={form.servicioId} onChange={(e) => cambiarServicio(e.target.value)}>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} — {formatCurrency(precioServicioEnLocal(s, localId))}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Precio</label>
          <input type="number" min="0" value={form.precio} onChange={(e) => update({ precio: e.target.value })} />
        </div>

        <div className="field">
          <label>Forma de pago</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-btn ${form.pago === 'efectivo' ? 'active' : ''}`}
              onClick={() => update({ pago: 'efectivo' })}
            >
              Efectivo
            </button>
            <button
              type="button"
              className={`toggle-btn ${form.pago === 'transferencia' ? 'active' : ''}`}
              onClick={() => update({ pago: 'transferencia' })}
            >
              Transferencia
            </button>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--surface-elevated)', padding: 14 }}>
          <div className="flex-between" style={{ gap: 8 }}>
            <span className="hint">Comisión de este trabajo</span>
            <strong style={{ color: 'var(--accent)' }}>
              {pctFinal}% · {formatCurrency((precio * pctFinal) / 100)}
            </strong>
          </div>
          {cambioServicioOPeluquero ? (
            <p className="hint" style={{ marginTop: 6 }}>Se recalcula con el % vigente porque cambiaste el servicio o el peluquero.</p>
          ) : pctVigente !== pctCongelado ? (
            <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={usarPctVigente}
                onChange={(e) => setUsarPctVigente(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Quedó registrado con {pctCongelado}%. Actualizar al % vigente ({pctVigente}%)
            </label>
          ) : (
            <p className="hint" style={{ marginTop: 6 }}>Quedó registrada al hacer el trabajo y no cambia si después se modifica el %.</p>
          )}
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => update({ fecha: e.target.value })} />
          </div>
          <div className="field">
            <label>Hora</label>
            <input type="time" value={form.hora} onChange={(e) => update({ hora: e.target.value })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
