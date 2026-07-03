import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/admin-auth';

/** True se a requisição atual tem o cookie de admin válido. */
export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get('admin_auth')?.value);
}
