import { useState } from 'react';
import Modal from './Modal';
import PagoSelector from './PagoSelector';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/format';
import { pagoInicial, validarPago, camposPago } from '../utils/pagos';

// Registrar el cobro de un corte o venta que quedó "a cobrar".
// item: corte o venta; tipo: 'corte' | 'venta'; descripcion: texto del trabajo/producto.
export default function CobrarModal({ item, tipo, descripcion, onClose }) {
  const { registrarCobro } = useApp();
  const { showToast } = useToast();
  const [pago, setPago] = useState(() => ({ ...pagoInicial(), cliente: item.clienteNombre ?? '' }));
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    const error = validarPago(pago, item.monto, { permitirACobrar: false });
    if (error) {
      showToast(error, 'error');
      return;
    }
    setGuardando(true);
    try {
      const c = camposPago(pago, item.monto);
      await registrarCobro(tipo, item.id, {
        cobroPago: c.pago,
        montoEfectivo: c.montoEfectivo,
        montoTransferencia: c.montoTransferencia,
      });
      showToast(`✓ Cobro registrado — ${formatCurrency(item.monto)}`);
      onClose();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`, 'error');
      setGuardando(false);
    }
  }

  return (
    <Modal
      title="Registrar cobro"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={confirmar} disabled={guardando}>
            {guardando ? 'Guardando…' : `Cobrar ${formatCurrency(item.monto)}`}
          </button>
        </>
      }
    >
      <div className="stack-gap">
        <p>
          <strong>{item.clienteNombre || 'Cliente'}</strong> debe <strong>{formatCurrency(item.monto)}</strong> de{' '}
          {descripcion} del {formatDate(item.fecha)}.
        </p>
        <PagoSelector value={pago} onChange={setPago} monto={item.monto} permitirACobrar={false} label="¿Cómo pagó?" />
      </div>
    </Modal>
  );
}
