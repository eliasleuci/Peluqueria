import { Fragment, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { filterByLocal } from '../utils/stats';

const TABS = [
  { key: 'locales', label: '🏪 Locales' },
  { key: 'servicios', label: '💈 Servicios' },
  { key: 'metas', label: '🎯 Metas' },
  { key: 'datos', label: '💾 Datos' },
];

export default function Configuracion() {
  const [tab, setTab] = useState('locales');
  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'locales' && <LocalesTab />}
      {tab === 'servicios' && <ServiciosTab />}
      {tab === 'metas' && <MetasTab />}
      {tab === 'datos' && <DatosTab />}
    </div>
  );
}

function emptyLocal() {
  return { nombre: '', direccion: '', telefono: '', horario: '09:00 a 20:00' };
}

// El horario se guarda como texto "HH:MM a HH:MM" en locales.horario (sin migración).
// Si había un texto libre viejo que no matchea, se arranca con valores vacíos.
function parseHorario(str) {
  const m = /^(\d{2}:\d{2})?\s*a\s*(\d{2}:\d{2})?$/.exec((str || '').trim());
  return m ? { apertura: m[1] ?? '', cierre: m[2] ?? '' } : { apertura: '', cierre: '' };
}

function horarioCompleto(str) {
  const { apertura, cierre } = parseHorario(str);
  return (!apertura && !cierre) || (apertura && cierre && cierre > apertura);
}

function HorarioPicker({ value, onChange }) {
  const { apertura, cierre } = parseHorario(value);
  const emit = (a, c) => onChange(a || c ? `${a} a ${c}`.trim() : '');
  const invalido = apertura && cierre && cierre <= apertura;
  return (
    <div className="field">
      <label>Horario de atención</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="time"
          value={apertura}
          onChange={(e) => emit(e.target.value, cierre)}
          style={{ flex: 1, minWidth: 110 }}
          aria-label="Apertura"
        />
        <span className="hint">a</span>
        <input
          type="time"
          value={cierre}
          onChange={(e) => emit(apertura, e.target.value)}
          style={{ flex: 1, minWidth: 110 }}
          aria-label="Cierre"
        />
      </div>
      {invalido && <span style={{ color: 'var(--red)', fontSize: 12 }}>El cierre debe ser después de la apertura.</span>}
    </div>
  );
}

function LocalesTab() {
  const { data, addLocal, updateLocal, deleteLocal } = useApp();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [nuevo, setNuevo] = useState(emptyLocal());
  const [toDelete, setToDelete] = useState(null);

  function draftOf(l) {
    return drafts[l.id] ?? l;
  }

  async function save(id) {
    const draft = draftOf(data.locales.find((l) => l.id === id));
    if (!horarioCompleto(draft.horario)) {
      showToast('Completá apertura y cierre (el cierre debe ser después de la apertura).', 'error');
      return;
    }
    try {
      await updateLocal(id, draft);
      showToast('✓ Local actualizado');
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  function patch(l, field, value) {
    setDrafts((prev) => ({ ...prev, [l.id]: { ...draftOf(l), [field]: value } }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    if (!horarioCompleto(nuevo.horario)) {
      showToast('Completá apertura y cierre (el cierre debe ser después de la apertura).', 'error');
      return;
    }
    try {
      await addLocal(nuevo);
      showToast('✓ Local agregado');
      setShowAdd(false);
      setNuevo(emptyLocal());
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleDelete() {
    try {
      await deleteLocal(toDelete.id);
      showToast('✓ Local eliminado');
      setToDelete(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Nuevo local
        </button>
      </div>

      <div className="grid grid-3">
        {data.locales.filter((l) => l.activo).map((l) => {
          const draft = draftOf(l);
          return (
            <div className="card stack-gap" key={l.id}>
              <div className="field">
                <label>Nombre</label>
                <input value={draft.nombre} onChange={(e) => patch(l, 'nombre', e.target.value)} />
              </div>
              <div className="field">
                <label>Dirección</label>
                <input value={draft.direccion} onChange={(e) => patch(l, 'direccion', e.target.value)} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input value={draft.telefono} onChange={(e) => patch(l, 'telefono', e.target.value)} />
              </div>
              <HorarioPicker value={draft.horario} onChange={(v) => patch(l, 'horario', v)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => save(l.id)}>
                  Guardar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setToDelete(l)}>
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Modal
          title="Nuevo local"
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
              <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Dirección</label>
              <input value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            </div>
            <HorarioPicker value={nuevo.horario} onChange={(v) => setNuevo({ ...nuevo, horario: v })} />
          </form>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="¿Eliminar local?"
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
            Se eliminará <strong>{toDelete.nombre}</strong>. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}

function PreciosLocalEditor({ servicio, locales, onSet, onClear }) {
  const { showToast } = useToast();
  const inicial = () =>
    Object.fromEntries(
      locales.map((l) => [l.id, servicio.preciosPorLocal?.[l.id] != null ? String(servicio.preciosPorLocal[l.id]) : ''])
    );
  const [valores, setValores] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  const guardadoDe = (l) => {
    const v = servicio.preciosPorLocal?.[l.id];
    return v != null ? String(v) : '';
  };
  const hayCambios = locales.some((l) => (valores[l.id] ?? '').trim() !== guardadoDe(l));

  async function guardar() {
    setGuardando(true);
    try {
      for (const l of locales) {
        const nuevo = (valores[l.id] ?? '').trim();
        if (nuevo === guardadoDe(l)) continue;
        if (nuevo === '') await onClear(servicio.id, l.id);
        else await onSet(servicio.id, l.id, Number(nuevo) || 0);
      }
      showToast('✓ Precios por local guardados');
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="stack-gap" style={{ gap: 12, padding: '6px 2px', width: '100%' }}>
      <span className="hint">Dejá el campo vacío para que ese local use el precio base ({formatCurrency(servicio.precio)}).</span>
      <div className="grid grid-3">
        {locales.map((l) => {
          const valor = valores[l.id] ?? '';
          const personalizado = valor.trim() !== '' && Number(valor) !== servicio.precio;
          return (
            <div className="field" key={l.id}>
              <label style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{l.nombre}</span>
                <span className={`badge ${personalizado ? 'badge-accent' : 'badge-gray'}`} style={{ fontWeight: 600 }}>
                  {personalizado ? 'Personalizado' : 'Usa base'}
                </span>
              </label>
              <input
                type="number"
                min="0"
                placeholder={`Base: ${servicio.precio}`}
                value={valor}
                onChange={(e) => setValores((prev) => ({ ...prev, [l.id]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={!hayCambios || guardando}>
          {guardando ? 'Guardando…' : 'Guardar precios'}
        </button>
        {hayCambios && <span className="hint">Tenés cambios sin guardar.</span>}
      </div>
    </div>
  );
}

function ServiciosTab() {
  const { data, addServicio, updateServicio, deleteServicio, setPrecioServicioLocal, quitarPrecioServicioLocal } =
    useApp();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '' });
  const [expandido, setExpandido] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const localesActivos = data.locales.filter((l) => l.activo);

  function intentarEliminar(s) {
    const tieneCortes = data.cortes.some((c) => c.servicioId === s.id);
    if (tieneCortes) {
      showToast('No se puede eliminar: tiene cortes registrados. Desactivalo en su lugar.', 'error');
      return;
    }
    setToDelete(s);
  }

  async function confirmarEliminar() {
    setBorrando(true);
    try {
      await deleteServicio(toDelete.id);
      showToast('✓ Servicio eliminado');
      setToDelete(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    } finally {
      setBorrando(false);
    }
  }

  async function handlePrecioChange(id, value) {
    try {
      await updateServicio(id, { precio: Number(value) || 0 });
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleToggleActivo(s) {
    try {
      await updateServicio(s.id, { activo: !s.activo });
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim() || !nuevo.precio) return;
    try {
      await addServicio({ nombre: nuevo.nombre.trim(), precio: Number(nuevo.precio) });
      showToast('✓ Servicio agregado');
      setShowAdd(false);
      setNuevo({ nombre: '', precio: '' });
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      <div className="section-header">
        <div />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Agregar servicio
        </button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Precio base</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.servicios.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td data-label="Servicio">{s.nombre}</td>
                    <td data-label="Precio base">
                      <input
                        type="number"
                        style={{ width: 120 }}
                        value={s.precio}
                        onChange={(e) => handlePrecioChange(s.id, e.target.value)}
                      />
                    </td>
                    <td data-label="Estado">{s.activo ? 'Activo' : 'Inactivo'}</td>
                    <td data-label="Acciones">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {localesActivos.length > 1 && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setExpandido(expandido === s.id ? null : s.id)}
                          >
                            {expandido === s.id ? 'Cerrar' : 'Precios por local'}
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActivo(s)}>
                          {s.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => intentarEliminar(s)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandido === s.id && (
                    <tr>
                      <td colSpan={4} style={{ background: 'var(--surface-elevated)' }}>
                        <PreciosLocalEditor
                          servicio={s}
                          locales={localesActivos}
                          onSet={setPrecioServicioLocal}
                          onClear={quitarPrecioServicioLocal}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toDelete && (
        <Modal
          title="¿Eliminar servicio?"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmarEliminar} disabled={borrando}>
                {borrando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </>
          }
        >
          <p>
            Se eliminará el servicio <strong>{toDelete.nombre}</strong> y sus precios por local. Esta acción no se
            puede deshacer.
          </p>
        </Modal>
      )}

      {showAdd && (
        <Modal
          title="Agregar servicio"
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
              <label>Nombre del servicio</label>
              <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Precio</label>
              <input
                type="number"
                value={nuevo.precio}
                onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MetasTab() {
  const { data, updateLocal, updateConfig } = useApp();
  const { showToast } = useToast();
  const [metaPeluquero, setMetaPeluquero] = useState(data.config.metaPeluquero);
  const [metasLocal, setMetasLocal] = useState(() =>
    Object.fromEntries(data.locales.filter((l) => l.activo).map((l) => [l.id, l.metaMensual]))
  );

  async function saveLocalMeta(id) {
    try {
      await updateLocal(id, { metaMensual: Number(metasLocal[id]) || 0 });
      showToast('✓ Meta actualizada');
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  async function saveMetaPeluquero() {
    try {
      await updateConfig({ metaPeluquero: Number(metaPeluquero) || 0 });
      showToast('✓ Meta de peluqueros actualizada');
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="stack-gap">
      <div className="card">
        <div className="card-title">Meta mensual de ingresos por local</div>
        <div className="grid grid-3">
          {data.locales.filter((l) => l.activo).map((l) => (
            <div className="field" key={l.id}>
              <label>{l.nombre}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={metasLocal[l.id]}
                  onChange={(e) => setMetasLocal({ ...metasLocal, [l.id]: e.target.value })}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => saveLocalMeta(l.id)}>
                  Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Meta mensual por peluquero (aplica a todos)</div>
        <div className="field" style={{ maxWidth: 260 }}>
          <label>Monto</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={metaPeluquero} onChange={(e) => setMetaPeluquero(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={saveMetaPeluquero}>
              Guardar
            </button>
          </div>
          <p className="hint">Actual: {formatCurrency(data.config.metaPeluquero)}</p>
        </div>
      </div>
    </div>
  );
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function DatosTab() {
  const { data, limpiarDemo } = useApp();
  const { showToast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [reporteLocal, setReporteLocal] = useState('all');

  function exportarReporte() {
    const cortes = filterByLocal(data.cortes, reporteLocal);
    const localName = (id) => data.locales.find((l) => l.id === id)?.nombre ?? '—';
    const peluqueroName = (id) => data.peluqueros.find((p) => p.id === id)?.nombre ?? '—';
    const servicioName = (id) => data.servicios.find((s) => s.id === id)?.nombre ?? '—';

    const header = ['Fecha', 'Hora', 'Local', 'Peluquero', 'Servicio', 'Precio', 'Descuento %', 'Monto', 'Pago', 'Notas'];
    const montoIndex = header.indexOf('Monto');
    const rows = [...cortes]
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      .map((c) => [
        formatDate(c.fecha),
        c.hora,
        localName(c.localId),
        peluqueroName(c.peluqueroId),
        servicioName(c.servicioId),
        c.precio,
        c.descuento,
        c.monto,
        c.pago === 'efectivo' ? 'Efectivo' : 'Transferencia',
        c.notas,
      ]);

    const totalMonto = cortes.reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
    const totalRow = header.map((_, i) => (i === 0 ? 'Total' : i === montoIndex ? totalMonto : ''));
    const csvLines = [
      header.map(csvEscape).join(';'),
      ...rows.map((r) => r.map(csvEscape).join(';')),
      '',
      totalRow.map(csvEscape).join(';'),
    ];
    const csv = '﻿' + csvLines.join('\n');

    const scopeLabel = reporteLocal === 'all' ? 'todos-los-locales' : localName(reporteLocal).toLowerCase().replace(/\s+/g, '-');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mipeluqueria-reporte-${scopeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('✓ Reporte exportado');
  }

  async function confirmarLimpiar() {
    try {
      await limpiarDemo();
      setConfirmClear(false);
      showToast('✓ Cortes eliminados');
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
    }
  }

  return (
    <div className="grid grid-2">
      <div className="card stack-gap">
        <div className="card-title">Exportar reportes</div>
        <p className="hint">Descarga un CSV con los cortes registrados del local elegido.</p>
        <div className="field">
          <label>Local</label>
          <select value={reporteLocal} onChange={(e) => setReporteLocal(e.target.value)}>
            <option value="all">Todos los locales</option>
            {data.locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={exportarReporte}>
          Exportar reporte
        </button>
      </div>

      <div className="card stack-gap">
        <div className="card-title">Limpiar datos demo</div>
        <p className="hint">Borra los cortes de ejemplo y deja la app vacía.</p>
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>
          Limpiar datos demo
        </button>
      </div>

      {confirmClear && (
        <Modal
          title="¿Estás seguro?"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmarLimpiar}>
                Sí, limpiar
              </button>
            </>
          }
        >
          <p>Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
}
