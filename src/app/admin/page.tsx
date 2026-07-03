import { getRulesStore, isPersistenceConfigured } from '@/lib/rules-store';
import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { RulesEditor } from '@/components/RulesEditor';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAdminAuthed('regras'))) {
    return (
      <>
        <Header active="regras" />
        <AdminLogin area="regras" titulo="Regras" />
      </>
    );
  }

  const store = await getRulesStore();
  return (
    <>
      <Header active="regras" />
      <AdminNav active="regras" />
      <RulesEditor initialStore={store} persistent={isPersistenceConfigured()} />
    </>
  );
}
