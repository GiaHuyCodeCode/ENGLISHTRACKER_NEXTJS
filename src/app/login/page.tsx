'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentNames, getStudentColors, getStudentAvatar, loginUser } from '@/lib/local-store';
import { ShieldCheck, User, LogIn, GraduationCap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'student' | null>(null);

  const handleAdminLogin = () => {
    loginUser('Admin', 'admin');
    router.push('/');
  };

  const handleStudentLogin = (name: string) => {
    loginUser(name, 'student');
    router.push('/student');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center fade-in">
      <div className="glass-strong rounded-3xl p-8 max-w-lg w-full border border-white/5 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3"></div>

        <div className="relative text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 text-primary mb-4 border border-primary/30 glow-primary">
            <LogIn className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold font-heading gradient-text">EduTrack Login</h1>
          <p className="text-muted-foreground mt-2 text-sm">Vui lòng chọn vai trò để đăng nhập hệ thống</p>
        </div>

        <div className="relative space-y-4">
          {!role ? (
            <>
              <button
                onClick={() => setRole('admin')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-secondary/30 hover:bg-secondary/60 border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg text-foreground">Giáo Viên</h3>
                    <p className="text-xs text-muted-foreground">Quản lý lớp học và theo dõi</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setRole('student')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-secondary/30 hover:bg-secondary/60 border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg text-foreground">Học Viên</h3>
                    <p className="text-xs text-muted-foreground">Làm bài tập và xem báo cáo</p>
                  </div>
                </div>
              </button>
            </>
          ) : role === 'admin' ? (
            <div className="fade-in stagger-1 space-y-4">
              <p className="text-sm text-center text-muted-foreground mb-4">Đăng nhập với tư cách Giáo Viên</p>
              <button
                onClick={handleAdminLogin}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all glow-primary"
              >
                Vào Dashboard Giáo Viên
              </button>
              <button onClick={() => setRole(null)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                Quay lại
              </button>
            </div>
          ) : (
            <div className="fade-in stagger-1 space-y-4">
              <p className="text-sm text-center text-muted-foreground mb-4">Chọn tên của bạn</p>
              <div className="grid grid-cols-2 gap-3">
                {getStudentNames().map(name => {
                  const c = getStudentColors(name);
                  return (
                    <button
                      key={name}
                      onClick={() => handleStudentLogin(name)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/5 bg-secondary/30 hover:bg-secondary/60 hover:border-${c.text.split('-')[1]}-500/50 transition-all group`}
                    >
                      <div className={`w-12 h-12 ${c.bg} ${c.text} border ${c.border} rounded-xl flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform`}>
                        {getStudentAvatar(name)}
                      </div>
                      <span className="font-semibold text-sm">{name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-2">
                <button onClick={() => setRole(null)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
                  Quay lại
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
