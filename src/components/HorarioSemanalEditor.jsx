import { Plus, X, Copy } from 'lucide-react';
import { DIAS, MAX_FRANJAS, normalizarSemana } from '../utils/horarios';

// Editor de horario por día con hasta 2 franjas (horario cortado).
// value: horario semanal (se normaliza); onChange(nuevoHorario).
// etiquetaAbierto: texto del estado activo ("Abierto" para locales, "Trabaja" para peluqueros).
export default function HorarioSemanalEditor({ value, onChange, etiquetaAbierto = 'Abierto', etiquetaCerrado = 'Cerrado' }) {
  const semana = normalizarSemana(value);

  function setDia(key, franjas) {
    onChange({ ...semana, [key]: franjas });
  }

  function toggleDia(key) {
    const franjas = semana[key];
    setDia(key, franjas.length ? [] : [{ desde: '09:00', hasta: '20:00' }]);
  }

  function setFranja(key, idx, campo, valor) {
    setDia(
      key,
      semana[key].map((f, i) => (i === idx ? { ...f, [campo]: valor } : f))
    );
  }

  function agregarFranja(key) {
    const franjas = semana[key];
    if (franjas.length >= MAX_FRANJAS) return;
    const primera = franjas[0];
    if (primera.desde < '13:00' && primera.hasta > '16:00') {
      // Caso típico: parte un turno corrido en mañana (hasta 13) y tarde (desde 16).
      setDia(key, [
        { ...primera, hasta: '13:00' },
        { desde: '16:00', hasta: primera.hasta },
      ]);
    } else {
      // Si no se puede partir con sentido, agrega una franja vacía para completar.
      setDia(key, [...franjas, { desde: '', hasta: '' }]);
    }
  }

  function quitarFranja(key, idx) {
    setDia(
      key,
      semana[key].filter((_, i) => i !== idx)
    );
  }

  function copiarLunes() {
    const lunes = semana.lun;
    const nueva = { ...semana };
    for (const d of DIAS) if (d.key !== 'lun' && d.key !== 'dom') nueva[d.key] = lunes.map((f) => ({ ...f }));
    onChange(nueva);
  }

  return (
    <div className="horario-semanal">
      <div className="flex-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="hint">Hasta {MAX_FRANJAS} franjas por día (horario cortado).</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copiarLunes}>
          <Copy size={14} /> Copiar lunes a Mar–Sáb
        </button>
      </div>
      {DIAS.map((d) => {
        const franjas = semana[d.key];
        const abierto = franjas.length > 0;
        return (
          <div className={`horario-dia${abierto ? '' : ' cerrado'}`} key={d.key}>
            <div className="horario-dia-head">
              <span className="horario-dia-nombre">{d.label}</span>
              <button
                type="button"
                className={`horario-toggle${abierto ? ' on' : ''}`}
                onClick={() => toggleDia(d.key)}
                aria-pressed={abierto}
              >
                {abierto ? etiquetaAbierto : etiquetaCerrado}
              </button>
            </div>
            {abierto && (
              <div className="horario-franjas">
                {franjas.map((f, idx) => (
                  <div className="horario-franja" key={idx}>
                    <input
                      type="time"
                      value={f.desde}
                      onChange={(e) => setFranja(d.key, idx, 'desde', e.target.value)}
                      aria-label={`${d.label} franja ${idx + 1} desde`}
                    />
                    <span className="hint">a</span>
                    <input
                      type="time"
                      value={f.hasta}
                      onChange={(e) => setFranja(d.key, idx, 'hasta', e.target.value)}
                      aria-label={`${d.label} franja ${idx + 1} hasta`}
                    />
                    {franjas.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm horario-icon-btn"
                        onClick={() => quitarFranja(d.key, idx)}
                        aria-label="Quitar franja"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {franjas.length < MAX_FRANJAS && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => agregarFranja(d.key)}>
                    <Plus size={14} /> Agregar franja
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
