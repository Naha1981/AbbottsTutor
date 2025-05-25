
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
import React, { useRef, useState, useContext, useEffect, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai'; 

const VALIDATE_INPUT_URL = true;
type AppMode = 'video' | 'homework' | 'record_lecture' | 'live_stream';
type LectureRecordingState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
type LiveStreamStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AppProps {
  onGoBackToLanding: () => void;
}

interface LiveStreamMessage {
  id: string;
  type: 'user' | 'model' | 'system_info';
  text?: string;
  audioMimeType?: string;
  audioData?: string; // Base64 encoded audio (if inline) or URI (if file)
  isInlineAudio?: boolean; // Flag to know if audioData is base64
  timestamp: number;
}

interface BufferedAudioSegment {
    data: string; // Can be base64 data or a file URI
    mimeType: string;
    type: 'inline' | 'file';
}

const LIVE_STREAM_MODEL_NAME = 'gemini-2.5-flash-preview-native-audio-dialog';

// System instruction from the user prompt
const LIVE_STREAM_SYSTEM_INSTRUCTION = `Here’s a **detailed prompt** for a **real-time homework assistant AI** tailored for **South African students (Grades 1–12)**, designed to act as a **live tutor** with screen-sharing capabilities. This system leverages **Gemini API**, **OCR**, and **adaptive learning** to provide instant, personalized help. The prompt aligns with the **CAPS curriculum**, Abbotts College’s values (e.g., individualized support), and South Africa’s educational needs.

---

### **Prompt Title**:  
**"LiveHomework Tutor: Real-Time AI Tutor for South African Students"**  

---

### **Role & Objective**  
**Role**: You are **LiveHomework Tutor**, a real-time AI assistant for South African students (Grades 1–12).  
**Mission**: Provide **instant, personalized academic support** by analyzing students’ screens (via OCR), explaining concepts step-by-step, and adapting to their learning style.  
**Core Values**:  
- **Personalized Learning** (Abbotts College philosophy)  
- **Accessibility** (multilingual support for isiZulu, isiXhosa, Afrikaans, English)  
- **CAPS Curriculum Alignment**  
- **Empowerment** (build confidence through incremental guidance)  

---

### **Key Features**  
1. **Screen Sharing + OCR**:  
   - Extract text/images from the student’s screen (e.g., handwritten math problems, essay prompts, science diagrams).  
   - Example:  
     \`\`\`  
     You are using Gemini API’s multimodal OCR to extract text from the student’s screen.  
     Prompt: "Analyze this image of a student’s homework. Identify the subject, topic, and specific problem. Provide step-by-step guidance."  
     \`\`\`  

2. **Real-Time Tutoring**:  
   - Explain concepts in simple terms, using **South African cultural context** (e.g., examples from local ecosystems, history, or daily life).  
   - Example:  
     \`\`\`  
     If a Grade 5 student struggles with fractions:  
     "Imagine you’re dividing a loaf of bread among your friends. If there are 4 friends and 1 loaf, how much does each friend get?"  
     \`\`\`  

3. **Adaptive Learning Paths**:  
   - Adjust explanations based on the student’s grade, subject, and difficulty level.  
   - Example:  
     \`\`\`  
     For a Grade 12 student stuck on a calculus problem:  
     "Let’s break this down. First, identify the function type. Is it a polynomial or trigonometric? Next, recall the differentiation rule..."  
     \`\`\`  

4. **Multilingual Support**:  
   - Switch between **English, isiZulu, isiXhosa, and Afrikaans** based on the student’s preference.  
   - Example:  
     \`\`\`  
     If a student asks for help in isiXhosa:  
     "Nceda ukuthi ngixabise le ndawo kwaye ngicaphule inkqubo yokuqala ukudibanisa amanani." (Translation: "Let me explain this step-by-step and simplify the process.")  
     \`\`\`  

5. **Interactive Whiteboard**:  
   - Use screen annotations to highlight mistakes, draw diagrams, or solve equations collaboratively.  
   - Example:  
     \`\`\`  
     For a physics problem involving forces:  
     "Let’s draw a free-body diagram together. I’ll highlight the gravitational force pulling downward."  
     \`\`\`  

6. **Practice Questions & Feedback**:  
   - Generate **custom exercises** to reinforce weak areas.  
   - Example:  
     \`\`\`  
     After helping a student with algebra:  
     "Try solving this similar problem: 3x + 5 = 20. I’ll check your answer and explain if you get stuck!"  
     \`\`\`  

---

### **Functional Requirements**  
#### **1. Screen Analysis & Problem Identification**  
\`\`\`  
When a student shares their screen:  
1. Use Gemini API to extract text/diagrams.  
2. Classify the subject (e.g., Math, Science, Literature) and topic (e.g., quadratic equations, photosynthesis, essay writing).  
3. Identify the specific problem (e.g., "Solve for x" or "Analyze this poem").  
4. Respond with:  
   - A summary of the problem.  
   - Step-by-step guidance.  
   - Visual aids (e.g., graphs, equations).  
\`\`\`  

#### **2. Subject-Specific Guidance**  
**Mathematics**  
\`\`\`  
If a student shares a math problem:  
1. Recognize the problem type (e.g., algebra, geometry).  
2. Explain the formula/concept using CAPS-aligned terminology.  
3. Provide worked examples (e.g., "Let’s solve 2x + 3 = 7 step-by-step").  
4. Offer practice problems with instant feedback.  
\`\`\`  

**Science (Natural Sciences & Physical Science)**  
\`\`\`  
For a chemistry equation:  
1. Identify the reaction type (e.g., combustion, neutralization).  
2. Break down the steps (e.g., balancing equations, identifying reactants/products).  
3. Use local examples (e.g., "Photosynthesis in the Kruger National Park ecosystem").  
\`\`\`  

**Languages (English/isiXhosa/isiZulu)**  
\`\`\`  
If a student needs help with an essay:  
1. Analyze the prompt (e.g., "Write a letter to the mayor about pollution").  
2. Suggest an outline (introduction, body, conclusion).  
3. Check grammar/spelling and suggest improvements.  
\`\`\`  

**History & Social Sciences**  
\`\`\`  
For a history question:  
1. Contextualize the topic (e.g., "The Battle of Rorke’s Drift in 1879").  
2. Provide key facts and timelines.  
3. Encourage critical thinking (e.g., "Why do you think this battle was significant?").  
\`\`\`  

#### **3. Accessibility & Inclusivity**  
\`\`\`  
- Offer voice-to-text and text-to-voice for students with disabilities.  
- Use simple language for younger learners (e.g., Grade 1: "What color is the sky?").  
- Include visual aids (e.g., diagrams for dyslexic learners).  
\`\`\`  

#### **4. Parent/Teacher Integration**  
\`\`\`  
- Send progress summaries to parents/teachers (e.g., "Today, the student mastered long division").  
- Flag recurring struggles (e.g., "This student needs extra help with fractions").  
\`\`\`  

---

### **Example Use Cases**  
#### **Case 1: Grade 3 Math (Basic Arithmetic)**  
**Student Action**: Shares a screen with a handwritten problem: "There are 12 apples. If 4 apples are eaten, how many are left?"  
**AI Response**:  
\`\`\`  
"Let’s solve this together! Start with 12 apples 🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎. If we eat 4, we subtract: 12 – 4 = 8. Try this: If there are 15 bananas and 6 are eaten, how many remain?"  
\`\`\`  

#### **Case 2: Grade 10 Science (Chemical Reactions)**  
**Student Action**: Shares a screen showing an unbalanced equation: H₂ + O₂ → H₂O.  
**AI Response**:  
\`\`\`  
"Let’s balance this equation step-by-step:  
1. Count atoms on both sides.  
2. Add coefficients to balance hydrogen and oxygen.  
3. Final balanced equation: 2H₂ + O₂ → 2H₂O.  
Practice: Balance N₂ + H₂ → NH₃."  
\`\`\`  

#### **Case 3: Grade 12 Literature (Poetry Analysis)**  
**Student Action**: Shares a screen with the poem *"The Road Not Taken"* by Robert Frost.  
**AI Response**:  
\`\`\`  
"Let’s analyze this poem:  
1. Theme: Choices and individuality.  
2. Metaphor: The road represents life decisions.  
3. Your task: Write a paragraph on how this applies to South African youth."  
\`\`\`  

---

### **Technical Implementation**  
1. **Gemini API Integration**:  
   - Use Gemini’s OCR for screen analysis.  
   - Leverage Gemini’s NLP to generate explanations.  
2. **Platform**:  
   - Web app (via Google AI Studio) with mobile compatibility (Android/iOS).  
3. **Security**:  
   - Encrypt student data.  
   - Comply with South African POPIA (data protection laws).  

---

### **Impact on South African Education**  
- **Equity**: Provides affordable tutoring for underserved communities.  
- **Confidence Building**: Uses Abbotts College’s philosophy of “incremental improvement” [[prospectus]](https://www.abbotts.co.za/wp-content/uploads/2021/11/abbotts_prospectus_nov2021_d5-1.pdf).  
- **Curriculum Alignment**: Follows CAPS guidelines for Grades 1–12.  

---

### **Final Prompt for Google AI Studio**  
\`\`\`  
You are LiveHomework Tutor, a real-time AI assistant for South African students (Grades 1–12). Your role is to:  
1. Analyze students’ screens using Gemini API’s OCR.  
2. Provide step-by-step explanations for any subject (Math, Science, Languages, History).  
3. Adapt to the student’s grade, language preference, and CAPS curriculum.  
4. Use examples relevant to South African culture (e.g., local flora/fauna, historical events).  
5. Generate practice questions and track progress.  

**Actions**:  
- If a student shares a math problem: Extract the equation, explain the concept, and offer practice.  
- If a student asks in isiXhosa: Switch to isiXhosa and provide guidance.  
- If a student struggles with a topic: Break it into smaller steps and use visual aids.  

**Example**:  
Student: "I don’t understand how to write a persuasive letter."  
AI: "Let’s draft one together! Start with a greeting, state your argument, and end with a call to action. Example: 'Dear Mayor, I am writing to request more parks in our community...'"  
\`\`\`  
`;


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
  const liveStreamInputRef = useRef<HTMLInputElement>(null);


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

  // State for "Live Stream" mode
  const aiRef = useRef<GoogleGenAI | null>(null);
  const liveStreamSessionRef = useRef<Session | null>(null);
  const [liveStreamStatus, setLiveStreamStatus] = useState<LiveStreamStatus>('disconnected');
  const [liveStreamMessages, setLiveStreamMessages] = useState<LiveStreamMessage[]>([]);
  const [currentLiveStreamInput, setCurrentLiveStreamInput] = useState('');
  const [liveStreamError, setLiveStreamError] = useState<string | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  // Refs for buffering live stream turn parts
  const currentTurnTextPartsRef = useRef<string[]>([]);
  const currentTurnAudioSegmentsRef = useRef<BufferedAudioSegment[]>([]);


  useEffect(() => {
    // Initialize GoogleGenAI instance once
    if (!aiRef.current && process.env.API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else if (!process.env.API_KEY) {
      console.error("API_KEY is not set. Live Stream feature will not work.");
      setLiveStreamError("API_KEY is not configured. Live Stream feature is disabled.");
    }
  }, []);


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
    
    const disconnectLiveStreamSession = () => {
      if (liveStreamSessionRef.current) {
        liveStreamSessionRef.current.close();
        // onclose callback will handle ref nullification and status update
      }
      // If not in live stream mode, ensure states are reset.
      // Also clear buffers if switching away.
      if (appMode !== 'live_stream') {
        setLiveStreamStatus('disconnected');
        setLiveStreamMessages([]);
        setLiveStreamError(null);
        currentTurnTextPartsRef.current = [];
        currentTurnAudioSegmentsRef.current = [];
        if (liveStreamSessionRef.current) { // Defensive nullification if onclose didn't fire
          liveStreamSessionRef.current = null;
        }
      }
    };

    stopAndCleanupRecording();
    if (appMode !== 'live_stream') { 
        disconnectLiveStreamSession();
    }


    return () => {
      stopAndCleanupRecording();
      // Ensure disconnection and buffer clearing on component unmount
      if (liveStreamSessionRef.current) {
        liveStreamSessionRef.current.close();
        liveStreamSessionRef.current = null;
      }
      currentTurnTextPartsRef.current = [];
      currentTurnAudioSegmentsRef.current = [];
    };
  }, [appMode]);

  // Scroll to bottom of chat messages
  useEffect(() => {
    if (appMode === 'live_stream' && chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [liveStreamMessages, appMode]);


  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    setVideoUrl(''); 
    setHomeworkQuestion(''); 
    setSelectedSubject(''); 
    setSelectedTerm('');
    setSelectedTopic('');
    setShowHomeworkResponse(false); 
    setLectureTranscriptionError(null);
    setTranscribedLectureText('');
    setCurrentLiveStreamInput('');
    setUrlValidating(false);
    setContentLoading(false);
    setHomeworkLoading(false);
  };

  const handleToggleLectureRecording = async () => {
    setLectureTranscriptionError(null);

    if (lectureRecordingState === 'recording') { 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } else if (lectureRecordingState === 'idle' || lectureRecordingState === 'done' || lectureRecordingState === 'error') { 
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
      } else if (appMode === 'live_stream' && liveStreamStatus === 'connected' && currentLiveStreamInput.trim()) {
        e.preventDefault();
        handleSendLiveStreamMessage();
      }
    }
  };

  const handleVideoSubmit = async () => {
    const inputValue = youtubeInputRef.current?.value.trim() || '';
    if (!inputValue) {
      youtubeInputRef.current?.focus();
      return;
    }
    if (urlValidating || contentLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing' || liveStreamStatus === 'connecting' || liveStreamStatus === 'connected') return;

    setUrlValidating(true);
    setVideoUrl(''); 
    setContentLoading(false); 
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
    setUrlValidating(false); 
  };
  
  const handleHomeworkSubmit = () => {
    const question = homeworkInputRef.current?.value.trim() || '';
    if (!selectedSubject || !selectedTerm || !selectedTopic || !question) {
      alert("Please select a subject, term, topic, and enter your homework question.");
      return;
    }
    if (homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing' || liveStreamStatus === 'connecting' || liveStreamStatus === 'connected') return;

    setHomeworkQuestion(question);
    setShowHomeworkResponse(true); 
    setReloadCounter((c) => c + 1); 
  };

  // --- Live Stream Functions ---
  const addLiveStreamMessage = (message: Omit<LiveStreamMessage, 'id' | 'timestamp'>) => {
    setLiveStreamMessages(prev => [...prev, { ...message, id: `msg-${Date.now()}-${Math.random()}`, timestamp: Date.now() }]);
  };

  const handleConnectLiveStream = async () => {
    if (!aiRef.current) {
      setLiveStreamError("Gemini AI Client not initialized. API Key might be missing.");
      setLiveStreamStatus('error');
      addLiveStreamMessage({ type: 'system_info', text: "Error: AI Client not initialized." });
      return;
    }
    if (liveStreamStatus === 'connected' || liveStreamStatus === 'connecting') return;

    setLiveStreamStatus('connecting');
    setLiveStreamError(null);
    addLiveStreamMessage({ type: 'system_info', text: "Connecting to Live Tutor..." });

    try {
      const session = await aiRef.current.live.connect({
        model: LIVE_STREAM_MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
          },
          systemInstruction: {
            parts: [{ text: LIVE_STREAM_SYSTEM_INSTRUCTION }],
          },
        },
        callbacks: {
          onopen: () => {
            currentTurnTextPartsRef.current = [];
            currentTurnAudioSegmentsRef.current = [];
            setLiveStreamStatus('connected');
            setLiveStreamError(null);
            addLiveStreamMessage({ type: 'system_info', text: "Connected! You can start chatting." });
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const modelTurnParts = message.serverContent.modelTurn.parts;
              modelTurnParts.forEach(part => {
                if (part.text) {
                  currentTurnTextPartsRef.current.push(part.text);
                }
                if (part.inlineData?.data && part.inlineData.mimeType) {
                  currentTurnAudioSegmentsRef.current.push({ 
                    data: part.inlineData.data, 
                    mimeType: part.inlineData.mimeType,
                    type: 'inline' 
                  });
                } else if (part.fileData?.fileUri && part.fileData.mimeType) {
                  currentTurnAudioSegmentsRef.current.push({ 
                    data: part.fileData.fileUri, // Store URI as data
                    mimeType: part.fileData.mimeType,
                    type: 'file' 
                  });
                }
              });
            }
          
            if (message.serverContent?.turnComplete) {
              const finalText = currentTurnTextPartsRef.current.join('\n').trim();
              if (finalText) {
                addLiveStreamMessage({ type: 'model', text: finalText });
              }
          
              if (currentTurnAudioSegmentsRef.current.length > 0) {
                const firstAudioSegment = currentTurnAudioSegmentsRef.current[0];
                const firstAudioMimeType = firstAudioSegment.mimeType;
                const totalSegments = currentTurnAudioSegmentsRef.current.length;
                let audioMessageText = `Tutor sent audio response (segments: ${totalSegments}, type: ${firstAudioMimeType || 'N/A'}).`;
                
                const allInline = currentTurnAudioSegmentsRef.current.every(seg => seg.type === 'inline');
                let concatenatedAudioData: string | undefined = undefined;

                if (allInline) {
                    concatenatedAudioData = currentTurnAudioSegmentsRef.current.map(seg => seg.data).join('');
                } else if (currentTurnAudioSegmentsRef.current.some(seg => seg.type === 'file')) {
                    audioMessageText += ` (Includes file-based audio).`;
                     // For file-based, audioData might store the first URI if needed, or stay undefined
                    if (!allInline && firstAudioSegment.type === 'file') {
                        concatenatedAudioData = firstAudioSegment.data; // Example: store first URI
                    }
                }
                
                addLiveStreamMessage({
                  type: 'model',
                  text: audioMessageText,
                  audioData: concatenatedAudioData, 
                  audioMimeType: firstAudioMimeType,
                  isInlineAudio: allInline && !!concatenatedAudioData
                });
              }
              currentTurnTextPartsRef.current = [];
              currentTurnAudioSegmentsRef.current = [];
            }
          },
          onerror: (errorEvent: ErrorEvent | Error) => { 
            console.error('Live stream error:', errorEvent);
            const errorMessage = (errorEvent instanceof ErrorEvent ? errorEvent.message : errorEvent.message) || "An unknown error occurred with the live stream.";
            setLiveStreamError(errorMessage);
            setLiveStreamStatus('error');
            addLiveStreamMessage({ type: 'system_info', text: `Error: ${errorMessage}` });
            liveStreamSessionRef.current = null; 
            currentTurnTextPartsRef.current = [];
            currentTurnAudioSegmentsRef.current = [];
          },
          onclose: (closeEvent?: CloseEvent) => {
            const reason = closeEvent?.reason || "Connection closed.";
            if (liveStreamStatus !== 'error') { 
                setLiveStreamStatus('disconnected');
            }
            addLiveStreamMessage({ type: 'system_info', text: `Disconnected: ${reason}` });
            liveStreamSessionRef.current = null;
            currentTurnTextPartsRef.current = [];
            currentTurnAudioSegmentsRef.current = [];
          },
        },
      });
      liveStreamSessionRef.current = session;
    } catch (error) {
      console.error('Failed to connect to live stream:', error);
      const errMsg = error instanceof Error ? error.message : "Failed to connect.";
      setLiveStreamError(errMsg);
      setLiveStreamStatus('error');
      addLiveStreamMessage({ type: 'system_info', text: `Connection Error: ${errMsg}` });
      liveStreamSessionRef.current = null; 
      currentTurnTextPartsRef.current = [];
      currentTurnAudioSegmentsRef.current = [];
    }
  };

  const handleDisconnectLiveStream = () => {
    if (liveStreamSessionRef.current) {
      liveStreamSessionRef.current.close();
    } else {
      setLiveStreamStatus('disconnected');
      addLiveStreamMessage({ type: 'system_info', text: 'Disconnected.' });
      setLiveStreamMessages([]); 
      currentTurnTextPartsRef.current = [];
      currentTurnAudioSegmentsRef.current = [];
    }
  };
  
  const handleSendLiveStreamMessage = () => {
    const messageText = currentLiveStreamInput.trim();
    if (!messageText || !liveStreamSessionRef.current || liveStreamStatus !== 'connected') {
      return;
    }
    try {
      liveStreamSessionRef.current.sendClientContent({
        turns: [{ text: messageText }],
      });
      addLiveStreamMessage({ type: 'user', text: messageText });
      setCurrentLiveStreamInput('');
    } catch (error) {
        console.error("Error sending live stream message:", error);
        const errMsg = error instanceof Error ? error.message : "Failed to send message.";
        setLiveStreamError(errMsg); 
        addLiveStreamMessage({ type: 'system_info', text: `Send Error: ${errMsg}` });
    }
  };
  // --- End Live Stream Functions ---


  const handleContentLoadingStateChange = (isLoading: boolean) => {
    if (appMode === 'video') {
      setContentLoading(isLoading);
    } else if (appMode === 'homework') {
      setHomeworkLoading(isLoading);
    }
  };
  
  const anyModeBusy = urlValidating || contentLoading || homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing' || liveStreamStatus === 'connecting';

  const videoInputDisabled = anyModeBusy || liveStreamStatus === 'connected';
  const videoSubmitButtonDisabled = videoInputDisabled || !youtubeInputRef.current?.value.trim();

  const homeworkSelectionDisabled = anyModeBusy || liveStreamStatus === 'connected';
  const homeworkInputDisabled = homeworkSelectionDisabled;
  const homeworkSubmitButtonDisabled = homeworkInputDisabled || !selectedSubject || !selectedTerm || !selectedTopic || !homeworkInputRef.current?.value.trim();
  
  const getLectureRecordButtonState = (): {text: string, icon: string, 'aria-label': string, disabled: boolean, className: string} => {
    const otherModeBusyForLecture = urlValidating || contentLoading || homeworkLoading || liveStreamStatus === 'connecting' || liveStreamStatus === 'connected';

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
        disabled: otherModeBusyForLecture, 
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
  
  const otherModesAreTrulyBusy = urlValidating || contentLoading || homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing';
  let liveStreamActionButtonDisabled: boolean;
  if (liveStreamStatus === 'connected') {
    liveStreamActionButtonDisabled = false; 
  } else if (liveStreamStatus === 'connecting') {
    liveStreamActionButtonDisabled = true; 
  } else { // 'disconnected' or 'error'
    liveStreamActionButtonDisabled = otherModesAreTrulyBusy || !aiRef.current; 
  }

  const liveStreamInputDisabled = liveStreamStatus !== 'connected';
  const liveStreamSendButtonDisabled = liveStreamStatus !== 'connected' || !currentLiveStreamInput.trim();
  
  const modeSelectionDisabled = urlValidating || contentLoading || homeworkLoading || lectureRecordingState === 'recording' || lectureRecordingState === 'transcribing' || liveStreamStatus === 'connecting' || liveStreamStatus === 'connected';


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
             : appMode === 'record_lecture' ? 'Effortless dictation. Turn recordings into transcribed notes.'
             : 'Chat live with an AI tutor for real-time assistance.'}
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
             <label className="mode-label">
              <input type="radio" name="appMode" value="live_stream" checked={appMode === 'live_stream'} onChange={() => handleModeChange('live_stream')} disabled={modeSelectionDisabled}/>
              Live Stream
            </label>
          </div>
          
          {lectureTranscriptionError && appMode === 'record_lecture' && <p className="error-message" role="alert">Transcription Error: {lectureTranscriptionError}</p>}
          {liveStreamError && appMode === 'live_stream' && <p className="error-message" role="alert">Live Stream Error: {liveStreamError}</p>}


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
                   onChange={() => { /* Handled by state if needed */ }}
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

          {appMode === 'live_stream' && (
            <div className="live-stream-container">
              <div className="live-stream-controls">
                <button
                  onClick={liveStreamStatus === 'connected' ? handleDisconnectLiveStream : handleConnectLiveStream}
                  className={`button-primary live-stream-connect-button ${liveStreamStatus === 'connected' ? 'is-connected' : ''}`}
                  disabled={liveStreamActionButtonDisabled}
                >
                  <span className="material-symbols-outlined">
                    {liveStreamStatus === 'connected' ? 'link_off' : liveStreamStatus === 'connecting' ? 'hourglass_empty' : 'sensors'}
                  </span>
                  {liveStreamStatus === 'connected' ? 'Disconnect' : liveStreamStatus === 'connecting' ? 'Connecting...' : 'Connect to Tutor'}
                </button>
                <p className="status-message live-stream-status" aria-live="polite">
                  Status: <span className={`status-indicator ${liveStreamStatus}`}>{liveStreamStatus.charAt(0).toUpperCase() + liveStreamStatus.slice(1)}</span>
                </p>
              </div>

              <div className="chat-messages-container" ref={chatMessagesContainerRef}>
                {liveStreamMessages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.type}-message`}>
                    <span className="message-sender">{msg.type === 'user' ? 'You' : msg.type === 'model' ? 'Tutor' : 'System'}</span>
                    <p className="message-text">{msg.text}</p>
                    {/* Display audio info only if it's not already part of the main text (e.g. "Tutor sent audio response...") */}
                    {/* And ensure there's audio data and mime type */}
                    {msg.audioData && msg.audioMimeType && !msg.text?.toLowerCase().includes("audio response") && (
                         <small className="message-audio-info">
                            (Audio: {msg.audioMimeType} {msg.isInlineAudio ? "- Inline" : "- File"})
                         </small>
                    )}
                    <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>

              <div className="live-stream-input-area">
                <label htmlFor="live-stream-input" className="sr-only">Type your message to the tutor</label>
                <input
                  ref={liveStreamInputRef}
                  id="live-stream-input"
                  type="text"
                  className="full-width-input"
                  placeholder={liveStreamStatus === 'connected' ? "Type your message..." : "Connect to enable chat"}
                  value={currentLiveStreamInput}
                  onChange={(e) => setCurrentLiveStreamInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={liveStreamInputDisabled}
                  aria-label="Chat input for live stream"
                />
                <button
                  onClick={handleSendLiveStreamMessage}
                  className="button-primary send-button"
                  disabled={liveStreamSendButtonDisabled}
                  aria-label="Send message to live tutor"
                >
                  <span className="material-symbols-outlined">send</span> Send
                </button>
              </div>
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
                      : appMode === 'record_lecture' 
                        ? 'Use the controls on the left to record a lecture and view the transcription.'
                        : liveStreamStatus === 'error' && liveStreamError ? `Live Stream Error: ${liveStreamError}`
                        : 'Connect to the Live Stream Tutor for real-time assistance. Chat will appear here.'
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
            padding-left: 4rem; 
            padding-right: 4rem;
          }
        }

        .subtitle {
          color: var(--color-accent-primary); 
          font-size: 1rem; 
          margin-top: 0.25rem; 
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
          gap: 0.75rem; /* Slightly reduced gap for 4 items */
          margin-bottom: 1rem;
          padding: 0.75rem; 
          background-color: var(--color-surface-1); 
          border-radius: 6px;
          justify-content: space-around; /* Better distribution for 4 items */
          border: 1px solid var(--color-border-subtle);
        }
        .mode-label {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--color-text);
          font-size: 0.85rem; /* Adjust if needed for space */
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

        .input-container, .curriculum-selection-container, .record-lecture-container, .live-stream-container {
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

        /* Live Stream Styles */
        .live-stream-container {
          border: 1px solid var(--color-border-subtle);
          border-radius: 6px;
          padding: 1rem;
          background-color: var(--color-surface-1);
          flex-grow: 1; /* Allow it to take space if left-side content is short */
          display: flex;
          flex-direction: column;
          min-height: 300px; /* Ensure it has some height */
        }
        .live-stream-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .live-stream-connect-button {
          padding: 0.6rem 1.2rem;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .live-stream-connect-button .material-symbols-outlined {
          font-size: 1.3rem;
        }
        .live-stream-connect-button.is-connected {
            background-color: var(--color-error); /* Red for disconnect */
            border-color: var(--color-error);
        }
         .live-stream-connect-button.is-connected .material-symbols-outlined {
            color: white;
        }
        .live-stream-status .status-indicator {
            font-weight: bold;
        }
        .live-stream-status .status-indicator.disconnected { color: var(--color-error); }
        .live-stream-status .status-indicator.connecting { color: #FFC107; } /* Amber */
        .live-stream-status .status-indicator.connected { color: #4CAF50; } /* Green */
        .live-stream-status .status-indicator.error { color: var(--color-error); }
        
        .chat-messages-container {
          flex-grow: 1;
          overflow-y: auto;
          background-color: var(--color-surface-2);
          border: 1px solid var(--color-border-subtle);
          border-radius: 4px;
          padding: 0.75rem;
          margin-bottom: 1rem;
          min-height: 150px; /* Minimum height for chat area */
          scrollbar-width: thin;
          scrollbar-color: var(--color-accent-primary) var(--color-bg);
        }
        .chat-messages-container::-webkit-scrollbar { width: 6px; }
        .chat-messages-container::-webkit-scrollbar-track { background: var(--color-bg); border-radius: 3px;}
        .chat-messages-container::-webkit-scrollbar-thumb { background-color: var(--color-accent-primary); border-radius: 3px; }

        .chat-message {
          margin-bottom: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          line-height: 1.4;
        }
        .chat-message .message-sender {
          font-weight: bold;
          font-size: 0.8rem;
          display: block;
          margin-bottom: 0.2rem;
        }
        .chat-message .message-text {
          font-size: 0.95rem;
          white-space: pre-wrap; /* Preserve line breaks from AI */
          word-wrap: break-word;
        }
         .chat-message .message-audio-info {
          font-size: 0.8rem;
          color: #aaa;
          display: block;
          margin-top: 0.25rem;
        }
        .chat-message .message-timestamp {
          font-size: 0.7rem;
          color: #888;
          display: block;
          text-align: right;
          margin-top: 0.3rem;
        }

        .user-message {
          background-color: var(--color-accent-secondary); /* Darker blue for user */
          color: var(--color-text);
          margin-left: auto; /* Align user messages to the right */
          max-width: 75%; 
        }
        .user-message .message-sender { color: var(--color-accent-primary); }

        .model-message {
          background-color: var(--color-surface-1); /* Slightly different dark surface for AI */
          border: 1px solid var(--color-border-subtle);
          max-width: 75%;
        }
        .model-message .message-sender { color: var(--color-accent-primary); }
        
        .system_info-message {
          background-color: transparent;
          text-align: center;
          font-style: italic;
          font-size: 0.85rem;
          color: #aaa;
        }
        .system_info-message .message-sender { display: none; }


        .live-stream-input-area {
          display: flex;
          gap: 0.5rem;
        }
        .live-stream-input-area input {
          flex-grow: 1;
        }
        .live-stream-input-area .send-button {
          padding: 0.5rem 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
         .live-stream-input-area .send-button .material-symbols-outlined {
           font-size: 1.2rem;
         }
        /* End Live Stream Styles */


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
