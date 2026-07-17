import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyDaiT-us5imXDg-YUgWVqo4-eknE7iWOdQ" });
ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "hi"
}).catch(e => console.log("CAUGHT:", e.message));
