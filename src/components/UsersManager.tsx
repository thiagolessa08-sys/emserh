'use client';

import { useEffect, useState } from 'react';

interface UserRow { username: string; nome: string; createdAt: string; }

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers((await res.json()).users);
  }

  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, username, senha }),
    });
    setLoading(false);
    if (res.ok) {
      setNome(''); setUsername(''); setSenha('');
      carregar();
    } else {
      const d = await res.json().catch(() => ({}));
      setErro(d.error ?? 'Falha ao criar usuário.');
    }
  }

  async function remover(u: string) {
    await fetch(`/api/admin/users?username=${encodeURIComponent(u)}`, { method: 'DELETE' });
    carregar();
  }

  return (
    <main className="admin-editor">
      <div className="card">
        <div className="card-head"><div className="card-title">Usuários</div></div>
        <div className="card-body">
          <form className="user-form" onSubmit={criar}>
            <input className="admin-input" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input className="admin-input" placeholder="Login (usuário)" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="admin-input" type="password" placeholder="Senha inicial" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={loading || !nome || !username || !senha}>
              {loading ? 'Criando...' : 'Adicionar usuário'}
            </button>
          </form>
          {erro && <p className="admin-error">{erro}</p>}

          <table className="user-table">
            <thead>
              <tr><th>Nome</th><th>Login</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.nome}</td>
                  <td>{u.username}</td>
                  <td><button className="rule-remove" onClick={() => remover(u.username)}>Remover</button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="user-empty">Nenhum usuário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
