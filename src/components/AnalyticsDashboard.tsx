'use client';

import { useEffect, useState } from 'react';

type Analytics = { [data: string]: { [username: string]: number } };

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics>({});
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((d) => { setAnalytics(d.analytics ?? {}); setNomes(d.nomes ?? {}); setCarregado(true); })
      .catch(() => setCarregado(true));
  }, []);

  const datas = Object.keys(analytics).sort().reverse();
  const linhas = datas.map((data) => {
    const porUsuario = analytics[data];
    const total = Object.values(porUsuario).reduce((s, n) => s + n, 0);
    return { data, porUsuario, total };
  });
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <main className="admin-editor">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Estatísticas de análises</div>
          <span style={{ fontSize: '12px', color: 'var(--em-muted)' }}>Total geral: <strong>{totalGeral}</strong></span>
        </div>
        <div className="card-body">
          {!carregado && <p className="user-empty">Carregando...</p>}
          {carregado && linhas.length === 0 && <p className="user-empty">Nenhuma análise registrada ainda.</p>}
          {linhas.map((l) => (
            <div key={l.data} className="stat-day">
              <div className="stat-day-head">
                <span className="stat-day-date">{l.data.split('-').reverse().join('/')}</span>
                <span className="stat-day-total">{l.total} análise(s)</span>
              </div>
              <div className="stat-users">
                {Object.entries(l.porUsuario).sort((a, b) => b[1] - a[1]).map(([u, n]) => (
                  <div key={u} className="stat-user-row">
                    <span>{nomes[u] ?? u}</span>
                    <span className="stat-user-count">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
