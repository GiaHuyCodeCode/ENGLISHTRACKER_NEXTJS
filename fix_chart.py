import re

with open('src/components/ui/StudentPerformanceChart.tsx', 'r') as f:
    content = f.read()

# Fix YAxis Margin and Width
content = content.replace("margin={{ top: 20, right: 30, left: -20, bottom: 5 }}", "margin={{ top: 20, right: 30, left: 0, bottom: 5 }}")
content = content.replace("<YAxis \n            stroke=\"#888888\"", "<YAxis \n            width={45}\n            stroke=\"#888888\"")

# Fix Color Mapping (don't use string hash, just use index directly)
old_color_map = """  const colorMap = students.reduce((acc, name) => {
    const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % colors.length;
    acc[name] = colors[index];
    return acc;
  }, {} as Record<string, string>);"""

new_color_map = """  const colorMap = students.reduce((acc, name, index) => {
    const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    acc[name] = colors[index % colors.length];
    return acc;
  }, {} as Record<string, string>);"""

content = content.replace(old_color_map, new_color_map)

with open('src/components/ui/StudentPerformanceChart.tsx', 'w') as f:
    f.write(content)
