import React, { useState, useEffect } from 'react';
import { empleados as empleadosApi, tarifas as tarifasApi, espacios as espaciosApi } from '../api';

function CrudSection({ title, items, fields, onAdd, onDelete, keyField, labelFn }) {
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onAdd(form);
      setForm({});
      setMsg('✅ Guardado');
    } catch (err) {
      const data = err.response?.data;
      setMsg('❌ ' + (data ? Object.values(data).flat().join(', ') : 'Error'));
    }
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="config-section">
      <h3>{title}</h3>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>{msg}</div>}

      <form onSubmit={handleSubmit} className="inline-form" style={{ flexWrap: 'wrap' }}>
        {fields.map((f) =>
          f.type === 'select' ? (
            <select key={f.name} value={form[f.name] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}>
              <option value="">{f.placeholder}</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              key={f.name}
              type={f.type || 'text'}
              placeholder={f.placeholder}
              required={f.required}
              value={form[f.name] || ''}
              step={f.step}
              onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
            />
          )
        )}
        <button type="submit" className="btn btn-sm">+ Agregar</button>
      </form>

      <div className="config-list">
        {items.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Sin registros aún</p>}
        {items.map((item) => (
          <div key={item[keyField]} className="config-item">
            <span>{labelFn(item)}</span>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(item[keyField])}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Config() {
  const [empleados, setEmpleados] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [globalMsg, setGlobalMsg] = useState('');

  const fetchAll = async () => {
    try {
      const [e, t, esp] = await Promise.all([empleadosApi.list(), tarifasApi.list(), espaciosApi.list()]);
      setEmpleados(e.data);
      setTarifas(t.data);
      setEspacios(esp.data);
    } catch { setGlobalMsg('Error cargando datos — ¿el backend está corriendo?'); }
  };

  useEffect(() => { fetchAll(); }, []);

  const wrapAdd = (apiFn, setter) => async (form) => {
    const res = await apiFn(form);
    setter((prev) => [...prev, res.data]);
  };

  const wrapDelete = (apiFn, setter, keyField) => async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await apiFn(id);
      setter((prev) => prev.filter((x) => x[keyField] !== id));
    } catch {
      setGlobalMsg('No se puede eliminar — tiene registros dependientes');
      setTimeout(() => setGlobalMsg(''), 4000);
    }
  };

  return (
    <div>
      <h2 className="section-title">Configuración</h2>

      {globalMsg && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{globalMsg}</div>}

      <div className="config-grid">
        <CrudSection
          title="Espacios de Parqueo"
          items={espacios}
          keyField="id_espacio"
          fields={[
            { name: 'codigo', placeholder: 'Código (A1)', required: true },
            { name: 'tipo_ubicacion', type: 'select', placeholder: '-- Tipo --', options: ['Cubierto', 'Descubierto', 'VIP', 'Motos'] },
          ]}
          onAdd={wrapAdd(espaciosApi.create, setEspacios)}
          onDelete={wrapDelete(espaciosApi.destroy, setEspacios, 'id_espacio')}
          labelFn={(e) => `${e.codigo} — ${e.tipo_ubicacion} [${e.estado}]`}
        />

        <CrudSection
          title="Tarifas"
          items={tarifas}
          keyField="id_tarifa"
          fields={[
            { name: 'nombre', placeholder: 'Nombre (ej: Normal)', required: true },
            { name: 'valor', type: 'number', placeholder: 'Valor $', required: true, step: '0.01' },
            { name: 'unidad_tiempo', type: 'select', placeholder: '-- Unidad --', options: ['minuto', 'hora', 'dia'] },
          ]}
          onAdd={wrapAdd(tarifasApi.create, setTarifas)}
          onDelete={wrapDelete(tarifasApi.destroy, setTarifas, 'id_tarifa')}
          labelFn={(t) => `${t.nombre} — $${t.valor}/${t.unidad_tiempo}`}
        />

        <CrudSection
          title="Empleados"
          items={empleados}
          keyField="id_empleado"
          fields={[
            { name: 'nombre', placeholder: 'Nombre completo', required: true },
            { name: 'rol', type: 'select', placeholder: '-- Rol --', options: ['Cajero', 'Vigilante', 'Administrador', 'Supervisor'] },
          ]}
          onAdd={wrapAdd(empleadosApi.create, setEmpleados)}
          onDelete={wrapDelete(empleadosApi.destroy, setEmpleados, 'id_empleado')}
          labelFn={(em) => `${em.nombre} — ${em.rol}`}
        />
      </div>
    </div>
  );
}
