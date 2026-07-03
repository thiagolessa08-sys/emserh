import { Header } from '@/components/Header';
import { AdminLogin } from '@/components/AdminLogin';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { isAdminAuthed } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  if (!(await isAdminAuthed('estatisticas'))) {
    return (<><Header active="estatisticas" /><AdminLogin area="estatisticas" titulo="Produção" /></>);
  }
  return (
    <>
      <Header active="estatisticas" />
      <AnalyticsDashboard />
    </>
  );
}
