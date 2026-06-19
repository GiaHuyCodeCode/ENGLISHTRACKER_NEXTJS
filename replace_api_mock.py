import re

with open('src/app/api/assignments/route.ts', 'r') as f:
    content = f.read()

if "USE_MOCK_DB" not in content:
    content = content.replace("import { NextResponse } from 'next/server';", "import { NextResponse } from 'next/server';\nimport { USE_MOCK_DB, mockAssignments } from '@/lib/database_mockup';")
    
    pattern = r"export async function GET\(\) \{"
    new_block = """export async function GET() {
  if (USE_MOCK_DB) {
    return NextResponse.json(mockAssignments);
  }
"""
    content = re.sub(pattern, new_block, content)

with open('src/app/api/assignments/route.ts', 'w') as f:
    f.write(content)

