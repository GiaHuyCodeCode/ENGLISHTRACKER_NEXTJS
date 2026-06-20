'use client';

import { useMemo, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Submission, getStudentNames, DailyTracking } from '@/lib/local-store';

interface Props {
  submissions: Submission[];
  trackings?: DailyTracking[]; // though trackings don't have duration currently, we pass it for future-proofing or just use submissions
}

export function StudentTimeChart({ submissions, trackings = [] }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const students = getStudentNames();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const data = useMemo(() => {
    // Generate last 7 days (including today)
    const days: string[] = [];
    const dateObjs: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateObjs.push(d);
      
      const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
      days.push(`${dayName} (${d.getDate()}/${d.getMonth() + 1})`);
    }

    const chartData = days.map((dayLabel, index) => {
      const targetDate = dateObjs[index];
      const targetDateString = targetDate.toISOString().split('T')[0];

      const record: any = { date: dayLabel };
      
      // Initialize time to 0 for all students
      students.forEach(s => { record[s] = 0; });

      // Sum up durationMs for this day
      submissions.forEach(sub => {
        if (!sub.submittedAt || !sub.durationMs) return;
        const subDateObj = new Date(sub.submittedAt);
        const subDateString = subDateObj.toISOString().split('T')[0];
        
        if (subDateString === targetDateString && students.includes(sub.studentName)) {
          // Convert ms to minutes
          record[sub.studentName] += (sub.durationMs / 60000);
        }
      });

      // Round to 1 decimal place
      students.forEach(s => {
        if (record[s] > 0) {
          record[s] = Math.round(record[s] * 10) / 10;
        }
      });

      return record;
    });

    return chartData;
  }, [submissions, students]);

  if (!isMounted) return <div className="h-80 w-full animate-pulse bg-white/5 rounded-2xl"></div>;

  if (!submissions || submissions.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground bg-white/5 rounded-2xl border border-white/5 mt-4">
        Chưa có dữ liệu thời gian học trong tuần.
      </div>
    );
  }

  // Consistent color palette for students
  const colorMap = students.reduce((acc, name, index) => {
    const colors = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    acc[name] = colors[index % colors.length];
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="h-80 w-full mt-6 bg-white/5 p-4 rounded-3xl border border-white/10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#888888" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dy={10}
            tick={{ fill: '#888888' }}
          />
          <YAxis 
            width={55}
            stroke="#888888" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dx={-10}
            tickFormatter={(value) => `${value} phút`}
            tick={{ fill: '#888888' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
            itemStyle={{ fontWeight: 'bold' }}
            cursor={{ stroke: '#ffffff20', strokeWidth: 2 }}
            formatter={(value: any) => [`${value} phút`, 'Thời gian học']}
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
