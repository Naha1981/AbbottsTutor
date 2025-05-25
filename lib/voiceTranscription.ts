/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import { GoogleGenAI, Part } from '@google/genai';

const API_KEY = process.env.API_KEY;
const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]); // Remove "data:mime/type;base64," prefix
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!API_KEY) {
    throw new Error('API key is missing. Ensure process.env.API_KEY is set.');
  }
  if (audioBlob.size === 0) {
    throw new Error('Audio blob is empty. Cannot transcribe.');
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const base64Audio = await blobToBase64(audioBlob);

  const audioPart: Part = {
    inlineData: {
      mimeType: audioBlob.type || 'audio/webm', // Use actual blob type, fallback to webm
      data: base64Audio,
    },
  };

  // Prompt for transcription
  const textPart: Part = {
    text: 'Transcribe this audio recording accurately. Provide only the transcribed text, without any additional comments or conversational filler.',
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [textPart, audioPart] }],
    });

    const transcription = response.text;
    if (transcription === null || transcription === undefined) {
        // This case might indicate an issue or empty transcription from the model.
        console.warn('Transcription result is null or undefined.');
        return ''; // Return empty string for null/undefined transcription
    }
    return transcription;

  } catch (error) {
    console.error('Error during Gemini API call for transcription:', error);
    // Rethrow to be caught by the caller, potentially with more user-friendly message.
    if (error instanceof Error) {
        throw new Error(`Transcription API error: ${error.message}`);
    }
    throw new Error('An unknown error occurred during transcription.');
  }
}
