'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface Ev { username: string; ts: string; conforme: boolean; durationMs: number; }
interface Usr { email: string; nome: string; unidade: string; role: string; }

const AV = ['#14304F', '#7FB348', '#3FA9D5', '#A86A12', '#B53A2C', '#2F7D4A', '#1E4570', '#5B7A2E'];
const UNIT_COLORS = ['#14304F', '#7FB348', '#3FA9D5', '#A86A12', '#94A1B2'];

function initials(n: string): string {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '—';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function relativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'agora há pouco';
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

export function AnalyticsDashboard() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [users, setUsers] = useState<Usr[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((d) => { setEvents(d.events ?? []); setUsers(d.users ?? []); setCarregado(true); })
      .catch(() => setCarregado(true));
  }, []);

  // Mede o container do gráfico para desenhá-lo no tamanho real (preenche o card sem distorção)
  const chartRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 700, h: 360 });
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const now = Date.now();
    const cutoff = now - days * 86_400_000;
    const prevCut = now - 2 * days * 86_400_000;
    const byEmail = new Map(users.map((u) => [u.email, u] as const));

    const inP = events.filter((e) => new Date(e.ts).getTime() >= cutoff);
    const prevP = events.filter((e) => { const t = new Date(e.ts).getTime(); return t >= prevCut && t < cutoff; });

    const total = inP.length;
    const totalPrev = prevP.length;
    const ativos = new Set(inP.map((e) => e.username)).size;
    const ativosPrev = new Set(prevP.map((e) => e.username)).size;
    const media = total / days;
    const mediaPrev = totalPrev / days;
    const avgMs = total ? inP.reduce((s, e) => s + (e.durationMs || 0), 0) / total : 0;
    const avgMsPrev = totalPrev ? prevP.reduce((s, e) => s + (e.durationMs || 0), 0) / totalPrev : 0;

    // por dia
    const perDayMap = new Map<string, { good: number; bad: number }>();
    for (const e of inP) {
      const k = ymd(new Date(e.ts));
      const cur = perDayMap.get(k) ?? { good: 0, bad: 0 };
      if (e.conforme) cur.good++; else cur.bad++;
      perDayMap.set(k, cur);
    }
    const perDay: { good: number; bad: number }[] = [];
    for (let k = days - 1; k >= 0; k--) {
      const key = ymd(new Date(now - k * 86_400_000));
      perDay.push(perDayMap.get(key) ?? { good: 0, bad: 0 });
    }

    // por usuário
    const perUser = new Map<string, { docs: number; conf: number; last: string }>();
    for (const e of inP) {
      const cur = perUser.get(e.username) ?? { docs: 0, conf: 0, last: e.ts };
      cur.docs++; if (e.conforme) cur.conf++;
      if (new Date(e.ts) > new Date(cur.last)) cur.last = e.ts;
      perUser.set(e.username, cur);
    }
    const ranking = [...perUser.entries()].map(([email, v]) => {
      const u = byEmail.get(email);
      return { email, nome: u?.nome ?? email, unidade: u?.unidade ?? '—', role: u?.role ?? '—', ...v, conformidade: v.docs ? Math.round((v.conf / v.docs) * 100) : 0 };
    }).sort((a, b) => b.docs - a.docs);

    // por unidade
    const unitMap = new Map<string, number>();
    for (const e of inP) {
      const u = byEmail.get(e.username);
      const un = u?.unidade || 'Outras';
      unitMap.set(un, (unitMap.get(un) ?? 0) + 1);
    }
    const byUnit = [...unitMap.entries()].map(([name, val], i) => ({ name, val, color: UNIT_COLORS[i % UNIT_COLORS.length] })).sort((a, b) => b.val - a.val);

    return { total, totalPrev, ativos, ativosPrev, media, mediaPrev, avgMs, avgMsPrev, perDay, ranking, byUnit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, users, days]);

  function delta(cur: number, prev: number): { txt: string; up: boolean } | null {
    if (!prev) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { txt: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, up: pct >= 0 };
  }
  function tempoTxt(ms: number): string {
    if (!ms) return '—';
    return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`;
  }

  // Gráfico de barras (SVG)
  const chart = useMemo(() => {
    const W = dims.w || 700, H = dims.h || 360, padL = 34, padB = 26, padT = 8;
    const n = data.perDay.length;
    const maxV = Math.max(10, ...data.perDay.map((d) => d.good + d.bad));
    const niceMax = Math.ceil(maxV / 10) * 10;
    const plotW = W - padL, plotH = H - padB - padT;
    const bw = plotW / n;
    const barW = Math.min(bw * 0.62, 18);
    const bars = data.perDay.map((d, i) => {
      const x = padL + i * bw + (bw - barW) / 2;
      const totalH = ((d.good + d.bad) / niceMax) * plotH;
      const badH = (d.bad / niceMax) * plotH;
      const goodH = totalH - badH;
      return { x, barW, goodY: padT + plotH - goodH, goodH, badY: padT + plotH - totalH, badH, label: i + 1 };
    });
    const grid = [0, 1, 2, 3, 4].map((i) => ({ y: padT + plotH * (i / 4), val: Math.round(niceMax * (1 - i / 4)) }));
    return { W, H, padL, bars, grid, n };
  }, [data.perDay]);

  const donutTotal = data.byUnit.reduce((s, u) => s + u.val, 0);
  const donutSegs = (() => {
    const r = 52, cx = 66, cy = 66, circ = 2 * Math.PI * r;
    let off = 0;
    return data.byUnit.map((d) => {
      const len = (donutTotal ? d.val / donutTotal : 0) * circ;
      const seg = { ...d, r, cx, cy, circ, len, off };
      off += len;
      return seg;
    });
  })();

  const dDocs = delta(data.total, data.totalPrev);
  const dMedia = delta(data.media, data.mediaPrev);

  return (
    <main className="prod-page">
      <div className="prod-head">
        <div>
          <div className="breadcrumb"><span>Administração</span> › <span>Uso e produção</span></div>
          <h1 className="page-title">Produção de <em>documentos</em> por usuário</h1>
          <p className="page-sub">Quantos processos e relatórios de conformidade cada servidor está gerando, e como o volume evolui ao longo do período.</p>
        </div>
        <div className="seg">
          {[[7, '7 dias'], [30, '30 dias'], [90, 'Trimestre']].map(([v, l]) => (
            <button key={v as number} className={days === v ? 'active' : ''} onClick={() => setDays(v as number)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon a">▤</div>{dDocs && <div className={`kpi-delta ${dDocs.up ? 'up' : 'down'}`}>{dDocs.txt}</div>}</div>
          <div className="kpi-val">{data.total.toLocaleString('pt-BR')}</div>
          <div className="kpi-label">Documentos analisados</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon c">◍</div></div>
          <div className="kpi-val">{data.ativos}</div>
          <div className="kpi-label">Usuários ativos</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon b">★</div>{dMedia && <div className={`kpi-delta ${dMedia.up ? 'up' : 'down'}`}>{dMedia.txt}</div>}</div>
          <div className="kpi-val">{data.media.toFixed(1)}<span style={{ fontSize: 18 }}>/dia</span></div>
          <div className="kpi-label">Média diária</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon d">◷</div></div>
          <div className="kpi-val">{tempoTxt(data.avgMs)}</div>
          <div className="kpi-label">Tempo médio / análise</div>
        </div>
      </div>

      <div className="prod-grid">
        <div className="card chart-card">
          <div className="card-head-p">
            <div><div className="ct">Documentos gerados por dia</div><div className="cs">Últimos {days} dias · conformes e com apontamentos</div></div>
            <div className="legend">
              <span><span className="sw" style={{ background: 'var(--m-navy)' }} /> Conformes</span>
              <span><span className="sw" style={{ background: 'var(--m-green)' }} /> Com apontamentos</span>
            </div>
          </div>
          <div className="card-body-p chart-body">
            <div className="chart-area" ref={chartRef}>
              {!carregado && <p className="prod-empty">Carregando...</p>}
              {carregado && data.total === 0 && <p className="prod-empty">Nenhuma análise registrada no período.</p>}
              {carregado && data.total > 0 && (
                <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="chart-svg" preserveAspectRatio="none">
                  {chart.grid.map((g, i) => (
                    <g key={i}>
                      <line x1={chart.padL} y1={g.y} x2={chart.W} y2={g.y} stroke="var(--m-line-2)" strokeWidth={1} />
                      <text x={chart.padL - 8} y={g.y + 3} textAnchor="end" fontSize={10.5} fill="var(--m-muted-2)" fontFamily="var(--font-jetbrains-mono), monospace">{g.val}</text>
                    </g>
                  ))}
                  {chart.bars.map((b, i) => (
                    <g key={i}>
                      <rect x={b.x} y={b.goodY} width={b.barW} height={b.goodH} rx={2} fill="var(--m-navy)" />
                      <rect x={b.x} y={b.badY} width={b.barW} height={b.badH} rx={2} fill="var(--m-green)" />
                      {(chart.n <= 14 || i % 3 === 0) && (
                        <text x={b.x + b.barW / 2} y={chart.H - 8} textAnchor="middle" fontSize={10} fill="var(--m-muted)">{b.label}</text>
                      )}
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>

        <div className="prod-side">
          <div className="card">
            <div className="card-head-p"><div><div className="ct">Ranking de produção</div><div className="cs">Maior volume no período</div></div></div>
            <div className="card-body-p">
              <div className="rank-list">
                {data.ranking.slice(0, 5).map((u, i) => (
                  <div key={u.email} className={`rank-row ${i === 0 ? 'top' : ''}`}>
                    <div className="rank-pos">{i + 1}</div>
                    <div className="rank-avatar" style={{ background: AV[i % AV.length] }}>{initials(u.nome)}</div>
                    <div className="rank-info"><div className="rank-name">{u.nome}</div><div className="rank-unit">{u.unidade} · {u.role}</div></div>
                    <div className="rank-count"><div className="n">{u.docs}</div><div className="l">docs</div></div>
                  </div>
                ))}
                {data.ranking.length === 0 && <p className="prod-empty">Sem dados.</p>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head-p"><div><div className="ct">Por unidade</div><div className="cs">Distribuição do volume</div></div></div>
            <div className="card-body-p">
              <div className="donut-wrap">
                <div className="donut-center">
                  <svg width={132} height={132} viewBox="0 0 132 132">
                    {donutSegs.map((s, i) => (
                      <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={s.color} strokeWidth={16}
                        strokeDasharray={`${s.len} ${s.circ - s.len}`} strokeDashoffset={-s.off} transform={`rotate(-90 ${s.cx} ${s.cy})`} />
                    ))}
                  </svg>
                  <div className="dc-total"><div className="n">{donutTotal.toLocaleString('pt-BR')}</div><div className="l">docs</div></div>
                </div>
                <div className="donut-legend">
                  {data.byUnit.map((d) => (
                    <div key={d.name} className="dl-item"><span className="sw" style={{ background: d.color }} /><span className="dl-name">{d.name}</span><span className="dl-val">{d.val}</span></div>
                  ))}
                  {data.byUnit.length === 0 && <span className="prod-empty">Sem dados.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-head-p"><div><div className="ct">Detalhamento por usuário</div><div className="cs">Documentos gerados, taxa de conformidade e última atividade</div></div></div>
        <div className="card-body-p">
          <table className="prod-table">
            <thead><tr><th>Servidor</th><th>Unidade</th><th className="num">Documentos</th><th className="num">Conformidade</th><th className="num">Última atividade</th></tr></thead>
            <tbody>
              {data.ranking.map((u, i) => {
                const tag = u.conformidade >= 90 ? 'ok' : (u.conformidade >= 83 ? 'warn' : 'err');
                const maxDocs = data.ranking[0]?.docs || 1;
                return (
                  <tr key={u.email}>
                    <td><div className="u-cell"><div className="ua" style={{ background: AV[i % AV.length] }}>{initials(u.nome)}</div><div><div className="un">{u.nome}</div><div className="ur">{u.role}</div></div></div></td>
                    <td>{u.unidade}</td>
                    <td className="num"><span className="mini-bar"><i style={{ width: `${Math.round((u.docs / maxDocs) * 100)}%` }} /></span>{u.docs}</td>
                    <td className="num"><span className={`tag ${tag}`}>{u.conformidade}%</span></td>
                    <td className="num" style={{ color: 'var(--m-muted)' }}>{relativo(u.last)}</td>
                  </tr>
                );
              })}
              {data.ranking.length === 0 && <tr><td colSpan={5} className="prod-empty">Nenhuma análise registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
