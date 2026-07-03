import { cookies } from 'next/headers';
import { verifyAuthToken, adminCookieName, type AdminArea } from '@/lib/admin-auth';

/** True se a requisição atual tem o cookie válido da área informada. */
export async function isAdminAuthed(area: AdminArea): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAuthToken(area, cookieStore.get(adminCookieName(area))?.value);
}
