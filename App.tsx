
import React, { useState, useEffect, useRef } from 'react';
import { Notebook, Library, CheckSquare, Calendar, Moon, Sun, PanelLeft, Edit2, Clock as ClockIcon, Sparkles } from 'lucide-react';
import { Note, Deck, Flashcard, Todo, CalendarEvent, AppView, Alarm } from './types';
import NoteApp from './components/NoteApp';
import FlashcardApp from './components/FlashcardApp';
import TodoApp from './components/TodoApp';
import CalendarApp from './components/CalendarApp';
import ClockApp from './components/ClockApp';
import { AIChat } from './components/AIChat';
import { generateId } from './utils';

// Helper for local storage
const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.NOTES);
  const [darkMode, setDarkMode] = useStickyState(false, 'neuro-darkmode');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // User Profile
  const [userName, setUserName] = useStickyState('User', 'neuro-username');
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // AI Chat State
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Application State with Persistence
  const [notes, setNotes] = useStickyState<Note[]>([], 'notes');
  const [decks, setDecks] = useStickyState<Deck[]>([
    { 
      id: '1', 
      name: 'General Knowledge',
      settings: {
        newCardsPerDay: 20,
        reviewLimitPerDay: 200,
        learningSteps: [1, 10],
        graduatingInterval: 1,
        easyBonus: 1.3
      }
    }
  ], 'neuro-decks');
  const [flashcards, setFlashcards] = useStickyState<Flashcard[]>([], 'neuro-flashcards');
  const [todos, setTodos] = useStickyState<Todo[]>([], 'neuro-todos');
  const [events, setEvents] = useStickyState<CalendarEvent[]>([], 'neuro-events');
  const [alarms, setAlarms] = useStickyState<Alarm[]>([], 'neuro-alarms');

  // Alarm Check Logic
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
      const currentSeconds = now.getSeconds();

      // Only check at 00 seconds to avoid multiple triggers
      if (currentSeconds === 0) {
          const triggeredAlarm = alarms.find(a => a.active && a.time === currentTime);
          if (triggeredAlarm) {
              playAlarmSound();
              if (Notification.permission === "granted") {
                  new Notification(`Alarm: ${triggeredAlarm.label}`, { body: "Time to check your tasks!" });
              } else if (Notification.permission !== "denied") {
                  Notification.requestPermission().then(permission => {
                      if (permission === "granted") {
                          new Notification(`Alarm: ${triggeredAlarm.label}`, { body: "Time to check your tasks!" });
                      }
                  });
              }
              // Use a timeout to prevent blocking the UI thread immediately
              setTimeout(() => alert(`ALARM: ${triggeredAlarm.label}`), 100);
          }
      }
    };
    
    const timer = setInterval(checkAlarms, 1000);
    return () => clearInterval(timer);
  }, [alarms]);

  const playAlarmSound = () => {
      // Simple beep using AudioContext with cleanup
      try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              osc.type = 'square';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
              
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              
              osc.start();
              osc.stop(ctx.currentTime + 0.5);

              // Crucial: Close the context after the sound is done to prevent memory leak/crash
              setTimeout(() => {
                  ctx.close().catch(console.error);
              }, 600);
          }
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Focus name input when editing starts
  useEffect(() => {
      if (isEditingName && nameInputRef.current) {
          nameInputRef.current.focus();
      }
  }, [isEditingName]);

  const addFlashcards = (newCards: Omit<Flashcard, 'id'>[]) => {
      const cardsWithIds = newCards.map(c => ({...c, id: generateId()}));
      setFlashcards([...flashcards, ...cardsWithIds]);
  };

  const addTasks = (tasks: string[]) => {
      const newTodos: Todo[] = tasks.map(t => ({
          id: generateId(),
          text: t,
          completed: false,
          priority: 'medium',
          dueDate: Date.now()
      }));
      setTodos([...newTodos, ...todos]);
  }

  const handleAddEvent = (event: CalendarEvent) => {
    setEvents([...events, event]);
  };

  const handleAddTodo = (todo: Todo) => {
    setTodos([...todos, todo]);
  };

  const navItems = [
    { view: AppView.NOTES, label: 'Notes', icon: Notebook },
    { view: AppView.FLASHCARDS, label: 'Flashcards', icon: Library },
    { view: AppView.TODO, label: 'Tasks', icon: CheckSquare },
    { view: AppView.CALENDAR, label: 'Schedule', icon: Calendar },
    { view: AppView.CLOCK, label: 'Time Tools', icon: ClockIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 overflow-hidden font-sans text-gray-900 dark:text-gray-100">
      
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0'} 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col fixed md:relative z-20 h-full`}
      >
        <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">N</div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                    NeuroNote
                </span>
            </div>

            {/* Editable Profile Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Welcome back,</p>
                <div className="flex items-center gap-2 group">
                    {isEditingName ? (
                        <input 
                            ref={nameInputRef}
                            type="text" 
                            value={userName} 
                            onChange={(e) => setUserName(e.target.value)}
                            onBlur={() => setIsEditingName(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                            className="w-full bg-white dark:bg-gray-800 border border-indigo-500 rounded px-1 py-0.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
                        />
                    ) : (
                        <button 
                            onClick={() => setIsEditingName(true)}
                            className="text-lg font-bold text-gray-800 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate flex-1 text-left flex items-center gap-2"
                        >
                            {userName}
                            <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                        </button>
                    )}
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
             <button 
                onClick={() => setIsAIChatOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
             >
                <Sparkles size={20} className="fill-white/20" />
                Ask Assistant
             </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-1 flex mb-3">
             <button 
               onClick={() => setDarkMode(false)}
               className={`flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-all ${!darkMode ? 'bg-white dark:bg-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
             >
                <Sun size={16} className="mr-2"/> Light
             </button>
             <button 
               onClick={() => setDarkMode(true)}
               className={`flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-all ${darkMode ? 'bg-white dark:bg-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
             >
                <Moon size={16} className="mr-2"/> Dark
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Sidebar Toggle */}
        <header className="p-4 flex items-center md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <PanelLeft size={20} className="text-gray-600 dark:text-gray-300"/>
            </button>
            <h1 className="ml-4 font-bold text-lg">{navItems.find(n => n.view === currentView)?.label}</h1>
        </header>

        {/* Dynamic Toggle Button for Desktop */}
        <div className="absolute top-6 left-6 hidden md:block z-10">
             {!sidebarOpen && (
                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <PanelLeft size={20} className="text-gray-600 dark:text-gray-300"/>
                </button>
             )}
             {sidebarOpen && (
                <button 
                    onClick={() => setSidebarOpen(false)}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white dark:bg-gray-800 border-y border-r border-gray-200 dark:border-gray-700 rounded-r-lg shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-500 transition-colors"
                    style={{ left: '-24px' }} // Visual fix handled by sidebar container
                >
                     <PanelLeft size={14} />
                </button>
             )}
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-hidden">
            {currentView === AppView.NOTES && (
                <NoteApp 
                    notes={notes} 
                    setNotes={setNotes} 
                    decks={decks}
                    setDecks={setDecks}
                    addFlashcards={addFlashcards}
                    addTasks={addTasks}
                />
            )}
            {currentView === AppView.FLASHCARDS && (
                <FlashcardApp 
                    decks={decks} 
                    setDecks={setDecks} 
                    cards={flashcards} 
                    setCards={setFlashcards} 
                />
            )}
            {currentView === AppView.TODO && (
                <TodoApp todos={todos} setTodos={setTodos} />
            )}
            {currentView === AppView.CALENDAR && (
                <CalendarApp 
                  todos={todos} 
                  events={events} 
                  onAddEvent={handleAddEvent}
                  onAddTodo={handleAddTodo}
                />
            )}
             {currentView === AppView.CLOCK && (
                <ClockApp alarms={alarms} setAlarms={setAlarms} />
            )}
        </div>
      </main>

      {/* Global AI Chat Integration */}
      <AIChat 
        isOpen={isAIChatOpen} 
        onClose={() => setIsAIChatOpen(false)} 
        notes={notes}
        todos={todos}
        events={events}
      />
    </div>
  );
};

export default App;
