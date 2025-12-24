
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Language, Scenario, VoiceOption } from './types';
import { LANGUAGES, SCENARIOS, DIFFICULTIES, VOICE_DETAILS } from './constants';
import ConversationView from './components/ConversationView';

const App: React.FC = () => {
  // Load initial state from localStorage if available
  const [state, setState] = useState<AppState>(() => {
    const savedLangId = localStorage.getItem('polyglot_pref_lang_id');
    const savedVoice = localStorage.getItem('polyglot_pref_voice') as VoiceOption | null;
    const savedDifficulty = localStorage.getItem('polyglot_pref_difficulty') as AppState['difficulty'] | null;

    const initialLang = savedLangId ? LANGUAGES.find(l => l.id === savedLangId) || null : null;

    return {
      language: initialLang,
      scenario: null,
      selectedVoice: savedVoice || (initialLang ? initialLang.voice : null),
      difficulty: savedDifficulty || 'Intermediate',
      status: 'idle',
    };
  });

  const [completions, setCompletions] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('polyglot_completions');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist preferences when they change
  useEffect(() => {
    if (state.language) {
      localStorage.setItem('polyglot_pref_lang_id', state.language.id);
    }
    if (state.selectedVoice) {
      localStorage.setItem('polyglot_pref_voice', state.selectedVoice);
    }
    localStorage.setItem('polyglot_pref_difficulty', state.difficulty);
  }, [state.language, state.selectedVoice, state.difficulty]);

  useEffect(() => {
    localStorage.setItem('polyglot_completions', JSON.stringify(completions));
  }, [completions]);

  const handleLanguageSelect = (lang: Language) => {
    setState(prev => ({ 
      ...prev, 
      language: lang,
      // Update voice if user hasn't manually picked a specific one that's different
      selectedVoice: lang.voice 
    }));
  };

  const handleStart = () => {
    if (state.language && state.scenario && state.selectedVoice) {
      setState(prev => ({ ...prev, status: 'active' }));
    }
  };

  const handleEnd = (completed: boolean) => {
    if (completed && state.language && state.scenario) {
      const key = `${state.language.id}_${state.scenario.id}`;
      setCompletions(prev => ({ ...prev, [key]: true }));
    }
    setState(prev => ({ ...prev, status: 'idle', scenario: null }));
  };

  const isScenarioCompleted = (scenarioId: string) => {
    if (!state.language) return false;
    return !!completions[`${state.language.id}_${scenarioId}`];
  };

  const renderSetup = () => (
    <div className="max-w-6xl mx-auto px-6 py-12 md:py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center mb-16 space-y-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase tracking-wider mb-2">
          ✨ Powered by Gemini Live
        </span>
        <h1 className="text-5xl md:text-6xl font-outfit font-extrabold text-slate-900 tracking-tight">
          Speak like a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Local</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
          The most natural way to master a new language. Practice real-time conversation with an AI partner that never tires.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Language & Voice Selection Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <span className="text-sm">1</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Select Language</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar border border-slate-100 rounded-3xl p-1 bg-white/50">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageSelect(lang)}
                  className={`group relative flex items-center gap-4 p-4 rounded-2xl transition-all border-2 text-left hover:scale-[1.02] active:scale-95 ${
                    state.language?.id === lang.id
                      ? 'border-blue-500 bg-blue-50/50 shadow-xl shadow-blue-100 ring-1 ring-blue-500/20'
                      : 'border-white bg-white hover:border-blue-200 hover:shadow-lg'
                  }`}
                >
                  {state.language?.id === lang.id && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />
                  )}
                  <span className="text-3xl transition-transform group-hover:scale-110">{lang.flag}</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">{lang.name}</div>
                    <div className="text-xs text-slate-500">{lang.nativeName}</div>
                  </div>
                  {state.language?.id === lang.id && (
                    <div className="bg-blue-500 rounded-full p-1 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
             <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <span className="text-sm">2</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Tutor Voice</h2>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 gap-2">
              {VOICE_DETAILS.map(voice => (
                <button
                  key={voice.id}
                  onClick={() => setState(prev => ({ ...prev, selectedVoice: voice.id }))}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                    state.selectedVoice === voice.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-transparent hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    state.selectedVoice === voice.id ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {voice.name[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold">{voice.name}</div>
                    <div className="text-[10px] opacity-70 uppercase tracking-tighter">{voice.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Main Configuration Area */}
        <section className="lg:col-span-8 space-y-8">
          {/* Difficulty & Scenario Header */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <span className="text-sm">3</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800">Choose Scenario</h2>
              </div>
              
              <div className="flex bg-slate-100 p-1.5 rounded-2xl self-start md:self-auto">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setState(prev => ({ ...prev, difficulty: d }))}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                      state.difficulty === d
                        ? 'bg-white text-blue-600 shadow-md transform scale-105'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SCENARIOS.map(sc => {
                const completed = isScenarioCompleted(sc.id);
                return (
                  <button
                    key={sc.id}
                    onClick={() => setState(prev => ({ ...prev, scenario: sc }))}
                    className={`relative flex flex-col gap-4 p-6 rounded-[2rem] transition-all border-2 text-left h-full hover:shadow-xl group outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      state.scenario?.id === sc.id
                        ? 'border-emerald-500 bg-emerald-50/30 shadow-emerald-100 ring-1 ring-emerald-500/20'
                        : 'border-slate-50 bg-slate-50/50 hover:border-emerald-200 hover:bg-white'
                    }`}
                  >
                    {/* Mastery Badge */}
                    {completed && (
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 animate-in zoom-in duration-500 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        MASTERED
                      </div>
                    )}

                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform group-hover:scale-110 group-focus:scale-110 shadow-sm ${
                      state.scenario?.id === sc.id ? 'bg-emerald-500 text-white' : 'bg-white'
                    }`}>
                      {sc.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-lg mb-1">{sc.title}</div>
                      <p className="text-sm text-slate-500 leading-relaxed mb-3">{sc.description}</p>
                      
                      {/* Detailed Reveal on Hover/Focus */}
                      <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-h-48 group-hover:opacity-100 group-focus:max-h-48 group-focus:opacity-100">
                        <div className="pt-3 border-t border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Practice points:</p>
                            <ul className="space-y-1.5">
                              {sc.details?.map((detail, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                                  {detail}
                                </li>
                              ))}
                            </ul>
                        </div>
                      </div>
                    </div>
                    {state.scenario?.id === sc.id && (
                      <div className="absolute top-4 right-4 bg-emerald-500 rounded-full p-1.5 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Area */}
          <div className="space-y-4 pt-4">
            <button
              disabled={!state.language || !state.scenario || !state.selectedVoice}
              onClick={handleStart}
              className={`w-full py-6 rounded-[2rem] font-bold text-2xl transition-all flex items-center justify-center gap-4 shadow-2xl ${
                state.language && state.scenario && state.selectedVoice
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:scale-[1.02] hover:shadow-blue-200 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed grayscale'
              }`}
            >
              <span>Start Live Session</span>
              <div className="bg-white/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
            
            <div className="text-center space-y-2">
              {!state.language || !state.scenario || !state.selectedVoice ? (
                <p className="text-sm font-medium text-slate-400">
                  {!state.language ? 'Select a language' : !state.selectedVoice ? 'Choose a voice' : !state.scenario ? 'Pick a scenario' : ''} to unlock the AI tutor.
                </p>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600 animate-pulse">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Ready for your {state.language.name} practice
                  </div>
                  <p className="text-xs text-slate-400">Voice: {state.selectedVoice} • Level: {state.difficulty}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe]">
      {/* Header */}
      <nav className="glass-effect sticky top-0 z-50 py-5 px-8 mb-4 border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setState(prev => ({ ...prev, status: 'idle' }))}>
            <div className="w-11 h-11 bg-blue-600 rounded-[1rem] flex items-center justify-center shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-2xl font-outfit font-extrabold text-slate-900 tracking-tight">
              Live<span className="text-blue-600">Tutor</span>
            </span>
          </div>
          
          {state.status === 'active' && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-100 shadow-sm">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                ACTIVE SESSION
              </span>
            </div>
          )}
        </div>
      </nav>

      <main>
        {state.status === 'active' && state.language && state.scenario && state.selectedVoice ? (
          <ConversationView
            language={state.language}
            scenario={state.scenario}
            difficulty={state.difficulty}
            selectedVoice={state.selectedVoice}
            onEnd={handleEnd}
          />
        ) : (
          renderSetup()
        )}
      </main>

      <footer className="mt-20 py-12 text-center border-t border-slate-100 bg-white">
        <div className="max-w-xl mx-auto px-6">
          <p className="text-slate-400 text-sm mb-2 font-medium">© 2024 Live Tutor AI • Built for the future of learning.</p>
          <div className="flex justify-center gap-4 grayscale opacity-50">
             <div className="h-6 w-px bg-slate-300"></div>
             <p className="text-xs text-slate-400">Powered by Google Gemini 2.5 Flash Native Audio</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
