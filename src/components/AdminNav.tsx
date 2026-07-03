interface AdminNavProps {
  active: 'regras' | 'usuarios' | 'estatisticas';
}

export function AdminNav({ active }: AdminNavProps) {
  const links = [
    { id: 'regras', label: 'Regras', href: '/admin' },
    { id: 'usuarios', label: 'Usuários', href: '/admin/usuarios' },
  ] as const;
  return (
    <nav className="admin-nav">
      {links.map((l) => (
        <a key={l.id} href={l.href} className={`admin-nav-link ${active === l.id ? 'active' : ''}`}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
