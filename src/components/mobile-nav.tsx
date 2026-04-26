"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { signOut } from "@/actions/auth";
import { ICON_MAP, IconName } from "@/lib/icons";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

interface MobileNavProps {
  items: NavItem[];
}

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
        aria-label="Open menu"
      >
        <ICON_MAP.menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Content */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-card p-6 shadow-2xl transition-transform duration-300 ease-in-out sm:w-[320px]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Logo" className="h-8 w-auto" />
            <div className="text-sm font-bold leading-tight">SDC System</div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 hover:bg-muted"
            aria-label="Close menu"
          >
            <ICON_MAP.x className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setPathname(item.href);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-border">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <ICON_MAP.logout className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
