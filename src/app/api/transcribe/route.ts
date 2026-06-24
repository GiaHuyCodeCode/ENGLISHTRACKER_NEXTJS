import { NextResponse } from 'next/server';

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyOk(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? true : 1 - levenshtein(a, b) / maxLen >= 0.8;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio') as Blob;
    const word = formData.get('word') as string;

    if (!file) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // In a real environment, we would send this to OpenAI Whisper:
    // ...
    // For this mockup environment, simulate delay:
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Server-side calculated accuracy
    const isCorrect = Math.random() > 0.15;
    
    let recognized = word;
    if (!isCorrect) {
      // Simulate mistake by dropping a random word or altering the last part
      const words = word.split(' ');
      if (words.length > 1) {
        words[Math.floor(Math.random() * words.length)] = 'um';
        recognized = words.join(' ');
      } else {
        recognized = word.substring(0, Math.floor(word.length / 2)) + 'a';
      }
    }

    const recWords = normalize(recognized).split(' ').filter(Boolean);
    const tgtWords = normalize(word).split(' ').filter(Boolean);
    
    let hits = 0;
    const wordDiff = word.trim().split(/\s+/).map((w, i) => {
      const ok = i < recWords.length ? fuzzyOk(recWords[i], normalize(w)) : false;
      if (ok) hits++;
      return { word: w, ok };
    });

    const accuracy = tgtWords.length ? Math.round((hits / tgtWords.length) * 100) : 0;

    return NextResponse.json({
      recognized,
      accuracy,
      wordDiff,
      message: "Scored by Server-side AI (Mock)"
    });
    
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Failed to transcribe' }, { status: 500 });
  }
}
