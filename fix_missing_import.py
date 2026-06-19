import re

with open('src/components/forms/AssignmentForms.tsx', 'r') as f:
    content = f.read()

# Add getVocabularyCards to import list
content = content.replace(
    "import { VocabKeyword, QuizQuestion, DictationSentence } from '@/lib/local-store';",
    "import { VocabKeyword, QuizQuestion, DictationSentence, getVocabularyCards } from '@/lib/local-store';"
)

with open('src/components/forms/AssignmentForms.tsx', 'w') as f:
    f.write(content)
