'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  GraduationCap,
  Users,
  Sparkles,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { getCurrentUser, logoutUser, UserSession } from '@/lib/local-store';

const teacherLinks = [
  { href: '/',                        icon: LayoutDashboard, label: 'Dashboard Giáo Viên' },
  { href: '/teacher/assignments/new', icon: PlusCircle,       label: 'Tạo Bài Tập' },
];

const studentLinks = [
  { href: '/student',             icon: GraduationCap, label: 'Dashboard Học Viên' },
  { href: '/student/assignments', icon: BookOpen,       label: 'Bài Tập Của Tôi' },
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
      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/50 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary border border-white/10">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold font-heading text-lg gradient-text tracking-tight">EduTrack</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 -mr-2 text-foreground/80 hover:text-primary transition-colors bg-white/5 rounded-xl border border-white/5">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed left-0 top-0 h-screen w-64 border-r border-foreground/5 bg-background/40 backdrop-blur-3xl flex flex-col z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand */}
        <div className="p-6 border-b border-foreground/5 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-primary border border-white/10">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold font-heading text-lg leading-tight gradient-text">
                EduTrack
              </p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Premium</p>
            </div>
          </div>
        </div>

        {/* Brand for mobile inside sidebar */}
        <div className="p-4 border-b border-foreground/5 md:hidden flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary border border-white/10">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold font-heading text-base gradient-text">EduTrack</span>
           </div>
           <button onClick={() => setIsOpen(false)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
             <X className="h-5 w-5" />
           </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Teacher section */}
          {user?.role === 'admin' && (
            <div>
              <div className="flex items-center gap-2 px-3 mb-2">
                <Users className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-widest">
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
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Student section */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <GraduationCap className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-widest">
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
                  <Icon className="h-4 w-4 flex-shrink-0" />
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
                <div className="w-8 h-8 rounded-full bg-secondary/50 border border-white/10 flex items-center justify-center font-bold text-xs text-primary">
                  {user.role === 'admin' ? 'AD' : user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user.username}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  logoutUser();
                  window.location.href = '/login';
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" /> Đăng Xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30">
              <span className="pulse-dot w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Offline Mode</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
