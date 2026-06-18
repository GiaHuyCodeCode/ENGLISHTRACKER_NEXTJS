'use client';

import { useEffect, useState } from 'react';
import {
  getSubmissions, getDailyTrackings, updateSubmissionScore, updateTrackingScore, deleteSubmission, deleteTracking,
  Submission, DailyTracking, getStudentNames, getStudentColors, getStudentAvatar, seedIfEmpty
} from '@/lib/local-store';
import { Edit2, CheckCircle2, XCircle, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {score}đ
    </span>
  );
}

function StudentAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const colors = getStudentColors(name);
  const initials = getStudentAvatar(name);
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClass} ${colors.bg} ${colors.text} border ${colors.border} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function ScoreManagementPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [trackings, setTrackings] = useState<DailyTracking[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>(getStudentNames()[0] || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, action: () => void, title: string, message: string } | null>(null);

  const refreshData = () => {
    setSubmissions(getSubmissions());
    setTrackings(getDailyTrackings());
  };

  useEffect(() => {
    seedIfEmpty();
    refreshData();
  }, []);

  const studentSubmissions = submissions.filter(s => s.studentName === selectedStudent);
  const studentTrackings = trackings.filter(t => t.studentName === selectedStudent);

  // Merge & Sort
  const allRecords = [
    ...studentSubmissions.map(s => ({ ...s, isTracking: false, date: new Date(s.submittedAt).getTime() })),
    ...studentTrackings.map(t => ({ ...t, isTracking: true, date: new Date(t.submittedAt).getTime() }))
  ].sort((a, b) => b.date - a.date);

  const handleSave = (id: string, isTracking: boolean) => {
    const num = parseInt(editScore, 10);
    if (isNaN(num) || num < 0 || num > 100) return alert('Điểm phải từ 0-100');
    
    if (isTracking) updateTrackingScore(id, num);
    else updateSubmissionScore(id, num);
    
    setEditingId(null);
    refreshData();
  };

  const handleDelete = (id: string, isTracking: boolean) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc muốn xóa điểm này?',
      action: () => {
        if (isTracking) deleteTracking(id);
        else deleteSubmission(id);
        refreshData();
        setConfirmDialog(null);
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto relative min-h-screen">
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background p-6 rounded-2xl border border-white/10 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-foreground">{confirmDialog.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors text-foreground">Hủy</button>
              <button onClick={confirmDialog.action} className="px-4 py-2 rounded-lg font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 fade-in">
        <Link
          href="/"
          className="p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-800/50 transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-heading flex items-center gap-2">
            Quản Lý Điểm Số
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Chỉnh sửa hoặc xóa điểm lịch sử của học viên</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass-strong rounded-3xl p-6 border border-white/5 space-y-6 fade-in stagger-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <StudentAvatar name={selectedStudent} size="sm" />
            <select 
              value={selectedStudent} 
              onChange={e => setSelectedStudent(e.target.value)}
              className="input-field text-sm py-2 px-3 min-w-[180px]"
            >
              {getStudentNames().map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="text-sm text-muted-foreground">
            Tổng cộng: <strong>{allRecords.length}</strong> bài nộp
          </div>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {allRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Chưa có dữ liệu nào.</div>
          ) : (
            allRecords.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-white/5 hover:bg-secondary/40 transition-colors group">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.isTracking ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'
                    }`}>
                      {r.isTracking ? 'BÁO CÁO' : 'BÀI TẬP'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.submittedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">
                    {r.isTracking ? (r as DailyTracking).category : (r as Submission).assignmentTitle}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {editingId === r.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={editScore} 
                        onChange={e => setEditScore(e.target.value)}
                        className="input-field w-20 text-center py-1 text-sm font-bold" 
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSave(r.id, r.isTracking)}
                      />
                      <button onClick={() => handleSave(r.id, r.isTracking)} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ScoreBadge score={r.score} />
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => { setEditingId(r.id); setEditScore(r.score.toString()); }}
                          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Sửa điểm"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(r.id, r.isTracking); }}
                          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors relative z-10"
                          title="Xóa bài nộp"
                        >
                          <Trash2 className="h-4 w-4 pointer-events-none" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
