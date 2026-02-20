import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

export default async function InputLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/input");

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();

  if (!profile?.approved) redirect("/pending");

  return <>{children}</>;
}
