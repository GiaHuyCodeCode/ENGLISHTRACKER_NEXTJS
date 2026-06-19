import re

with open('src/lib/local-store.ts', 'r') as f:
    content = f.read()

# For getSubmissions
content = content.replace("export function getSubmissions(): Submission[] {\n  return read<Submission[]>(KEYS.submissions, []);", "export function getSubmissions(): Submission[] {\n  if (USE_MOCK_DB) return mockSubmissions;\n  return read<Submission[]>(KEYS.submissions, []);")

# For getAssignments
content = content.replace("export function getAssignments(): Assignment[] {\n  return read<Assignment[]>(KEYS.assignments, []);", "export function getAssignments(): Assignment[] {\n  if (USE_MOCK_DB) return mockAssignments;\n  return read<Assignment[]>(KEYS.assignments, []);")

# For getDailyTrackings
content = content.replace("export function getDailyTrackings(): DailyTracking[] {\n  return read<DailyTracking[]>(KEYS.dailyTracking, []);", "export function getDailyTrackings(): DailyTracking[] {\n  if (USE_MOCK_DB) return mockTrackings;\n  return read<DailyTracking[]>(KEYS.dailyTracking, []);")

# For getVocabularyCards
content = content.replace("export function getVocabularyCards(): VocabCard[] {\n  return read<VocabCard[]>(KEYS.vocabulary, []);", "export function getVocabularyCards(): VocabCard[] {\n  if (USE_MOCK_DB) return mockVocabCards;\n  return read<VocabCard[]>(KEYS.vocabulary, []);")

# For getStudentNames
# getStudentNames() reads from Submissions and trackings mostly, but let's just let it run naturally, since getSubmissions and getDailyTrackings are mocked now, it will automatically return the mocked student names!
# wait, what if they read from localStorage for Gamification profiles?
content = content.replace("export function getGamificationProfiles(): GamificationProfile[] {", "export function getGamificationProfiles(): GamificationProfile[] {\n  if (USE_MOCK_DB) return [{ studentName: 'Huy', streakCount: 3, badges: [], points: 100 }, { studentName: 'Linh', streakCount: 1, badges: [], points: 50 }, { studentName: 'Tuấn', streakCount: 5, badges: [], points: 80 }, { studentName: 'Mai', streakCount: 2, badges: [], points: 90 }];")

with open('src/lib/local-store.ts', 'w') as f:
    f.write(content)

