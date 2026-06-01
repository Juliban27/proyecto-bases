import React, { useState, useEffect } from 'react';
import { clientes as clientesApi, vehiculos as vehiculosApi } from '../api';

const INITIAL_CLIENTE = { nombre: '', telefono: '', tipo_cliente: 'Regular' };
const INITIAL_VEH = { placa: '', tipo: 'Automóvil', marca: '', color: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [vehiculosMap, setVehiculosMap] = useState({});
  const [editCliente, setEditCliente] = useState(null);
  const [formCliente, setFormCliente] = useState(INITIAL_CLIENTE);
  const [formVeh, setFormVeh] = useState(INITIAL_VEH);
  const [mostrarFormVeh, setMostrarFormVeh] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClientes = async () => {
    try {
      const res = await clientesApi.list();
      setClientes(res.data);
    } catch { setMsg('Error cargando clientes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClientes(); }, []);

  const toggleExpand = async (id) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!vehiculosMap[id]) {
      const res = await clientesApi.vehiculos(id);
      setVehiculosMap((m) => ({ ...m, [id]: res.data }));
    }
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    try {
      if (editCliente) {
        await clientesApi.update(editCliente, formCliente);
        setMsg('Cliente actualizado');
      } else {
        await clientesApi.create(formCliente);
        setMsg('Cliente creado');
      }
      setFormCliente(INITIAL_CLIENTE);
      setEditCliente(null);
      fetchClientes();
    } catch (err) {
      const data = err.response?.data;
      setMsg('Error: ' + (data ? Object.values(data).flat().join(', ') : 'desconocido'));
    }
  };

  const eliminarCliente = async (id) => {
    if (!confirm('¿Eliminar este cliente y todos sus vehículos?')) return;
    try {
      await clientesApi.destroy(id);
      setMsg('Cliente eliminado');
      fetchClientes();
    } catch { setMsg('No se puede eliminar — tiene tickets asociados'); }
  };

  const agregarVehiculo = async (e, clienteId) => {
    e.preventDefault();
    try {
      const res = await vehiculosApi.create({ ...formVeh, id_cliente: clienteId });
      setVehiculosMap((m) => ({ ...m, [clienteId]: [...(m[clienteId] || []), res.data] }));
      setFormVeh(INITIAL_VEH);
      setMostrarFormVeh(null);
      setMsg('Vehículo agregado');
    } catch (err) {
      const data = err.response?.data;
      setMsg('Error: ' + (data ? Object.values(data).flat().join(', ') : 'desconocido'));
    }
  };

  const eliminarVehiculo = async (placa, clienteId) => {
    if (!confirm(`¿Eliminar vehículo ${placa}?`)) return;
    try {
      await vehiculosApi.destroy(placa);
      setVehiculosMap((m) => ({ ...m, [clienteId]: m[clienteId].filter((v) => v.placa !== placa) }));
      setMsg('Vehículo eliminado');
    } catch { setMsg('No se puede eliminar — tiene tickets asociados'); }
  };

  const iniciarEdicion = (c) => {
    setEditCliente(c.id_cliente);
    setFormCliente({ nombre: c.nombre, telefono: c.telefono, tipo_cliente: c.tipo_cliente });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="loading">Cargando clientes...</div>;

  return (
    <div>
      <h2 className="section-title">Clientes</h2>

      {msg && (
        <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>
          {msg} <button className="close-btn" onClick={() => setMsg('')}>×</button>
        </div>
      )}

      {/* Formulario cliente */}
      <div className="form-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>{editCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
        <form onSubmit={guardarCliente}>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre</label>
              <input required placeholder="Nombre completo" value={formCliente.nombre}
                onChange={(e) => setFormCliente((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input required placeholder="300 000 0000" value={formCliente.telefono}
                onChange={(e) => setFormCliente((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={formCliente.tipo_cliente}
                onChange={(e) => setFormCliente((f) => ({ ...f, tipo_cliente: e.target.value }))}>
                <option>Regular</option>
                <option>Mensualero</option>
                <option>VIP</option>
              </select>
            </div>
          </div>
          <div className="row-group" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
            {editCliente && (
              <button type="button" className="btn btn-outline" onClick={() => { setEditCliente(null); setFormCliente(INITIAL_CLIENTE); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn">{editCliente ? 'Actualizar' : 'Crear Cliente'}</button>
          </div>
        </form>
      </div>

      {/* Lista clientes */}
      {clientes.length === 0 ? (
        <div className="empty-state">No hay clientes registrados.</div>
      ) : (
        clientes.map((c) => (
          <div key={c.id_cliente} className="card" style={{ marginBottom: '1rem' }}>
            <div className="cliente-header">
              <div>
                <strong>{c.nombre}</strong>
                <span className="badge badge-tipo">{c.tipo_cliente}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '1rem', fontSize: '0.9rem' }}>{c.telefono}</span>
              </div>
              <div className="row-group" style={{ gap: '0.5rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => toggleExpand(c.id_cliente)}>
                  {expandido === c.id_cliente ? '▲ Vehículos' : '▼ Vehículos'}
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => iniciarEdicion(c)}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => eliminarCliente(c.id_cliente)}>Eliminar</button>
              </div>
            </div>

            {expandido === c.id_cliente && (
              <div className="vehiculos-section">
                <div className="vehiculos-list">
                  {(vehiculosMap[c.id_cliente] || []).length === 0 && (
                    <p style={{ color: 'var(--text-secondary)' }}>Sin vehículos registrados</p>
                  )}
                  {(vehiculosMap[c.id_cliente] || []).map((v) => (
                    <div key={v.placa} className="vehiculo-item">
                      <span className="veh-placa">{v.placa}</span>
                      <span>{v.marca} {v.color} ({v.tipo})</span>
                      <button className="btn btn-sm btn-danger" onClick={() => eliminarVehiculo(v.placa, c.id_cliente)}>×</button>
                    </div>
                  ))}
                </div>

                {mostrarFormVeh === c.id_cliente ? (
                  <form onSubmit={(e) => agregarVehiculo(e, c.id_cliente)} className="inline-form" style={{ marginTop: '1rem' }}>
                    <input required placeholder="Placa (ABC123)" value={formVeh.placa}
                      onChange={(e) => setFormVeh((f) => ({ ...f, placa: e.target.value.toUpperCase() }))} />
                    <input required placeholder="Marca" value={formVeh.marca}
                      onChange={(e) => setFormVeh((f) => ({ ...f, marca: e.target.value }))} />
                    <input placeholder="Color" value={formVeh.color}
                      onChange={(e) => setFormVeh((f) => ({ ...f, color: e.target.value }))} />
                    <select value={formVeh.tipo} onChange={(e) => setFormVeh((f) => ({ ...f, tipo: e.target.value }))}>
                      <option>Automóvil</option>
                      <option>Motocicleta</option>
                      <option>Camioneta</option>
                      <option>Bus</option>
                    </select>
                    <button type="submit" className="btn btn-sm">Agregar</button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setMostrarFormVeh(null)}>Cancelar</button>
                  </form>
                ) : (
                  <button className="btn btn-sm btn-outline" style={{ marginTop: '1rem' }}
                    onClick={() => setMostrarFormVeh(c.id_cliente)}>
                    + Agregar vehículo
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
