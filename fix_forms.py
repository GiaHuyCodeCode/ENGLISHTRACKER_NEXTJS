import os
import re

with open('src/app/teacher/assignments/new/page.tsx', 'r') as f:
    content = f.read()

# Pattern to extract the forms block
# The forms start at "// ── Vocab Form" and end right before "export default function NewAssignmentPage()"
start_marker = "// ── Vocab Form ────────────────────────────────────────────────────────────────"
end_marker = "export default function NewAssignmentPage() {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    forms_code = content[start_idx:end_idx]
    
    # Ensure they are exported
    forms_code = forms_code.replace("function VocabForm", "export function VocabForm")
    # QuizForm, VocabRewriteForm, DictationForm are likely already exported
    
    # We need to write this to a new file `src/components/forms/AssignmentForms.tsx`
    os.makedirs('src/components/forms', exist_ok=True)
    
    # Include necessary imports
    forms_imports = """'use client';

import { useState, useRef } from 'react';
import { VocabKeyword, QuizQuestion, DictationSentence } from '@/lib/local-store';
import { FileJson, AlertCircle, CheckCircle2, ChevronDown, Clock, Play, Trash2, Headphones, Plus, Upload, Eye, Volume2 } from 'lucide-react';

// YouTube URL parser
export function extractYoutubeId(url: string): string | null {
  const regExps = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of regExps) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

"""
    with open('src/components/forms/AssignmentForms.tsx', 'w') as f2:
        f2.write(forms_imports + forms_code)
    
    # Remove forms from new/page.tsx and add import
    new_content = content[:start_idx] + "\nimport { VocabForm, QuizForm, VocabRewriteForm, DictationForm } from '@/components/forms/AssignmentForms';\n\n" + content[end_idx:]
    
    # Fix extractYoutubeId in new_content if it's there
    new_content = re.sub(r"// YouTube URL parser\nfunction extractYoutubeId.*?return null;\n\}\n", "", new_content, flags=re.DOTALL)
    
    with open('src/app/teacher/assignments/new/page.tsx', 'w') as f:
        f.write(new_content)

# Update edit/page.tsx to import from the new location
with open('src/app/teacher/assignments/[id]/edit/page.tsx', 'r') as f:
    edit_content = f.read()

edit_content = edit_content.replace(
    "import { VocabForm, QuizForm, VocabRewriteForm, DictationForm } from '../../new/page';",
    "import { VocabForm, QuizForm, VocabRewriteForm, DictationForm } from '@/components/forms/AssignmentForms';"
)

with open('src/app/teacher/assignments/[id]/edit/page.tsx', 'w') as f:
    f.write(edit_content)

print("Forms extracted successfully!")
