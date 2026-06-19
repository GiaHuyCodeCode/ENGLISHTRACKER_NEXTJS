import re

with open('src/lib/local-store.ts', 'r') as f:
    content = f.read()

# The helper functions to inject back
helpers = """
export function getStudentNames(): string[] {
  return getStudents().map(s => s.name);
}

export function createStudent(name: string, color: string) {
  const students = getStudents();
  if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Học viên đã tồn tại!');
  }
  
  const avatar = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
  const newStudent: Student = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
    name,
    color,
    avatar,
    createdAt: new Date().toISOString()
  };
  
  write('et_students', [...students, newStudent]);
  syncActionToSheet({ action: 'add_student', student: newStudent });
  return newStudent;
}

export function getStudentColors(name: string): { bg: string; text: string; border: string; hex: string } {
  const student = getStudents().find(s => s.name === name);
  const hex = student?.color || '#8B5CF6'; 
  
  if (hex.toUpperCase().includes('EF4444')) return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', hex };
  if (hex.toUpperCase().includes('3B82F6')) return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', hex };
  if (hex.toUpperCase().includes('10B981')) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', hex };
  if (hex.toUpperCase().includes('F59E0B')) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', hex };
  if (hex.toUpperCase().includes('8B5CF6')) return { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', hex };
  if (hex.toUpperCase().includes('EC4899')) return { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', hex };
  
  return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', hex };
}

export function getStudentAvatar(name: string): string {
  const student = getStudents().find(s => s.name === name);
  if (student) return student.avatar;
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
}

export interface GamificationProfile {
  studentName: string;
  streakCount: number;
  lastActiveDate: string | null;
  badges: string[];
}
"""

# Insert right before export interface BadgeDef
if "getStudentNames" not in content:
    content = content.replace("export interface BadgeDef {", helpers + "\nexport interface BadgeDef {")

# Also fix the weird "return read<GamificationProfile[]>(KEYS.gamification, []);" that shorts out Gamification profile calc
content = content.replace("export function getGamificationProfiles(): GamificationProfile[] {\n  return read<GamificationProfile[]>(KEYS.gamification, []);", "export function getGamificationProfiles(): GamificationProfile[] {")

with open('src/lib/local-store.ts', 'w') as f:
    f.write(content)
