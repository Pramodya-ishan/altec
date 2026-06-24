import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
});

async function run() {
    try {
        console.log("Calling Gemini API with 2.5 flash...");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Hello"
        });
        console.log("Response:", response.text);
    } catch(e) {
        console.error("Gemini Error:", e);
    }
    process.exit(0);
}
run();
