import { isAuthenticated } from "@/lib/auth";
import AdminClient from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAuthenticated();
  return <AdminClient initialAuthed={authed} />;
}
