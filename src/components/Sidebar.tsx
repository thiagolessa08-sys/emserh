const CHECK_ITEMS = [
  {
    title: 'Empenho, liquidação e pagamento',
    sub: 'Conferência dos três estágios da despesa pública.',
  },
  {
    title: 'Certidões e habilitação',
    sub: 'Validade fiscal, trabalhista e previdenciária.',
  },
  {
    title: 'Assinaturas e atestos',
    sub: 'Identifica responsáveis e datas exigidas.',
  },
  {
    title: 'Vinculação ao contrato',
    sub: 'Itens, valores e prazos vs. instrumento contratual.',
  },
] as const;

const RECENT_ITEMS = [
  {
    name: 'Processo 2024.0451 — Hosp. Carlos Macieira',
    date: 'há 2 horas · 14 documentos',
    badge: null,
  },
  {
    name: 'Empenho 2024.388 — Manut. predial',
    date: 'ontem · 7 documentos',
    badge: { cls: 'warn', label: '3 OBS.' },
  },
  {
    name: 'Contrato 097/2024 — Insumos',
    date: '3 dias · 22 documentos',
    badge: { cls: 'err', label: '5 NC' },
  },
] as const;

function CheckIcon() {
  return (
    <div className="check-icon">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path
          d="M2 5.5L4.5 8L9 3"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="side">
      <div className="card">
        <div className="card-head">
          <div className="card-title">O que é verificado</div>
        </div>
        <div className="card-body">
          <div className="checklist">
            {CHECK_ITEMS.map((item) => (
              <div key={item.title} className="check-item">
                <CheckIcon />
                <div>
                  {item.title}
                  <small>{item.sub}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Análises Recentes</div>
        </div>
        <div className="card-body" style={{ paddingTop: '6px' }}>
          <div className="recent">
            {RECENT_ITEMS.map((item) => (
              <div key={item.name} className="recent-item">
                <div>
                  <div className="recent-name">{item.name}</div>
                  <div className="recent-date">{item.date}</div>
                </div>
                {item.badge && (
                  <span className={`em-badge ${item.badge.cls}`}>{item.badge.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
