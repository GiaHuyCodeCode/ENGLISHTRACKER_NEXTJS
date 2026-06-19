import re

with open('src/app/page.tsx', 'r') as f:
    content = f.read()

# Thêm import cho StudentPerformanceChart nếu chưa có
if "StudentPerformanceChart" not in content:
    content = content.replace("import { Trophy,", "import { StudentPerformanceChart } from '@/components/ui/StudentPerformanceChart';\nimport { Trophy,")

# Thay thế khối Student Leaderboard
pattern = r"\{/\* Student Leaderboard \*/\}.*?(?=\{/\* Assignments List \*/\})"
new_block = """{/* Student Leaderboard */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Biểu Đồ Thi Đua Học Tập
          </h2>
          <div className="glass-strong rounded-3xl p-6 flex flex-col justify-center">
            <StudentPerformanceChart submissions={submissions} />
          </div>
        </div>

        """
content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open('src/app/page.tsx', 'w') as f:
    f.write(content)

