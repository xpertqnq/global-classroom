import { GoogleGenAI } from '@google/genai';

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
      body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다. 설정에서 개인 키를 입력하거나 서버 설정을 확인해주세요.' }),
    };
  }

  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    console.error('translate: failed to parse body', err);
    body = {};
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const from = typeof body.from === 'string' ? body.from : '';
  const to = typeof body.to === 'string' ? body.to : '';

  if (!text.trim() || !from || !to) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '필수 값(text/from/to)이 누락되었습니다.' }),
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  // 폴백 모델 순회
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [{
            text: `Translate the following text from ${from} to ${to}.
Output ONLY the translated text, no explanations.
Text: "${text}"`,
          }],
        }],
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translated: response.text?.trim() || '',
          model, // 사용된 모델 반환
        }),
      };
    } catch (error: any) {
      lastError = error;
      console.error(`translate: model ${model} failed`, error);
      // 429 (Rate Limit) 또는 503 (Service Unavailable)인 경우 다음 모델 시도
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
      error: '번역에 실패했습니다. 모든 모델의 제한량이 소진되었습니다.',
      detail: lastError?.message || String(lastError),
    }),
  };
};
