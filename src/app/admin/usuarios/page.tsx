import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { UsersManager } from '@/components/UsersManager';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  if (!(await isAdminAuthed('usuarios'))) {
    return (<><Header active="usuarios" /><AdminLogin area="usuarios" titulo="Usuários" /></>);
  }
  return (
    <>
      <Header active="usuarios" />
      <UsersManager />
    </>
  );
}
