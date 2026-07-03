'use client';

import { useMemo, useState, useEffect } from 'react';

interface UserRow {
  email: string; nome: string; cpf: string; matricula: string;
  telefone: string; unidade: string; cargo: string; role: string; createdAt: string;
}

const UNIDADES = [
  { value: 'GCIF', label: 'GCIF — Controle Interno Financeiro' },
  { value: 'GECOMP', label: 'GECOMP — Compras e Contratações' },
  { value: 'GEFIN', label: 'GEFIN — Financeiro' },
  { value: 'Hosp. Carlos Macieira', label: 'Hospital Carlos Macieira' },
  { value: 'Hosp. Ilha', label: 'Hospital da Ilha' },
  { value: 'Presidência', label: 'Presidência' },
];

const ROLES = [
  { id: 'Auditor', desc: 'Submete e analisa processos, emite relatórios.' },
  { id: 'Consulta', desc: 'Somente leitura de relatórios e históricos.' },
  { id: 'Administrador', desc: 'Gerencia usuários, normativos e parâmetros.' },
];

function initials(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '—';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function UsersManager() {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [unidade, setUnidade] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState('Auditor');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);

  async function carregar() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers((await res.json()).users);
  }
  useEffect(() => { carregar(); }, []);

  const req = useMemo(() => ({
    nome: nome.trim().split(/\s+/).filter(Boolean).length >= 2,
    cpf: cpf.replace(/\D/g, '').length === 11,
    email: /@emserh\.ma\.gov\.br$/i.test(email.trim()),
    unidade: !!unidade,
    senha: senha.length >= 4,
  }), [nome, cpf, email, unidade, senha]);

  const podeEnviar = req.nome && req.cpf && req.email && req.unidade && req.senha && !!matricula.trim();

  function onCpf(v: string) {
    let d = v.replace(/\D/g, '').slice(0, 11);
    d = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(d);
  }
  function onTel(v: string) {
    let d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length > 6) d = d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    else if (d.length > 2) d = d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    setTelefone(d.trim());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setLoading(true); setErro(null); setOk(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, cpf, matricula, telefone, unidade, cargo, role, senha }),
    });
    setLoading(false);
    if (res.ok) {
      setOk(`Usuário ${nome.trim().split(/\s+/)[0]} cadastrado com sucesso.`);
      setNome(''); setCpf(''); setMatricula(''); setEmail(''); setTelefone('');
      setUnidade(''); setCargo(''); setRole('Auditor'); setSenha('');
      carregar();
      setTimeout(() => setOk(null), 3500);
    } else {
      const d = await res.json().catch(() => ({}));
      setErro(d.error ?? 'Falha ao cadastrar usuário.');
    }
  }

  async function remover(em: string) {
    await fetch(`/api/admin/users?email=${encodeURIComponent(em)}`, { method: 'DELETE' });
    carregar();
  }

  return (
    <main className="reg-page">
      <div className="page-header">
        <h1 className="page-title">Cadastrar novo <em>usuário</em></h1>
        <p className="page-sub">Registre um servidor para acesso ao Auditor de Conformidade. O nível de permissão determina quais ações o usuário poderá executar sobre os processos.</p>
      </div>

      <div className="reg-grid">
        <div className="card">
          <div className="card-head"><div className="card-title"><span className="num">1</span> Dados do servidor</div></div>
          <div className="card-body">
            <form onSubmit={submit} noValidate>
              <div className="fieldset">
                <div className="field full">
                  <label>Nome completo <span className="req">*</span></label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Helena de Carvalho" />
                </div>
                <div className="field">
                  <label>CPF <span className="req">*</span></label>
                  <input value={cpf} onChange={(e) => onCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                </div>
                <div className="field">
                  <label>Matrícula <span className="req">*</span></label>
                  <input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex.: 45.981-2" />
                </div>
                <div className="field">
                  <label>E-mail institucional <span className="req">*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@emserh.ma.gov.br" />
                </div>
                <div className="field">
                  <label>Telefone <span className="opt">(opcional)</span></label>
                  <input value={telefone} onChange={(e) => onTel(e.target.value)} placeholder="(98) 90000-0000" />
                </div>
              </div>

              <div className="divider-label"><span>Lotação</span></div>
              <div className="fieldset">
                <div className="field">
                  <label>Unidade / Gerência <span className="req">*</span></label>
                  <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                    <option value="">Selecione…</option>
                    {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Cargo / Função</label>
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Auditor de Controle Interno" />
                </div>
              </div>

              <div className="divider-label"><span>Nível de permissão</span></div>
              <div className="roles">
                {ROLES.map((r) => (
                  <div key={r.id} className={`role ${role === r.id ? 'sel' : ''}`} onClick={() => setRole(r.id)}>
                    <div className="role-check">✓</div>
                    <div className="role-name">{r.id}</div>
                    <div className="role-desc">{r.desc}</div>
                  </div>
                ))}
              </div>

              <div className="divider-label"><span>Acesso</span></div>
              <div className="field">
                <label>Senha inicial <span className="req">*</span></label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres" />
                <div className="hint">O usuário entra em /login com o e-mail e esta senha. Ele pode ser orientado a trocá-la depois.</div>
              </div>

              {erro && <p className="admin-error" style={{ marginTop: 12 }}>{erro}</p>}
              {ok && <p className="reg-ok" style={{ marginTop: 12 }}>✓ {ok}</p>}

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={() => { setNome(''); setCpf(''); setMatricula(''); setEmail(''); setTelefone(''); setUnidade(''); setCargo(''); setRole('Auditor'); setSenha(''); }}>Limpar</button>
                <div className="spacer" />
                <button type="submit" className="btn-primary-reg" disabled={loading || !podeEnviar}>
                  + {loading ? 'Cadastrando...' : 'Cadastrar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className="reg-side">
          <div className="card preview-card">
            <div className="card-body">
              <div className="preview-label">Prévia do cadastro</div>
              <div className="preview-user">
                <div className="preview-avatar">{initials(nome)}</div>
                <div>
                  <div className="preview-name">{nome.trim() || 'Novo usuário'}</div>
                  <div className="preview-mail">{email.trim() || 'nome@emserh.ma.gov.br'}</div>
                </div>
              </div>
              <div className="preview-tags">
                <span className="preview-tag">{unidade || 'Unidade não definida'}</span>
                <span className="preview-tag">{role}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Requisitos</div></div>
            <div className="card-body">
              <div className="rule-list">
                {[
                  ['Nome completo do servidor', req.nome],
                  ['CPF com 11 dígitos válido', req.cpf],
                  ['E-mail institucional (@emserh.ma.gov.br)', req.email],
                  ['Unidade de lotação selecionada', req.unidade],
                  ['Senha inicial definida', req.senha],
                ].map(([label, done]) => (
                  <div key={label as string} className={`reg-rule ${done ? '' : 'pending'}`}>
                    <div className="ri">✓</div><div>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="side-note">O acesso segue a <strong>Política de Segurança da Informação</strong> da EMSERH. Cadastros são auditados e o servidor responde pelo uso das credenciais.</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Usuários cadastrados */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head"><div className="card-title">Usuários cadastrados <span className="num">{users.length}</span></div></div>
        <div className="card-body">
          <table className="user-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Unidade</th><th>Nível</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>{u.nome}</td><td>{u.email}</td><td>{u.unidade}</td><td>{u.role}</td>
                  <td><button className="rule-remove" onClick={() => remover(u.email)}>Remover</button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="user-empty">Nenhum usuário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
