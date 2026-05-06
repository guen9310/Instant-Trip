import { GlobalNav } from "@/components/layout/GlobalNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <GlobalNav />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
