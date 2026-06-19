import re

with open('src/lib/google-sheets.ts', 'r') as f:
    content = f.read()

if "USE_MOCK_DB" not in content:
    content = content.replace("import { Submission, Assignment, DailyTracking, VocabCard } from './local-store';", "import { Submission, Assignment, DailyTracking, VocabCard } from './local-store';\nimport { USE_MOCK_DB } from './database_mockup';")
    
    # Prepend if (USE_MOCK_DB) return; to syncSubmissionToSheet, syncAssignmentToSheet, syncActionToSheet, syncVocabListToSheet
    content = content.replace("export async function syncSubmissionToSheet(submission: any) {", "export async function syncSubmissionToSheet(submission: any) {\n  if (USE_MOCK_DB) return;")
    content = content.replace("export async function syncAssignmentToSheet(assignment: Assignment) {", "export async function syncAssignmentToSheet(assignment: Assignment) {\n  if (USE_MOCK_DB) return;")
    content = content.replace("export async function syncActionToSheet(action: 'delete_submission' | 'delete_assignment', id: string) {", "export async function syncActionToSheet(action: 'delete_submission' | 'delete_assignment', id: string) {\n  if (USE_MOCK_DB) return;")
    content = content.replace("export async function syncVocabListToSheet(cards: VocabCard[]) {", "export async function syncVocabListToSheet(cards: VocabCard[]) {\n  if (USE_MOCK_DB) return;")

with open('src/lib/google-sheets.ts', 'w') as f:
    f.write(content)

