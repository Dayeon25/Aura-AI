import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Summarizes text with a specific time target or level.
 */
export async function summarizeText(text: string, level: string = "일반", minutes: number = 5) {
  const prompt = `다음 텍스트를 ${level} 수준의 독자에게 맞춰서 요약해줘. 읽는 데 약 ${minutes}분 정도 걸리는 분량으로 한국어로 작성해줘. 텍스트: ${text}`;
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

/**
 * Analyzes text to detect roles (gender, age, tone) for a multi-role audiobook.
 */
export async function analyzeRoles(text: string) {
  const prompt = `다음 소설 발췌문을 분석하여 등장인물들을 식별해줘. 각 인물에 대해 목소리 프로필(성별, 대략적인 연령대, 어조)을 제안해줘. 결과는 {name, gender, age, tone}을 포함하는 JSON 배열 형식으로 반환해줘. 텍스트: ${text}`;
  const result = await geminiModel.generateContent(prompt);
  try {
    const jsonStr = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse roles", e);
    return [];
  }
}

/**
 * Generates an "AI Lecture" based on a content snippet.
 */
export async function generateLecture(content: string) {
  const prompt = `당신은 Aura AI의 전문 교수님입니다. 다음 텍스트의 핵심 개념을 설명하는 매우 흥미로운 교육용 한국어 강의 스크립트를 작성해줘. 영상 강의에 적합하도록 섹션을 나누어 작성해줘. 내용: ${content}`;
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

/**
 * Answers questions about the context of the book.
 */
export async function askQuestion(context: string, question: string) {
  const prompt = `문맥: ${context}\n\n질문: ${question}\n\n위 문맥을 바탕으로 한국어로 질문에 답변해줘. 만약 기술적인 문항이라면, 명확하고 쉬운 용어로 부연 설명해줘.`;
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

/**
 * Suggests related books or study materials.
 */
export async function getRecommendations(title: string, category: string) {
  const prompt = `사용자가 '${title}'(${category})을(를) 읽고 있습니다. 더 깊이 있는 학습에 도움이 될 만한 관련 도서나 학습 자료 3개를 한국어로 추천해줘. 일반 텍스트 리스트 형식으로 반환해줘.`;
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}
