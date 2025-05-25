/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

export interface CapsTerm {
  term_name: string;
  topics: string[];
}

export interface CapsSubject {
  subject: string;
  terms: CapsTerm[]; // Updated from topics: string[]
}

export interface KeyConcept {
  concept: string;
  definition: string;
  formula?: string;
  detailedExplanation?: string; // Added for step-by-step explanations
}

export interface PracticeQuestion {
  question: string;
  type: 'multiple-choice' | 'short-answer' | 'problem-solving' | string;
  options?: string[];
  answer: string;
  solutionSteps?: string; // Added for detailed solution steps
}

// ContentType for video-to-app now primarily focuses on these.
// 'spec' and 'conceptOutline' are no longer generated for the "Learning Aids" section.
// 'code' is generated for the render tab.
// 'explanation' is for the modal.
// 'homeworkAssist' is for the homework mode.
export type ContentType = 
  | 'code' 
  | 'keyConcepts' 
  | 'practiceQuestions' 
  | 'explanation' 
  | 'homeworkAssist';
  // | 'spec' // No longer a primary generated learning aid
  // | 'conceptOutline'; // No longer a primary generated learning aid


export type GeneratedContent = string | KeyConcept[] | PracticeQuestion[];