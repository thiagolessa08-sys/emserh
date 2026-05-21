export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="brand-divider" />
          <div className="brand-meta">
            <div className="system">Auditor de Conformidade</div>
            <div className="dept">GCIF · Gerência de Controle Interno Financeiro</div>
          </div>
        </div>
        <div className="header-right">
          <a className="header-link active" href="#">Nova análise</a>
          <a className="header-link" href="#">Histórico</a>
          <a className="header-link" href="#">Normativos</a>
          <div className="user-chip">
            <span className="name">M. Carvalho</span>
            <div className="avatar">MC</div>
          </div>
        </div>
      </div>
    </header>
  );
}
