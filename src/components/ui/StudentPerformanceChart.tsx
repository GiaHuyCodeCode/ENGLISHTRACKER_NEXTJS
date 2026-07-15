'use client';

import { useMemo, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Submission, getStudentNames } from '@/lib/local-store';
import { toLocalDateString } from '@/lib/utils';

interface Props {
  submissions: Submission[];
  referenceDate?: string; // Format: yyyy-mm-dd
}

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function StudentPerformanceChart({ submissions, referenceDate }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  
  const getPropRefDate = () => {
    if (referenceDate) {
      const [y, m, d] = referenceDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  const [currentRefDate, setCurrentRefDate] = useState<Date>(getPropRefDate());
  const students = getStudentNames();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync with referenceDate prop when it changes (e.g. from teacher dashboard time travel)
  useEffect(() => {
    setCurrentRefDate(getPropRefDate());
  }, [referenceDate]);

  const handlePrev = () => {
    const nextD = new Date(currentRefDate);
    if (timeRange === 'week') {
      nextD.setDate(nextD.getDate() - 7);
    } else {
      nextD.setMonth(nextD.getMonth() - 1);
    }
    setCurrentRefDate(nextD);
  };

  const handleNext = () => {
    const nextD = new Date(currentRefDate);
    if (timeRange === 'week') {
      nextD.setDate(nextD.getDate() + 7);
    } else {
      nextD.setMonth(nextD.getMonth() + 1);
    }
    setCurrentRefDate(nextD);
  };

  const rangeLabel = useMemo(() => {
    if (timeRange === 'week') {
      const d = new Date(currentRefDate);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const format = (date: Date) => {
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      };
      return `Tuần từ ${format(monday)} đến ${format(sunday)}`;
    } else {
      return `Tháng ${String(currentRefDate.getMonth() + 1).padStart(2, '0')}/${currentRefDate.getFullYear()}`;
    }
  }, [currentRefDate, timeRange]);

  const data = useMemo(() => {
    const days: string[] = [];
    const dateObjs: Date[] = [];
    
    if (timeRange === 'week') {
      // Find Monday
      const d = new Date(currentRefDate);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 7; i++) {
        const current = new Date(monday);
        current.setDate(monday.getDate() + i);
        dateObjs.push(current);
        const dayName = current.toLocaleDateString('vi-VN', { weekday: 'short' });
        days.push(`${dayName} (${current.getDate()}/${current.getMonth() + 1})`);
      }
    } else {
      // Month
      const year = currentRefDate.getFullYear();
      const month = currentRefDate.getMonth();
      const startDate = new Date(year, month, 1);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(year, month + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      
      const current = new Date(startDate);
      while (current <= endDate) {
        dateObjs.push(new Date(current));
        const dayName = current.toLocaleDateString('vi-VN', { weekday: 'short' });
        days.push(`${dayName} (${current.getDate()}/${current.getMonth() + 1})`);
        current.setDate(current.getDate() + 1);
      }
    }

    const chartData = days.map((dayLabel, index) => {
      const targetDate = dateObjs[index];
      const targetDateString = toLocalDateString(targetDate);
      
      const dayName = targetDate.toLocaleDateString('vi-VN', { weekday: 'short' });
      const shortDate = `${targetDate.getDate()}/${targetDate.getMonth() + 1}`;
      const fullDate = `${dayName} (${shortDate})`;

      const record: any = { 
        date: shortDate,
        fullDate: fullDate,
      };
      
      // Initialize scores to 0 for all students
      students.forEach(s => { record[s] = 0; });

      // Sum up scores for this day
      submissions.forEach(sub => {
        if (!sub.submittedAt) return;
        const subDateString = toLocalDateString(sub.submittedAt);
        
        if (subDateString === targetDateString && students.includes(sub.studentName)) {
          record[sub.studentName] += sub.score || 0;
        }
      });

      return record;
    });

    return chartData;
  }, [submissions, students, currentRefDate, timeRange]);

  if (!isMounted) return <div className="h-96 w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-3xl"></div>;

  // Consistent color palette for students
  const colorMap = students.reduce((acc, name, index) => {
    const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    acc[name] = colors[index % colors.length];
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="w-full flex flex-col mt-4">
      {/* Chart Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-black/5 dark:border-white/5"
            title={timeRange === 'week' ? 'Tuần trước' : 'Tháng trước'}
          >
            <ChevronLeft />
          </button>
          <span className="text-sm font-semibold px-4 py-1.5 min-w-[200px] text-center select-none bg-black/5 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 text-muted-foreground">
            {rangeLabel}
          </span>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-black/5 dark:border-white/5"
            title={timeRange === 'week' ? 'Tuần sau' : 'Tháng sau'}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="flex bg-black/5 dark:bg-black/25 p-1 rounded-xl border border-black/5 dark:border-white/5">
          <button
            onClick={() => {
              setTimeRange('week');
              setCurrentRefDate(getPropRefDate());
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === 'week'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Theo Tuần
          </button>
          <button
            onClick={() => {
              setTimeRange('month');
              setCurrentRefDate(getPropRefDate());
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === 'month'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Theo Tháng
          </button>
        </div>
      </div>

      {submissions && submissions.length > 0 ? (
        <div className="h-80 w-full bg-black/5 dark:bg-white/5 p-4 rounded-3xl border border-black/10 dark:border-white/10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                dy={10}
                tickFormatter={(value, index) => {
                  if (data.length <= 10) return value;
                  if (index === 0 || index === data.length - 1 || index % 5 === 0) {
                    return value;
                  }
                  return '•';
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                width={45}
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                dx={-10}
                tickFormatter={(value) => `${value}đ`}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                labelFormatter={(label, items) => {
                  const payload = items?.[0]?.payload;
                  return payload?.fullDate || label;
                }}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                itemStyle={{ fontWeight: 'bold' }}
                cursor={{ stroke: '#ffffff20', strokeWidth: 2 }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              
              {students.map(studentName => (
                <Line
                  key={studentName}
                  type="monotone"
                  dataKey={studentName}
                  name={studentName}
                  stroke={colorMap[studentName]}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#1e293b' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground bg-black/5 dark:bg-white/5 rounded-3xl border border-black/10 dark:border-white/10">
          Chưa có dữ liệu thi đua trong tuần.
        </div>
      )}
    </div>
  );
}

