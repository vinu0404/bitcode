import AppHeader from "@/components/bc/AppHeader";
import CommandPalette from "@/components/bc/CommandPalette";
import AdminGate from "@/components/admin/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <CommandPalette />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 96px" }}>
        <AdminGate>{children}</AdminGate>
      </main>
    </>
  );
}
