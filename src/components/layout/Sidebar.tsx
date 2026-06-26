'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, logoutUser, UserSession } from '@/lib/local-store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/* ─────────────────────────────────────────────────────────────────────────────
   🌸 FLOWER ICON SYSTEM — hand-crafted botanical SVGs
   Each icon represents a flower or botanical element, scaled to 16×16
───────────────────────────────────────────────────────────────────────────── */

/** 🌺 Hibiscus / Dashboard — 5-petal flower with grid center */
const FlowerDashboard = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* 5 petals arranged radially */}
    <ellipse cx="12" cy="5.5" rx="2.2" ry="3.5" />
    <ellipse cx="12" cy="5.5" rx="2.2" ry="3.5" transform="rotate(72 12 12)" />
    <ellipse cx="12" cy="5.5" rx="2.2" ry="3.5" transform="rotate(144 12 12)" />
    <ellipse cx="12" cy="5.5" rx="2.2" ry="3.5" transform="rotate(216 12 12)" />
    <ellipse cx="12" cy="5.5" rx="2.2" ry="3.5" transform="rotate(288 12 12)" />
    {/* center */}
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.7" stroke="none"/>
  </svg>
);

/** 🪷 Lotus / Assignments — layered lotus petals with lines suggesting a list */
const FlowerLotus = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* center petal */}
    <path d="M12 3 C12 3 9 7 9 11 C9 14 10.5 15 12 15 C13.5 15 15 14 15 11 C15 7 12 3 12 3Z"/>
    {/* left petal */}
    <path d="M12 15 C12 15 7 12 5.5 9 C4.5 7 5.5 5 7 5.5 C9 6.5 10 9 10 12"/>
    {/* right petal */}
    <path d="M12 15 C12 15 17 12 18.5 9 C19.5 7 18.5 5 17 5.5 C15 6.5 14 9 14 12"/>
    {/* stem */}
    <path d="M12 15 L12 20"/>
    {/* water line */}
    <path d="M7 20 Q12 18 17 20" opacity="0.5"/>
  </svg>
);

/** 🌼 Daisy Plus — daisy with + center for "Add new" */
const FlowerAdd = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* 8 small petals */}
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(45 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(90 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(135 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(180 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(225 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(270 12 12)" />
    <ellipse cx="12" cy="4.5" rx="1.6" ry="3" transform="rotate(315 12 12)" />
    {/* center circle */}
    <circle cx="12" cy="12" r="2.8" fill="currentColor" opacity="0.15" stroke="currentColor"/>
    {/* + sign in center */}
    <path d="M12 10.5v3M10.5 12h3" strokeWidth="1.8"/>
  </svg>
);

/** 🌸 Cherry Blossom / Student dashboard */
const FlowerCherry = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* 5 heart-shaped petals */}
    <path d="M12 12 C12 12 10 8.5 8 7.5 C6 6.5 4.5 8 5.5 10 C6.5 12 12 12 12 12Z"/>
    <path d="M12 12 C12 12 14 8.5 16 7.5 C18 6.5 19.5 8 18.5 10 C17.5 12 12 12 12 12Z"/>
    <path d="M12 12 C12 12 8.5 14 7.5 16 C6.5 18 8 19.5 10 18.5 C12 17.5 12 12 12 12Z"/>
    <path d="M12 12 C12 12 15.5 14 16.5 16 C17.5 18 16 19.5 14 18.5 C12 17.5 12 12 12 12Z"/>
    <path d="M12 12 C12 12 12 8 12 6 C12 4 10 3.5 9.5 5 C9 6.5 12 12 12 12Z" transform="rotate(-20 12 12)"/>
    {/* center stamen dots */}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.8" stroke="none"/>
  </svg>
);

/** 🌹 Rose layers / Library — concentric rose cross-section */
const FlowerRose = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* outer petals */}
    <path d="M12 3 C8 3 4 6 4 10 C4 15 7 18 12 19 C17 18 20 15 20 10 C20 6 16 3 12 3Z"/>
    {/* mid ring */}
    <path d="M12 6 C9 6 7 8.5 7 11 C7 14 9 16 12 16 C15 16 17 14 17 11 C17 8.5 15 6 12 6Z"/>
    {/* inner spiral */}
    <path d="M12 9 C10.5 9 10 10 10 11.5 C10 13 11 14 12 14 C13 14 14 13 14 11.5 C14 10 13.5 9 12 9Z"/>
    {/* center */}
    <circle cx="12" cy="11.5" r="1.2" fill="currentColor" opacity="0.6" stroke="none"/>
  </svg>
);

/** 🌿 Botanical Folder — leaves forming a folder shape */
const FlowerFolder = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* folder body */}
    <path d="M3 8 C3 6.9 3.9 6 5 6 L9.5 6 L11 8 L19 8 C20.1 8 21 8.9 21 10 L21 17 C21 18.1 20.1 19 19 19 L5 19 C3.9 19 3 18.1 3 17 L3 8Z"/>
    {/* small leaf accent */}
    <path d="M9 13 C9 11 11 10 13 11 C11 12 10 14 12 15" strokeWidth="1.1" opacity="0.7"/>
    <path d="M13 11 L13 15" strokeWidth="1.1" opacity="0.7"/>
  </svg>
);

/** 🌻 Sunflower cluster / Users/Teacher */
const FlowerUsers = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* two overlapping small flowers */}
    {/* left flower */}
    <circle cx="9" cy="8" r="3.5"/>
    <path d="M9 4.5 L9 5.5M9 10.5 L9 11.5M5.5 8 L6.5 8M11.5 8 L12.5 8" strokeWidth="1.6"/>
    {/* right flower (slightly behind) */}
    <circle cx="15" cy="8" r="3.5" opacity="0.7"/>
    {/* stems */}
    <path d="M9 11.5 C9 14 7 16 7 19"/>
    <path d="M15 11.5 C15 14 17 16 17 19"/>
    {/* ground */}
    <path d="M5 19 L19 19" opacity="0.4"/>
  </svg>
);

/** Small graduation petal for section label */
const FlowerGrad = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {/* mortarboard as flower */}
    <path d="M12 4 L22 9 L12 14 L2 9 Z"/>
    <path d="M7 11.5 L7 17 C7 17 9.5 19 12 19 C14.5 19 17 17 17 17 L17 11.5"/>
    <path d="M22 9 L22 14"/>
    {/* small petal accent */}
    <circle cx="22" cy="14" r="1.2" fill="currentColor" opacity="0.6" stroke="none"/>
  </svg>
);

/** Hamburger as 3 petal rows */
const FlowerMenu = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    {/* 3 lines with small leaf ends */}
    <path d="M4 6 Q12 5 20 6"/>
    <path d="M4 12 Q12 11 20 12"/>
    <path d="M4 18 Q12 17 20 18"/>
  </svg>
);

/** Close X as crossed stems */
const FlowerClose = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 6 Q12 12 18 18"/>
    <path d="M18 6 Q12 12 6 18"/>
    {/* tiny petal at intersect */}
    <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.4" stroke="none"/>
  </svg>
);

/** Logout as wilting flower */
const FlowerLogout = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
    {/* small petal at arrow tip */}
    <circle cx="21" cy="12" r="1" fill="currentColor" opacity="0.5" stroke="none"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   🌸 PETAL "E" BRAND MONOGRAM
───────────────────────────────────────────────────────────────────────────── */
const PetalMark = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="10" fill="hsl(340 60% 58%)"/>
    <rect width="36" height="36" rx="10" fill="url(#pg)" opacity="0.35"/>
    {/* "E" with petal embellishment */}
    <path d="M10 10h16v3H13v4h11v3H13v4h13v3H10V10z" fill="white" opacity="0.95"/>
    {/* Golden pollen dot — bloom accent */}
    <circle cx="27" cy="9.5" r="3.2" fill="hsl(47 72% 58%)"/>
    {/* tiny petal lines on pollen dot */}
    <path d="M27 6.8v1.5M27 10.7v1.5M24.3 9.5h1.5M28.7 9.5h1.5" stroke="hsl(340 60% 58%)" strokeWidth="0.8" strokeLinecap="round"/>
    <defs>
      <radialGradient id="pg" cx="25%" cy="20%" r="75%">
        <stop stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </radialGradient>
    </defs>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   NAVIGATION LINKS
───────────────────────────────────────────────────────────────────────────── */
const teacherLinks = [
  { href: '/',                        Icon: FlowerDashboard, label: 'Dashboard Giáo Viên' },
  { href: '/?tab=assignments_mgmt',   Icon: FlowerLotus,     label: 'Quản Lý Bài Tập'     },
  { href: '/teacher/assignments/new', Icon: FlowerAdd,       label: 'Tạo Bài Tập'          },
];

const studentLinks = [
  { href: '/student',             Icon: FlowerCherry,  label: 'Dashboard Học Viên' },
  { href: '/student/assignments', Icon: FlowerLotus,   label: 'Bài Tập Của Tôi'    },
  { href: '/student/library',     Icon: FlowerRose,    label: 'Thư Viện Từ Vựng'   },
  { href: '/student/lessons',     Icon: FlowerFolder,  label: 'Thư Mục Bài Học'    },
];

/* ─────────────────────────────────────────────────────────────────────────────
   SIDEBAR COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentSearch, setCurrentSearch] = useState('');

  useEffect(() => {
    setIsOpen(false);
    setUser(getCurrentUser());
    if (typeof window !== 'undefined') setCurrentSearch(window.location.search);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' && (!currentSearch || currentSearch === '?tab=overview');
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      return pathname === path && currentSearch.includes(query);
    }
    return pathname === href;
  };

  const userInitials = user?.role === 'admin'
    ? 'AD'
    : user?.username.slice(0, 2).toUpperCase() ?? '??';

  return (
    <>
      {/* ── Mobile Topbar ──────────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-4"
        style={{
          background: 'hsl(150 30% 4% / 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid hsl(0 0% 100% / 0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <PetalMark size={30} />
          <span className="font-bold text-base text-white" style={{ letterSpacing: '-0.025em' }}>
            EduTrack
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: 'hsl(0 0% 100% / 0.07)',
            border: '1px solid hsl(0 0% 100% / 0.08)',
            color: 'hsl(0 0% 80%)',
          }}
          aria-label="Toggle menu"
        >
          {isOpen ? <FlowerClose /> : <FlowerMenu />}
        </button>
      </div>

      {/* ── Mobile Bottom Navigation (Student) ─────────────────────────────── */}
      {user?.role !== 'admin' && pathname !== '/login' && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50"
          aria-label="Điều hướng học viên"
          style={{
            background: 'hsl(150 30% 2% / 0.96)',
            backdropFilter: 'blur(32px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
            borderTop: '1px solid hsl(340 60% 58% / 0.12)',
            boxShadow:
              'inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 -16px 56px hsl(150 30% 2% / 0.75)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex h-[3.75rem]">
            {([
              { href: '/student',             Icon: FlowerCherry, label: '🌸 Dashboard' },
              { href: '/student/assignments', Icon: FlowerLotus,  label: 'Bài Tập'      },
              { href: '/student/library',     Icon: FlowerRose,   label: 'Thư Viện'     },
              { href: '/student/lessons',     Icon: FlowerFolder, label: 'Bài Học'      },
            ] as const).map(({ href, Icon, label }) => {
              const active = href === '/student'
                ? pathname === '/student'
                : pathname?.startsWith(href) ?? false;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] relative bloom-press select-none"
                  style={{ color: active ? 'hsl(340 60% 72%)' : 'hsl(150 8% 42%)' }}
                >
                  {/* Bloom glow pill behind active icon */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="petal-pulse absolute rounded-[14px]"
                      style={{
                        inset: '7px 16%',
                        background: 'hsl(340 60% 58% / 0.14)',
                        border: '1px solid hsl(340 60% 58% / 0.24)',
                      }}
                    />
                  )}
                  <span
                    className="relative z-10"
                    style={{
                      transform: active ? 'scale(1.15) translateY(-1px)' : 'scale(1)',
                      transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                  >
                    <Icon size={active ? 21 : 19} />
                  </span>
                  <span
                    className="relative z-10 font-semibold leading-none"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.01em',
                      opacity: active ? 1 : 0.45,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* ── Mobile backdrop ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'hsl(150 30% 3% / 0.8)', backdropFilter: 'blur(6px)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 z-50 flex flex-col
          transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'hsl(150 25% 4% / 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid hsl(0 0% 100% / 0.06)',
          boxShadow: '8px 0 48px hsl(150 30% 2% / 0.5)',
        }}
      >
        {/* ── Botanical corner accent overlay */}
        <div
          className="absolute top-0 right-0 w-28 h-28 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage: 'url(/flower-corner.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'top right',
          }}
          aria-hidden="true"
        />

        {/* ── Brand (desktop) ───────────────────────────────────────────────── */}
        <div
          className="hidden md:flex items-center gap-3 px-5 pt-6 pb-5"
          style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}
        >
          <PetalMark size={36} />
          <div>
            <p className="font-bold text-[15px] text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
              EduTrack
            </p>
            <div className="eyebrow-tag mt-1" style={{ fontSize: '9px', padding: '0.1rem 0.55rem' }}>
              🌸 Bloom
            </div>
          </div>
        </div>

        {/* ── Brand (mobile) ────────────────────────────────────────────────── */}
        <div
          className="flex md:hidden items-center justify-between px-4 py-3.5"
          style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}
        >
          <div className="flex items-center gap-2.5">
            <PetalMark size={30} />
            <span className="font-bold text-sm text-white" style={{ letterSpacing: '-0.02em' }}>EduTrack</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg"
            style={{ background: 'hsl(0 0% 100% / 0.06)', color: 'hsl(0 0% 75%)' }}
          >
            <FlowerClose />
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">

          {/* Teacher section */}
          {user?.role === 'admin' && (
            <div>
              <div className="flex items-center gap-1.5 px-3 mb-1.5">
                <FlowerUsers />
                <span style={{
                  fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'hsl(340 60% 58% / 0.6)',
                }}>
                  Giáo Viên
                </span>
              </div>
              <div className="space-y-0.5">
                {teacherLinks.map(({ href, Icon, label }) => (
                  <Link key={href} href={href} className={`nav-link ${isActive(href) ? 'active' : ''}`}>
                    <Icon />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Student section */}
          <div>
            <div className="flex items-center gap-1.5 px-3 mb-1.5">
              <FlowerGrad />
              <span style={{
                fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'hsl(340 60% 58% / 0.6)',
              }}>
                Học Viên
              </span>
            </div>
            <div className="space-y-0.5">
              {studentLinks.map(({ href, Icon, label }) => (
                <Link key={href} href={href} className={`nav-link ${isActive(href) ? 'active' : ''}`}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* ── User footer ───────────────────────────────────────────────────── */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid hsl(0 0% 100% / 0.05)' }}>
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                {/* Squircle avatar with petal initial */}
                <div
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center font-bold text-xs"
                  style={{
                    borderRadius: '0.6rem',
                    background: 'hsl(340 60% 58% / 0.16)',
                    border: '1px solid hsl(340 60% 58% / 0.28)',
                    color: 'hsl(340 60% 65%)',
                  }}
                >
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white" style={{ letterSpacing: '-0.01em' }}>
                    {user.username}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(150 10% 55%)' }}>
                    {user.role}
                  </p>
                </div>
              </div>

              {/* Theme toggle */}
              <ThemeToggle />

              <button
                onClick={() => { logoutUser(); window.location.href = '/login'; }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.97]"
                style={{
                  background: 'hsl(0 70% 58% / 0.09)',
                  border: '1px solid hsl(0 70% 58% / 0.2)',
                  color: 'hsl(0 70% 68%)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(0 70% 58% / 0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'hsl(0 70% 58% / 0.09)')}
              >
                <FlowerLogout /> Đăng Xuất
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'hsl(150 15% 9% / 0.6)' }}
            >
              <span className="pulse-dot w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'hsl(148 60% 52%)' }} />
              <span className="text-xs" style={{ color: 'hsl(150 10% 55%)' }}>Offline Mode</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
