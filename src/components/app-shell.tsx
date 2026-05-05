import Link from "next/link";

import { signOut } from "@/actions/auth";
import { ModeToggle } from "@/components/mode-toggle";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ICON_MAP, IconName } from "@/lib/icons";
import { UserRole } from "@/generated/prisma/enums";
import { MobileNav } from "@/components/mobile-nav";

const navItems: { href: string; label: string; icon: IconName; roles: UserRole[] }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", roles: [UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF] },
  { href: "/clients", label: "Clients", icon: "clients", roles: [UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF] },
  { href: "/projects", label: "Projects", icon: "projects", roles: [UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF] },
  { href: "/invoices", label: "Invoices", icon: "invoices", roles: [UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF] },
  { href: "/reports", label: "Reports", icon: "reports", roles: [UserRole.ADMIN, UserRole.FINANCE] },
  { href: "/tax-reminder", label: "Tax Reminder", icon: "tax", roles: [UserRole.ADMIN, UserRole.FINANCE] },
  { href: "/collections", label: "Collections", icon: "collections", roles: [UserRole.ADMIN, UserRole.FINANCE] },
  { href: "/ledger", label: "Ledger", icon: "ledger", roles: [UserRole.ADMIN, UserRole.FINANCE] },
  { href: "/expenses", label: "Expenses", icon: "invoices", roles: [UserRole.ADMIN, UserRole.FINANCE] },
  { href: "/settings", label: "Settings", icon: "settings", roles: [UserRole.ADMIN] },
  { href: "/users", label: "Users", icon: "users", roles: [UserRole.ADMIN] },
  { href: "/audit-log", label: "Audit Log", icon: "audit", roles: [UserRole.ADMIN] },
  { href: "/admin", label: "System Owner", icon: "dashboard", roles: [UserRole.ADMIN] },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  if (!session) {
    return <>{children}</>;
  }
  const user = session.user;
  const ownerEmail = process.env.ADMIN_EMAIL || "admin@solusidigitalcreative.com";
  const items = navItems.filter((i) => {
    // Only show System Owner menu to the specific system admin email
    if (i.href === "/admin") {
      return user.email === ownerEmail;
    }
    return i.roles.includes(user.role);
  });
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full flex-col gap-4 p-3 sm:gap-4 sm:p-4 md:flex-row md:gap-6 md:p-6">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <img src="/icon.png" alt="Solusi Invoice" className="h-16 w-auto" />
              <div className="mt-2 truncate text-sm font-semibold leading-tight">
                Solusi Invoice
              </div>
              <div className="text-xs text-muted-foreground">Dashboard Bisnis</div>
            </div>
            <ModeToggle />
          </div>

          <nav className="grid gap-1">
            {items.map((item) => {
              const Icon = ICON_MAP[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/90 hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-2">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-xs font-medium text-muted-foreground">Theme</div>
              <div className="mt-1 text-sm">Dark / Light</div>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground/90 hover:bg-muted"
              >
                <ICON_MAP.logout className="h-4 w-4 text-muted-foreground" />
                Logout
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm md:hidden print:hidden">
            <div className="flex items-center gap-3">
              <MobileNav items={items} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight">
                  Invoice SDC
                </div>
              </div>
            </div>
            <ModeToggle />
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm print:border-0 print:bg-transparent print:shadow-none">
            <div className="p-4 sm:p-4 md:p-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

