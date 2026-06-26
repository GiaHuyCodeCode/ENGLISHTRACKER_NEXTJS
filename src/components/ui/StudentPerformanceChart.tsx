'use client';

import { useMemo, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Submission, getStudentNames } from '@/lib/local-store';
import { toLocalDateString } from '@/lib/utils';

interface Props {
  submissions: Submission[];
}

export function StudentPerformanceChart({ submissions }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const students = getStudentNames();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const data = useMemo(() => {
    const days: string[] = [];
    const dateObjs: Date[] = [];
    
    // Start date is June 22, 2026 (Month is 0-indexed, so 5 is June)
    const startDate = new Date(2026, 5, 22);
    startDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let current = new Date(startDate);
    if (today < startDate) {
      // Fallback: if current time is before June 22, 2026, just show the last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dateObjs.push(d);
        const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
        days.push(`${dayName} (${d.getDate()}/${d.getMonth() + 1})`);
      }
    } else {
      while (current <= today) {
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
  }, [submissions, students]);

  if (!isMounted) return <div className="h-80 w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-2xl"></div>;

  if (!submissions || submissions.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 mt-4">
        Chưa có dữ liệu thi đua trong tuần.
      </div>
    );
  }

  // Consistent color palette for students
  const colorMap = students.reduce((acc, name, index) => {
    const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    acc[name] = colors[index % colors.length];
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="h-80 w-full mt-6 bg-black/5 dark:bg-white/5 p-4 rounded-3xl border border-black/10 dark:border-white/10">
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
              if (index === 0 || index === data.length - 1) {
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
  );
}
