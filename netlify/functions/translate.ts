import { GoogleGenAI } from '@google/genai';

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '허용되지 않은 메서드입니다.' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '서버 환경변수 GEMINI_API_KEY가 설정되지 않았습니다.' }),
    };
  }

  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const from = typeof body.from === 'string' ? body.from : '';
  const to = typeof body.to === 'string' ? body.to : '';
  const model = typeof body.model === 'string' ? body.model : 'gemini-2.5-flash';

  if (!text.trim() || !from || !to) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '필수 값(text/from/to)이 누락되었습니다.' }),
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: `Translate the following text from ${from} to ${to}.
Output ONLY the translated text, no explanations.
Text: "${text}"`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translated: response.text?.trim() || '' }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: '번역에 실패했습니다.',
        detail: error?.message || String(error),
      }),
    };
  }
};
