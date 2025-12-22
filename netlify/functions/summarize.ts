import { GoogleGenAI } from '@google/genai';

export const handler = async (event: any) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
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

    const historyText = body.history || '';
    const lang = body.lang || 'ko';

    if (!historyText) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'History text is required' }),
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
      Please analyze and summarize the following conversation.
      Provide the result in the language: ${lang === 'ko' ? 'Korean' : 'English'}.
      
      Format your response exactly as follows:
      ## 📝 Summary
      (3 bullet points summarizing the main content)
      
      ## 💡 Key Topics
      (List of important terms or topics mentioned)
      
      Conversation:
      ${historyText}
    `;

        const response = await (ai as any).getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(prompt);
        const resultText = response.response.text() || '';

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: resultText }),
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Summarization failed',
                detail: error?.message || String(error),
            }),
        };
    }
};
