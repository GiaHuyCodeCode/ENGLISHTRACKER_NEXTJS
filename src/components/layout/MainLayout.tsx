'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return (
      <div className="flex-1 min-h-screen">
        <main className="w-full min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen md:ml-64 overflow-x-hidden pt-14 md:pt-0">
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </>
  );
}
