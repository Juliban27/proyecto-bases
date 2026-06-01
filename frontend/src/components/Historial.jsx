import React, { useState, useEffect, useCallback } from 'react';
import { pagos as pagosApi } from '../api';

function duracion(entrada, salida) {
  if (!entrada || !salida) return '—';
  const diff = new Date(salida) - new Date(entrada);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Historial() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const fetchPagos = useCallback(async () => {
    try {
      const res = await pagosApi.list();
      setPagos(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  const filtrados = pagos.filter((p) => {
    const q = busqueda.toLowerCase();
    if (!q) return true;
    return (
      p.ticket_info?.placa_info?.placa?.toLowerCase().includes(q) ||
      p.ticket_info?.cliente_nombre?.toLowerCase().includes(q) ||
      p.metodo_pago?.toLowerCase().includes(q)
    );
  });

  const totalIngresos = filtrados.reduce((sum, p) => sum + parseFloat(p.total), 0);

  if (loading) return <div className="loading">Cargando historial...</div>;

  return (
    <div>
      <h2 className="section-title">Historial de Pagos</h2>

      <div className="historial-toolbar">
        <input
          placeholder="Buscar por placa, cliente o método de pago..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ maxWidth: '360px' }}
        />
        <div className="historial-summary">
          <span>{filtrados.length} registros</span>
          <span className="historial-total">Total: <strong>${totalIngresos.toLocaleString()}</strong></span>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '1.5rem' }}>
          {busqueda ? 'No hay resultados para esa búsqueda.' : 'Aún no hay pagos registrados.'}
        </div>
      ) : (
        <div className="historial-table-wrap">
          <table className="historial-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Placa</th>
                <th>Cliente</th>
                <th>Espacio</th>
                <th>Tarifa</th>
                <th>Entrada</th>
                <th>Duración</th>
                <th>Método</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const t = p.ticket_info;
                return (
                  <tr key={p.id_pago}>
                    <td className="cell-id">#{p.id_pago}</td>
                    <td><span className="placa-chip">{t?.placa_info?.placa}</span></td>
                    <td>{t?.cliente_nombre || '—'}</td>
                    <td>{t?.espacio_info?.codigo || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {t?.tarifa_info ? `${t.tarifa_info.nombre}` : '—'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {t?.fecha_entrada ? new Date(t.fecha_entrada).toLocaleString('es-CO') : '—'}
                    </td>
                    <td className="cell-duracion">{duracion(t?.fecha_entrada, t?.fecha_salida)}</td>
                    <td>
                      <span className="metodo-chip">{p.metodo_pago}</span>
                    </td>
                    <td className="cell-total">${Number(p.total).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
