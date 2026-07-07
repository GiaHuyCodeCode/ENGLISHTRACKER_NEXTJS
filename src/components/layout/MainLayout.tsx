'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Sidebar } from './Sidebar';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLoginPage = pathname === '/login';

  const isExercisePage = pathname?.startsWith('/student/assignments/') ||
    pathname?.startsWith('/student/dictation/') ||
    pathname?.startsWith('/student/shadowing/') ||
    (pathname === '/student/vocabulary' && searchParams?.get('assignId'));

  if (isLoginPage) {
    return (
      <div className="flex-1 min-h-[100dvh]">
        <main className="w-full min-h-[100dvh]">
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-[100dvh] min-w-0 w-full md:ml-64 overflow-x-clip pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-0">
        <main className={`flex-1 p-4 md:p-8 min-w-0 w-full ${
          isExercisePage 
            ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]' 
            : 'pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-8'
        }`}>
          {children}
        </main>
      </div>
    </>
  );
}
