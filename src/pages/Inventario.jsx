import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

function estadoDe(producto) {
  const { stock, stockMinimo } = producto;
  if (stock < stockMinimo * 0.2) return { label: 'Reponer', color: 'red', emoji: '🔴' };
  if (stock <= stockMinimo) return { label: 'Bajo', color: 'yellow', emoji: '🟡' };
  return { label: 'OK', color: 'green', emoji: '🟢' };
}

function emptyProducto() {
  return { nombre: '', categoria: '', stock: 0, unidad: 'unidades', stockMinimo: 1 };
}

export default function Inventario() {
  const { data, addProducto, deleteProducto, ajustarStock } = useApp();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyProducto());
  const [ajusteProducto, setAjusteProducto] = useState(null);
  const [ajusteCantidad, setAjusteCantidad] = useState(1);
  const [ajusteMotivo, setAjusteMotivo] = useState('compra');
  const [ajusteSigno, setAjusteSigno] = useState(1);
  const [toDelete, setToDelete] = useState(null);

  const productos = data.productos;

  const enAlerta = useMemo(() => productos.filter((p) => estadoDe(p).label === 'Reponer'), [productos]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    try {
      await addProducto({
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim(),
        stock: Number(form.stock) || 0,
        unidad: form.unidad,
        stockMinimo: Number(form.stockMinimo) || 0,
      });
      showToast('✓ Producto agregado');
      setShowAdd(false);
      setForm(emptyProducto());
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
          ⚠️ {enAlerta.length} producto{enAlerta.length > 1 ? 's' : ''} por debajo del stock mínimo: {enAlerta.map((p) => p.nombre).join(', ')}
        </div>
      )}

      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
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
                <th>Stock actual</th>
                <th>Unidad</th>
                <th>Stock mínimo</th>
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
                    <td data-label="Stock actual">{p.stock}</td>
                    <td data-label="Unidad">{p.unidad}</td>
                    <td data-label="Stock mínimo">{p.stockMinimo}</td>
                    <td data-label="Estado">
                      <Badge color={estado.color}>
                        {estado.emoji} {estado.label}
                      </Badge>
                    </td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal
          title="Agregar producto"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleAdd}>
                Guardar
              </button>
            </>
          }
        >
          <form className="stack-gap" onSubmit={handleAdd}>
            <div className="field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Categoría</label>
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Stock</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
            <div className="field">
              <label>Stock mínimo</label>
              <input
                type="number"
                value={form.stockMinimo}
                onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
              />
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
              <input
                type="number"
                min="1"
                value={ajusteCantidad}
                onChange={(e) => setAjusteCantidad(e.target.value)}
              />
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
