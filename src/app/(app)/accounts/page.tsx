import { redirect } from 'next/navigation';

// Accounts now lives inside Settings; keep this route so old links/bookmarks still land somewhere.
export default function AccountsRedirect() {
  redirect('/settings');
}
