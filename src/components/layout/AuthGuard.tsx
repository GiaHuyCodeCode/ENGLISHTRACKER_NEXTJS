'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, UserSession } from '@/lib/local-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const session = getCurrentUser();
    setUser(session);
    setMounted(true);

    if (!session && pathname !== '/login') {
      router.push('/login');
    } else if (session) {
      if (pathname === '/login') {
        router.push(session.role === 'admin' ? '/' : '/student');
      } else if (session.role === 'student' && (pathname === '/' || pathname.startsWith('/teacher'))) {
        router.push('/student');
      }
    }
  }, [pathname, router]);

  if (!mounted) return null;

  // Don't render children if trying to access protected route without auth
  if (!user && pathname !== '/login') return null;

  return <>{children}</>;
}
