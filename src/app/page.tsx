import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/sheets";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect("/auth/signin");

  const userEmail = session.user.email.toLowerCase().trim();

  try {
    const settings = await getSettings((session as any).accessToken);
    const vaEmail = (settings["VA_EMAIL"] ?? "").toLowerCase().trim();
    const clientEmail = (settings["CLIENT_EMAIL"] ?? "").toLowerCase().trim();

    if (vaEmail && userEmail === vaEmail) redirect("/dashboard");
    if (clientEmail && userEmail === clientEmail) redirect("/client");
  } catch {
    const vaEnv = (process.env.VA_EMAIL ?? "").toLowerCase().trim();
    const clientEnv = (process.env.CLIENT_EMAIL ?? "").toLowerCase().trim();
    if (vaEnv && userEmail === vaEnv) redirect("/dashboard");
    if (clientEnv && userEmail === clientEnv) redirect("/client");
  }

  redirect("/auth/signin?error=AccessDenied");
}
