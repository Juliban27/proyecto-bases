import React, { useState, useEffect, useCallback } from 'react';
import { espacios as espaciosApi } from '../api';
import ParkingMap from './ParkingMap';

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);

  const fetchResumen = useCallback(async () => {
    try {
      const res = await espaciosApi.resumen();
      setResumen(res.data);
    } catch {/* backend offline */}
  }, []);

  useEffect(() => {
    fetchResumen();
  }, [fetchResumen]);

  return (
    <div>
      {resumen && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{resumen.total}</div>
            <div className="stat-label">Espacios totales</div>
          </div>
          <div className="stat-card libre">
            <div className="stat-value">{resumen.libres}</div>
            <div className="stat-label">Disponibles</div>
          </div>
          <div className="stat-card ocupado">
            <div className="stat-value">{resumen.ocupados}</div>
            <div className="stat-label">Ocupados</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{resumen.tickets_hoy}</div>
            <div className="stat-label">Tickets hoy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">${Number(resumen.ingresos_hoy).toLocaleString()}</div>
            <div className="stat-label">Ingresos hoy</div>
          </div>
        </div>
      )}

      <ParkingMap onStatsChange={fetchResumen} />
    </div>
  );
}
