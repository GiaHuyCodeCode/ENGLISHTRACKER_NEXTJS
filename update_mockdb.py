import re

with open('src/lib/database_mockup.ts', 'r') as f:
    content = f.read()

# Add new mockVocabProgress
new_content = """export const mockVocabProgress: any[] = [
  { studentName: 'Huy', wordId: 'v1', stage: 2, interval: 3, nextReviewDate: d(0), repetitions: 2, lastReviewed: d(3) }, // Due today
  { studentName: 'Huy', wordId: 'v2', stage: 3, interval: 7, nextReviewDate: d(-3), repetitions: 3, lastReviewed: d(4) }, // Due in 3 days
  { studentName: 'Huy', wordId: 'v3', stage: 1, interval: 1, nextReviewDate: d(1), repetitions: 1, lastReviewed: d(2) }, // Due yesterday (Overdue)
  { studentName: 'Huy', wordId: 'v4', stage: 4, interval: 14, nextReviewDate: d(-10), repetitions: 4, lastReviewed: d(4) }, // Due in 10 days
  { studentName: 'Linh', wordId: 'v1', stage: 1, interval: 1, nextReviewDate: d(0), repetitions: 1, lastReviewed: d(1) }, // Due today
];

export const mockGamification: any[] = [
  { studentName: 'Huy', streakCount: 3, badges: ['b1', 'b2'], points: 100, lastActiveDate: d(0) },
  { studentName: 'Linh', streakCount: 1, badges: ['b1'], points: 50, lastActiveDate: d(0) },
  { studentName: 'Tuấn', streakCount: 5, badges: ['b3'], points: 80, lastActiveDate: d(0) },
  { studentName: 'Mai', streakCount: 2, badges: [], points: 90, lastActiveDate: d(0) }
];
"""

if "mockVocabProgress" not in content:
    content = content + "\n" + new_content

with open('src/lib/database_mockup.ts', 'w') as f:
    f.write(content)

