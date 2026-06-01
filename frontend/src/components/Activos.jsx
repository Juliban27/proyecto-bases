import React, { useState, useEffect, useCallback } from 'react';
import { tickets as ticketsApi, tarifas as tarifasApi } from '../api';

function tiempoTranscurrido(fechaEntrada) {
  const diff = Date.now() - new Date(fechaEntrada).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function costoEstimado(fechaEntrada, tarifa) {
  if (!tarifa) return '—';
  const diff = Date.now() - new Date(fechaEntrada).getTime();
  const minutos = diff / 60000;
  const horas = minutos / 60;
  let total;
  if (tarifa.unidad_tiempo === 'minuto') {
    total = Math.ceil(Math.max(minutos, 1)) * parseFloat(tarifa.valor);
  } else if (tarifa.unidad_tiempo === 'hora') {
    total = Math.ceil(Math.max(horas, 1)) * parseFloat(tarifa.valor);
  } else if (tarifa.unidad_tiempo === 'dia') {
    total = Math.ceil(Math.max(horas / 24, 1)) * parseFloat(tarifa.valor);
  } else {
    total = parseFloat(tarifa.valor);
  }
  return `$${total.toLocaleString()}`;
}

const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'];

export default function Activos() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salidaModal, setSalidaModal] = useState(null);
  const [metodo, setMetodo] = useState('Efectivo');
  const [tarifaOverride, setTarifaOverride] = useState('');
  const [tarifas, setTarifas] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [msg, setMsg] = useState('');
  const [, forceUpdate] = useState(0);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await ticketsApi.activos();
      setTickets(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    tarifasApi.list().then((r) => setTarifas(r.data));
    const interval = setInterval(fetchTickets, 30000);
    const timer = setInterval(() => forceUpdate((n) => n + 1), 60000);
    return () => { clearInterval(interval); clearInterval(timer); };
  }, [fetchTickets]);

  const registrarSalida = async () => {
    if (!salidaModal) return;
    if (!salidaModal.tarifa_info && !tarifaOverride) {
      setMsg('Selecciona una tarifa antes de cobrar'); return;
    }
    setProcesando(true);
    try {
      const body = { metodo_pago: metodo };
      if (tarifaOverride) body.id_tarifa = tarifaOverride;
      const res = await ticketsApi.registrarSalida(salidaModal.id_ticket, body);
      const { total, duracion_horas } = res.data;
      setMsg(`✅ Salida registrada — Total cobrado: $${Number(total).toLocaleString()} (${Math.round(duracion_horas * 60)}min)`);
      setSalidaModal(null);
      await fetchTickets();
    } catch (e) {
      setMsg('❌ ' + (e.response?.data?.error || 'Error al registrar salida'));
    } finally {
      setProcesando(false);
    }
  };

  if (loading) return <div className="loading">Cargando tickets activos...</div>;

  return (
    <div>
      <h2 className="section-title">Tickets Activos</h2>

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1.5rem' }}>
          {msg}
          <button className="close-btn" onClick={() => setMsg('')}>×</button>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="empty-state">No hay vehículos en el parqueadero ahora mismo.</div>
      ) : (
        <div className="tickets-list">
          {tickets.map((t) => (
            <div key={t.id_ticket} className="card ticket-card">
              <div className="ticket-header">
                <div>
                  <span className="ticket-placa">{t.placa_info?.placa}</span>
                  <span className="ticket-marca"> {t.placa_info?.marca} {t.placa_info?.color}</span>
                </div>
                <span className="badge badge-active">Activo</span>
              </div>

              <div className="ticket-body">
                <div className="ticket-info-row">
                  <span>👤 Cliente</span>
                  <span>{t.cliente_nombre || '—'}</span>
                </div>
                <div className="ticket-info-row">
                  <span>🅿 Espacio</span>
                  <span>{t.espacio_info?.codigo} — {t.espacio_info?.tipo_ubicacion}</span>
                </div>
                <div className="ticket-info-row">
                  <span>💰 Tarifa</span>
                  <span>{t.tarifa_info ? `${t.tarifa_info.nombre} $${t.tarifa_info.valor}/${t.tarifa_info.unidad_tiempo}` : '—'}</span>
                </div>
                <div className="ticket-info-row">
                  <span>🕐 Entrada</span>
                  <span>{new Date(t.fecha_entrada).toLocaleString('es-CO')}</span>
                </div>
                <div className="ticket-info-row">
                  <span>⏱ Tiempo</span>
                  <span className="tiempo-vivo">{tiempoTranscurrido(t.fecha_entrada)}</span>
                </div>
                <div className="ticket-info-row">
                  <span>💵 Estimado</span>
                  <span className="costo-estimado">{costoEstimado(t.fecha_entrada, t.tarifa_info)}</span>
                </div>
              </div>

              <button
                className="btn btn-danger btn-full"
                onClick={() => { setSalidaModal(t); setMsg(''); }}
              >
                Registrar Salida / Cobrar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal salida */}
      {salidaModal && (
        <div className="modal-overlay" onClick={() => setSalidaModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Registrar Salida</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Ticket #{salidaModal.id_ticket} — {salidaModal.placa_info?.placa}
            </p>

            {!salidaModal.tarifa_info && (
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ color: '#f87171' }}>⚠ Sin tarifa — selecciona una</label>
                <select value={tarifaOverride} onChange={(e) => setTarifaOverride(e.target.value)}>
                  <option value="">-- Seleccionar tarifa --</option>
                  {tarifas.map((t) => <option key={t.id_tarifa} value={t.id_tarifa}>{t.nombre} — ${t.valor}/{t.unidad_tiempo}</option>)}
                </select>
              </div>
            )}

            {(salidaModal.tarifa_info || tarifaOverride) && (
              <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                Costo estimado: {costoEstimado(salidaModal.fecha_entrada,
                  salidaModal.tarifa_info || tarifas.find((t) => String(t.id_tarifa) === tarifaOverride))}
              </p>
            )}

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Método de pago</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSalidaModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={registrarSalida} disabled={procesando}>
                {procesando ? 'Procesando...' : '✔ Confirmar Cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
