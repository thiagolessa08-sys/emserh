'use client';

interface HeaderProps {
  onLogoClick?: () => void;
  active?: 'analise' | 'regras';
}

export function Header({ onLogoClick, active = 'analise' }: HeaderProps) {
  // Na home (onLogoClick definido) faz reset SPA; nas demais telas o link "/" navega.
  function handleHome(e: React.MouseEvent) {
    if (onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  }

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/" onClick={handleHome} aria-label="Voltar para a tela inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="brand-divider" />
          <div className="brand-meta">
            <div className="system">Auditor de Conformidade</div>
            <div className="dept">GCIF · Gerência de Controle Interno Financeiro</div>
          </div>
        </a>
        <div className="header-right">
          <a
            className={`header-link ${active === 'analise' ? 'active' : ''}`}
            href="/"
            onClick={handleHome}
          >
            Nova análise
          </a>
          <a className="header-link" href="#">Histórico</a>
          <a className={`header-link ${active === 'regras' ? 'active' : ''}`} href="/admin">Regras</a>
          <div className="user-chip">
            <span className="name">M. Carvalho</span>
            <div className="avatar">MC</div>
          </div>
        </div>
      </div>
    </header>
  );
}
