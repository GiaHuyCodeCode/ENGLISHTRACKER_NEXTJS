import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
];

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface SentenceFeedback {
  sentenceId: number;
  correct: string;
  studentText: string;
  accuracy: number;
  errors: string[];
}

interface FeedbackRequest {
  studentName: string;
  assignmentTitle: string;
  sentences: SentenceFeedback[];
  overallScore: number;
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<string> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error (${model}): ${res.status} — ${JSON.stringify(errBody)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`No text content from model ${model}`);
  return text;
}

function buildPrompt(req: FeedbackRequest): string {
  const sentenceSummary = req.sentences
    .map((s, i) =>
      `Câu ${i + 1} (Độ chính xác: ${s.accuracy}%):
  - Bản gốc: "${s.correct}"
  - Học viên viết: "${s.studentText || '(bỏ trống)'}"
  - Từ sai/thiếu: ${s.errors.length > 0 ? s.errors.join(', ') : 'Không có'}`
    )
    .join('\n\n');

  return `Bạn là một giáo viên tiếng Anh giàu kinh nghiệm đang chấm bài luyện nghe chép chính tả (Dictation) cho học viên.

Thông tin bài làm:
- Học viên: ${req.studentName}
- Bài tập: "${req.assignmentTitle}"
- Điểm tổng: ${req.overallScore}/100

Chi tiết từng câu:
${sentenceSummary}

Hãy đưa ra nhận xét ngắn gọn, tích cực, cá nhân hóa bằng tiếng Việt với cấu trúc JSON sau:
{
  "summary": "1-2 câu nhận xét tổng quan về kết quả và thái độ học",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "improvements": ["Điểm cần cải thiện 1 với ví dụ cụ thể", "Điểm cần cải thiện 2"],
  "tips": ["Mẹo luyện tập 1 (cụ thể, dễ thực hiện)", "Mẹo luyện tập 2", "Mẹo luyện tập 3"],
  "encouragement": "1 câu động viên ngắn gọn, chân thành"
}

Chỉ trả về JSON, không có text nào khác.`;
}

function buildFallbackFeedback(req: FeedbackRequest) {
  const score = req.overallScore;
  const isGood = score >= 80;
  const isMedium = score >= 50;

  return {
    summary: isGood
      ? `${req.studentName} đã hoàn thành bài Dictation "${req.assignmentTitle}" với kết quả rất tốt (${score}/100). Khả năng nghe hiểu và viết lại của bạn đang tiến bộ rõ rệt!`
      : isMedium
      ? `${req.studentName} đã hoàn thành bài "${req.assignmentTitle}" đạt ${score}/100. Bạn đã nắm được phần lớn nội dung, cần cải thiện thêm ở một số câu.`
      : `${req.studentName} cần luyện tập thêm. Điểm ${score}/100 cho thấy kỹ năng nghe cần được củng cố hơn.`,
    strengths: isGood
      ? ['Khả năng nhận diện từ vựng tốt', 'Tốc độ xử lý thông tin nghe khá nhanh']
      : ['Đã cố gắng hoàn thành toàn bộ bài tập', 'Có nỗ lực ghi lại những gì nghe được'],
    improvements: req.sentences
      .filter(s => s.accuracy < 70)
      .slice(0, 2)
      .map(s => `Câu: "${s.correct}" — Hãy nghe lại chậm hơn và chú ý phát âm các từ: ${s.errors.slice(0, 3).join(', ')}`),
    tips: [
      'Nghe lại đoạn audio 3-5 lần trước khi gõ để nắm toàn bộ ngữ cảnh',
      'Luyện nghe YouTube với subtitle tiếng Anh để quen với tốc độ nói tự nhiên',
      'Chú ý các từ nối (linking words) và âm liên kết trong câu',
    ],
    encouragement: isGood
      ? 'Xuất sắc! Hãy tiếp tục duy trì phong độ này nhé! 🎉'
      : 'Đừng nản lòng! Mỗi lần luyện tập là một bước tiến bộ. Cố lên! 💪',
  };
}

// Rate limiting: in-memory store (resets on server restart)
const rateLimitStore = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body: FeedbackRequest = await req.json();
    const { studentName, assignmentTitle, sentences, overallScore } = body;

    if (!studentName || !sentences?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rate limit: 1 req per 60s per student
    const rateLimitKey = studentName;
    const lastRequest = rateLimitStore.get(rateLimitKey) || 0;
    const now = Date.now();
    if (now - lastRequest < 60_000) {
      // Return cached feedback without hitting AI
      return NextResponse.json({
        ...buildFallbackFeedback(body),
        source: 'cached',
      });
    }
    rateLimitStore.set(rateLimitKey, now);

    const apiKey = process.env.GEMINI_API_KEY;

    // No API key → return rule-based feedback
    if (!apiKey) {
      return NextResponse.json({
        ...buildFallbackFeedback(body),
        source: 'rule_based',
      });
    }

    const prompt = buildPrompt(body);

    // Try each model in order, auto-fallback
    let lastError: Error | null = null;
    for (const model of GEMINI_MODELS) {
      try {
        const rawText = await callGemini(model, prompt, apiKey);

        // Parse JSON from response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
          ...parsed,
          source: model,
        });
      } catch (err: any) {
        console.error(`[AI Feedback] Model ${model} failed:`, err.message);
        lastError = err;
        // Continue to next model
      }
    }

    // All models failed → rule-based fallback
    console.error('[AI Feedback] All models failed, using rule-based fallback:', lastError?.message);
    return NextResponse.json({
      ...buildFallbackFeedback(body),
      source: 'fallback',
    });

  } catch (err: any) {
    console.error('[AI Feedback] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
