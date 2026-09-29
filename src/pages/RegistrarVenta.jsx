import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { toDateKey, nowTimeKey, formatCurrency } from '../utils/format';

function emptyForm(peluqueroId) {
  return {
    fecha: toDateKey(new Date()),
    peluqueroId: peluqueroId ?? '',
    productoId: '',
    cantidad: 1,
    precio: '',
    pago: 'efectivo',
  };
}

export default function RegistrarVenta() {
  const { data, activeLocal, addVenta } = useApp();
  const { role, profile } = useAuth();
  const { showToast } = useToast();
  const esPeluquero = role === 'PELUQUERO';
  const miPeluqueroId = esPeluquero ? profile?.peluqueroId ?? '' : '';

  const [form, setForm] = useState(() => emptyForm(miPeluqueroId));
  const [errors, setErrors] = useState({});

  const peluquerosActivos = data.peluqueros.filter(
    (p) => p.activo && (activeLocal === 'all' || String(p.localId) === String(activeLocal))
  );
  const peluquero = data.peluqueros.find((p) => p.id === form.peluqueroId);
  const local = data.locales.find((l) => l.id === peluquero?.localId);
  // Solo productos del local donde se vende (o compartidos entre locales).
  const disponiblesEn = (localId) => data.productos.filter((p) => !p.localId || p.localId === localId);
  const productosActivos = local ? disponiblesEn(local.id) : [];
  const producto = data.productos.find((p) => p.id === form.productoId);

  const precio = Number(form.precio) || 0;
  const cantidad = Number(form.cantidad) || 0;
  const monto = precio * cantidad;
  const comisionMonto = producto?.generaComision ? monto * ((peluquero?.comisionProducto || 0) / 100) : 0;

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  // Al cambiar de peluquero puede cambiar el local: si el producto elegido no se vende ahí, se limpia.
  function handlePeluqueroChange(pid) {
    const nuevoLocalId = data.peluqueros.find((p) => p.id === pid)?.localId;
    const sigueDisponible = disponiblesEn(nuevoLocalId).some((p) => p.id === form.productoId);
    update(sigueDisponible ? { peluqueroId: pid } : { peluqueroId: pid, productoId: '', precio: '' });
  }

  function handleProductoChange(id) {
    const p = data.productos.find((x) => x.id === id);
    update({ productoId: id, precio: p ? p.precio : form.precio });
  }

  function validate() {
    const e = {};
    if (!form.fecha) e.fecha = true;
    if (!form.peluqueroId) e.peluqueroId = true;
    if (form.peluqueroId && !local) e.local = true;
    if (!form.productoId) e.productoId = true;
    if (cantidad <= 0) e.cantidad = true;
    if (precio <= 0) e.precio = true;
    if (producto && cantidad > producto.stock) e.stock = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await addVenta({
        localId: local.id,
        peluqueroId: form.peluqueroId,
        productoId: form.productoId,
        cantidad,
        precio,
        monto,
        comisionMonto,
        pago: form.pago,
        fecha: form.fecha,
        hora: nowTimeKey(),
        notas: '',
      });
      showToast(`✓ Venta registrada — ${formatCurrency(monto)}`);
      setForm(emptyForm(esPeluquero ? miPeluqueroId : form.peluqueroId));
    } catch (err) {
      showToast(`Error al guardar: ${err.message ?? err}`, 'error');
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
          <label>Producto {errors.productoId && required}</label>
          <select
            value={form.productoId}
            onChange={(e) => handleProductoChange(e.target.value)}
            disabled={!local}
          >
            <option value="">{local ? 'Seleccionar…' : 'Primero elegí el peluquero'}</option>
            {productosActivos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {formatCurrency(p.precio)} (stock: {p.stock})
              </option>
            ))}
          </select>
          {producto?.generaComision && <span className="hint">Este producto genera comisión.</span>}
          {local && productosActivos.length === 0 && (
            <span className="hint">No hay productos cargados para {local.nombre}.</span>
          )}
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Cantidad {errors.cantidad && required}</label>
            <input
              type="number"
              min="1"
              value={form.cantidad}
              onChange={(e) => update({ cantidad: e.target.value })}
            />
            {errors.stock && (
              <span style={{ color: 'var(--red)', fontSize: 13 }}>
                No hay stock suficiente (disponible: {producto?.stock ?? 0}).
              </span>
            )}
          </div>
          <div className="field">
            <label>Precio unitario {errors.precio && required}</label>
            <input type="number" min="0" value={form.precio} onChange={(e) => update({ precio: e.target.value })} />
          </div>
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

        {comisionMonto > 0 && (
          <div className="flex-between hint">
            <span>Comisión para el peluquero</span>
            <strong style={{ color: 'var(--accent)' }}>{formatCurrency(comisionMonto)}</strong>
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
          Guardar venta · {formatCurrency(monto)}
        </button>
      </form>
    </div>
  );
}
