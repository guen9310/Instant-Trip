import { GlobalNav } from "@/components/layout/GlobalNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { getSession } from "@/server/session";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <GlobalNav user={session?.user ?? null} />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
