import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { toDateKey, nowTimeKey, formatCurrency } from '../utils/format';

function emptyForm(localId, peluqueroId) {
  return {
    localId,
    fecha: toDateKey(new Date()),
    peluqueroId: peluqueroId ?? '',
    servicioId: '',
    precio: '',
    descuento: 0,
    pago: 'efectivo',
    notas: '',
  };
}

export default function RegistrarCorte() {
  const { data, activeLocal, addCorte } = useApp();
  const { role, profile } = useAuth();
  const { showToast } = useToast();
  const esPeluquero = role === 'PELUQUERO';

  const localesActivos = data.locales.filter((l) => l.activo);
  const initialLocal = activeLocal === 'all' ? localesActivos[0]?.id ?? '' : activeLocal;
  const initialPeluquero = esPeluquero ? profile?.peluqueroId ?? '' : '';

  const [form, setForm] = useState(() => emptyForm(initialLocal, initialPeluquero));
  const [errors, setErrors] = useState({});

  const peluquerosDelLocal = data.peluqueros.filter((p) => p.activo && String(p.localId) === String(form.localId));
  const serviciosActivos = data.servicios.filter((s) => s.activo);

  const precioFinal = useMemo(() => {
    const base = Number(form.precio) || 0;
    const desc = Number(form.descuento) || 0;
    return base - base * (desc / 100);
  }, [form.precio, form.descuento]);

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleServicioChange(id) {
    const servicio = data.servicios.find((s) => s.id === id);
    update({ servicioId: id, precio: servicio ? servicio.precio : form.precio });
  }

  function validate() {
    const e = {};
    if (!form.localId) e.localId = true;
    if (!form.fecha) e.fecha = true;
    if (!form.peluqueroId) e.peluqueroId = true;
    if (!form.servicioId) e.servicioId = true;
    if (!form.precio || Number(form.precio) <= 0) e.precio = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await addCorte({
        localId: form.localId,
        fecha: form.fecha,
        hora: nowTimeKey(),
        peluqueroId: form.peluqueroId,
        servicioId: form.servicioId,
        precio: Number(form.precio),
        descuento: Number(form.descuento) || 0,
        monto: precioFinal,
        pago: form.pago,
        notas: form.notas,
      });
      showToast(`✓ Corte registrado — ${formatCurrency(precioFinal)}`);
      setForm(emptyForm(form.localId, esPeluquero ? initialPeluquero : form.peluqueroId));
    } catch (err) {
      showToast(`Error al guardar: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <form className="stack-gap" onSubmit={handleSubmit}>
        <div className="grid grid-2">
          <div className="field">
            <label>Local</label>
            <select
              value={form.localId}
              onChange={(e) => update({ localId: e.target.value, peluqueroId: esPeluquero ? form.peluqueroId : '' })}
            >
              {localesActivos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          {!esPeluquero && (
            <div className="field">
              <label>Peluquero {errors.peluqueroId && <span style={{ color: 'var(--red)' }}>*</span>}</label>
              <select value={form.peluqueroId} onChange={(e) => update({ peluqueroId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {peluquerosDelLocal.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="field">
          <label>Fecha</label>
          <input type="date" value={form.fecha} onChange={(e) => update({ fecha: e.target.value })} />
        </div>

        <div className="field">
          <label>Servicio {errors.servicioId && <span style={{ color: 'var(--red)' }}>*</span>}</label>
          <select value={form.servicioId} onChange={(e) => handleServicioChange(e.target.value)}>
            <option value="">Seleccionar…</option>
            {serviciosActivos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} — {formatCurrency(s.precio)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Precio {errors.precio && <span style={{ color: 'var(--red)' }}>*</span>}</label>
            <input
              type="number"
              min="0"
              value={form.precio}
              onChange={(e) => update({ precio: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Descuento %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.descuento}
              onChange={(e) => update({ descuento: e.target.value })}
            />
          </div>
        </div>
        <p className="hint">
          Precio final: <strong style={{ color: 'var(--gold)' }}>{formatCurrency(precioFinal)}</strong>
        </p>

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

        <div className="field">
          <label>Notas (opcional)</label>
          <textarea
            placeholder="Ej: pidió fade corto"
            value={form.notas}
            onChange={(e) => update({ notas: e.target.value })}
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
          Guardar corte
        </button>
      </form>
    </div>
  );
}
