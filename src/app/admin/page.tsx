import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';
import { getRulesStore } from '@/lib/rules-store';
import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { RulesEditor } from '@/components/RulesEditor';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authed = verifyAuthToken(cookieStore.get('admin_auth')?.value);

  if (!authed) {
    return (
      <>
        <Header active="regras" />
        <AdminLogin />
      </>
    );
  }

  const store = await getRulesStore();
  return (
    <>
      <Header active="regras" />
      <RulesEditor initialStore={store} />
    </>
  );
}
