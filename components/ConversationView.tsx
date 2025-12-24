
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { Language, Scenario, TranscriptionEntry, VoiceOption } from '../types';
import { SYSTEM_PROMPT_TEMPLATE } from '../constants';
import { createPcmBlob, decodeFromBase64, decodeAudioData } from '../services/audioUtils';

interface Challenge {
  type: 'repeat' | 'structure' | 'describe';
  instruction: string;
  target?: string;
  visual?: string;
  status: 'active' | 'evaluating' | 'completed';
  result?: {
    score: number;
    fluency: number;
    feedback: string;
    correction?: string;
    phoneticTips?: string;
  };
}

interface Props {
  language: Language;
  scenario: Scenario;
  difficulty: string;
  selectedVoice: VoiceOption;
  onEnd: (completed: boolean) => void;
}

const ConversationView: React.FC<Props> = ({ language, scenario, difficulty, selectedVoice, onEnd }) => {
  const storageKey = useMemo(() => `polyglot_history_${language.id}_${scenario.id}`, [language.id, scenario.id]);

  const [entries, setEntries] = useState<TranscriptionEntry[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [inputGain, setInputGain] = useState(1.0);
  const [outputVolume, setOutputVolume] = useState(1.0);
  const [outputPitch, setOutputPitch] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserTalkingLocal, setIsUserTalkingLocal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // VAD Advanced Settings
  const [vadThreshold, setVadThreshold] = useState(0.008);
  const [vadDuration, setVadDuration] = useState(800);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Skill Challenge State
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  const sessionRef = useRef<any>(null);
  const isPausedRef = useRef(false);
  const speechRateRef = useRef(1.0);
  const inputGainRef = useRef(1.0);
  const outputVolumeRef = useRef(1.0);
  const outputPitchRef = useRef(1.0);
  const vadThresholdRef = useRef(0.008);
  const vadDurationRef = useRef(800);
  
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionRef = useRef<{ input: string; output: string }>({ input: '', output: '' });

  const wasUserTalkingRef = useRef(false);
  const lastSilenceTimeRef = useRef(0);

  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  useEffect(() => { inputGainRef.current = inputGain; }, [inputGain]);
  useEffect(() => { vadThresholdRef.current = vadThreshold; }, [vadThreshold]);
  useEffect(() => { vadDurationRef.current = vadDuration; }, [vadDuration]);
  useEffect(() => { 
    outputVolumeRef.current = outputVolume; 
    if (outputGainNodeRef.current) {
      outputGainNodeRef.current.gain.setTargetAtTime(outputVolume, audioContextOutRef.current?.currentTime || 0, 0.05);
    }
  }, [outputVolume]);
  useEffect(() => { outputPitchRef.current = outputPitch; }, [outputPitch]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, storageKey]);

  const generateChallenge = async () => {
    setActiveChallenge({ status: 'active', type: 'repeat', instruction: 'Generating challenge...' });
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const types = ['repeat', 'structure', 'describe'];
      const chosenType = types[Math.floor(Math.random() * types.length)] as Challenge['type'];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a ${chosenType === 'repeat' ? 'Repeat Phrase' : chosenType === 'structure' ? 'Sentence Structure' : 'Visual Description'} speaking exercise for a student learning ${language.name} at ${difficulty} level.
        The context is: ${scenario.title} (${scenario.description}).
        Return a JSON object with:
        - instruction: Clearly state what to do in English.
        - target: (Mandatory for repeat/structure) The specific phrase to repeat or structure to use in ${language.name}.
        - visual: (Optional) An emoji representing something for the "describe" type.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              instruction: { type: Type.STRING },
              target: { type: Type.STRING },
              visual: { type: Type.STRING },
            },
            required: ["instruction"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      setActiveChallenge({
        ...data,
        type: chosenType,
        status: 'active'
      });
    } catch (e) {
      console.error('Failed to generate challenge', e);
      setActiveChallenge(null);
    }
  };

  const evaluateChallengeResponse = async (userInput: string) => {
    if (!activeChallenge || activeChallenge.status !== 'active') return;
    
    setActiveChallenge(prev => prev ? { ...prev, status: 'evaluating' } : null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Evaluate this student's response for a ${activeChallenge.type} exercise in ${language.name}.
        Exercise Instruction: ${activeChallenge.instruction}
        Target Phrase/Structure: ${activeChallenge.target || 'N/A'}
        Student's Transcribed Speech: "${userInput}"
        
        Evaluation Guidelines:
        1. Accuracy/Pronunciation: Compare the transcription to the target. If the transcript has words that sound phonetically similar to the target but are different, infer a pronunciation error.
        2. Fluency: Judge if the response sounds complete and confident.
        
        Provide a JSON evaluation:
        - score: 0 to 100 for Pronunciation Accuracy.
        - fluency: 0 to 100 for Fluency.
        - feedback: A short critique in English (under 15 words).
        - phoneticTips: One specific tip for better pronunciation of a sound found in the target.
        - correction: A corrected version if they missed the structure.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              fluency: { type: Type.INTEGER },
              feedback: { type: Type.STRING },
              phoneticTips: { type: Type.STRING },
              correction: { type: Type.STRING },
            },
            required: ["score", "fluency", "feedback"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      setActiveChallenge(prev => prev ? { ...prev, status: 'completed', result: data } : null);
    } catch (e) {
      console.error('Evaluation failed', e);
      setActiveChallenge(null);
    }
  };

  const checkGrammar = async (text: string, timestamp: number) => {
    if (!text || text.split(' ').length < 2) return;
    if (activeChallenge && activeChallenge.status === 'active') return;
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following ${language.name} text for grammatical and spelling errors: "${text}". 
        If the text has errors, provide the corrected version and the original text in JSON format.
        If the text is correct, return a simple status "OK".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              originalText: { type: Type.STRING },
              correctedText: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ["status", "originalText"],
          },
        },
      });
      
      const result = JSON.parse(response.text || '{}');
      if (result.status === 'CORRECTION' && result.correctedText) {
        setEntries(prev => prev.map(e => 
          e.timestamp === timestamp ? { ...e, correction: result.correctedText } : e
        ));
      }
    } catch (e) {
      console.warn('Grammar check failed', e);
    }
  };

  const playFeedbackSound = useCallback((type: 'start' | 'stop') => {
    if (!audioContextOutRef.current || isPausedRef.current) return;
    const ctx = audioContextOutRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'start' ? 880 : 440, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(() => {});
      audioContextOutRef.current = null;
    }
    outputGainNodeRef.current = null;
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    setIsActive(false);
    setIsUserTalkingLocal(false);
    setIsSpeaking(false);
  }, []);

  const startSession = useCallback(async () => {
    if (isConnecting) return;
    cleanup();
    setError(null);
    setIsConnecting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup output gain node
      outputGainNodeRef.current = audioContextOutRef.current.createGain();
      outputGainNodeRef.current.gain.setValueAtTime(outputVolumeRef.current, 0);
      outputGainNodeRef.current.connect(audioContextOutRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: SYSTEM_PROMPT_TEMPLATE(language.name, scenario.prompt, difficulty),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isPausedRef.current || !sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const currentGain = inputGainRef.current;
              
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                inputData[i] *= currentGain;
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              const now = Date.now();

              const currentThreshold = vadThresholdRef.current;
              const currentDuration = vadDurationRef.current;

              if (rms > currentThreshold) {
                if (!wasUserTalkingRef.current) {
                  wasUserTalkingRef.current = true;
                  setIsUserTalkingLocal(true);
                  playFeedbackSound('start');
                }
                lastSilenceTimeRef.current = now;
              } else {
                if (wasUserTalkingRef.current && (now - lastSilenceTimeRef.current > currentDuration)) {
                  wasUserTalkingRef.current = false;
                  setIsUserTalkingLocal(false);
                  playFeedbackSound('stop');
                }
              }

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(() => {});
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextOutRef.current && !isPausedRef.current && outputGainNodeRef.current) {
              setIsSpeaking(true);
              const ctx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeFromBase64(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              
              // Combined playback rate for pitch and speech rate
              const currentRate = speechRateRef.current * outputPitchRef.current;
              source.playbackRate.value = currentRate;
              
              // Connect to gain node instead of destination
              source.connect(outputGainNodeRef.current);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += (buffer.duration / currentRate);
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }

            if (msg.serverContent?.inputTranscription) {
              transcriptionRef.current.input += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription) {
              transcriptionRef.current.output += msg.serverContent.outputTranscription.text;
            }
            if (msg.serverContent?.turnComplete) {
              const { input, output } = transcriptionRef.current;
              const timestamp = Date.now();
              if (input.trim()) {
                setEntries(prev => [...prev, { role: 'user', text: input, timestamp }]);
                evaluateChallengeResponse(input.trim());
                checkGrammar(input.trim(), timestamp);
              }
              if (output.trim()) {
                setEntries(prev => [...prev, { role: 'model', text: output, timestamp: Date.now() }]);
              }
              transcriptionRef.current = { input: '', output: '' };
            }
          },
          onerror: (e) => {
            setError(getFriendlyErrorMessage(e));
            setIsConnecting(false);
            setIsActive(false);
          },
          onclose: (e) => {
            if (!isActive && !error) {
               setError("The session could not be established. This may be due to high traffic or an invalid API key.");
            }
            setIsActive(false);
            setIsConnecting(false);
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
      setIsConnecting(false);
    }
  }, [selectedVoice, language.name, scenario.prompt, difficulty, cleanup, playFeedbackSound, isConnecting, isActive, error]);

  const getFriendlyErrorMessage = (err: any): string => {
    const message = err?.message || String(err);
    if (!navigator.onLine) return "You seem to be offline.";
    if (message.includes('Permission denied')) return "Microphone access denied.";
    return `An error occurred: ${message.slice(0, 50)}...`;
  };

  useEffect(() => {
    startSession();
    return cleanup;
  }, [startSession, cleanup]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries]);

  const rateVisuals = useMemo(() => {
    const duration = 1.0 / speechRate;
    let colorClass = 'text-blue-600';
    let accentClass = 'accent-blue-600';
    let iconClass = 'text-blue-500';
    if (speechRate < 0.9) { colorClass = 'text-emerald-600'; accentClass = 'accent-emerald-500'; iconClass = 'text-emerald-500'; }
    else if (speechRate > 1.1) { colorClass = 'text-indigo-600'; accentClass = 'accent-indigo-600'; iconClass = 'text-indigo-500'; }
    return { colorClass, accentClass, iconClass, duration: `${duration}s` };
  }, [speechRate]);

  const pulseClass = useMemo(() => {
    if (isPaused || !isActive || isConnecting || error) return '';
    if (isUserTalkingLocal) return 'pulse-user-talking';
    if (isSpeaking) return 'pulse-tutor-talking';
    return 'pulse-listening';
  }, [isPaused, isActive, isConnecting, error, isUserTalkingLocal, isSpeaking]);

  const colorClass = useMemo(() => {
    if (error) return 'text-rose-500 bg-rose-100';
    if (isPaused) return 'text-slate-400 bg-slate-200 grayscale';
    if (isUserTalkingLocal) return 'text-blue-600 bg-blue-600 scale-110 shadow-blue-200';
    if (isSpeaking) return 'text-indigo-600 bg-indigo-500 scale-105 shadow-indigo-200';
    if (isActive) return 'text-blue-500 bg-blue-400';
    return 'text-slate-400 bg-slate-300';
  }, [error, isPaused, isUserTalkingLocal, isSpeaking, isActive]);

  const gainIndicator = useMemo(() => {
    const barCount = 6;
    const activeBars = Math.ceil((inputGain / 3.0) * barCount);
    let baseColor = 'bg-slate-200';
    let activeColor = 'bg-blue-400';
    if (inputGain > 1.0) activeColor = 'bg-indigo-500';
    if (inputGain > 2.0) activeColor = 'bg-violet-600';
    return (
      <div className="flex items-center gap-0.5 ml-2 h-3">
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} className={`w-1 rounded-full transition-all duration-300 ${i < activeBars ? activeColor : baseColor}`} style={{ height: `${40 + (i + 1) * 10}%`, opacity: i < activeBars ? 1 : 0.3 }} />
        ))}
      </div>
    );
  }, [inputGain]);

  const ScoreGauge = ({ score, size = 80, label = "Accuracy" }: { score: number, size?: number, label?: string }) => {
    const radius = size * 0.4;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90 w-full h-full">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
            <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-black text-slate-800" style={{ fontSize: size * 0.25 }}>
            {score}%
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-16rem)] max-w-4xl mx-auto px-4">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 glass-effect rounded-2xl shadow-sm border border-white/50">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{language.flag}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 leading-tight truncate">{scenario.title}</h3>
              <p className="text-xs text-slate-500 font-medium">{language.name} • {difficulty}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tutor Audio Settings */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-100">
              <div className="flex flex-col items-center px-2 border-r border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Tutor</span>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-indigo-500">VOL</span>
                    <input type="range" min="0" max="2" step="0.1" value={outputVolume} onChange={(e) => setOutputVolume(parseFloat(e.target.value))} className="w-12 h-1 accent-indigo-500" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-violet-500">PITCH</span>
                    <input type="range" min="0.5" max="1.5" step="0.1" value={outputPitch} onChange={(e) => setOutputPitch(parseFloat(e.target.value))} className="w-12 h-1 accent-violet-500" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black text-blue-500">RATE</span>
                    <input type="range" min="0.5" max="1.5" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))} className="w-12 h-1 accent-blue-500" />
                  </div>
                </div>
              </div>

              {/* Mic Gain Settings */}
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  Mic <span className="text-slate-600">{inputGain.toFixed(1)}x</span>
                  {gainIndicator}
                </div>
                <input type="range" min="0.0" max="3.0" step="0.1" value={inputGain} onChange={(e) => setInputGain(parseFloat(e.target.value))} className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowAdvanced(!showAdvanced)} className={`p-2 rounded-xl transition-all ${showAdvanced ? 'bg-slate-200 text-slate-800 shadow-inner' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
              </button>
              <button onClick={generateChallenge} disabled={activeChallenge?.status === 'active' || activeChallenge?.status === 'evaluating'} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all text-xs disabled:opacity-50">🔥 Challenge</button>
              <button onClick={() => onEnd(entries.length >= 4)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors text-sm">End</button>
            </div>
          </div>
        </div>

        {activeChallenge && (
          <div className={`p-6 rounded-[2rem] border-2 transition-all duration-500 animate-in slide-in-from-top-4 ${activeChallenge.status === 'completed' ? (activeChallenge.result?.score! >= 80 ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' : 'bg-amber-50 border-amber-200 shadow-amber-100') : 'bg-white border-indigo-200 shadow-xl shadow-indigo-100'}`}>
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase tracking-widest">{activeChallenge.type} Exercise</span>
                  {activeChallenge.status === 'evaluating' && <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 animate-pulse"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> Scoring Pronunciation...</span>}
                </div>
                <h4 className="text-xl font-black text-slate-800 leading-tight">{activeChallenge.instruction}</h4>
                {activeChallenge.visual && <div className="text-6xl py-4 flex justify-center bg-slate-50 rounded-2xl border border-slate-100">{activeChallenge.visual}</div>}
                {activeChallenge.target && activeChallenge.status !== 'completed' && <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-indigo-900 font-mono text-center text-lg font-bold">"{activeChallenge.target}"</div>}
                {activeChallenge.status === 'completed' && activeChallenge.result && (
                  <div className="space-y-4 pt-2 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                      <ScoreGauge score={activeChallenge.result.score} label="Pronunciation" />
                      <ScoreGauge score={activeChallenge.result.fluency} label="Fluency" size={60} />
                      <div className="col-span-2 space-y-2">
                        <div className="flex items-center gap-2">
                           {activeChallenge.result.score >= 95 && <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">PERFECT PITCH</span>}
                           <p className="text-sm font-bold text-slate-700 leading-tight">{activeChallenge.result.feedback}</p>
                        </div>
                        {activeChallenge.result.phoneticTips && (
                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/50">
                            <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-tighter">Pronunciation Tip:</span>
                            <p className="text-xs text-indigo-700 font-medium leading-relaxed italic">"{activeChallenge.result.phoneticTips}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {activeChallenge.result.correction && (
                       <div className="text-xs p-3 bg-white rounded-2xl border border-slate-200">
                         <span className="text-slate-400 block mb-1 font-bold">Suggested structure:</span>
                         <span className="text-emerald-600 font-bold">{activeChallenge.result.correction}</span>
                       </div>
                    )}
                    <button onClick={() => setActiveChallenge(null)} className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors">Continue Practice</button>
                  </div>
                )}
              </div>
              <div className="md:w-32 flex items-center justify-center">
                {activeChallenge.status === 'active' && (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Speak Now</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAdvanced && (
          <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4">Mic Tuning</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">Threshold: {vadThreshold.toFixed(4)}</span>
                <input type="range" min="0.001" max="0.05" step="0.001" value={vadThreshold} onChange={(e) => setVadThreshold(parseFloat(e.target.value))} className="w-full h-1.5 accent-blue-600" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">Stop Delay: {vadDuration}ms</span>
                <input type="range" min="200" max="2000" step="50" value={vadDuration} onChange={(e) => setVadDuration(parseInt(e.target.value))} className="w-full h-1.5 accent-indigo-600" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mb-6 space-y-4 px-2 custom-scrollbar">
        {entries.length === 0 && !isConnecting && !activeChallenge && (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-4">💬</div>
            <p className="font-medium">Say hello to start, or try a Skill Challenge!</p>
          </div>
        )}
        {entries.map((entry, idx) => (
          <div key={idx} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${entry.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
              <p className="text-sm leading-relaxed">{entry.text}</p>
              {entry.role === 'user' && entry.correction && (
                <div className="mt-2 pt-2 border-t border-blue-400/30 text-[11px] font-medium animate-in slide-in-from-top-1">
                  <span className="text-blue-200 block mb-0.5 font-bold uppercase tracking-tight">Correction:</span>
                  <p className="italic text-white bg-blue-700/50 px-2 py-1 rounded-lg border border-blue-400/20">{entry.correction}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="relative flex justify-center py-8">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${colorClass}`}>
          <div className={`w-16 h-16 bg-white rounded-full flex items-center justify-center transition-all shadow-md ${pulseClass} pulse-animation`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 transition-colors ${isUserTalkingLocal ? 'text-blue-600' : isSpeaking ? 'text-indigo-600' : 'text-blue-500'}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationView;
