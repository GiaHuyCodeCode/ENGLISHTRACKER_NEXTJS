import re

with open('src/app/student/dictation/[id]/page.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace("import { ArrowLeft", 
"import { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';\nimport { ArrowLeft")

# Remove Leaderboard component
pattern = r"// ── Leaderboard ─────────────────────────────────────────────────────────────.*?// ── Result Screen ─────────────────────────────────────────────────────────────"
content = re.sub(pattern, "// ── Result Screen ─────────────────────────────────────────────────────────────", content, flags=re.DOTALL)

# Replace tag
content = content.replace("<Leaderboard submissions", "<RaceTrackLeaderboard submissions")

with open('src/app/student/dictation/[id]/page.tsx', 'w') as f:
    f.write(content)

