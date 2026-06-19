with open('src/app/student/dictation/[id]/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useEffect, useState, useRef } from 'react';", "import { useEffect, useState, useRef, useCallback } from 'react';")

old_code = """  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const speakCurrent = () => {
    if (!sentences[currentIdx]) return;
    if (isMounted.current) setIsSpeaking(true);"""

new_code = """  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const speakCurrent = useCallback(() => {
    if (!sentences[currentIdx]) return;
    if (isMounted.current) setIsSpeaking(true);"""

content = content.replace(old_code, new_code)

with open('src/app/student/dictation/[id]/page.tsx', 'w') as f:
    f.write(content)

