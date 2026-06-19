import re

with open('src/lib/local-store.ts', 'r') as f:
    content = f.read()

pattern = r"export function getStudents\(\): Student\[\] \{"
new_block = """export function getStudents(): Student[] {
  if (USE_MOCK_DB) return [
    { id: '1', name: 'Huy', color: '#3B82F6', avatar: 'HY', createdAt: new Date().toISOString() },
    { id: '2', name: 'Linh', color: '#10B981', avatar: 'LN', createdAt: new Date().toISOString() },
    { id: '3', name: 'Tuấn', color: '#F59E0B', avatar: 'TN', createdAt: new Date().toISOString() },
    { id: '4', name: 'Mai', color: '#EF4444', avatar: 'MI', createdAt: new Date().toISOString() }
  ];
"""

content = re.sub(pattern, new_block, content)

with open('src/lib/local-store.ts', 'w') as f:
    f.write(content)

