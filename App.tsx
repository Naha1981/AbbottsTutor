

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import ContentContainer from '@/components/ContentContainer';
import { ContentContainerRef } from '@/components/ContentContainer';
import { DataContext } from '@/context';
import { CapsSubject, CapsTerm } from '@/lib/types';
import { transcribeAudio } from '@/lib/voiceTranscription';
import {
  getYoutubeEmbedUrl,
  validateYoutubeUrl,
} from '@/lib/youtube';
import React, { useRef, useState, useContext, useEffect } from 'react';

const VALIDATE_INPUT_URL = true;
type AppMode = 'video' | 'homework' | 'record_lecture';
type LectureRecordingState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

interface AppProps {
  onGoBackToLanding: () => void;
}

export default function App({ onGoBackToLanding }: AppProps) {
  const {
    capsStructure,
    isLoadingCaps,
  } = useContext(DataContext);

  const [appMode, setAppMode] = useState<AppMode>('video');
  const [videoUrl, setVideoUrl] = useState('');
  const [urlValidating, setUrlValidating] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [homeworkLoading, setHomeworkLoading] = useState(false);

  const contentContainerRef = useRef<ContentContainerRef | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const youtubeInputRef = useRef<HTMLInputElement>(null);
  const homeworkInputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  
  const [availableTerms, setAvailableTerms] = useState<CapsTerm[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  
  const [homeworkQuestion, setHomeworkQuestion] = useState('');
  const [showHomeworkResponse, setShowHomeworkResponse] = useState(false);

  // State for "Record Lecture" mode
  const [lectureRecordingState, setLectureRecordingState] = useState<LectureRecordingState>('idle');
  const [transcribedLectureText, setTranscribedLectureText] = useState('');
  const [lectureTranscriptionError, setLectureTranscriptionError] = useState<string | null>(null);

  // Voice Transcription Refs (reused for lecture recording)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);


  useEffect(() => {
    if (capsStructure && capsStructure.length > 0 && !selectedSubject) {
      // setSelectedSubject(capsStructure[0].subject);
    }
  }, [capsStructure, selectedSubject]);

  useEffect(() => {
    if (selectedSubject) {
      const subjectData = capsStructure?.find(s => s.subject === selectedSubject);
      setAvailableTerms(subjectData?.terms || []);
      setSelectedTerm('');
      setSelectedTopic('');
      setAvailableTopics([]);
    } else {
      setAvailableTerms([]);
      setAvailableTopics([]);
    }
  }, [selectedSubject, capsStructure]);

  useEffect(() => {
    if (selectedTerm) {
      const termData = availableTerms.find(t => t.term_name === selectedTerm);
      setAvailableTopics(termData?.topics || []);
      setSelectedTopic('');
    } else {
      setAvailableTopics([]);
    }
  }, [selectedTerm, availableTerms]);
  
  // Cleanup media resources on mode change or unmount
  useEffect(() => {
    const stopAndCleanupRecording = () => {
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.onstop = null; 
          mediaRecorderRef.current.stop();
        }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      mediaRecorderRef.current = null;
      audioStreamRef.current = null;
      audioChunksRef.current = [];
      
      if (appMode !== 'record_lecture') {
        setLectureRecordingState('idle');
      }
    };
    
    stopAndCleanupRecording();

    return () => {
      stopAndCleanupRecording();
    };
  }, [appMode]);


  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    // Reset common data states
    setVideoUrl(''); 
    setHomeworkQuestion(''); 
    setSelectedSubject(''); 
    setSelectedTerm('');
    setSelectedTopic('');
    setShowHomeworkResponse(false); 
    
    // Reset lecture specific states
    setLectureTranscriptionError(null);
    setTranscribedLectureText('');
    // lectureRecordingState is handled by useEffect cleanup based on new appMode

    // Reset all loading flags to ensure a clean state for the new mode
    setUrlValidating(false);
    setContentLoading(false);
    setHomeworkLoading(false);
  };

  const handleToggleLectureRecording = async () => {
    setLectureTranscriptionError(null);

    if (lectureRecordingState === 'recording') { // Currently recording, so stop it
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        // onstop handler will set state to 'transcribing'
      }
    } else if (lectureRecordingState === 'idle' || lectureRecordingState === 'done' || lectureRecordingState === 'error') { // Not recording anything, so start
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('getUserMedia is not supported in your browser.');
          setLectureRecordingState('error');
          setLectureTranscriptionError('Microphone access is not supported.');
          return;
        }
        audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLectureRecordingState('recording');
        audioChunksRef.current = [];
        
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.log(options.mimeType + ' is not supported, trying audio/webm');
            options.mimeType = 'audio/webm';
            if(!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.log(options.mimeType + ' is not supported, using default');
                delete options.mimeType;
            }
        }
        mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current, options);

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          setLectureRecordingState('transcribing'); 

          if (audioStreamRef.current) { 
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
          audioChunksRef.current = [];
          
          if (audioBlob.size === 0) {
            setLectureTranscriptionError("No audio was recorded. Please try again.");
            setLectureRecordingState('error');
            return;
          }

          try {
            const transcribedText = await transcribeAudio(audioBlob);
            setTranscribedLectureText(transcribedText);
            setLectureRecordingState('done');
          } catch (error) {
            console.error("Transcription error:", error);
            const errMsg = error instanceof Error ? error.message : "Transcription failed.";
            setLectureTranscriptionError(errMsg);
            setLectureRecordingState('error');
            alert(`Transcription failed: ${errMsg}`);
          }
        };
        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error starting recording:", err);
        const errorMsg = err instanceof Error ? err.message : "Could not start recording.";
        setLectureTranscriptionError(errorMsg);
        alert(`Recording Error: ${errorMsg}. Please ensure microphone permission is granted.`);
        setLectureRecordingState('error');
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      }
    }
  };

  const handleClearTranscription = () => {
    setTranscribedLectureText('');
    setLectureTranscriptionError(null);
    setLectureRecordingState('idle');
  };


  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubject(e.target.value);
  };

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTerm(e.target.value);
  };

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTopic(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      if (appMode === 'video' && !urlValidating && !contentLoading ) {
        handleVideoSubmit();
      } else if (appMode === 'homework' && !homeworkLoading && homeworkInputRef.current?.value.trim()) {
        e.preventDefault(); 
        handleHomeworkSubmit();
      }
    }
  };

  const handleVideoSubmit = async () => {
    const inputValue = youtubeInputRef.current?.value.trim() || '';
    if (!inputValue) {
      youtubeInputRef.current?.focus();
      return;
    }
    // Ensure button is not disabled by another condition before proceeding
    if (urlValidating || contentLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing') return;


    setUrlValidating(true);
    setVideoUrl(''); // Clear previous video while validating new one
    setContentLoading(false); // Reset content loading state
    setShowHomeworkResponse(false);

    if (VALIDATE_INPUT_URL) {
      const validationResult = await validateYoutubeUrl(inputValue);
      if (validationResult.isValid) {
        proceedWithVideo(inputValue);
      } else {
        alert(validationResult.error || 'Invalid YouTube URL');
        setUrlValidating(false);
      }
    } else {
      proceedWithVideo(inputValue);
    }
  };

  const proceedWithVideo = (url: string) => {
    setVideoUrl(url);
    setReloadCounter((c) => c + 1);
    setUrlValidating(false); // Validation is complete
  };
  
  const handleHomeworkSubmit = () => {
    const question = homeworkInputRef.current?.value.trim() || '';
    if (!selectedSubject || !selectedTerm || !selectedTopic || !question) {
      alert("Please select a subject, term, topic, and enter your homework question.");
      return;
    }
    setHomeworkQuestion(question);
    setShowHomeworkResponse(true); 
    setReloadCounter((c) => c + 1); 
  };


  const handleContentLoadingStateChange = (isLoading: boolean) => {
    if (appMode === 'video') {
      setContentLoading(isLoading);
    } else if (appMode === 'homework') {
      setHomeworkLoading(isLoading);
    }
    // No content loading state change from ContentContainer for 'record_lecture' mode
  };
  
  // More specific disabled conditions for inputs/buttons per mode
  const videoInputDisabled = urlValidating || contentLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing';
  const videoSubmitButtonDisabled = videoInputDisabled || !youtubeInputRef.current?.value.trim();

  const homeworkSelectionDisabled = homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing';
  const homeworkInputDisabled = homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing';
  const homeworkSubmitButtonDisabled = homeworkInputDisabled || !selectedSubject || !selectedTerm || !selectedTopic || !homeworkInputRef.current?.value.trim();
  
  const getLectureRecordButtonState = (): {text: string, icon: string, 'aria-label': string, disabled: boolean, className: string} => {
    // Disable lecture recording button if any other mode is busy with its primary task
    const otherModeBusy = urlValidating || contentLoading || homeworkLoading;

    if (lectureRecordingState === 'recording') {
      return { text: 'Stop Recording', icon: 'stop', 'aria-label': 'Stop recording lecture', disabled: false, className: 'is-recording' };
    }
    if (lectureRecordingState === 'transcribing') {
      return { text: 'Transcribing...', icon: 'hourglass_empty', 'aria-label': 'Transcribing lecture audio...', disabled: true, className: 'is-transcribing' };
    }
    return { 
        text: 'Record Lecture', 
        icon: 'mic', 
        'aria-label': 'Record lecture audio', 
        disabled: otherModeBusy, // Only disable if another mode is actively processing
        className: '' 
    };
  };
  const lectureRecordButtonState = getLectureRecordButtonState();

  const getLectureStatusMessage = () => {
    switch (lectureRecordingState) {
      case 'idle': return "Click 'Record Lecture' to start.";
      case 'recording': return "Recording audio... Click 'Stop Recording' when done.";
      case 'transcribing': return "Transcribing audio, please wait...";
      case 'done': return transcribedLectureText ? "Transcription complete." : "Transcription complete (no text captured).";
      case 'error': return `Error: ${lectureTranscriptionError || "An unknown error occurred."}`;
      default: return "";
    }
  };
  
  // Mode selection disabled if any primary task is ongoing
  const modeSelectionDisabled = urlValidating || contentLoading || homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing';


  return (
    <>
      <main className="main-container">
        <div className="left-side">
          <div className="app-header">
            <button onClick={onGoBackToLanding} className="button-secondary back-to-home-button" aria-label="Back to Home">
              <span className="material-symbols-outlined">arrow_back_ios</span> Home
            </button>
            <h1 className="headline">AI Learning Assistant</h1>
          </div>
          <p className="subtitle">
            {appMode === 'video' ? 'Generate interactive learning apps from YouTube content.' 
             : appMode === 'homework' ? 'Get AI-powered help with your homework.'
             : 'Effortless dictation. Turn recordings into transcribed notes.'}
          </p>
          
          <div className="mode-selection-container">
            <label className="mode-label">
              <input type="radio" name="appMode" value="video" checked={appMode === 'video'} onChange={() => handleModeChange('video')} disabled={modeSelectionDisabled}/>
              Video to App
            </label>
            <label className="mode-label">
              <input type="radio" name="appMode" value="homework" checked={appMode === 'homework'} onChange={() => handleModeChange('homework')} disabled={modeSelectionDisabled}/>
              Homework Assist
            </label>
            <label className="mode-label">
              <input type="radio" name="appMode" value="record_lecture" checked={appMode === 'record_lecture'} onChange={() => handleModeChange('record_lecture')} disabled={modeSelectionDisabled}/>
              Record Lecture
            </label>
          </div>
          
          {lectureTranscriptionError && appMode === 'record_lecture' && <p className="error-message" role="alert">Transcription Error: {lectureTranscriptionError}</p>}

          {appMode === 'video' && (
            <>
              <div className="input-container">
                <label htmlFor="youtube-url" className="input-label">
                  Paste a URL from YouTube:
                </label>
                <input
                  ref={youtubeInputRef}
                  id="youtube-url"
                  className="youtube-input full-width-input"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={videoInputDisabled}
                  onKeyDown={handleKeyDown}
                  onChange={() => {
                     setVideoUrl('');
                  }}
                />
              </div>
              <div className="button-container">
                <button
                  onClick={handleVideoSubmit}
                  className="button-primary submit-button"
                  disabled={videoSubmitButtonDisabled}>
                  {urlValidating
                    ? 'Validating URL...'
                    : contentLoading
                      ? 'Generating App...'
                      : 'Generate app'}
                </button>
              </div>
              <div className="video-container">
                {videoUrl ? (
                  <iframe
                    className="video-iframe"
                    src={getYoutubeEmbedUrl(videoUrl)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen></iframe>
                ) : (
                  <div className="video-placeholder">Video will appear here</div>
                )}
              </div>
            </>
          )}

          {appMode === 'homework' && (
            <>
              <div className="curriculum-selection-container">
                <div className="select-container">
                  <label htmlFor="subject-select" className="input-label">Subject:</label>
                  <select id="subject-select" className="curriculum-select" value={selectedSubject} onChange={handleSubjectChange} disabled={isLoadingCaps || homeworkSelectionDisabled}>
                    <option value="">-- Select Subject --</option>
                    {capsStructure?.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
                  </select>
                </div>
                <div className="select-container">
                  <label htmlFor="term-select" className="input-label">Term:</label>
                  <select id="term-select" className="curriculum-select" value={selectedTerm} onChange={handleTermChange} disabled={!selectedSubject || homeworkSelectionDisabled}>
                    <option value="">-- Select Term --</option>
                    {availableTerms.map(t => <option key={t.term_name} value={t.term_name}>{t.term_name}</option>)}
                  </select>
                </div>
                <div className="select-container">
                  <label htmlFor="topic-select" className="input-label">Topic:</label>
                  <select id="topic-select" className="curriculum-select" value={selectedTopic} onChange={handleTopicChange} disabled={!selectedTerm || homeworkSelectionDisabled}>
                    <option value="">-- Select Topic --</option>
                    {availableTopics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-container">
                <label htmlFor="homework-question" className="input-label">
                  Enter your homework question:
                </label>
                <textarea
                  ref={homeworkInputRef}
                  id="homework-question"
                  className="homework-textarea full-width-input"
                  rows={4}
                  placeholder="e.g., Explain Newton's First Law, or solve for x in 2x + 5 = 11"
                  disabled={homeworkInputDisabled}
                  onKeyDown={handleKeyDown}
                   onChange={() => { 
                     // Re-render handled by state change if needed
                   }}
                />
              </div>
              <div className="button-container">
                <button
                  onClick={handleHomeworkSubmit}
                  className="button-primary submit-button"
                  disabled={homeworkSubmitButtonDisabled}>
                  {homeworkLoading ? 'Getting Assistance...' : 'Get Assistance'}
                </button>
              </div>
            </>
          )}

          {appMode === 'record_lecture' && (
            <div className="record-lecture-container">
              <div className="button-container record-button-container">
                 <button
                    type="button"
                    onClick={handleToggleLectureRecording}
                    className={`button-primary lecture-record-button ${lectureRecordButtonState.className}`}
                    aria-label={lectureRecordButtonState['aria-label']}
                    title={lectureRecordButtonState['aria-label']}
                    disabled={lectureRecordButtonState.disabled}
                  >
                    <span className="material-symbols-outlined">{lectureRecordButtonState.icon}</span>
                    {lectureRecordButtonState.text}
                  </button>
              </div>
              <p className="status-message" aria-live="polite">{getLectureStatusMessage()}</p>
              <label htmlFor="transcribed-text" className="input-label sr-only">Transcribed Text:</label>
              <textarea
                id="transcribed-text"
                className="homework-textarea full-width-input transcription-display"
                rows={10}
                value={transcribedLectureText}
                readOnly
                placeholder="Your transcribed audio will appear here..."
                aria-label="Transcribed lecture text"
              />
              {(lectureRecordingState === 'done' || lectureRecordingState === 'error') && transcribedLectureText && (
                 <div className="button-container clear-button-container">
                    <button onClick={handleClearTranscription} className="button-secondary">
                        Clear Transcription &amp; Record New
                    </button>
                 </div>
              )}
            </div>
          )}

          <p className="attribution">
            An experiment by <strong>Thabiso Naha</strong>
          </p>
        </div>

        <div className="right-side">
          <div className="content-area">
            {(appMode === 'video' && videoUrl) || (appMode === 'homework' && showHomeworkResponse) ? (
              <ContentContainer
                key={reloadCounter} 
                appMode={appMode}
                contentBasis={appMode === 'video' ? videoUrl : undefined}
                homeworkParams={appMode === 'homework' ? {
                  subject: selectedSubject,
                  term: selectedTerm,
                  topic: selectedTopic,
                  question: homeworkQuestion
                } : undefined}
                onLoadingStateChange={handleContentLoadingStateChange}
                ref={contentContainerRef}
              />
            ) : (
              <div className="content-placeholder">
                <p>
                  {appMode === 'video' 
                    ? (urlValidating ? 'Validating URL...' : (contentLoading ? 'Generating App...' : 'Paste a YouTube URL to begin.'))
                    : appMode === 'homework' 
                      ? (homeworkLoading ? 'Getting Assistance...' : 'Select subject, term, topic and enter your question for Homework Assistance.')
                      : 'Use the controls on the left to record a lecture and view the transcription.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .main-container {
          padding: 2rem;
          display: flex;
          gap: 2rem;
          height: 100vh;
          box-sizing: border-box;
          overflow: hidden;
          background-color: var(--color-bg); 
          color: var(--color-text);

          @media (max-width: 768px) {
            flex-direction: column;
            padding: 1.5rem; 
            gap: 1rem;
            height: auto;
            overflow: visible;
          }
        }

        .left-side {
          width: 40%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          overflow-y: auto;
          scrollbar-width: thin; 
          scrollbar-color: var(--color-accent-primary) var(--color-surface-1);
          padding-right: 10px; 

          @media (max-width: 768px) {
            width: 100%;
            height: auto;
            overflow: visible;
            padding-right: 0;
          }
        }

        .left-side::-webkit-scrollbar {
          width: 8px;
        }
        .left-side::-webkit-scrollbar-track {
          background: var(--color-surface-1);
          border-radius: 4px;
        }
        .left-side::-webkit-scrollbar-thumb {
          background-color: var(--color-accent-primary);
          border-radius: 4px;
          border: 2px solid var(--color-surface-1);
        }

        .app-header {
          display: flex;
          align-items: center;
          justify-content: center; 
          width: 100%;
          position: relative; 
          padding: 0.5rem 1rem; 
          box-sizing: border-box;
          margin-bottom: 0; 
        }

        .back-to-home-button {
          position: absolute; 
          left: 1rem; /* Aligned with parent's padding */
          top: 50%;
          transform: translateY(-50%);
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          z-index: 10;
        }
        .back-to-home-button .material-symbols-outlined {
          font-size: 1.1rem; 
        }

        .right-side {
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 1rem;
          height: 100%;
          min-width: 0; 


          @media (max-width: 768px) {
            height: auto;
          }
        }

        .headline {
          color: var(--color-text);
          font-family: var(--font-display);
          font-size: 2.2rem; /* Reduced */
          font-weight: 400;
          margin: 0; /* Reset margin */
          text-align: center;
          text-transform: uppercase;
          width: 100%; /* Takes full width of its offset parent */
          box-sizing: border-box;
          padding-left: 5.5rem; /* Space for button */
          padding-right: 5.5rem; /* Symmetrical space */


          @media (max-width: 768px) {
            font-size: 1.8rem; 
            /* Consider reducing padding on mobile if still too cramped */
            padding-left: 4rem; 
            padding-right: 4rem;
          }
        }

        .subtitle {
          color: var(--color-accent-primary); 
          font-size: 1rem; 
          margin-top: 0.25rem; /* Adjusted from -0.25 if header margin-bottom is 0 */
          margin-bottom: 0.5rem; 
          text-align: center;
          max-width: 90%;

          @media (max-width: 768px) {
            font-size: 0.8rem; 
          }
        }
        
        .mode-selection-container {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 0.75rem; 
          background-color: var(--color-surface-1); 
          border-radius: 6px;
          justify-content: center;
          border: 1px solid var(--color-border-subtle);
        }
        .mode-label {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--color-text);
        }
        .mode-label input[type="radio"] {
            accent-color: var(--color-accent-primary); 
        }
        .mode-label input[type="radio"]:disabled {
          cursor: not-allowed;
        }
        .mode-label:has(input[type="radio"]:disabled) {
            opacity: 0.6;
            cursor: not-allowed;
        }


        .attribution {
          color: #AAAAAA; 
          font-family: var(--font-secondary);
          font-size: 0.8rem; 
          font-style: italic;
          margin-top: auto; 
          padding-top: 1rem; 
          text-align: center;

          @media (max-width: 768px) {
            font-size: 0.7rem;
            margin-top: 1rem;
          }
        }

        .input-container, .curriculum-selection-container, .record-lecture-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem; 
        }
        .select-container {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }


        .input-label {
          display: block;
          margin-bottom: 0.25rem; 
          font-size: 0.9rem;
          color: var(--color-text);
        }
        .sr-only { 
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
        }
        
        /* youtube-input, curriculum-select, homework-textarea inherit from index.css */
        
        .full-width-input {
           width: 100%;
        }
        
        .homework-textarea {
          resize: vertical;
          min-height: 80px;
        }
        .transcription-display {
          min-height: 150px;
          background-color: var(--color-surface-2); 
          font-family: var(--font-technical);
          border: 1px solid var(--color-border-subtle);
        }
        
        .curriculum-select:disabled {
           opacity: 0.6;
           cursor: not-allowed;
        }

        /* mic-button class is not directly used for lecture button, specific styles below */
        
        .error-message {
          color: var(--color-error);
          background-color: var(--color-error-bg);
          padding: 0.75rem;
          border-radius: 4px;
          font-size: 0.9rem;
          text-align: center;
          border: 1px solid var(--color-error);
          width: 100%;
        }


        .button-container {
          width: 100%;
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem; 
        }

        .submit-button {
          flex: 1;
        }
        
        .record-lecture-container {
          display: flex;
          flex-direction: column;
          gap: 1rem; 
          align-items: center; 
          width: 100%;
        }
        .record-button-container, .clear-button-container {
            justify-content: center; 
            width: auto; 
        }
        .lecture-record-button {
            padding: 0.75rem 1.5rem; 
            font-size: 1rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .lecture-record-button .material-symbols-outlined {
            font-size: 1.5rem; 
            color: var(--color-text); 
        }
        .lecture-record-button.is-recording {
            background-color: var(--color-error);
            border-color: var(--color-error);
            color: white;
        }
        .lecture-record-button.is-recording .material-symbols-outlined {
            color: white;
        }
        .lecture-record-button.is-transcribing .material-symbols-outlined {
            animation: spin 1.5s linear infinite;
        }

        .status-message {
            font-size: 0.9rem;
            color: var(--color-accent-primary); 
            text-align: center;
            min-height: 1.2em; 
        }


        .video-container {
          background-color: var(--color-surface-1); 
          border-radius: 8px;
          color: var(--color-accent-primary); 
          margin: 0.5rem 0;
          padding-top: 56.25%; 
          position: relative;
          width: 100%;
          border: 1px solid var(--color-border-subtle);
        }

        .video-iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
        }

        .video-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          max-height: 100%;
          background-color: var(--color-bg); 

          @media (max-width: 768px) {
            max-height: 550px;
            min-height: 550px;
          }
        }

        .content-placeholder {
          align-items: center;
          border: 2px dashed var(--color-accent-secondary); 
          border-radius: 8px;
          box-sizing: border-box;
          color: var(--color-text); 
          display: flex;
          flex-direction: column;
          font-size: 1.2rem;
          height: 100%;
          justify-content: center;
          padding: 0 2rem;
          width: 100%;
          text-align: center;
          background-color: var(--color-surface-1); 

          @media (max-width: 768px) {
            min-height: inherit;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
