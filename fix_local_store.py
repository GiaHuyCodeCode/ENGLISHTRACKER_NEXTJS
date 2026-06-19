import re

with open('src/lib/local-store.ts', 'r') as f:
    content = f.read()

# 1. Gỡ bỏ override getter
content = re.sub(r"  if \(USE_MOCK_DB\) return mockSubmissions;\n", "", content)
content = re.sub(r"  if \(USE_MOCK_DB\) return mockAssignments;\n", "", content)
content = re.sub(r"  if \(USE_MOCK_DB\) return mockTrackings;\n", "", content)
content = re.sub(r"  if \(USE_MOCK_DB\) return mockVocabCards;\n", "", content)

# 2. Gỡ override getGamificationProfiles (khôi phục trạng thái cũ)
pattern_gami = r"export function getGamificationProfiles\(\): GamificationProfile\[\] \{.*?\}"
content = re.sub(pattern_gami, "export function getGamificationProfiles(): GamificationProfile[] {\n  return read<GamificationProfile[]>(KEYS.gamification, []);\n}", content, flags=re.DOTALL)

# 3. Gỡ override getStudents
pattern_stu = r"export function getStudents\(\): Student\[\] \{.*?\];\n\}"
content = re.sub(pattern_stu, """export function getStudents(): Student[] {
  return read<Student[]>('et_students', [
    { id: '1', name: 'Minh Uyên', color: '#EF4444', avatar: 'MU', createdAt: new Date().toISOString() },
    { id: '2', name: 'Khả Nhi', color: '#3B82F6', avatar: 'KN', createdAt: new Date().toISOString() },
    { id: '3', name: 'Ngọc Huy', color: '#10B981', avatar: 'NH', createdAt: new Date().toISOString() },
    { id: '4', name: 'Dương Lâm', color: '#F59E0B', avatar: 'DL', createdAt: new Date().toISOString() }
  ]);
}""", content, flags=re.DOTALL)

# 4. Thay đổi import
content = content.replace("mockVocabCards } from './database_mockup';", "mockVocabCards, mockVocabProgress, mockGamification } from './database_mockup';")

# 5. Cập nhật seedIfEmpty
pattern_seed = r"export function seedIfEmpty\(\): void \{.*?localStorage\.setItem\(KEYS\.seeded, '1'\);"
new_seed = """let initializedSwitch = false;
export function seedIfEmpty(): void {
  if (typeof window === 'undefined') return;

  if (!initializedSwitch) {
      initializedSwitch = true;
      const isCurrentlyMock = localStorage.getItem('is_mock_db') === '1';
      if (USE_MOCK_DB && !isCurrentlyMock) {
          localStorage.clear();
          localStorage.setItem('is_mock_db', '1');
      } else if (!USE_MOCK_DB && isCurrentlyMock) {
          localStorage.clear();
          localStorage.setItem('is_mock_db', '0');
      }
  }

  // Patch existing assignments that might be missing keywords or vocabCards (e.g. D8 bug)
  const assignments = getAssignments();
  let changed = false;
  const updatedAssignments = assignments.map(a => {
    let patched = false;
    const update = { ...a };
    if (!update.keywords) {
      update.keywords = [];
      patched = true;
    }
    if (!update.vocabCards) {
      update.vocabCards = [];
      patched = true;
    }
    if (patched) changed = true;
    return update;
  });

  if (changed) {
    write(KEYS.assignments, updatedAssignments);
  }

  if (localStorage.getItem(KEYS.seeded)) return;

  if (USE_MOCK_DB) {
     write(KEYS.assignments, mockAssignments);
     write(KEYS.submissions, mockSubmissions);
     write(KEYS.dailyTracking, mockTrackings);
     write(KEYS.vocabulary, mockVocabCards);
     write(KEYS.vocabProgress, mockVocabProgress);
     write(KEYS.gamification, mockGamification);
     write('et_students', [
        { id: '1', name: 'Huy', color: '#3B82F6', avatar: 'HY', createdAt: new Date().toISOString() },
        { id: '2', name: 'Linh', color: '#10B981', avatar: 'LN', createdAt: new Date().toISOString() },
        { id: '3', name: 'Tuấn', color: '#F59E0B', avatar: 'TN', createdAt: new Date().toISOString() },
        { id: '4', name: 'Mai', color: '#EF4444', avatar: 'MI', createdAt: new Date().toISOString() }
     ]);
  }
  
  localStorage.setItem(KEYS.seeded, '1');"""

content = re.sub(pattern_seed, new_seed, content, flags=re.DOTALL)

with open('src/lib/local-store.ts', 'w') as f:
    f.write(content)

