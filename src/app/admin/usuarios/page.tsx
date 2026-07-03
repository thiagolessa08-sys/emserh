import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { UsersManager } from '@/components/UsersManager';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  if (!(await isAdminAuthed('usuarios'))) {
    return (<><Header active="regras" /><AdminLogin area="usuarios" titulo="Usuários" /></>);
  }
  return (
    <>
      <Header active="regras" />
      <AdminNav active="usuarios" />
      <UsersManager />
    </>
  );
}
