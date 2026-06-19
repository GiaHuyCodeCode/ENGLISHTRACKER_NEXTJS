import re

with open('src/app/teacher/assignments/new/page.tsx', 'r') as f:
    content = f.read()

# Fix imports
content = content.replace("VocabRewriteForm", "RewriteVocabForm")

# Ensure VocabularyForm is imported
if "VocabularyForm" not in content[:500]:
    content = content.replace("RewriteVocabForm, DictationForm }", "RewriteVocabForm, DictationForm, VocabularyForm }")

with open('src/app/teacher/assignments/new/page.tsx', 'w') as f:
    f.write(content)
