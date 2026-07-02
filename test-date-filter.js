const mgmtDateFilter = '2026-06-30';
const mgmtSkillFilter = 'Vocab';
const a = {
  id: 'rep-1',
  title: 'Stage 1',
  type: 'repetition',
  createdAt: '2026-06-30T01:00:00.000Z'
};

if (mgmtSkillFilter === 'Vocab') {
  if (a.type === 'repetition') console.log('Hiding repetition in Vocab tab!');
}
