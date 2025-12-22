import { GoogleGenAI, Type } from '@google/genai';

const SUPPORTED_CODES = ['ko', 'en', 'ja', 'zh', 'vi', 'es', 'fr', 'de', 'ru', 'th', 'id', 'ar', 'hi', 'tl', 'mn', 'uz'] as const;
type SupportedCode = (typeof SUPPORTED_CODES)[number];

// 모델 우선순위 (무료 제한량 많은 순서)
const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',  // 1순위: 1000-1500 RPD
  'gemini-1.5-flash',       // 2순위: 1000 RPD
  'gemini-2.5-flash',       // 3순위: 20-25 RPD
];

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '허용되지 않은 메서드입니다.' }),
    };
  }

  const userApiKey = event.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }),
    };
  }

  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }

  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '필수 값(text)이 누락되었습니다.' }),
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  const prompt = `Detect the language of the following text.
Return JSON only.
Rules:
- code must be one of: ${SUPPORTED_CODES.join(', ')}
- confidence must be a number between 0 and 1.
Text: ${JSON.stringify(text)}`;

  // 폴백 모델 순회
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['code', 'confidence'],
          },
        },
      });

      const json = JSON.parse(response.text || '{}') as { code?: SupportedCode; confidence?: number };
      const code = SUPPORTED_CODES.includes((json.code as any) ?? '') ? (json.code as SupportedCode) : 'en';
      const confidence = typeof json.confidence === 'number' ? json.confidence : 0;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, confidence, model }),
      };
    } catch (error: any) {
      lastError = error;
      // 429 (Rate Limit) 또는 503인 경우 다음 모델 시도
      const status = error?.status || error?.response?.status;
      if (status === 429 || status === 503 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        console.log(`Model ${model} rate limited, trying next...`);
        continue;
      }
      // 다른 에러는 즉시 반환
      break;
    }
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: '언어 감지에 실패했습니다.',
      detail: lastError?.message || String(lastError),
    }),
  };
};
