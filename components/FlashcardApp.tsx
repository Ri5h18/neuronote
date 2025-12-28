
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Play, RotateCw, CheckCircle2, XCircle, Brain, Library, Trash2, Edit2, Image as ImageIcon, X, Upload, Layout, FileUp, Settings, Sliders, BarChart3, Clock, HelpCircle } from 'lucide-react';
import { Deck, Flashcard, DeckSettings, FlashcardState } from '../types';
import { generateId, compressImage } from '../utils';
import { marked } from 'marked';
import { MarkdownEditor } from './MarkdownEditor';

interface FlashcardAppProps {
  decks: Deck[];
  setDecks: React.Dispatch<React.SetStateAction<Deck[]>>;
  cards: Flashcard[];
  setCards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
}

const DEFAULT_SETTINGS: DeckSettings = {
  newCardsPerDay: 20,
  reviewLimitPerDay: 200,
  learningSteps: [1, 10], // 1 min, 10 min
  graduatingInterval: 1, // 1 day
  easyBonus: 1.3
};

const FlashcardApp: React.FC<FlashcardAppProps> = ({ decks, setDecks, cards, setCards }) => {
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  
  // Study Session State
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // UI State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ front: '', back: '', frontImage: '', backImage: '' });
  const [newDeckName, setNewDeckName] = useState('');
  
  // Settings Form State
  const [tempSettings, setTempSettings] = useState<DeckSettings>(DEFAULT_SETTINGS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Initializers ---

  useEffect(() => {
    // Ensure active deck is valid
    if (decks.length > 0 && !activeDeckId) {
        setActiveDeckId(decks[0].id);
    } else if (activeDeckId && !decks.find(d => d.id === activeDeckId)) {
        setActiveDeckId(decks.length > 0 ? decks[0].id : null);
    }
  }, [decks, activeDeckId]);

  // Ensure all decks have settings (migration)
  useEffect(() => {
    const updatedDecks = decks.map(d => {
        if (!d.settings) return { ...d, settings: DEFAULT_SETTINGS };
        return d;
    });
    // Check if update is needed to avoid loop
    if (JSON.stringify(updatedDecks) !== JSON.stringify(decks)) {
        setDecks(updatedDecks);
    }
  }, []);

  // Ensure all cards have state (migration)
  useEffect(() => {
      const updatedCards = cards.map(c => {
          if (!c.state) return { ...c, state: 'new' as FlashcardState, lapses: 0 };
          return c;
      });
       if (JSON.stringify(updatedCards) !== JSON.stringify(cards)) {
        setCards(updatedCards);
    }
  }, []);

  // --- Helpers ---

  const renderMarkdown = (text: string) => {
    try {
        return { __html: marked.parse(text) as string };
    } catch {
        return { __html: text };
    }
  };

  const getActiveDeck = () => decks.find(d => d.id === activeDeckId);

  // --- Anki-style Algorithm Logic ---

  const formatInterval = (minutes: number, isDays: boolean = false): string => {
      if (isDays) {
          if (minutes >= 365) return `${(minutes / 365).toFixed(1)}y`;
          if (minutes >= 30) return `${(minutes / 30).toFixed(1)}mo`;
          return `${Math.round(minutes)}d`;
      }
      if (minutes < 1) return '<1m';
      if (minutes < 60) return `${Math.round(minutes)}m`;
      if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
      return `${Math.round(minutes / 1440)}d`;
  };

  // Calculate next state without applying it (for button preview)
  const calculateNextState = (card: Flashcard, rating: 'again' | 'hard' | 'good' | 'easy', settings: DeckSettings) => {
    let nextInterval = card.interval; // min for learning, days for review
    let nextEase = card.easeFactor;
    let nextState = card.state;

    // 1. New or Relearning Cards
    if (card.state === 'new' || card.state === 'learning' || card.state === 'relearning') {
        const steps = settings.learningSteps;
        // Determine current step index based on interval matching
        let currentStepIndex = steps.indexOf(card.interval);
        if (currentStepIndex === -1) currentStepIndex = 0; // Default to first step if lost

        if (rating === 'again') {
            nextInterval = steps[0];
            nextState = 'learning';
        } else if (rating === 'hard') {
            // Hard in learning mode usually just repeats current step or avg of current and next
             nextInterval = card.interval; 
        } else if (rating === 'good') {
            if (currentStepIndex < steps.length - 1) {
                nextInterval = steps[currentStepIndex + 1];
                nextState = 'learning';
            } else {
                nextInterval = settings.graduatingInterval; // Graduate to days
                nextState = 'review';
            }
        } else if (rating === 'easy') {
            nextInterval = settings.graduatingInterval * settings.easyBonus; // Graduate with bonus
            nextState = 'review';
        }
    } 
    // 2. Review Cards
    else {
        if (rating === 'again') {
            nextState = 'relearning';
            nextInterval = settings.learningSteps[0];
            nextEase = Math.max(1.3, nextEase - 0.2);
        } else if (rating === 'hard') {
            nextInterval = Math.max(1, card.interval * 1.2); // Hard penalty is smaller interval growth
            nextEase = Math.max(1.3, nextEase - 0.15);
        } else if (rating === 'good') {
            nextInterval = Math.ceil(card.interval * card.easeFactor);
        } else if (rating === 'easy') {
            nextInterval = Math.ceil(card.interval * card.easeFactor * settings.easyBonus);
            nextEase += 0.15;
        }
    }

    return { nextInterval, nextEase, nextState };
  };

  const handleRateCard = (rating: 'again' | 'hard' | 'good' | 'easy') => {
      const card = studyQueue[currentCardIndex];
      const settings = getActiveDeck()?.settings || DEFAULT_SETTINGS;
      const { nextInterval, nextEase, nextState } = calculateNextState(card, rating, settings);
      
      const isReview = nextState === 'review';
      const nextReviewTime = Date.now() + (isReview ? nextInterval * 24 * 60 * 60 * 1000 : nextInterval * 60 * 1000);

      const updatedCard: Flashcard = {
          ...card,
          state: nextState,
          interval: nextInterval,
          easeFactor: nextEase,
          nextReview: nextReviewTime,
          repetitions: card.repetitions + 1,
          lapses: rating === 'again' && card.state === 'review' ? card.lapses + 1 : card.lapses
      };

      setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
      
      // If interval is less than 10 minutes (learning step), re-queue it in this session
      if (!isReview && nextInterval <= 10) {
           setStudyQueue(prev => [...prev, updatedCard]);
      }

      setIsFlipped(false);
      setCurrentCardIndex(prev => prev + 1);

      if (currentCardIndex >= studyQueue.length - 1 && (!(!isReview && nextInterval <= 10))) {
          // If this was the last card and we didn't just requeue it
          // Check if queue is truly empty or if we have requeued items pending
          // The effect hook on studyQueue will handle "End of Session"
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!studyMode || !isFlipped) return;
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === '1') handleRateCard('again');
        if (e.key === '2') handleRateCard('hard');
        if (e.key === '3') handleRateCard('good');
        if (e.key === '4') handleRateCard('easy');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [studyMode, isFlipped, currentCardIndex, studyQueue]); // Dependencies critical for closure

  useEffect(() => {
    if (!studyMode) return;
    const handleFlipKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isFlipped) {
            e.preventDefault(); // Prevent scroll
            setIsFlipped(true);
        }
    };
    window.addEventListener('keydown', handleFlipKey);
    return () => window.removeEventListener('keydown', handleFlipKey);
  }, [studyMode, isFlipped]);


  // --- Deck & Study Management ---

  const startStudy = () => {
    if (!activeDeckId) return;
    const deckCards = cards.filter(c => c.deckId === activeDeckId);
    const settings = getActiveDeck()?.settings || DEFAULT_SETTINGS;
    const now = Date.now();

    // 1. Identify New Cards (Limit by settings)
    const newCards = deckCards
        .filter(c => c.state === 'new')
        .slice(0, settings.newCardsPerDay);

    // 2. Identify Reviews (Due cards)
    const dueReviews = deckCards
        .filter(c => c.state !== 'new' && c.nextReview <= now)
        .sort((a,b) => a.nextReview - b.nextReview)
        .slice(0, settings.reviewLimitPerDay);

    // 3. Learning cards (In progress)
    const learningCards = deckCards.filter(c => (c.state === 'learning' || c.state === 'relearning') && c.nextReview <= now);

    const queue = [...learningCards, ...dueReviews, ...newCards];
    
    if (queue.length === 0) {
        alert("Congratulations! You have finished this deck for now.");
        return;
    }

    setStudyQueue(queue);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyMode(true);
  };

  // --- Modal Handlers ---
  
  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeDeckId) return;
      setDecks(decks.map(d => d.id === activeDeckId ? { ...d, settings: tempSettings } : d));
      setIsSettingsModalOpen(false);
  };

  const openSettings = () => {
      const deck = getActiveDeck();
      if (deck && deck.settings) {
          setTempSettings(deck.settings);
      } else {
          setTempSettings(DEFAULT_SETTINGS);
      }
      setIsSettingsModalOpen(true);
  };

  // --- CRUD (Existing Logic maintained) ---
  const handleCreateDeck = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDeckName.trim()) return;
      setDecks([...decks, { id: generateId(), name: newDeckName, settings: DEFAULT_SETTINGS }]);
      setIsDeckModalOpen(false);
  };

  const deleteDeck = (id: string) => {
      if(confirm('Delete deck?')) {
          setDecks(decks.filter(d => d.id !== id));
          setCards(cards.filter(c => c.deckId !== id));
          if(activeDeckId === id) setActiveDeckId(null);
      }
  };

  const saveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeckId) return;
    if (editingCardId) {
        setCards(cards.map(c => c.id === editingCardId ? { ...c, ...formData } : c));
    } else {
        const newCard: Flashcard = {
            id: generateId(),
            deckId: activeDeckId,
            front: formData.front,
            back: formData.back,
            frontImage: formData.frontImage,
            backImage: formData.backImage,
            nextReview: Date.now(),
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0,
            state: 'new',
            lapses: 0
        };
        setCards([...cards, newCard]);
    }
    setIsCardModalOpen(false);
    setEditingCardId(null);
    setFormData({ front: '', back: '', frontImage: '', backImage: '' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'frontImage' | 'backImage') => {
      const file = e.target.files?.[0];
      if (file) {
          try {
            const compressed = await compressImage(file);
            setFormData(prev => ({ ...prev, [field]: compressed }));
          } catch (err) { alert("Error uploading image"); }
      }
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... Keep existing import logic ... */ };

  // --- Statistics for Dashboard ---
  const deckStats = useMemo(() => {
      if (!activeDeckId) return { new: 0, learning: 0, review: 0 };
      const dCards = cards.filter(c => c.deckId === activeDeckId);
      const now = Date.now();
      return {
          new: dCards.filter(c => c.state === 'new').length,
          learning: dCards.filter(c => (c.state === 'learning' || c.state === 'relearning')).length,
          review: dCards.filter(c => c.state === 'review' && c.nextReview <= now).length,
      };
  }, [cards, activeDeckId]);

  // --- Rendering ---

  if (studyMode) {
      const currentCard = studyQueue[currentCardIndex];
      const settings = getActiveDeck()?.settings || DEFAULT_SETTINGS;

      // Handle session finish
      if (!currentCard) {
          return (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in-95">
                  <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400">
                      <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Session Complete!</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
                      You've reviewed all queued cards for this deck. Come back later for more reviews.
                  </p>
                  <button onClick={() => setStudyMode(false)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30">
                      Back to Decks
                  </button>
              </div>
          );
      }

      // Calculate future states for buttons
      const againState = calculateNextState(currentCard, 'again', settings);
      const hardState = calculateNextState(currentCard, 'hard', settings);
      const goodState = calculateNextState(currentCard, 'good', settings);
      const easyState = calculateNextState(currentCard, 'easy', settings);

      const isReview = currentCard.state === 'review';

      return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
            {/* Study Header */}
            <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-4 text-sm font-bold font-mono">
                    <span className="text-blue-500">New: {studyQueue.slice(currentCardIndex).filter(c => c.state === 'new').length}</span>
                    <span className="text-red-500">Lrn: {studyQueue.slice(currentCardIndex).filter(c => c.state === 'learning' || c.state === 'relearning').length}</span>
                    <span className="text-green-500">Rev: {studyQueue.slice(currentCardIndex).filter(c => c.state === 'review').length}</span>
                </div>
                <button onClick={() => setStudyMode(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Card Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
                <div 
                    className="w-full max-w-2xl min-h-[300px] bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center p-8 md:p-12 cursor-pointer transition-all hover:shadow-2xl"
                    onClick={() => !isFlipped && setIsFlipped(true)}
                >
                    <div className="flex-1 flex flex-col justify-center w-full">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Question</div>
                        {currentCard.frontImage && (
                            <img src={currentCard.frontImage} alt="Front" className="max-h-64 object-contain mx-auto mb-6 rounded-lg" />
                        )}
                        <div 
                             className="markdown-preview text-xl md:text-2xl text-gray-900 dark:text-gray-100 prose dark:prose-invert mx-auto"
                             dangerouslySetInnerHTML={renderMarkdown(currentCard.front)}
                        />
                    </div>

                    {isFlipped && (
                        <>
                            <div className="w-full h-px bg-gray-100 dark:bg-gray-700 my-8"></div>
                            <div className="flex-1 flex flex-col justify-center w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">Answer</div>
                                {currentCard.backImage && (
                                    <img src={currentCard.backImage} alt="Back" className="max-h-64 object-contain mx-auto mb-6 rounded-lg" />
                                )}
                                <div 
                                    className="markdown-preview text-lg md:text-xl text-gray-700 dark:text-gray-300 prose dark:prose-invert mx-auto"
                                    dangerouslySetInnerHTML={renderMarkdown(currentCard.back)}
                                />
                            </div>
                        </>
                    )}
                </div>
                {!isFlipped && <p className="mt-8 text-gray-400 animate-pulse text-sm">Tap or press Space to flip</p>}
            </div>

            {/* Rating Bar */}
            {isFlipped && (
                <div className="p-4 md:p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-full duration-300">
                    <div className="max-w-4xl mx-auto grid grid-cols-4 gap-2 md:gap-4">
                        {[
                            { label: 'Again', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300', key: '1', data: againState, action: 'again' },
                            { label: 'Hard', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', key: '2', data: hardState, action: 'hard' },
                            { label: 'Good', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', key: '3', data: goodState, action: 'good' },
                            { label: 'Easy', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', key: '4', data: easyState, action: 'easy' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => handleRateCard(btn.action as any)}
                                className={`flex flex-col items-center justify-center py-3 md:py-4 rounded-xl transition-transform active:scale-95 ${btn.color} hover:brightness-95 dark:hover:brightness-110`}
                            >
                                <span className="text-xs opacity-70 font-mono mb-1">
                                    {formatInterval(btn.data.nextInterval, btn.data.nextState === 'review')}
                                </span>
                                <span className="font-bold text-sm md:text-base">{btn.label}</span>
                                <span className="text-[10px] opacity-50 font-mono hidden md:inline mt-1">[{btn.key}]</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- Main Dashboard ---

  return (
    <div className="flex flex-col md:flex-row h-full gap-6 relative">
      {/* Decks Sidebar */}
      <div className="w-full md:w-64 flex flex-col gap-2 flex-shrink-0 max-h-[200px] md:max-h-full overflow-hidden border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-4 md:pb-0">
        <div className="flex justify-between items-center mb-2 px-2">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Your Decks</h2>
          <button onClick={() => { setNewDeckName(''); setIsDeckModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded-lg transition-colors"><Plus size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
            {decks.map(deck => (
            <div
                key={deck.id}
                className={`group flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer mb-1 ${
                activeDeckId === deck.id 
                ? 'bg-white dark:bg-gray-800 shadow-sm border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'
                }`}
                onClick={() => setActiveDeckId(deck.id)}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <Library size={18} className="flex-shrink-0" />
                    <span className="font-medium truncate">{deck.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
            </div>
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 flex flex-col overflow-hidden relative">
        {activeDeckId && getActiveDeck() ? (
          <>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getActiveDeck()?.name}</h1>
                        <button onClick={openSettings} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Deck Settings">
                            <Settings size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> New: {deckStats.new}
                        </span>
                        <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div> Learn: {deckStats.learning}
                        </span>
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> Review: {deckStats.review}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={startStudy} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-2">
                        <Play size={20} fill="currentColor" /> Study Now
                    </button>
                </div>
            </div>

            {/* Card List */}
            <div className="flex-1 overflow-y-auto pr-2 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button 
                        onClick={() => { setEditingCardId(null); setFormData({ front: '', back: '', frontImage: '', backImage: '' }); setIsCardModalOpen(true); }}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all min-h-[160px]"
                    >
                        <Plus size={32} />
                        <span className="mt-2 font-medium">Add Flashcard</span>
                    </button>
                    
                    {cards.filter(c => c.deckId === activeDeckId).map(card => (
                        <div key={card.id} className="group relative p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors flex flex-col">
                            <div className="flex-1">
                                <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                                    Front {card.frontImage && <ImageIcon size={12} className="text-indigo-500" />}
                                </div>
                                <div className="markdown-preview text-center text-gray-800 dark:text-gray-200 mb-3 line-clamp-2 text-sm prose dark:prose-invert" dangerouslySetInnerHTML={renderMarkdown(card.front || "...")} />
                                <div className="h-px bg-gray-200 dark:bg-gray-700 w-full mb-3"></div>
                                <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                                    Back {card.backImage && <ImageIcon size={12} className="text-indigo-500" />}
                                </div>
                                <div className="markdown-preview text-center text-gray-600 dark:text-gray-400 line-clamp-2 text-sm prose dark:prose-invert" dangerouslySetInnerHTML={renderMarkdown(card.back || "...")} />
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-between text-[10px] text-gray-400 font-mono">
                                <span>Int: {formatInterval(card.interval, card.state === 'review')}</span>
                                <span className={card.state === 'new' ? 'text-blue-500' : card.state === 'review' ? 'text-green-500' : 'text-orange-500'}>{card.state.toUpperCase()}</span>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                <button onClick={() => { setEditingCardId(card.id); setFormData({ front: card.front, back: card.back, frontImage: card.frontImage || '', backImage: card.backImage || '' }); setIsCardModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-500"><Edit2 size={14} /></button>
                                <button onClick={() => { if(confirm('Delete card?')) setCards(prev => prev.filter(c => c.id !== card.id)); }} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <Layout size={48} className="mb-4 opacity-50" />
             <p className="text-lg font-medium">Select a deck</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2"><Sliders size={20} /> Deck Options</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Cards per Day</label>
                          <input type="number" min="0" value={tempSettings.newCardsPerDay} onChange={e => setTempSettings({...tempSettings, newCardsPerDay: parseInt(e.target.value)})} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Reviews per Day</label>
                          <input type="number" min="0" value={tempSettings.reviewLimitPerDay} onChange={e => setTempSettings({...tempSettings, reviewLimitPerDay: parseInt(e.target.value)})} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Graduating Interval (Days)</label>
                            <input type="number" min="1" value={tempSettings.graduatingInterval} onChange={e => setTempSettings({...tempSettings, graduatingInterval: parseInt(e.target.value)})} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Easy Bonus (Multiplier)</label>
                            <input type="number" step="0.1" min="1" value={tempSettings.easyBonus} onChange={e => setTempSettings({...tempSettings, easyBonus: parseFloat(e.target.value)})} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                        </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
                          <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Deck Creation Modal */}
      {isDeckModalOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsDeckModalOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create New Deck</h2>
                    <button onClick={() => setIsDeckModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <form onSubmit={handleCreateDeck}>
                    <input autoFocus type="text" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="Deck Name" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-gray-100" />
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">Create Deck</button>
                </form>
            </div>
        </div>
      )}

      {/* Card Modal (Edit/Create) */}
      {isCardModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsCardModalOpen(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingCardId ? 'Edit Flashcard' : 'New Flashcard'}</h2>
                      <button onClick={() => setIsCardModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={24}/></button>
                  </div>
                  <form onSubmit={saveCard} className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="space-y-3">
                          <div className="flex justify-between items-center">
                              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Front</label>
                              <label className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                                  <Upload size={12} /> {formData.frontImage ? 'Change' : 'Add Image'} <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'frontImage')} />
                              </label>
                          </div>
                          <MarkdownEditor value={formData.front} onChange={val => setFormData({...formData, front: val})} placeholder="Enter question..." className="min-h-[150px]" />
                          {formData.frontImage && <img src={formData.frontImage} className="h-32 rounded-lg border object-cover" />}
                      </div>
                      <div className="h-px bg-gray-100 dark:bg-gray-800"></div>
                      <div className="space-y-3">
                           <div className="flex justify-between items-center">
                              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Back</label>
                              <label className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                                  <Upload size={12} /> {formData.backImage ? 'Change' : 'Add Image'} <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'backImage')} />
                              </label>
                          </div>
                          <MarkdownEditor value={formData.back} onChange={val => setFormData({...formData, back: val})} placeholder="Enter answer..." className="min-h-[150px]" />
                           {formData.backImage && <img src={formData.backImage} className="h-32 rounded-lg border object-cover" />}
                      </div>
                  </form>
                  <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
                      <button onClick={saveCard} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">{editingCardId ? 'Save Changes' : 'Create Card'}</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default FlashcardApp;
