import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { toDateKey, nowTimeKey, formatCurrency } from '../utils/format';
import { precioServicioEnLocal } from '../utils/precios';
import { pctComisionVigente } from '../utils/stats';

function emptyForm(peluqueroId) {
  return {
    fecha: toDateKey(new Date()),
    peluqueroId: peluqueroId ?? '',
    servicioId: '',
    precio: '',
    pago: 'efectivo',
  };
}

export default function RegistrarCorte() {
  const { data, activeLocal, addCorte } = useApp();
  const { role, profile } = useAuth();
  const { showToast } = useToast();
  const esPeluquero = role === 'PELUQUERO';
  const miPeluqueroId = esPeluquero ? profile?.peluqueroId ?? '' : '';

  const [form, setForm] = useState(() => emptyForm(miPeluqueroId));
  const [errors, setErrors] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Ref además del estado: bloquea un doble toque antes de que React vuelva a renderizar.
  const enviandoRef = useRef(false);

  const peluquerosActivos = data.peluqueros.filter(
    (p) => p.activo && (activeLocal === 'all' || String(p.localId) === String(activeLocal)),
  );
  const serviciosActivos = data.servicios.filter((s) => s.activo);
  const peluquero = data.peluqueros.find((p) => p.id === form.peluqueroId);
  const local = data.locales.find((l) => l.id === peluquero?.localId);
  const precio = Number(form.precio) || 0;
  const servicioElegido = data.servicios.find((s) => s.id === form.servicioId);
  const pctComision = servicioElegido ? pctComisionVigente(servicioElegido.id, peluquero, data.servicios) : 0;

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleServicioChange(id) {
    const servicio = data.servicios.find((s) => s.id === id);
    update({ servicioId: id, precio: servicio ? precioServicioEnLocal(servicio, local?.id) : form.precio });
  }

  // Al cambiar el peluquero cambia el local, así que recalculamos el precio del servicio
  // ya elegido para ese local (evita que quede el precio de otro local).
  function handlePeluqueroChange(pid) {
    const nuevoPeluquero = data.peluqueros.find((p) => p.id === pid);
    const nuevoLocal = data.locales.find((l) => l.id === nuevoPeluquero?.localId);
    const servicio = data.servicios.find((s) => s.id === form.servicioId);
    update({
      peluqueroId: pid,
      precio: servicio ? precioServicioEnLocal(servicio, nuevoLocal?.id) : form.precio,
    });
  }

  function validate() {
    const e = {};
    if (!form.fecha) e.fecha = true;
    if (!form.peluqueroId) e.peluqueroId = true;
    if (form.peluqueroId && !local) e.local = true;
    if (!form.servicioId) e.servicioId = true;
    if (precio <= 0) e.precio = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (enviandoRef.current || !validate()) return;
    enviandoRef.current = true;
    setGuardando(true);
    try {
      await addCorte({
        localId: local.id,
        fecha: form.fecha,
        hora: nowTimeKey(),
        peluqueroId: form.peluqueroId,
        servicioId: form.servicioId,
        precio,
        descuento: 0,
        monto: precio,
        pago: form.pago,
        notas: '',
      });
      showToast(`✓ Corte registrado — ${formatCurrency(precio)}`);
      setForm(emptyForm(esPeluquero ? miPeluqueroId : form.peluqueroId));
    } catch (err) {
      showToast(`Error al guardar: ${err.message ?? err}`, 'error');
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  const required = <span style={{ color: 'var(--red)' }}>*</span>;

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <form className="stack-gap" onSubmit={handleSubmit}>
        <div className="grid grid-2">
          <div className="field">
            <label>Peluquero {errors.peluqueroId && required}</label>
            {esPeluquero ? (
              <input readOnly value={peluquero?.nombre ?? profile?.nombre ?? ''} />
            ) : (
              <select value={form.peluqueroId} onChange={(e) => handlePeluqueroChange(e.target.value)}>
                <option value="">Seleccionar…</option>
                {peluquerosActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="field">
            <label>Local</label>
            <input readOnly value={local?.nombre ?? ''} placeholder={esPeluquero ? '' : 'Según el peluquero'} />
          </div>
        </div>
        {errors.local && (
          <p style={{ color: 'var(--red)', fontSize: 13 }}>
            Este peluquero no tiene una sucursal asignada. Asignale una desde Peluqueros.
          </p>
        )}

        <div className="field">
          <label>Fecha</label>
          <input type="date" value={form.fecha} onChange={(e) => update({ fecha: e.target.value })} />
        </div>

        <div className="field">
          <label>Servicio {errors.servicioId && required}</label>
          <select value={form.servicioId} onChange={(e) => handleServicioChange(e.target.value)}>
            <option value="">Seleccionar…</option>
            {serviciosActivos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} — {formatCurrency(precioServicioEnLocal(s, local?.id))}
              </option>
            ))}
          </select>
          {servicioElegido && (
            <span className="hint">
              Comisión: {pctComision}%
              {servicioElegido.comisionPct != null ? ' (servicio especial)' : ''} · {formatCurrency((precio * pctComision) / 100)}
            </span>
          )}
        </div>

        <div className="field">
          <label>Precio {errors.precio && required}</label>
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
              💵 Efectivo
            </button>
            <button
              type="button"
              className={`toggle-btn ${form.pago === 'transferencia' ? 'active' : ''}`}
              onClick={() => update({ pago: 'transferencia' })}
            >
              📲 Transferencia
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={guardando}>
          {guardando ? 'Guardando…' : <>Guardar corte · {formatCurrency(precio)}</>}
        </button>
      </form>
    </div>
  );
}
