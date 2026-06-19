import re

with open('src/app/student/page.tsx', 'r') as f:
    content = f.read()

if "StudentPerformanceChart" not in content:
    content = content.replace("import { Trophy,", "import { StudentPerformanceChart } from '@/components/ui/StudentPerformanceChart';\nimport { Trophy,")

pattern = r"\{/\* LEADERBOARD SECTION \*/\}.*?(?=\{/\* Stats for selected student \*/\})"
new_block = """{/* LEADERBOARD SECTION */}
      <div className="fade-in stagger-4 space-y-6">
        <h2 className="text-xl font-bold font-heading gradient-text flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Biểu Đồ Thi Đua Học Tập
        </h2>
        <StudentPerformanceChart submissions={getSubmissions()} />
      </div>

      """

content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open('src/app/student/page.tsx', 'w') as f:
    f.write(content)

