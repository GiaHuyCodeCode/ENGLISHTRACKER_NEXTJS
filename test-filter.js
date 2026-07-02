const fs = require('fs');

// Mock data
const allAssignments = [
  { id: '1', title: 'Vocab 1', type: 'vocabulary', skill: 'Vocab', createdAt: '2026-06-30T10:00:00.000Z' },
  { id: '2', title: 'Rep 1', type: 'repetition', createdAt: '2026-06-30T08:00:00.000Z' }
];

function filter(mgmtSkillFilter, mgmtDateFilter) {
  return allAssignments.filter(a => {
    if (mgmtSkillFilter === 'all' && a.type === 'repetition') {
      return false; // Mặc định ẩn bài repetition ở tab "Tất cả"
    }
    if (mgmtSkillFilter !== 'all') {
      if (mgmtSkillFilter === 'Repetition') {
        if (a.type !== 'repetition') return false;
      } else {
        if (a.type === 'repetition') return false;
        const skill = a.skill || 'Vocab';
        if (skill.toLowerCase() !== mgmtSkillFilter.toLowerCase()) return false;
      }
    }
    if (mgmtDateFilter) {
      if (!a.createdAt) return false;
      const d = new Date(a.createdAt);
      const aDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (aDate !== mgmtDateFilter) return false;
    }
    return true;
  });
}

console.log("all + date:", filter('all', '2026-06-30').length);
console.log("Repetition + date:", filter('Repetition', '2026-06-30').length);
console.log("Vocab + date:", filter('Vocab', '2026-06-30').length);

