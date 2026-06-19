import re

with open('src/components/forms/AssignmentForms.tsx', 'r') as f:
    content = f.read()

# Replace the current lucide-react import with a comprehensive one
old_import = "import { FileJson, AlertCircle, CheckCircle2, ChevronDown, Clock, Play, Trash2, Headphones, Plus, Upload, Eye, Volume2 } from 'lucide-react';"
new_import = "import { BookOpen, ListChecks, Plus, Trash2, Upload, CheckCircle2, AlertCircle, ArrowLeft, Eye, FileJson, PenTool, Headphones, Play, Clock, ChevronDown, Volume2, Save, X, XCircle, Search, Copy } from 'lucide-react';"

if old_import in content:
    content = content.replace(old_import, new_import)
else:
    # Fallback if old_import was slightly different
    content = re.sub(r"import \{.*?\} from 'lucide-react';", new_import, content)

with open('src/components/forms/AssignmentForms.tsx', 'w') as f:
    f.write(content)
