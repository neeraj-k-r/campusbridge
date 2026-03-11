import { GoogleGenAI, Type } from "@google/genai";

export async function generateEventDescription(eventData) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("Gemini API Key is not configured. Please set GEMINI_API_KEY in your environment.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Title: ${eventData.title}, Date: ${eventData.date}, Location: ${eventData.location}, Details: ${eventData.additionalDetails}`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a detailed event proposal based on the following idea: "${prompt}". 
      Include a catchy title, a comprehensive description, a suggested location type (e.g., Auditorium, Lab, Outdoor), and a suggested duration (e.g., 2 hours, Half-day).
      Make it sound professional and engaging for college students.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A catchy and professional title for the event.",
            },
            description: {
              type: Type.STRING,
              description: "A detailed description of the event, its purpose, and what attendees can expect.",
            },
            suggestedLocation: {
              type: Type.STRING,
              description: "A suggested type of location for this event.",
            },
            suggestedDuration: {
              type: Type.STRING,
              description: "A suggested duration for the event.",
            }
          },
          required: ["title", "description", "suggestedLocation", "suggestedDuration"],
        },
      },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating event details:", error);
    throw new Error("Failed to generate event details. Please try again or use manual entry.");
  }
}

export async function generateEventPoster(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("Gemini API Key is not configured. Please set GEMINI_API_KEY in your environment.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: `A professional, engaging poster for a college event. The event is about: ${prompt}. Do not include any text in the image.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
          imageSize: "1K"
        }
      },
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating event poster:", error);
    throw new Error("Failed to generate event poster. Please try again.");
  }
}
