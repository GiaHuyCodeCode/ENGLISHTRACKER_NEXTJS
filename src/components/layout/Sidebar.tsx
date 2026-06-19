'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  PlusCircle,
  GraduationCap,
  Users,
  Sparkles,
  Menu,
  X,
  LogOut,
  Layers,
  FolderOpen,
  ListChecks
} from 'lucide-react';
import { getCurrentUser, logoutUser, UserSession } from '@/lib/local-store';

const teacherLinks = [
  { href: '/',                        icon: LayoutDashboard, label: 'Dashboard Giáo Viên' },
  { href: '/teacher/assignments/new', icon: PlusCircle,       label: 'Tạo Bài Tập' },
];

const studentLinks = [
  { href: '/student',             icon: GraduationCap, label: 'Dashboard Học Viên' },
  { href: '/student/assignments', icon: ListChecks,     label: 'Bài Tập Của Tôi' },
  { href: '/student/library',     icon: Layers,        label: 'Thư Viện Từ Vựng' },
  { href: '/student/lessons',     icon: FolderOpen,    label: 'Thư Mục Bài Học' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);

  // Đóng sidebar khi chuyển trang trên mobile
  useEffect(() => {
    setIsOpen(false);
    setUser(getCurrentUser());
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/' || href === '/student' 
      ? pathname === href 
      : pathname.startsWith(href);

  return (
    <>
      {/* Mobile Topbar (Apple Translucent Navbar style) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/55 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0071e3] flex items-center justify-center border border-white/10">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-base tracking-tight text-white">EduTrack</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-foreground/80 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5">
          {isOpen ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Menu className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content (macOS Finder style sidebar) */}
      <aside className={`fixed left-0 top-0 h-screen w-64 border-r border-white/5 bg-[#161617]/50 backdrop-blur-3xl flex flex-col z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand */}
        <div className="p-6 border-b border-white/5 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0071e3] flex items-center justify-center shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-base leading-tight text-white tracking-tight">
                EduTrack
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">Premium</p>
            </div>
          </div>
        </div>

        {/* Brand for mobile inside sidebar */}
        <div className="p-4 border-b border-white/5 md:hidden flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0071e3] flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
              <span className="font-semibold text-sm text-white">EduTrack</span>
           </div>
           <button onClick={() => setIsOpen(false)} className="p-2 text-muted-foreground hover:text-white transition-colors">
             <X className="h-4 w-4" strokeWidth={1.5} />
           </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Teacher section */}
          {user?.role === 'admin' && (
            <div>
              <div className="flex items-center gap-2 px-3 mb-2">
                <Users className="h-3.5 w-3.5 text-sky-400/80" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-sky-400/80 uppercase tracking-widest">
                  Giáo Viên
                </span>
              </div>
              <div className="space-y-1">
                {teacherLinks.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link ${isActive(href) ? 'active' : ''}`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Student section */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <GraduationCap className="h-3.5 w-3.5 text-sky-400/80" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-sky-400/80 uppercase tracking-widest">
                Học Viên
              </span>
            </div>
            <div className="space-y-1">
              {studentLinks.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link ${isActive(href) ? 'active' : ''}`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer (User Info & Logout) */}
        <div className="p-4 border-t border-white/5">
          {user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-[#2c2c2e] border border-white/10 flex items-center justify-center font-bold text-xs text-[#0071e3]">
                  {user.role === 'admin' ? 'AD' : user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{user.username}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  logoutUser();
                  window.location.href = '/login';
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#ff453a]/10 text-[#ff453a] hover:bg-[#ff453a]/20 border border-[#ff453a]/25 transition-all text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} /> Đăng Xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2c2c2e]/30">
              <span className="pulse-dot w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Offline Mode</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
