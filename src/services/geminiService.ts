import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getTutorResponse = async (messages: { role: "user" | "model"; parts: { text: string }[] }[], systemInstruction: string) => {
  const contents = messages.length > 0 ? messages : [{ role: 'user', parts: [{ text: '你好，请开始算法训练营的开场白。' }] }];
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: contents,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });
  return response.text;
};
