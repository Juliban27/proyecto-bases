import React, { useState, useEffect } from 'react';
import api from '../api';

function BarChart({ data, valueKey, labelKey, color = 'var(--accent)' }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>Sin datos</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => {
        const pct = max > 0 ? (Number(d[valueKey]) / max) * 100 : 0;
        return (
          <div key={i} className="bar-row">
            <div className="bar-label">{d[labelKey]}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="bar-value">{Number(d[valueKey]).toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Reportes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reportes/')
      .then((r) => setData(r.data))
      .catch(() => setError('Error cargando reportes — ¿el backend está corriendo?'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Generando reportes...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const { totales, ingresos_diarios, vehiculos_top, uso_espacios, por_metodo } = data;

  return (
    <div>
      <h2 className="section-title">Reportes y Estadísticas</h2>

      {/* KPIs */}
      <div className="stats-row" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{totales.total_tickets}</div>
          <div className="stat-label">Tickets totales</div>
        </div>
        <div className="stat-card libre">
          <div className="stat-value">{totales.activos}</div>
          <div className="stat-label">En parqueadero ahora</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totales.total_pagos}</div>
          <div className="stat-label">Pagos realizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${Number(totales.ingresos_totales).toLocaleString()}</div>
          <div className="stat-label">Ingresos totales</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totales.total_clientes}</div>
          <div className="stat-label">Clientes registrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totales.total_vehiculos}</div>
          <div className="stat-label">Vehículos registrados</div>
        </div>
      </div>

      <div className="reportes-grid">

        {/* Ingresos últimos 14 días */}
        <div className="reporte-card">
          <h3>Ingresos últimos 14 días</h3>
          {ingresos_diarios.length === 0 ? (
            <p className="no-data">Sin registros aún</p>
          ) : (
            <BarChart
              data={ingresos_diarios}
              labelKey="fecha"
              valueKey="ingresos"
              color="var(--success)"
            />
          )}
        </div>

        {/* Métodos de pago */}
        <div className="reporte-card">
          <h3>Métodos de pago</h3>
          {por_metodo.length === 0 ? (
            <p className="no-data">Sin registros aún</p>
          ) : (
            <div>
              <BarChart data={por_metodo} labelKey="metodo_pago" valueKey="total" color="var(--accent)" />
              <table className="mini-table" style={{ marginTop: '1rem' }}>
                <thead><tr><th>Método</th><th>Pagos</th><th>Total</th></tr></thead>
                <tbody>
                  {por_metodo.map((m) => (
                    <tr key={m.metodo_pago}>
                      <td>{m.metodo_pago}</td>
                      <td>{m.pagos}</td>
                      <td className="cell-total">${Number(m.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vehículos más frecuentes */}
        <div className="reporte-card">
          <h3>Vehículos más frecuentes</h3>
          {vehiculos_top.length === 0 ? (
            <p className="no-data">Sin registros aún</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr><th>Placa</th><th>Vehículo</th><th>Cliente</th><th>Visitas</th><th>Total pagado</th></tr>
              </thead>
              <tbody>
                {vehiculos_top.map((v) => (
                  <tr key={v.placa}>
                    <td><span className="placa-chip">{v.placa}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{v.marca} {v.color}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{v.cliente}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{v.visitas}</td>
                    <td className="cell-total">${Number(v.total_pagado).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Espacios más usados */}
        <div className="reporte-card">
          <h3>Espacios más usados</h3>
          {uso_espacios.length === 0 ? (
            <p className="no-data">Sin registros aún</p>
          ) : (
            <div>
              <BarChart
                data={uso_espacios.filter((e) => e.total_tickets > 0)}
                labelKey="codigo"
                valueKey="total_tickets"
                color="var(--warning)"
              />
              <table className="mini-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr><th>Espacio</th><th>Tipo</th><th>Usos</th><th>Prom. min</th><th>Ingresos</th></tr>
                </thead>
                <tbody>
                  {uso_espacios.map((e) => (
                    <tr key={e.codigo}>
                      <td><strong>{e.codigo}</strong></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.tipo_ubicacion}</td>
                      <td style={{ textAlign: 'center' }}>{e.total_tickets}</td>
                      <td style={{ textAlign: 'center', color: 'var(--warning)' }}>
                        {e.promedio_minutos ? Math.round(e.promedio_minutos) : '—'}
                      </td>
                      <td className="cell-total">${Number(e.ingresos_generados || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Nota académica sobre vistas SQL */}
      <div className="sql-note">
        <h4>Vistas SQL utilizadas en estos reportes</h4>
        <div className="sql-chips">
          <span className="sql-chip">vista_ocupacion_actual</span>
          <span className="sql-chip">vista_ingresos_diarios</span>
          <span className="sql-chip">vista_tickets_completos</span>
          <span className="sql-chip">vista_uso_espacios</span>
        </div>
        <p>Los datos provienen directamente de consultas SQL sobre las vistas y triggers definidos en la base de datos.</p>
      </div>
    </div>
  );
}
