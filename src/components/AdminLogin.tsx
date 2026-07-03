'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminLoginProps {
  area?: 'regras' | 'usuarios' | 'estatisticas';
  titulo?: string;
}

export function AdminLogin({ area = 'regras', titulo = 'Administração' }: AdminLoginProps) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, senha }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      setErro('Senha incorreta.');
    }
  }

  return (
    <main className="admin-login">
      <form className="card admin-login-card" onSubmit={submit}>
        <div className="card-head"><div className="card-title">{titulo}</div></div>
        <div className="card-body">
          <label className="segment-label" htmlFor="senha">Senha de acesso</label>
          <input
            id="senha"
            type="password"
            className="admin-input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
          />
          {erro && <p className="admin-error">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={loading || !senha}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
