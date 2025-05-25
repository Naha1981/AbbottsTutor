/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {
  GenerateContentResponse,
  GenerateContentConfig,
  GenerateContentParameters,
  GoogleGenAI,
  Part,
  FinishReason,
} from '@google/genai';

// Fix: API key must be obtained exclusively from process.env.API_KEY
const API_KEY = process.env.API_KEY;

interface GenerateTextOptions {
  prompt: string;
  videoUrl?: string;
  modelName?: string; // Optional, defaults to gemini-2.5-flash-preview-04-17
  config?: Partial<GenerateContentConfig>; // Allow passing other config like temperature, responseMimeType
}

/**
 * Generate text content using the Gemini API, optionally including video data.
 *
 * @param options - Configuration options for the generation request.
 * @returns The generated text string.
 */
export async function generateText(
  options: GenerateTextOptions,
): Promise<string> {
  const {
    prompt,
    videoUrl,
    modelName = 'gemini-2.5-flash-preview-04-17', // Default model
    config = {},
  } = options;

  if (!API_KEY) {
    throw new Error(
      'API key is missing or empty. Make sure process.env.API_KEY is set.',
    );
  }

  const ai = new GoogleGenAI({apiKey: API_KEY});

  const parts: Part[] = [{text: prompt}];

  if (videoUrl) {
    try {
      // Using fileData with fileUri is for server-side. For client-side, you'd typically use inlineData with base64.
      // However, the prompt implies direct URI usage might be working in their setup,
      // or they have a proxy that handles it. Assuming current videoUrl approach works for now.
      parts.push({
        fileData: {
          mimeType: 'video/mp4', // Assuming mp4, could be made more flexible
          fileUri: videoUrl,
        },
      });
    } catch (error) {
      console.error('Error processing video input:', error);
      throw new Error(`Failed to process video input from URL: ${videoUrl}`);
    }
  }
  
  const generationConfig: GenerateContentConfig = {
    temperature: 0.7, // Default temperature
    ...config, // Merge with any provided config
  };

  const request: GenerateContentParameters = {
    model: modelName,
    contents: [{role: 'user', parts}],
    config: generationConfig,
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent(request);

    if (response.promptFeedback?.blockReason) {
      throw new Error(
        `Content generation failed: Prompt blocked (reason: ${response.promptFeedback.blockReason})`,
      );
    }

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('Content generation failed: No candidates returned.');
    }

    const firstCandidate = response.candidates[0];

    if (
      firstCandidate.finishReason &&
      firstCandidate.finishReason !== FinishReason.STOP &&
      firstCandidate.finishReason !== FinishReason.MAX_TOKENS // MAX_TOKENS can sometimes be acceptable if content is usable
    ) {
      if (firstCandidate.finishReason === FinishReason.SAFETY) {
        throw new Error(
          'Content generation failed: Response blocked due to safety settings.',
        );
      } else {
        throw new Error(
          `Content generation failed: Stopped due to ${firstCandidate.finishReason}.`,
        );
      }
    }
    
    // Use the .text accessor as per guidelines
    const textOutput = response.text;
    if (textOutput === null || textOutput === undefined) {
        // This case should ideally be caught by earlier checks (no candidates, blocked)
        // but as a fallback:
        const partText = firstCandidate.content?.parts?.map(p => p.text).join('') || '';
        if (!partText) {
           throw new Error('Content generation failed: No text found in response parts.');
        }
        return partText;
    }
    return textOutput;

  } catch (error) {
    console.error(
      'An error occurred during Gemini API call or response processing:',
      error,
    );
    if (error instanceof Error) {
      if (error.message.includes('429') || error.message.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'API request limit reached (Error 429: Resource Exhausted). You may have exceeded your current quota. Please check your plan and billing details or try again later. For more information, visit https://ai.google.dev/gemini-api/docs/rate-limits.'
        );
      }
      // Preserve other specific error messages from the SDK if they exist
      throw error;
    }
    // Fallback for non-Error objects
    throw new Error('An unknown error occurred during the Gemini API call.');
  }
}