interface HeaderProps {
  onLogoClick?: () => void;
}

export function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <button
          type="button"
          className="brand"
          onClick={onLogoClick}
          aria-label="Voltar para a tela inicial"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="brand-divider" />
          <div className="brand-meta">
            <div className="system">Auditor de Conformidade</div>
            <div className="dept">GCIF · Gerência de Controle Interno Financeiro</div>
          </div>
        </button>
        <div className="header-right">
          <a
            className="header-link active"
            href="#"
            onClick={(e) => { e.preventDefault(); onLogoClick?.(); }}
          >
            Nova análise
          </a>
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
