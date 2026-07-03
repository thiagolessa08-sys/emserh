import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminNav } from '@/components/AdminNav';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  if (!(await isAdminAuthed())) {
    return (<><Header active="regras" /><AdminLogin /></>);
  }
  return (
    <>
      <Header active="regras" />
      <AdminNav active="estatisticas" />
      <AnalyticsDashboard />
    </>
  );
}
