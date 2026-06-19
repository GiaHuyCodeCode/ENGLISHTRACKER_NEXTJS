import re

with open('src/lib/local-store.ts', 'r') as f:
    content = f.read()

if "USE_MOCK_DB" not in content:
    content = content.replace("import { syncSubmissionToSheet", "import { USE_MOCK_DB, mockAssignments, mockSubmissions, mockTrackings, mockVocabCards } from './database_mockup';\nimport { syncSubmissionToSheet")
    
    pattern = r"  if \(localStorage\.getItem\(KEYS\.seeded\)\) return;\n  \n  // Không tạo sample data nữa, chỉ đánh dấu đã khởi tạo\n  localStorage\.setItem\(KEYS\.seeded, '1'\);"
    
    new_block = """  if (localStorage.getItem(KEYS.seeded)) return;
  
  if (USE_MOCK_DB) {
    write(KEYS.assignments, mockAssignments);
    write(KEYS.submissions, mockSubmissions);
    write(KEYS.dailyTracking, mockTrackings);
    write(KEYS.vocabulary, mockVocabCards);
  }
  
  localStorage.setItem(KEYS.seeded, '1');"""
    
    content = re.sub(pattern, new_block, content)

with open('src/lib/local-store.ts', 'w') as f:
    f.write(content)

