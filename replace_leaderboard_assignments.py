import re

with open('src/app/student/assignments/[id]/page.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace("import { MultipleChoiceExercise } from '@/components/exercises/MultipleChoiceExercise';", 
"import { MultipleChoiceExercise } from '@/components/exercises/MultipleChoiceExercise';\nimport { RaceTrackLeaderboard } from '@/components/ui/RaceTrackLeaderboard';")

# Remove Leaderboard component
pattern = r"// ── Leaderboard ─────────────────────────────────────────────────────────────.*?// ── Main Exercise Page ───────────────────────────────────────────────────────"
content = re.sub(pattern, "// ── Main Exercise Page ───────────────────────────────────────────────────────", content, flags=re.DOTALL)

# Replace tag
content = content.replace("<Leaderboard submissions", "<RaceTrackLeaderboard submissions")

with open('src/app/student/assignments/[id]/page.tsx', 'w') as f:
    f.write(content)

