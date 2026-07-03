'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onLogoClick?: () => void;
  active?: 'analise' | 'regras';
}

export function Header({ onLogoClick, active = 'analise' }: HeaderProps) {
  const [nome, setNome] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (ativo) setNome(d?.user?.nome ?? null); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  function handleHome(e: React.MouseEvent) {
    if (onLogoClick) { e.preventDefault(); onLogoClick(); }
  }

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }

  const iniciais = nome ? nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';

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
          <a className={`header-link ${active === 'analise' ? 'active' : ''}`} href="/" onClick={handleHome}>Nova análise</a>
          <a className="header-link" href="#">Histórico</a>
          <a className={`header-link ${active === 'regras' ? 'active' : ''}`} href="/admin">Regras</a>
          {nome && (
            <div className="user-chip">
              <span className="name">{nome}</span>
              <div className="avatar">{iniciais}</div>
              <button className="logout-btn" onClick={sair} title="Sair">Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
