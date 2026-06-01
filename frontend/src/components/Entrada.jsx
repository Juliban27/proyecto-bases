import React, { useState, useEffect } from 'react';
import { clientes as clientesApi, vehiculos as vehiculosApi, espacios as espaciosApi, tarifas as tarifasApi, empleados as empleadosApi, tickets as ticketsApi } from '../api';

const INITIAL = {
  id_cliente: '',
  placa: '',
  id_espacio: '',
  id_tarifa: '',
  id_empleado: '',
};

export default function Entrada({ onSuccess }) {
  const [form, setForm] = useState(INITIAL);
  const [clientes, setClientes] = useState([]);
  const [vehiculosCliente, setVehiculosCliente] = useState([]);
  const [espaciosLibres, setEspaciosLibres] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Nuevo cliente/vehiculo inline
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '', tipo_cliente: 'Regular' });
  const [nuevoVehiculo, setNuevoVehiculo] = useState({ placa: '', tipo: 'Automóvil', marca: '', color: '' });
  const [modoNuevoCliente, setModoNuevoCliente] = useState(false);
  const [modoNuevoVehiculo, setModoNuevoVehiculo] = useState(false);

  useEffect(() => {
    Promise.all([
      clientesApi.list(),
      espaciosApi.libres(),
      tarifasApi.list(),
      empleadosApi.list(),
    ]).then(([c, e, t, em]) => {
      setClientes(c.data);
      setEspaciosLibres(e.data);
      setTarifas(t.data);
      setEmpleados(em.data);
    }).catch(() => setError('Error cargando datos. ¿Está el backend corriendo?'));
  }, []);

  useEffect(() => {
    if (!form.id_cliente) { setVehiculosCliente([]); return; }
    clientesApi.vehiculos(form.id_cliente).then((r) => setVehiculosCliente(r.data));
  }, [form.id_cliente]);

  // Auto-sugerir tarifa según tipo de vehículo
  useEffect(() => {
    if (!form.placa || tarifas.length === 0) return;
    const vehiculo = vehiculosCliente.find((v) => v.placa === form.placa);
    if (!vehiculo) return;
    const esMoto = vehiculo.tipo === 'Motocicleta';
    const sugerida = tarifas.find((t) =>
      t.unidad_tiempo === 'minuto' && (esMoto ? t.nombre.toLowerCase().includes('moto') : !t.nombre.toLowerCase().includes('moto'))
    );
    if (sugerida) set('id_tarifa', String(sugerida.id_tarifa));
  }, [form.placa, vehiculosCliente, tarifas]);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const crearCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.telefono) { setError('Nombre y teléfono son obligatorios'); return; }
    try {
      const res = await clientesApi.create(nuevoCliente);
      const nuevo = res.data;
      setClientes((prev) => [...prev, nuevo]);
      setForm((f) => ({ ...f, id_cliente: String(nuevo.id_cliente) }));
      setNuevoCliente({ nombre: '', telefono: '', tipo_cliente: 'Regular' });
      setModoNuevoCliente(false);
      setError('');
    } catch (e) {
      setError('Error creando cliente');
    }
  };

  const crearVehiculo = async () => {
    if (!nuevoVehiculo.placa || !nuevoVehiculo.marca) { setError('Placa y marca son obligatorias'); return; }
    if (!form.id_cliente) { setError('Selecciona un cliente primero'); return; }
    try {
      const res = await vehiculosApi.create({ ...nuevoVehiculo, id_cliente: form.id_cliente });
      const nuevo = res.data;
      setVehiculosCliente((prev) => [...prev, nuevo]);
      setForm((f) => ({ ...f, placa: nuevo.placa }));
      setNuevoVehiculo({ placa: '', tipo: 'Automóvil', marca: '', color: '' });
      setModoNuevoVehiculo(false);
      setError('');
    } catch (e) {
      const msg = e.response?.data?.placa?.[0] || 'Error creando vehículo';
      setError(msg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.placa || !form.id_espacio || !form.id_tarifa || !form.id_empleado) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const res = await ticketsApi.create({
        placa: form.placa,
        id_espacio: form.id_espacio,
        id_tarifa: form.id_tarifa,
        id_empleado: form.id_empleado,
      });
      const ticket = res.data;
      setSuccess(`✅ Ticket #${ticket.id_ticket} creado para ${form.placa} — Espacio asignado.`);
      setForm(INITIAL);
      setVehiculosCliente([]);
      // Refrescar espacios libres
      const esp = await espaciosApi.libres();
      setEspaciosLibres(esp.data);
      setTimeout(() => { onSuccess && onSuccess(); }, 1500);
    } catch (e) {
      const data = e.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.values(data).flat().join(' | ');
        setError(msgs);
      } else {
        setError('Error al registrar la entrada');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <h2 className="section-title">Registrar Entrada</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="form-card">

        {/* CLIENTE */}
        <div className="form-group">
          <label>Cliente</label>
          <div className="row-group">
            <select value={form.id_cliente} onChange={(e) => { set('id_cliente', e.target.value); set('placa', ''); }}>
              <option value="">-- Seleccionar cliente --</option>
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} ({c.tipo_cliente})</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setModoNuevoCliente((v) => !v)}>
              {modoNuevoCliente ? 'Cancelar' : '+ Nuevo'}
            </button>
          </div>
          {modoNuevoCliente && (
            <div className="inline-form">
              <input placeholder="Nombre" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente((p) => ({ ...p, nombre: e.target.value }))} />
              <input placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente((p) => ({ ...p, telefono: e.target.value }))} />
              <select value={nuevoCliente.tipo_cliente} onChange={(e) => setNuevoCliente((p) => ({ ...p, tipo_cliente: e.target.value }))}>
                <option>Regular</option>
                <option>Mensualero</option>
                <option>VIP</option>
              </select>
              <button type="button" className="btn btn-sm" onClick={crearCliente}>Guardar cliente</button>
            </div>
          )}
        </div>

        {/* VEHÍCULO */}
        <div className="form-group">
          <label>Vehículo</label>
          <div className="row-group">
            <select value={form.placa} onChange={(e) => set('placa', e.target.value)} disabled={!form.id_cliente && !modoNuevoVehiculo}>
              <option value="">-- Seleccionar vehículo --</option>
              {vehiculosCliente.map((v) => (
                <option key={v.placa} value={v.placa}>{v.placa} — {v.marca} {v.color}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setModoNuevoVehiculo((v) => !v)} disabled={!form.id_cliente}>
              {modoNuevoVehiculo ? 'Cancelar' : '+ Nuevo'}
            </button>
          </div>
          {modoNuevoVehiculo && (
            <div className="inline-form">
              <input placeholder="Placa (ej: ABC123)" value={nuevoVehiculo.placa} onChange={(e) => setNuevoVehiculo((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} />
              <input placeholder="Marca" value={nuevoVehiculo.marca} onChange={(e) => setNuevoVehiculo((p) => ({ ...p, marca: e.target.value }))} />
              <input placeholder="Color" value={nuevoVehiculo.color} onChange={(e) => setNuevoVehiculo((p) => ({ ...p, color: e.target.value }))} />
              <select value={nuevoVehiculo.tipo} onChange={(e) => setNuevoVehiculo((p) => ({ ...p, tipo: e.target.value }))}>
                <option>Automóvil</option>
                <option>Motocicleta</option>
                <option>Camioneta</option>
                <option>Bus</option>
              </select>
              <button type="button" className="btn btn-sm" onClick={crearVehiculo}>Guardar vehículo</button>
            </div>
          )}
        </div>

        {/* ESPACIO */}
        <div className="form-group">
          <label>Espacio disponible ({espaciosLibres.length} libres)</label>
          <select value={form.id_espacio} onChange={(e) => set('id_espacio', e.target.value)}>
            <option value="">-- Seleccionar espacio --</option>
            {espaciosLibres.map((esp) => (
              <option key={esp.id_espacio} value={esp.id_espacio}>{esp.codigo} — {esp.tipo_ubicacion}</option>
            ))}
          </select>
        </div>

        {/* TARIFA */}
        <div className="form-group">
          <label>Tarifa</label>
          <select value={form.id_tarifa} onChange={(e) => set('id_tarifa', e.target.value)}>
            <option value="">-- Seleccionar tarifa --</option>
            {tarifas.map((t) => (
              <option key={t.id_tarifa} value={t.id_tarifa}>{t.nombre} — ${t.valor}/{t.unidad_tiempo}</option>
            ))}
          </select>
        </div>

        {/* EMPLEADO */}
        <div className="form-group">
          <label>Empleado que registra</label>
          <select value={form.id_empleado} onChange={(e) => set('id_empleado', e.target.value)}>
            <option value="">-- Seleccionar empleado --</option>
            {empleados.map((em) => (
              <option key={em.id_empleado} value={em.id_empleado}>{em.nombre} ({em.rol})</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-full" disabled={loading}>
          {loading ? 'Registrando...' : '🚗 Registrar Entrada'}
        </button>
      </form>
    </div>
  );
}
