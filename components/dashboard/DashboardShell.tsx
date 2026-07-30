'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

/**
 * Owns the mobile hamburger/drawer interaction only. All nav content and
 * access-control logic stays server-rendered in app/dashboard/layout.tsx and
 * is passed in as `sidebar`/`header` slots — this component just decides
 * where that JSX renders (inline sidebar on md+, slide-in drawer below it).
 */
export function DashboardShell({
  sidebar,
  header,
  children,
}: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 bg-white border-r border-gray-100 flex-col">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Closes on any tap inside, including a nav link — that's the
              intended way to dismiss it, not just the backdrop. */}
          <div
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-xl flex flex-col"
            onClick={() => setOpen(false)}
          >
            {sidebar}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <header className="flex items-center gap-3 bg-white border-b border-gray-100 px-4 md:px-8 py-4 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="md:hidden -ml-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
            {header}
          </div>
        </header>
        <div className="p-4 md:p-8 flex-1">
          <div className="max-w-[1100px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
