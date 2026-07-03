'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setErro('Usuário ou senha incorretos.');
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="login-sub">Auditor de Conformidade · GCIF</div>
        </div>
        <div className="card-body">
          <label className="segment-label" htmlFor="usuario">Usuário</label>
          <input id="usuario" className="admin-input" value={username} autoFocus
            onChange={(e) => setUsername(e.target.value)} />
          <label className="segment-label" htmlFor="senha">Senha</label>
          <input id="senha" type="password" className="admin-input" value={senha}
            onChange={(e) => setSenha(e.target.value)} />
          {erro && <p className="admin-error">{erro}</p>}
          <button className="btn-primary" type="submit" disabled={loading || !username || !senha}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
