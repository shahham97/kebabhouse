import { redirect } from 'next/navigation';

export default function LegacyStaffLoginRedirect() {
  redirect('/staff/login');
}
