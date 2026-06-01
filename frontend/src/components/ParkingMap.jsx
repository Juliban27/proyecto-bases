import React, { useState, useEffect, useCallback } from 'react';
import {
  espacios as espaciosApi,
  tickets as ticketsApi,
  clientes as clientesApi,
  vehiculos as vehiculosApi,
  tarifas as tarifasApi,
  empleados as empleadosApi,
} from '../api';

// Agrupa espacios por la primera letra del código
function groupBySection(espacios) {
  const map = {};
  for (const e of espacios) {
    const sec = e.codigo.replace(/[0-9]/g, '') || 'X';
    if (!map[sec]) map[sec] = [];
    map[sec].push(e);
  }
  // Ordenar cada sección por código
  for (const sec of Object.keys(map)) {
    map[sec].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }
  return map;
}

const SECCION_LABELS = { A: 'Sección A', B: 'Sección B', C: 'VIP', M: 'Motos', D: 'Sección D' };
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'];

function tiempoTranscurrido(fechaEntrada) {
  const diff = Date.now() - new Date(fechaEntrada).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function costoEstimado(fechaEntrada, tarifa) {
  if (!tarifa) return null;
  const diff = Date.now() - new Date(fechaEntrada).getTime();
  const minutos = diff / 60000;
  const horas = minutos / 60;
  if (tarifa.unidad_tiempo === 'minuto') {
    return Math.ceil(Math.max(minutos, 1)) * parseFloat(tarifa.valor);
  } else if (tarifa.unidad_tiempo === 'hora') {
    return Math.ceil(Math.max(horas, 1)) * parseFloat(tarifa.valor);
  } else if (tarifa.unidad_tiempo === 'dia') {
    return Math.ceil(Math.max(horas / 24, 1)) * parseFloat(tarifa.valor);
  }
  return parseFloat(tarifa.valor);
}

export default function ParkingMap({ onStatsChange }) {
  const [espacios, setEspacios] = useState([]);
  const [ticketsActivos, setTicketsActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // espacio seleccionado
  const [modal, setModal] = useState(null); // 'entrada' | 'salida'
  const [, tick] = useState(0);

  // Datos para formulario entrada
  const [clientes, setClientes] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [vehiculosCliente, setVehiculosCliente] = useState([]);
  const [formEntrada, setFormEntrada] = useState({ id_cliente: '', placa: '', id_tarifa: '', id_empleado: '' });
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [procesando, setProcesando] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const fetchData = useCallback(async () => {
    try {
      const [espRes, tickRes] = await Promise.all([espaciosApi.list(), ticketsApi.activos()]);
      setEspacios(espRes.data);
      setTicketsActivos(tickRes.data);
      if (onStatsChange) onStatsChange();
    } catch {/* backend offline */}
    finally { setLoading(false); }
  }, [onStatsChange]);

  useEffect(() => {
    fetchData();
    const refresh = setInterval(fetchData, 15000);
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => { clearInterval(refresh); clearInterval(timer); };
  }, [fetchData]);

  // Cargar datos del formulario de entrada
  useEffect(() => {
    if (modal === 'entrada') {
      Promise.all([clientesApi.list(), tarifasApi.list(), empleadosApi.list()])
        .then(([c, t, em]) => { setClientes(c.data); setTarifas(t.data); setEmpleados(em.data); });
    }
  }, [modal]);

  useEffect(() => {
    if (!formEntrada.id_cliente) { setVehiculosCliente([]); return; }
    clientesApi.vehiculos(formEntrada.id_cliente).then((r) => setVehiculosCliente(r.data));
  }, [formEntrada.id_cliente]);

  // Auto-sugerir tarifa según tipo de vehículo
  useEffect(() => {
    if (!formEntrada.placa || tarifas.length === 0) return;
    const vehiculo = vehiculosCliente.find((v) => v.placa === formEntrada.placa);
    if (!vehiculo) return;
    const esMoto = vehiculo.tipo === 'Motocicleta';
    const sugerida = tarifas.find((t) =>
      t.unidad_tiempo === 'minuto' && (esMoto ? t.nombre.toLowerCase().includes('moto') : !t.nombre.toLowerCase().includes('moto'))
    );
    if (sugerida) setFormEntrada((f) => ({ ...f, id_tarifa: String(sugerida.id_tarifa) }));
  }, [formEntrada.placa, vehiculosCliente, tarifas]);

  const ticketDeEspacio = (espacioId) =>
    ticketsActivos.find((t) => t.id_espacio === espacioId);

  const abrirEspacio = (espacio) => {
    setSelected(espacio);
    setMsg({ text: '', type: '' });
    if (espacio.estado === 'Libre') {
      setFormEntrada({ id_cliente: '', placa: '', id_tarifa: '', id_empleado: '' });
      setModal('entrada');
    } else {
      setModal('salida');
    }
  };

  const cerrarModal = () => { setModal(null); setSelected(null); };

  const registrarEntrada = async (e) => {
    e.preventDefault();
    if (!formEntrada.placa || !formEntrada.id_tarifa || !formEntrada.id_empleado) {
      setMsg({ text: 'Completa todos los campos', type: 'error' }); return;
    }
    setProcesando(true);
    try {
      await ticketsApi.create({
        placa: formEntrada.placa,
        id_espacio: selected.id_espacio,
        id_tarifa: formEntrada.id_tarifa,
        id_empleado: formEntrada.id_empleado,
      });
      setMsg({ text: `✅ Entrada registrada en ${selected.codigo}`, type: 'success' });
      await fetchData();
      setTimeout(cerrarModal, 1200);
    } catch (err) {
      const data = err.response?.data;
      const txt = data ? Object.values(data).flat().join(' | ') : 'Error al registrar';
      setMsg({ text: txt, type: 'error' });
    } finally { setProcesando(false); }
  };

  const registrarSalida = async () => {
    const ticket = ticketDeEspacio(selected.id_espacio);
    if (!ticket) return;
    setProcesando(true);
    try {
      const res = await ticketsApi.registrarSalida(ticket.id_ticket, { metodo_pago: metodoPago });
      const { total } = res.data;
      setMsg({ text: `✅ Cobrado $${Number(total).toLocaleString()} — ${metodoPago}`, type: 'success' });
      await fetchData();
      setTimeout(cerrarModal, 1500);
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Error al registrar salida', type: 'error' });
    } finally { setProcesando(false); }
  };

  if (loading) return <div className="loading">Cargando mapa...</div>;

  const secciones = groupBySection(espacios);
  const ticket = selected ? ticketDeEspacio(selected?.id_espacio) : null;
  const costo = ticket ? costoEstimado(ticket.fecha_entrada, ticket.tarifa_info) : null;

  return (
    <div>
      <div className="parking-map">
        {/* Entrada del parqueadero */}
        <div className="parking-entrance">
          <div className="entrance-arrow">▼</div>
          <span>ENTRADA / SALIDA</span>
          <div className="entrance-arrow">▼</div>
        </div>

        {/* Calle principal */}
        <div className="main-street">
          <div className="street-markings" />
        </div>

        {/* Secciones */}
        {Object.entries(secciones).map(([sec, spots]) => (
          <div key={sec} className="parking-section">
            <div className="section-label">
              {SECCION_LABELS[sec] || `Sección ${sec}`}
            </div>
            <div className="spots-row">
              {spots.map((esp) => {
                const tk = ticketDeEspacio(esp.id_espacio);
                const libre = esp.estado === 'Libre';
                return (
                  <button
                    key={esp.id_espacio}
                    className={`parking-spot ${libre ? 'spot-libre' : 'spot-ocupado'}`}
                    onClick={() => abrirEspacio(esp)}
                    title={libre ? `${esp.codigo} — Disponible` : `${esp.codigo} — ${tk?.placa_info?.placa || 'Ocupado'}`}
                  >
                    <div className="spot-code">{esp.codigo}</div>
                    {!libre && tk && (
                      <>
                        <div className="spot-plate">{tk.placa_info?.placa}</div>
                        <div className="spot-time">{tiempoTranscurrido(tk.fecha_entrada)}</div>
                      </>
                    )}
                    {libre && <div className="spot-free-icon">P</div>}
                  </button>
                );
              })}
            </div>
            <div className="section-street" />
          </div>
        ))}

        {/* Leyenda */}
        <div className="map-legend">
          <span className="legend-item libre">■ Disponible</span>
          <span className="legend-item ocupado">■ Ocupado</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Clic en un espacio para registrar entrada o salida</span>
        </div>
      </div>

      {/* Modal */}
      {modal && selected && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal modal-map" onClick={(e) => e.stopPropagation()}>

            {msg.text && (
              <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
                {msg.text}
              </div>
            )}

            {/* MODAL ENTRADA */}
            {modal === 'entrada' && (
              <>
                <div className="modal-spot-header libre">
                  <span className="modal-spot-code">{selected.codigo}</span>
                  <span className="modal-spot-type">{selected.tipo_ubicacion} — Disponible</span>
                </div>
                <h3 style={{ margin: '1rem 0' }}>Registrar Entrada</h3>
                <form onSubmit={registrarEntrada}>
                  <div className="form-group">
                    <label>Cliente</label>
                    <select value={formEntrada.id_cliente}
                      onChange={(e) => setFormEntrada((f) => ({ ...f, id_cliente: e.target.value, placa: '' }))}>
                      <option value="">-- Seleccionar cliente --</option>
                      {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Vehículo</label>
                    <select value={formEntrada.placa}
                      onChange={(e) => setFormEntrada((f) => ({ ...f, placa: e.target.value }))}
                      disabled={!formEntrada.id_cliente}>
                      <option value="">-- Seleccionar vehículo --</option>
                      {vehiculosCliente.map((v) => <option key={v.placa} value={v.placa}>{v.placa} — {v.marca} {v.color}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tarifa</label>
                    <select value={formEntrada.id_tarifa}
                      onChange={(e) => setFormEntrada((f) => ({ ...f, id_tarifa: e.target.value }))}>
                      <option value="">-- Seleccionar tarifa --</option>
                      {tarifas.map((t) => <option key={t.id_tarifa} value={t.id_tarifa}>{t.nombre} — ${t.valor}/{t.unidad_tiempo}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Empleado</label>
                    <select value={formEntrada.id_empleado}
                      onChange={(e) => setFormEntrada((f) => ({ ...f, id_empleado: e.target.value }))}>
                      <option value="">-- Seleccionar empleado --</option>
                      {empleados.map((em) => <option key={em.id_empleado} value={em.id_empleado}>{em.nombre} ({em.rol})</option>)}
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
                    <button type="submit" className="btn" disabled={procesando}>
                      {procesando ? 'Registrando...' : '🚗 Registrar Entrada'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* MODAL SALIDA */}
            {modal === 'salida' && ticket && (
              <>
                <div className="modal-spot-header ocupado">
                  <span className="modal-spot-code">{selected.codigo}</span>
                  <span className="modal-spot-type">{selected.tipo_ubicacion} — Ocupado</span>
                </div>

                <div className="salida-info">
                  <div className="salida-row">
                    <span>Placa</span>
                    <strong>{ticket.placa_info?.placa}</strong>
                  </div>
                  <div className="salida-row">
                    <span>Vehículo</span>
                    <span>{ticket.placa_info?.marca} {ticket.placa_info?.color}</span>
                  </div>
                  <div className="salida-row">
                    <span>Cliente</span>
                    <span>{ticket.cliente_nombre}</span>
                  </div>
                  <div className="salida-row">
                    <span>Entrada</span>
                    <span>{new Date(ticket.fecha_entrada).toLocaleString('es-CO')}</span>
                  </div>
                  <div className="salida-row">
                    <span>Tiempo</span>
                    <strong className="tiempo-vivo">{tiempoTranscurrido(ticket.fecha_entrada)}</strong>
                  </div>
                  <div className="salida-row">
                    <span>Tarifa</span>
                    <span>{ticket.tarifa_info?.nombre} — ${ticket.tarifa_info?.valor}/{ticket.tarifa_info?.unidad_tiempo}</span>
                  </div>
                  <div className="salida-row total-row">
                    <span>Total a cobrar</span>
                    <strong className="costo-estimado">${costo ? Number(costo).toLocaleString() : '—'}</strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Método de pago</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
                  <button className="btn btn-danger" onClick={registrarSalida} disabled={procesando}>
                    {procesando ? 'Procesando...' : '✔ Confirmar Cobro'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
