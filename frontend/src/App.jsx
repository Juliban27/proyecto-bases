import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Entrada from './components/Entrada';
import Activos from './components/Activos';
import Clientes from './components/Clientes';
import Historial from './components/Historial';
import Reportes from './components/Reportes';
import Config from './components/Config';

const TABS = [
  { id: 'dashboard', label: '🅿 Mapa' },
  { id: 'entrada', label: '🚗 Entrada' },
  { id: 'activos', label: '⏱ Activos' },
  { id: 'historial', label: '📋 Historial' },
  { id: 'reportes', label: '📊 Reportes' },
  { id: 'clientes', label: '👤 Clientes' },
  { id: 'config', label: '⚙ Config' },
];

function App() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="container">
      <header>
        <h1>Smart Parking DB</h1>
        <p>Sistema de gestión de parqueadero — Triggers &amp; Decoradores</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'entrada' && <Entrada onSuccess={() => setTab('activos')} />}
        {tab === 'activos' && <Activos />}
        {tab === 'historial' && <Historial />}
        {tab === 'reportes' && <Reportes />}
        {tab === 'clientes' && <Clientes />}
        {tab === 'config' && <Config />}
      </main>
    </div>
  );
}

export default App;
