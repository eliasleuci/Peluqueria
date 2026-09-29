import { useState, useMemo } from 'react';
import { Package, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import PeriodSelector from '../components/PeriodSelector';
import { formatCurrency, formatDate, toDateKey } from '../utils/format';
import { filterByLocal, filterByRange, periodRange } from '../utils/stats';

const TABS = [
  { key: 'inventario', label: 'Inventario', icon: Package },
  { key: 'ventas', label: 'Ventas de producto', icon: Wallet },
];

function estadoDe(producto) {
  const { stock, stockMinimo } = producto;
  if (stock < stockMinimo * 0.2) return { label: 'Reponer', color: 'red', emoji: '🔴' };
  if (stock <= stockMinimo) return { label: 'Bajo', color: 'yellow', emoji: '🟡' };
  return { label: 'OK', color: 'green', emoji: '🟢' };
}

function emptyProducto(localId = '') {
  return {
    nombre: '',
    categoria: '',
    localId,
    stock: 0,
    unidad: 'unidades',
    stockMinimo: 1,
    precio: 0,
    comisionFija: 0,
  };
}

export default function Inventario() {
  const [tab, setTab] = useState('inventario');
  return (
    <div className="stack-gap">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <t.icon size={16} strokeWidth={1.8} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'inventario' ? <InventarioTab /> : <VentasTab />}
    </div>
  );
}

function InventarioTab() {
  const { data, activeLocal, addProducto, updateProducto, deleteProducto, ajustarStock } = useApp();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null); // producto en edición, o null si es alta
  const [form, setForm] = useState(emptyProducto());
  const [ajusteProducto, setAjusteProducto] = useState(null);
  const [ajusteCantidad, setAjusteCantidad] = useState(1);
  const [ajusteMotivo, setAjusteMotivo] = useState('compra');
  const [ajusteSigno, setAjusteSigno] = useState(1);
  const [toDelete, setToDelete] = useState(null);

  const localesActivos = data.locales.filter((l) => l.activo);
  const localName = (id) => (id ? data.locales.find((l) => l.id === id)?.nombre ?? '—' : 'Compartido');

  // Filtro del selector de local del topbar: productos de ese local + los compartidos.
  const productos = useMemo(
    () =>
      activeLocal === 'all'
        ? data.productos
        : data.productos.filter((p) => !p.localId || String(p.localId) === String(activeLocal)),
    [data.productos, activeLocal]
  );
  const enAlerta = useMemo(() => productos.filter((p) => estadoDe(p).label === 'Reponer'), [productos]);

  function abrirAlta() {
    setEditando(null);
    setForm(emptyProducto(activeLocal !== 'all' ? activeLocal : localesActivos[0]?.id ?? ''));
    setShowForm(true);
  }

  function abrirEdicion(p) {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      categoria: p.categoria,
      localId: p.localId ?? '',
      stock: p.stock,
      unidad: p.unidad,
      stockMinimo: p.stockMinimo,
      precio: p.precio,
      comisionFija: p.comisionFija,
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      showToast('Poné un nombre al producto.', 'error');
      return;
    }
    const datos = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim(),
      localId: form.localId || null,
      unidad: form.unidad,
      stockMinimo: Number(form.stockMinimo) || 0,
      precio: Number(form.precio) || 0,
      comisionFija: Number(form.comisionFija) || 0,
    };
    try {
      if (editando) {
        await updateProducto(editando.id, datos);
        showToast('✓ Producto actualizado');
      } else {
        await addProducto({ ...datos, stock: Number(form.stock) || 0 });
        showToast('✓ Producto agregado');
      }
      setShowForm(false);
      setEditando(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleAjustar(e) {
    e.preventDefault();
    const delta = ajusteSigno * (Number(ajusteCantidad) || 0);
    try {
      await ajustarStock(ajusteProducto.id, delta);
      showToast(`✓ Stock ${delta >= 0 ? 'aumentado' : 'reducido'} (${ajusteMotivo})`);
      setAjusteProducto(null);
      setAjusteCantidad(1);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteProducto(toDelete.id);
      showToast('✓ Producto eliminado');
      setToDelete(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      {enAlerta.length > 0 && (
        <div className="alert-banner">
          ⚠️ {enAlerta.length} producto{enAlerta.length > 1 ? 's' : ''} por debajo del stock mínimo:{' '}
          {enAlerta.map((p) => p.nombre).join(', ')}
        </div>
      )}

      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={abrirAlta}>
          + Agregar producto
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Local</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Comisión</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const estado = estadoDe(p);
                return (
                  <tr key={p.id}>
                    <td data-label="Producto">{p.nombre}</td>
                    <td data-label="Categoría">{p.categoria}</td>
                    <td data-label="Local">{localName(p.localId)}</td>
                    <td data-label="Precio">{formatCurrency(p.precio)}</td>
                    <td data-label="Stock">
                      {p.stock} {p.unidad}
                    </td>
                    <td data-label="Comisión">
                      {p.comisionFija > 0 ? `${formatCurrency(p.comisionFija)} / u` : <span className="hint">—</span>}
                    </td>
                    <td data-label="Estado">
                      <Badge color={estado.color}>
                        {estado.emoji} {estado.label}
                      </Badge>
                    </td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirEdicion(p)}>
                          Editar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setAjusteProducto(p)}>
                          Ajustar stock
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-secondary">
                    {activeLocal === 'all' ? 'Todavía no cargaste productos.' : 'No hay productos en este local.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal
          title={editando ? `Editar — ${editando.nombre}` : 'Agregar producto'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Guardar
              </button>
            </>
          }
        >
          <form className="stack-gap" onSubmit={handleSave}>
            <div className="field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Categoría</label>
                <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </div>
              <div className="field">
                <label>Local</label>
                <select value={form.localId} onChange={(e) => setForm({ ...form, localId: e.target.value })}>
                  {localesActivos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                  <option value="">Compartido (todos los locales)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Precio de venta</label>
                <input
                  type="number"
                  min="0"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Unidad</label>
                <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                  <option value="unidades">unidades</option>
                  <option value="ml">ml</option>
                  <option value="gr">gr</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              {editando ? (
                <div className="field">
                  <label>Stock actual</label>
                  <input readOnly value={`${editando.stock} ${editando.unidad}`} />
                  <span className="hint">Se modifica con "Ajustar stock".</span>
                </div>
              ) : (
                <div className="field">
                  <label>Stock inicial</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <label>Stock mínimo</label>
                <input
                  type="number"
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Comisión para el vendedor ($ por unidad)</label>
              <input
                type="number"
                min="0"
                placeholder="0 = sin comisión"
                value={form.comisionFija}
                onChange={(e) => setForm({ ...form, comisionFija: e.target.value })}
              />
              <span className="hint">
                {Number(form.comisionFija) > 0
                  ? `Por cada unidad vendida, el vendedor se lleva ${formatCurrency(form.comisionFija)} y al local le quedan ${formatCurrency(
                      Math.max(0, (Number(form.precio) || 0) - Number(form.comisionFija))
                    )}.`
                  : 'Dejalo en 0 si este producto no le deja comisión al vendedor (ej. ceras). Para perfumes, poné 7000.'}
              </span>
            </div>
          </form>
        </Modal>
      )}

      {ajusteProducto && (
        <Modal
          title={`Ajustar stock — ${ajusteProducto.nombre}`}
          onClose={() => setAjusteProducto(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAjusteProducto(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleAjustar}>
                Aplicar
              </button>
            </>
          }
        >
          <form className="stack-gap" onSubmit={handleAjustar}>
            <div className="field">
              <label>Operación</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${ajusteSigno === 1 ? 'active' : ''}`}
                  onClick={() => setAjusteSigno(1)}
                >
                  + Sumar
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${ajusteSigno === -1 ? 'active' : ''}`}
                  onClick={() => setAjusteSigno(-1)}
                >
                  − Restar
                </button>
              </div>
            </div>
            <div className="field">
              <label>Cantidad</label>
              <input type="number" min="1" value={ajusteCantidad} onChange={(e) => setAjusteCantidad(e.target.value)} />
            </div>
            <div className="field">
              <label>Motivo</label>
              <select value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)}>
                <option value="compra">Compra</option>
                <option value="uso">Uso</option>
                <option value="perdida">Pérdida</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="¿Eliminar producto?"
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
            Se eliminará <strong>{toDelete.nombre}</strong> del inventario. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}

function VentasTab() {
  const { data, activeLocal, deleteVenta } = useApp();
  const { showToast } = useToast();
  const hoy = toDateKey(new Date());
  const [periodo, setPeriodo] = useState({ period: 'mes', custom: { from: hoy, to: hoy } });
  const [toDelete, setToDelete] = useState(null);
  const { period, custom } = periodo;

  const rango = useMemo(() => periodRange(period, 0, custom), [period, custom]);
  const ventas = useMemo(
    () =>
      filterByRange(filterByLocal(data.ventas, activeLocal), rango.from, rango.to).sort((a, b) =>
        (b.fecha + b.hora).localeCompare(a.fecha + a.hora)
      ),
    [data.ventas, activeLocal, rango]
  );

  const total = ventas.reduce((a, v) => a + v.monto, 0);
  const unidades = ventas.reduce((a, v) => a + v.cantidad, 0);
  const comisiones = ventas.reduce((a, v) => a + v.comisionMonto, 0);

  const productoName = (id) => data.productos.find((p) => p.id === id)?.nombre ?? '—';
  const peluqueroName = (id) => data.peluqueros.find((p) => p.id === id)?.nombre ?? '—';

  const porProducto = useMemo(() => {
    const acc = {};
    for (const v of ventas) {
      if (!acc[v.productoId]) acc[v.productoId] = { cantidad: 0, monto: 0 };
      acc[v.productoId].cantidad += v.cantidad;
      acc[v.productoId].monto += v.monto;
    }
    return Object.entries(acc)
      .map(([id, x]) => ({ id, nombre: data.productos.find((p) => p.id === id)?.nombre ?? '—', ...x }))
      .sort((a, b) => b.monto - a.monto);
  }, [ventas, data.productos]);

  const porPeluquero = useMemo(() => {
    const acc = {};
    for (const v of ventas) {
      if (!acc[v.peluqueroId]) acc[v.peluqueroId] = { monto: 0, comision: 0 };
      acc[v.peluqueroId].monto += v.monto;
      acc[v.peluqueroId].comision += v.comisionMonto;
    }
    return Object.entries(acc)
      .map(([id, x]) => ({ id, nombre: data.peluqueros.find((p) => p.id === id)?.nombre ?? '—', ...x }))
      .sort((a, b) => b.monto - a.monto);
  }, [ventas, data.peluqueros]);

  async function handleDelete() {
    try {
      await deleteVenta(toDelete.id);
      showToast('✓ Venta eliminada (stock restaurado)');
      setToDelete(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      <PeriodSelector period={period} custom={custom} onChange={setPeriodo} />

      <div className="grid grid-3">
        <div className="card">
          <div className="hint">Total vendido</div>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{formatCurrency(total)}</div>
        </div>
        <div className="card">
          <div className="hint">Unidades</div>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{unidades}</div>
        </div>
        <div className="card">
          <div className="hint">Comisiones a pagar</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>{formatCurrency(comisiones)}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Productos más vendidos</div>
          <div className="stack-gap" style={{ gap: 8 }}>
            {porProducto.map((p) => (
              <div className="flex-between" key={p.id}>
                <span>{p.nombre}</span>
                <span className="hint">
                  {p.cantidad} u · {formatCurrency(p.monto)}
                </span>
              </div>
            ))}
            {porProducto.length === 0 && <p className="text-secondary">Sin ventas en el período.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Por peluquero</div>
          <div className="stack-gap" style={{ gap: 8 }}>
            {porPeluquero.map((p) => (
              <div className="flex-between" key={p.id}>
                <span>{p.nombre}</span>
                <span className="hint">
                  {formatCurrency(p.monto)} · comisión {formatCurrency(p.comision)}
                </span>
              </div>
            ))}
            {porPeluquero.length === 0 && <p className="text-secondary">Sin ventas en el período.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Ventas del período</div>
        <div className="table-wrap table-wrap-scroll">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Peluquero</th>
                <th>Cant.</th>
                <th>Monto</th>
                <th>Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td data-label="Fecha">{formatDate(v.fecha)}</td>
                  <td data-label="Producto">{productoName(v.productoId)}</td>
                  <td data-label="Peluquero">{peluqueroName(v.peluqueroId)}</td>
                  <td data-label="Cant.">{v.cantidad}</td>
                  <td data-label="Monto">{formatCurrency(v.monto)}</td>
                  <td data-label="Pago">
                    <Badge color={v.pago === 'efectivo' ? 'green' : 'blue'}>
                      {v.pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                    </Badge>
                  </td>
                  <td data-label="Acciones">
                    <button className="btn btn-danger btn-sm" onClick={() => setToDelete(v)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-secondary">
                    Sin ventas en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toDelete && (
        <Modal
          title="¿Eliminar venta?"
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
            Se eliminará la venta de <strong>{productoName(toDelete.productoId)}</strong> y se{' '}
            <strong>restaurará el stock</strong> ({toDelete.cantidad} u). Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}
