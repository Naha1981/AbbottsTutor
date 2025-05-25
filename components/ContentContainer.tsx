
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import Editor from '@monaco-editor/react';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import {
  KeyConcept,
  PracticeQuestion,
  GeneratedContent,
  ContentType,
} from '@/lib/types';
import {parseHTML, parseJsonResponse} from '@/lib/parse';
import {
  CODE_REGION_CLOSER,
  CODE_REGION_OPENER,
  CODE_FROM_VIDEO_PROMPT, // Changed from SPEC_FROM_VIDEO_PROMPT
  KEY_CONCEPTS_PROMPT,
  PRACTICE_QUESTIONS_PROMPT,
  // CONCEPT_OUTLINE_PROMPT, // Removed
  EXPLAIN_DIFFERENTLY_PROMPT,
  HOMEWORK_ASSIST_PROMPT,
} from '@/lib/prompts';
import {generateText} from '@/lib/textGeneration';
import { getYouTubeVideoTitle } from '@/lib/youtube';


export interface ContentContainerRef {
  // getSpec: () => string; // Removed
  getCode: () => string;
}

type AppMode = 'video' | 'homework';

interface HomeworkParams {
  subject: string;
  term: string;
  topic: string;
  question: string;
}

interface ContentContainerProps {
  appMode: AppMode;
  contentBasis?: string; // Video URL for 'video' mode
  homeworkParams?: HomeworkParams; // Params for 'homework' mode
  // preSeededSpec?: string; // Removed
  preSeededCode?: string;
  onLoadingStateChange?: (isLoading: boolean) => void;
}

interface LoadingStates {
  // spec: boolean; // Removed
  code: boolean;
  keyConcepts: boolean;
  practiceQuestions: boolean;
  // conceptOutline: boolean; // Removed
  explanation: boolean;
  homeworkAssist: boolean;
}


export default forwardRef<ContentContainerRef, ContentContainerProps>(
  function ContentContainer(
    {
      appMode,
      contentBasis,
      homeworkParams,
      // preSeededSpec, // Removed
      preSeededCode,
      onLoadingStateChange,
    }: ContentContainerProps,
    ref: React.ForwardedRef<ContentContainerRef>
  ) {
    // const [spec, setSpec] = useState<string>(preSeededSpec || ''); // Removed
    const [code, setCode] = useState<string>(preSeededCode || '');
    const [keyConcepts, setKeyConcepts] = useState<KeyConcept[]>([]);
    const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[]>([]);
    // const [conceptOutline, setConceptOutline] = useState<string>(''); // Removed
    const [homeworkAssistanceText, setHomeworkAssistanceText] = useState<string>('');
    
    const [iframeKey, setIframeKey] = useState(0);
    
    const initialLoadingStates: LoadingStates = {
      // spec: appMode === 'video' && !(preSeededSpec && preSeededCode), // Removed
      code: appMode === 'video' && !preSeededCode, // Simplified logic
      keyConcepts: appMode === 'video',
      practiceQuestions: appMode === 'video',
      // conceptOutline: appMode === 'video', // Removed
      explanation: false,
      homeworkAssist: appMode === 'homework',
    };
    const [loadingStates, setLoadingStates] = useState<LoadingStates>(initialLoadingStates);
    
    const [error, setError] = useState<string | null>(null);
    // const [isEditingSpec, setIsEditingSpec] = useState(false); // Removed
    // const [editedSpec, setEditedSpec] = useState(''); // Removed
    
    const [activeOuterTabIndex, setActiveOuterTabIndex] = useState(0);
    const [activeLearningAidTabIndex, setActiveLearningAidTabIndex] = useState(0); 

    const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
    const [explanationConcept, setExplanationConcept] = useState('');
    const [explanationContent, setExplanationContent] = useState('');


    useImperativeHandle(ref, () => ({
      // getSpec: () => spec, // Removed
      getCode: () => code,
    }));

    const updateLoadingState = (contentType: keyof LoadingStates, isLoading: boolean) => {
      setLoadingStates(prev => ({...prev, [contentType]: isLoading}));
    };

    const generateAndSetContent = async <T extends GeneratedContent>(
      contentType: ContentType | 'homeworkAssist', // ContentType might need update if spec/conceptOutline are removed from it
      promptTemplate: string,
      setter: React.Dispatch<React.SetStateAction<T>>,
      parser?: (text: string) => T, 
      promptParams?: Record<string, string> 
    ) => {
      // Ensure contentType matches keys in LoadingStates
      const loadingKey = contentType as keyof LoadingStates;
      if (!(loadingKey in loadingStates)) {
        // If contentType was for a removed feature like 'spec' or 'conceptOutline', skip
        console.warn(`generateAndSetContent called for unhandled contentType: ${contentType}`);
        return;
      }


      if (appMode === 'video' && !contentBasis && contentType !== 'homeworkAssist') return;
      if (appMode === 'homework' && (!homeworkParams || !homeworkParams.question) && contentType === 'homeworkAssist') return;

      updateLoadingState(loadingKey, true);
      setError(null);

      try {
        let finalPrompt = promptTemplate;
        if (promptParams) {
          Object.keys(promptParams).forEach(key => {
            const placeholder = new RegExp(`{${key.toUpperCase()}}`, 'g');
            finalPrompt = finalPrompt.replace(placeholder, promptParams[key]);
          });
        }
        
        const videoUrlForApi = undefined; 

        const responseText = await generateText({
          prompt: finalPrompt,
          videoUrl: videoUrlForApi, 
          config: (contentType === 'keyConcepts' || contentType === 'practiceQuestions') // Removed 'conceptOutline' 
                  ? { responseMimeType: "application/json" } 
                  : undefined,
        });
        
        let dataForSetter: T;

        if (parser) { 
          dataForSetter = parser(responseText);
        } else if (contentType === 'keyConcepts' || contentType === 'practiceQuestions') {
          let parsedJson;
          try {
            parsedJson = parseJsonResponse(responseText);
          } catch (e) {
            console.error(`JSON parsing failed for ${contentType}:`, e, "Original Response Snippet:", responseText.substring(0,300));
            throw new Error(`AI response for ${contentType} was badly formatted. Please try again.`);
          }

          if (contentType === 'keyConcepts' && parsedJson && typeof parsedJson === 'object' && Array.isArray(parsedJson.concepts)) {
            dataForSetter = parsedJson.concepts as T;
          } else if (contentType === 'practiceQuestions' && parsedJson && typeof parsedJson === 'object' && Array.isArray(parsedJson.questions)) {
            dataForSetter = parsedJson.questions as T;
          } else {
            console.error(`Unexpected JSON structure for ${contentType}. Expected .concepts or .questions array. Got:`, parsedJson);
            throw new Error(`AI response for ${contentType} had an unexpected structure.`);
          }
        } 
        // Removed 'conceptOutline' specific parsing logic
        else { 
          dataForSetter = responseText as T; 
        }
        
        setter(dataForSetter);

      } catch (err) {
        console.error(`Error in generateAndSetContent for ${contentType}:`, err);
        let userMessage = `Failed to generate ${contentType}. An unexpected error occurred.`; // Default message
        if (err instanceof Error) {
            // Check for specific, user-friendly messages (like the one for 429 from generateText)
            if (err.message.includes("API request limit reached") ||
                err.message.startsWith("AI response for") || // Custom errors from parsing logic
                err.message.includes("badly formatted") ||
                err.message.includes("unexpected structure") ||
                err.message.includes("Content generation failed:") || // From generateText (e.g., safety, no candidates)
                err.message.includes("Transcription API error:") // From transcribeAudio (though not directly used here)
            ) {
                userMessage = err.message;
            } else {
                // For more generic errors from generateText or other unhandled exceptions
                userMessage = `Error generating ${contentType}: ${err.message}`;
            }
        }
        setError(userMessage);

        let actualEmptyState: any;
        if (contentType === 'keyConcepts' || contentType === 'practiceQuestions') {
            actualEmptyState = [];
        } else { 
            actualEmptyState = '';
        }
        setter(actualEmptyState as T);
      } finally {
        updateLoadingState(loadingKey, false);
      }
    };
    
    useEffect(() => {
      const overallLoading = Object.values(loadingStates).some(state => state === true);
      if (onLoadingStateChange) {
        onLoadingStateChange(overallLoading);
      }
    }, [loadingStates, onLoadingStateChange]);

    useEffect(() => {
      async function initializeVideoMode() {
        if (appMode === 'video' && contentBasis) {
          let videoTitle = 'this video'; 
          try {
            videoTitle = await getYouTubeVideoTitle(contentBasis);
          } catch (e) {
            console.warn("Failed to fetch video title for prompt context:", e);
            videoTitle = `the video at ${contentBasis}`;
          }
          
          const commonPromptParams = { VIDEO_TITLE: videoTitle, VIDEO_URL: contentBasis };

          if (preSeededCode) {
            // setSpec(''); // No spec to set
            setCode(preSeededCode);
            // updateLoadingState('spec', false); // Removed
            updateLoadingState('code', false);
          } else {
            // updateLoadingState('spec', true); // Removed
            setError(null);
            // setSpec(''); // Removed
            setCode('');
            
            updateLoadingState('code', true);
            try {
              const finalCodePrompt = CODE_FROM_VIDEO_PROMPT
                .replace(/{VIDEO_TITLE}/g, videoTitle)
                .replace(/{VIDEO_URL}/g, contentBasis)
                .replace(/{CODE_REGION_OPENER}/g, CODE_REGION_OPENER) 
                .replace(/{CODE_REGION_CLOSER}/g, CODE_REGION_CLOSER);

              const codeResponse = await generateText({
                prompt: finalCodePrompt,
              });
              const generatedCode = parseHTML(codeResponse, CODE_REGION_OPENER, CODE_REGION_CLOSER);
              setCode(generatedCode);
            } catch (err) {
              console.error('Error during initial code generation:', err);
              // Error handling for code generation will use the updated logic in the catch block of generateAndSetContent
              // This specific catch block can be simplified or rely on the general error display.
               let userMessage = 'Failed to generate initial app content due to an unexpected error.';
                if (err instanceof Error) {
                    if (err.message.includes("API request limit reached") || err.message.includes("Content generation failed:")) {
                        userMessage = err.message;
                    } else {
                        userMessage = `Error generating app code: ${err.message}`;
                    }
                }
              setError(userMessage);
            } finally {
                 updateLoadingState('code', false);
            }
          }
          // Generate learning aids
          generateAndSetContent<KeyConcept[]>('keyConcepts', KEY_CONCEPTS_PROMPT, setKeyConcepts, undefined, commonPromptParams);
          generateAndSetContent<PracticeQuestion[]>('practiceQuestions', PRACTICE_QUESTIONS_PROMPT, setPracticeQuestions, undefined, commonPromptParams);
          // generateAndSetContent<string>('conceptOutline', CONCEPT_OUTLINE_PROMPT, setConceptOutline, undefined, commonPromptParams); // Removed

        } else if (appMode === 'homework' && homeworkParams?.question) {
          // setSpec(''); // Removed
          setCode(''); 
          setKeyConcepts([]); 
          setPracticeQuestions([]); 
          // setConceptOutline(''); // Removed
          generateAndSetContent<string>(
            'homeworkAssist',
            HOMEWORK_ASSIST_PROMPT,
            setHomeworkAssistanceText,
            undefined, 
            {
              SUBJECT: homeworkParams.subject,
              TERM: homeworkParams.term,
              TOPIC: homeworkParams.topic,
              QUESTION: homeworkParams.question,
            }
          );
        }
      }
      initializeVideoMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appMode, contentBasis, homeworkParams, preSeededCode]);


    useEffect(() => {
      if (code) {
        setIframeKey((prev) => prev + 1);
      }
    }, [code]);

    // Removed: handleSpecEdit, handleSpecSave, handleSpecCancel

    const handleExplainConcept = async (concept: string) => {
      setExplanationConcept(concept);
      setIsExplanationModalOpen(true);
      setExplanationContent('');
      updateLoadingState('explanation', true); 
      setError(null);
      try {
        const prompt = EXPLAIN_DIFFERENTLY_PROMPT.replace('{CONCEPT}', concept);
        await generateAndSetContent<string>('explanation', prompt, setExplanationContent);
      } catch (err) { 
        console.error('Error in handleExplainConcept calling generateAndSetContent:', err);
        // Error state will be set by generateAndSetContent
        if (!explanationContent && !error) { // if generateAndSetContent sets error, this might not be needed
             setExplanationContent('Sorry, I could not generate an explanation at this time.');
        }
      }
    };

    const renderLoadingSpinner = (text?: string) => (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">{text || 'Loading...'}</p>
      </div>
    );

    const renderErrorState = (customError?: string) => (
      <div className="error-container">
        <div className="error-icon material-symbols-outlined">error</div>
        <h3 className="error-title">Error</h3>
        <p>{customError || error || 'Something went wrong. Please try again.'}</p>
        {appMode === 'video' && !contentBasis?.startsWith('http://') && !contentBasis?.startsWith('https://') && !customError && (
          <p className="error-note">(<strong>NOTE:</strong> Video URL might be a factor if title fetching failed. Ensure it starts with http:// or https://.)</p>
        )}
      </div>
    );
    
    // Removed renderSpecContent

    const renderKeyConceptsContent = () => {
      if (loadingStates.keyConcepts) return renderLoadingSpinner('Extracting key concepts...');
      if (error && keyConcepts.length === 0 && !loadingStates.keyConcepts) return renderErrorState(error); 
      if (!keyConcepts || keyConcepts.length === 0 && !loadingStates.keyConcepts) return <p className="empty-content-message">No key concepts extracted.</p>;
      return (
        <div className="tab-content-scrollable">
          <ul className="key-concepts-list">
            {keyConcepts.map((kc, index) => (
              <li key={index} className="key-concept-item">
                <h4>{kc.concept}</h4>
                <p>{kc.definition}</p>
                {kc.formula && <pre className="formula-display"><code>{kc.formula}</code></pre>}
                {kc.detailedExplanation && (
                  <div className="detailed-explanation">
                    <h4>Step-by-step Explanation:</h4>
                    <p>{kc.detailedExplanation}</p>
                  </div>
                )}
                <button onClick={() => handleExplainConcept(kc.concept)} className="button-secondary explain-button">
                  Explain Differently <span className="material-symbols-outlined">psychology_alt</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    };

    const renderPracticeQuestionsContent = () => {
      if (loadingStates.practiceQuestions) return renderLoadingSpinner('Generating practice questions...');
      if (error && practiceQuestions.length === 0 && !loadingStates.practiceQuestions) return renderErrorState(error);
      if (!practiceQuestions || practiceQuestions.length === 0 && !loadingStates.practiceQuestions) return <p className="empty-content-message">No practice questions generated.</p>;
      return (
        <div className="tab-content-scrollable">
          <ul className="practice-questions-list">
            {practiceQuestions.map((pq, index) => (
              <li key={index} className="practice-question-item">
                <p><strong>{`Q${index + 1} (${pq.type || 'Question'}):`}</strong> {pq.question}</p>
                {pq.options && (
                  <ul className="question-options">
                    {pq.options.map((opt, i) => <li key={i}>{opt}</li>)}
                  </ul>
                )}
                {pq.answer && <p className="answer-reveal"><strong>Answer:</strong> {pq.answer}</p>}
                {pq.solutionSteps && (
                  <div className="solution-steps">
                    <h4>Solution Steps:</h4>
                    <p>{pq.solutionSteps}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    };

    // Removed renderConceptOutlineContent
    
    const renderHomeworkAssistanceContent = () => {
      if (loadingStates.homeworkAssist) return renderLoadingSpinner('Getting AI assistance...');
      if (error && !homeworkAssistanceText && !loadingStates.homeworkAssist) return renderErrorState(error);
      if (!homeworkAssistanceText && !loadingStates.homeworkAssist) return <p className="empty-content-message">Enter your question and details to get help.</p>;
      return (
         <div className="tab-content-scrollable">
          <pre>{homeworkAssistanceText}</pre>
        </div>
      );
    };

    if (error && !(/*loadingStates.spec ||*/ loadingStates.code || loadingStates.keyConcepts || loadingStates.practiceQuestions /*|| loadingStates.conceptOutline*/ || loadingStates.homeworkAssist) && appMode === 'video' && !contentBasis) {
        return renderErrorState();
    }


    return (
      <div className="content-container-wrapper">
        {appMode === 'video' ? (
          <Tabs
            selectedIndex={activeOuterTabIndex}
            onSelect={(index) => {
              setActiveOuterTabIndex(index);
            }}
            className="outer-tabs"
          >
            <TabList className="outer-tab-list">
              <Tab className="outer-tab" disabled={loadingStates.code && !code}>Here is your App</Tab>
              <Tab className="outer-tab">Learning Aids</Tab>
            </TabList>

            <TabPanel className="outer-tab-panel">
              {loadingStates.code && !code ? renderLoadingSpinner('Generating interactive app...') : error && !code /*&& !loadingStates.spec (spec removed)*/ ? renderErrorState() : (
                <div className="iframe-container">
                  <iframe key={iframeKey} srcDoc={code} title="rendered-html" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin" />
                </div>
              )}
            </TabPanel>
            <TabPanel className="outer-tab-panel">
              <Tabs selectedIndex={activeLearningAidTabIndex} onSelect={index => setActiveLearningAidTabIndex(index)} className="inner-tabs">
                <TabList className="inner-tab-list">
                  {/* <Tab className="inner-tab">App Spec</Tab> // Removed */}
                  <Tab className="inner-tab">Key Concepts</Tab>
                  <Tab className="inner-tab">Practice Questions</Tab>
                  {/* <Tab className="inner-tab">Concept Outline</Tab> // Removed */}
                </TabList>
                {/* <TabPanel className="inner-tab-panel">{renderSpecContent()}</TabPanel> // Removed */}
                <TabPanel className="inner-tab-panel">{renderKeyConceptsContent()}</TabPanel>
                <TabPanel className="inner-tab-panel">{renderPracticeQuestionsContent()}</TabPanel>
                {/* <TabPanel className="inner-tab-panel">{renderConceptOutlineContent()}</TabPanel> // Removed */}
              </Tabs>
            </TabPanel>
          </Tabs>
        ) : ( 
          <Tabs selectedIndex={0} className="outer-tabs"> 
            <TabList className="outer-tab-list">
              <Tab className="outer-tab">Homework Assistance</Tab>
            </TabList>
            <TabPanel className="outer-tab-panel">
              {renderHomeworkAssistanceContent()}
            </TabPanel>
          </Tabs>
        )}

        {isExplanationModalOpen && (
          <div className="modal-overlay" onClick={() => setIsExplanationModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Explanation for: {explanationConcept}</h3>
              {loadingStates.explanation ? renderLoadingSpinner('Generating explanation...') : 
               error && explanationContent.startsWith('Sorry') ? renderErrorState('Failed to generate explanation.') : 
               <div className="modal-scrollable-content"><pre>{explanationContent}</pre></div>
              }
              <button onClick={() => setIsExplanationModalOpen(false)} className="button-primary close-modal-button">Close</button>
            </div>
          </div>
        )}

        <style>{`
          .content-container-wrapper {
            border: 2px solid var(--color-accent-secondary); /* Darker blue border */
            border-radius: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            height: 100%;
            max-height: inherit;
            min-height: inherit;
            overflow: hidden;
            position: relative;
            background-color: var(--color-bg); /* Base background for content area */
          }

          /* Tab System Styles - relies on index.css for .react-tabs__* base */
          .outer-tabs, .inner-tabs {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .outer-tab-list, .inner-tab-list {
            /* Basic structure from react-tabs, colors from index.css */
            padding: 0 10px; /* Keep padding for spacing */
            flex-shrink: 0;
          }
          .outer-tab, .inner-tab {
            /* Colors and selected state handled by .react-tabs__tab--selected in index.css */
            padding: 10px 15px;
            cursor: pointer;
            margin-bottom: -1px; /* Overlap border */
            font-size: 0.9rem;
            user-select: none;
          }
          
          .outer-tab-panel, .inner-tab-panel {
            flex: 1;
            overflow: hidden; 
            padding: 0; 
            height: 100%; 
            box-sizing: border-box;
            position: relative; 
            background-color: var(--color-surface-1); /* Panel background */
          }
          
          /* Adjust padding for content within panels */
           .outer-tab-panel > div, 
           .inner-tab-panel > div:not(.editor-container):not(.iframe-container),
           .inner-tab-panel.react-tabs__tab-panel--selected { /* Target selected inner tab panel directly */
             padding: 1rem;
             height: 100%;
             box-sizing: border-box;
             overflow-y: auto;
             scrollbar-width: thin;
             scrollbar-color: var(--color-accent-primary) var(--color-surface-2);
          }
          .inner-tab-panel.react-tabs__tab-panel--selected::-webkit-scrollbar {
            width: 8px;
          }
          .inner-tab-panel.react-tabs__tab-panel--selected::-webkit-scrollbar-track {
            background: var(--color-surface-2);
            border-radius: 4px;
          }
          .inner-tab-panel.react-tabs__tab-panel--selected::-webkit-scrollbar-thumb {
            background-color: var(--color-accent-primary);
            border-radius: 4px;
            border: 2px solid var(--color-surface-2);
          }
          
           .outer-tabs > .react-tabs__tab-panel--selected:not(:has(.inner-tabs)) > div:first-child {
             padding: 1rem; 
           }
           .outer-tabs > .react-tabs__tab-panel--selected:has(.inner-tabs) {
             padding: 0; /* No padding for panel containing inner tabs */
           }


          .tab-content-scrollable { 
            height: 100%;
            overflow-y: auto;
            box-sizing: border-box;
            line-height: 1.6;
            color: var(--color-text); /* Text color for scrollable content */
          }
          .tab-content-scrollable pre {
            white-space: pre-wrap;
            word-wrap: break-word; 
            font-family: var(--font-technical);
            font-size: 0.9rem;
            color: var(--color-text);
          }

          .iframe-container, .editor-container { 
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden; 
          }
          .iframe-container iframe {
            border: none;
            width: 100%;
            height: 100%;
          }

          .loading-container, .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 2rem;
            text-align: center;
            box-sizing: border-box;
            color: var(--color-text); /* Base text color */
            background-color: var(--color-surface-1); /* Match panel bg */
          }
          .loading-spinner {
            animation: spin 1s ease-in-out infinite;
            border: 4px solid rgba(255, 255, 255, 0.1); /* Light track for dark theme */
            border-radius: 50%;
            border-top-color: var(--color-accent-primary); /* Blue spinner */
            height: 50px;
            width: 50px;
          }
          .loading-text, .error-note {
            color: #bdbdbd; /* Lighter grey for less emphasis */
            font-size: 1.1rem;
            margin-top: 15px;
          }
          .error-icon {
            font-family: 'Material Symbols Outlined'; 
            font-size: 3rem; 
            color: var(--color-error); 
            margin-bottom: 0.5rem;
          }
          .error-title {
            font-size: 1.3rem;
            color: var(--color-error);
            margin-bottom: 0.5rem;
          }
          .error-note {
            font-size: 0.9rem;
            margin-top: 1rem;
          }
          
          .empty-content-message {
            padding: 2rem;
            text-align: center;
            color: #AAAAAA; /* Lighter grey */
            font-style: italic;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .key-concepts-list, .practice-questions-list {
            list-style: none;
            padding: 0; 
          }
          .key-concept-item, .practice-question-item {
            background-color: var(--color-surface-2); /* Slightly different dark surface */
            border: 1px solid var(--color-border-subtle);
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1rem;
            color: var(--color-text);
          }
          .key-concept-item h4 {
            margin-top: 0;
            margin-bottom: 0.5rem;
            color: var(--color-accent-primary); /* Light blue for concept title */
          }
          .formula-display {
            background-color: var(--color-bg); /* Base dark for code/formula */
            padding: 0.5rem;
            border-radius: 4px;
            margin: 0.5rem 0;
            overflow-x: auto;
            font-family: var(--font-technical);
            border: 1px solid var(--color-border-subtle);
          }
          .explain-button {
            margin-top: 0.5rem;
            font-size: 0.8rem;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
          }
          .explain-button .material-symbols-outlined {
            font-size: 1rem;
            color: var(--color-accent-primary); /* Match button text color */
          }
          .icon-button { /* General icon button style */
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
          }
          .icon-button .material-symbols-outlined {
             font-size: 1.125rem;
          }


          .question-options {
            list-style-type: lower-alpha;
            padding-left: 20px;
            margin: 0.5rem 0;
          }
          .answer-reveal {
            margin-top: 0.5rem;
            background-color: rgba(0, 90, 153, 0.2); /* Darker blue with alpha */
            padding: 0.5rem;
            border-radius: 4px;
            border: 1px solid var(--color-accent-secondary);
          }

          .detailed-explanation, .solution-steps {
            margin-top: 0.75rem;
            padding: 0.75rem;
            background-color: var(--color-bg); /* Base dark */
            border-radius: 4px;
            border: 1px solid var(--color-border-subtle);
          }
          .detailed-explanation h4, .solution-steps h4 {
            margin-top: 0;
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
            color: var(--color-text);
          }
          .detailed-explanation p, .solution-steps p {
            white-space: pre-wrap; 
            word-wrap: break-word;
            line-height: 1.5;
            font-size: 0.9rem;
          }


          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7); /* Darker overlay */
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .modal-content {
            background-color: var(--color-surface-1); /* Dark surface for modal */
            color: var(--color-text);
            padding: 2rem;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); /* Shadow for dark theme */
            border: 1px solid var(--color-accent-secondary);
          }
          .modal-content h3 {
            margin-top: 0;
            color: var(--color-accent-primary); /* Light blue for modal title */
          }
          .modal-scrollable-content {
            overflow-y: auto;
            flex-grow: 1;
            margin-bottom: 1rem;
            border: 1px solid var(--color-border-subtle);
            padding: 0.5rem 1rem;
            border-radius: 4px;
            background-color: var(--color-bg); /* Base dark for scrollable area */
            scrollbar-width: thin;
            scrollbar-color: var(--color-accent-primary) var(--color-surface-2);
          }
           .modal-scrollable-content::-webkit-scrollbar {
            width: 8px;
          }
           .modal-scrollable-content::-webkit-scrollbar-track {
            background: var(--color-surface-2);
            border-radius: 4px;
          }
           .modal-scrollable-content::-webkit-scrollbar-thumb {
            background-color: var(--color-accent-primary);
            border-radius: 4px;
            border: 2px solid var(--color-surface-2);
          }
          .modal-scrollable-content pre {
            white-space: pre-wrap;
            word-wrap: break-word; 
            font-family: var(--font-secondary);
            font-size: 0.95rem;
            line-height: 1.7;
            color: var(--color-text);
          }
          .close-modal-button {
            align-self: flex-end;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
);