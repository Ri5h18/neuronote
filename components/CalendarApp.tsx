
import React, { useState, useEffect, useRef } from 'react';
import { 
  format, endOfMonth, eachDayOfInterval, isSameDay, addMonths, isToday, 
  startOfWeek, endOfWeek, addDays, startOfDay, getHours, getMinutes, 
  setHours, setMinutes, isBefore, addWeeks, subWeeks, subDays, addHours,
  differenceInMinutes, subMonths, isWithinInterval
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Calendar as CalIcon, Plus, X, Clock, 
  CheckCircle2, Image as ImageIcon, MapPin, AlignLeft, MoreHorizontal,
  ChevronDown, Layout
} from 'lucide-react';
import { Todo, CalendarEvent } from '../types';
import { generateId, compressImage } from '../utils';

interface CalendarAppProps {
  todos: Todo[];
  events: CalendarEvent[];
  onAddEvent: (event: CalendarEvent) => void;
  onAddTodo: (todo: Todo) => void;
}

type ViewType = 'month' | 'week' | 'day';

const CalendarApp: React.FC<CalendarAppProps> = ({ todos, events, onAddEvent, onAddTodo }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{start: Date, end: Date} | null>(null);

  // Modal Form State
  const [newItemType, setNewItemType] = useState<'task' | 'event'>('event');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImage, setNewItemImage] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  // Scroll to current time on mount (for week/day view)
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((view === 'week' || view === 'day') && scrollRef.current) {
      // Scroll to 8 AM by default
      scrollRef.current.scrollTop = 8 * 60; 
    }
  }, [view]);

  // --- Navigation Logic ---
  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'day') setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'day') setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  // --- Data Helpers ---
  const getItemsForDay = (date: Date) => {
    const dayTasks = todos.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), date) && !t.completed);
    const dayEvents = events.filter(e => isSameDay(new Date(e.start), date));
    return { tasks: dayTasks, events: dayEvents };
  };

  const getAllDayItems = (date: Date) => {
    const { tasks } = getItemsForDay(date);
    // In this app, we treat tasks as All Day items for simplicity in the TimeGrid
    return tasks;
  };

  const getTimedEvents = (date: Date) => {
    const { events } = getItemsForDay(date);
    return events.sort((a, b) => a.start - b.start);
  };

  // --- Modal Logic ---
  const openModal = (start?: Date, end?: Date) => {
    const now = new Date();
    const s = start || setMinutes(setHours(currentDate, 9), 0);
    const e = end || setMinutes(setHours(currentDate, 10), 0);
    
    setSelectedSlot({ start: s, end: e });
    setStartTime(format(s, 'HH:mm'));
    setEndTime(format(e, 'HH:mm'));
    setNewItemTitle('');
    setNewItemDesc('');
    setNewItemImage('');
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !selectedSlot) return;

    const id = generateId();
    
    // Construct real start/end dates from the time inputs
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const finalStart = setMinutes(setHours(selectedSlot.start, startH), startM);
    let finalEnd = setMinutes(setHours(selectedSlot.start, endH), endM);
    
    // Handle overnight edge case simply (if end < start, assume next day? No, just force end > start)
    if (isBefore(finalEnd, finalStart)) {
        finalEnd = addHours(finalStart, 1);
    }

    if (newItemType === 'task') {
      const newTodo: Todo = {
        id,
        text: newItemTitle,
        completed: false,
        priority: 'medium',
        dueDate: finalStart.getTime(),
        image: newItemImage || undefined
      };
      onAddTodo(newTodo);
    } else {
      const newEvent: CalendarEvent = {
        id,
        title: newItemTitle,
        description: newItemDesc,
        start: finalStart.getTime(),
        end: finalEnd.getTime(),
        type: 'custom',
        image: newItemImage || undefined
      };
      onAddEvent(newEvent);
    }
    
    setIsModalOpen(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const compressed = await compressImage(file);
              setNewItemImage(compressed);
          } catch (e) {
              console.error(e);
          }
      }
  };

  // --- Views ---

  const MonthView = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDay = firstDay.getDay(); // 0-6
    const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(currentDate) });
    const blanks = Array(startDay).fill(null);

    return (
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-gray-200 dark:bg-gray-700 gap-px border-l border-gray-200 dark:border-gray-700">
          {blanks.map((_, i) => <div key={`blank-${i}`} className="bg-white dark:bg-gray-800" />)}
          {days.map(day => {
            const { tasks, events } = getItemsForDay(day);
            const isTodayDate = isToday(day);
            return (
              <div 
                key={day.toISOString()} 
                onClick={() => { setCurrentDate(day); setView('day'); }} // Drill down on click
                className={`bg-white dark:bg-gray-800 p-2 min-h-[100px] hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group flex flex-col gap-1`}
              >
                <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {format(day, 'd')}
                    </span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); openModal(day, day); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    {[...events, ...tasks].slice(0, 4).map(item => {
                        const isTask = (item as Todo).text !== undefined;
                        const title = isTask ? (item as Todo).text : (item as CalendarEvent).title;
                        return (
                            <div key={item.id} className={`truncate text-[10px] px-1.5 py-0.5 rounded border-l-2 ${isTask ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'}`}>
                                {title}
                            </div>
                        )
                    })}
                    {[...events, ...tasks].length > 4 && (
                        <span className="text-[10px] text-gray-400 pl-1">
                            + {[...events, ...tasks].length - 4} more
                        </span>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const TimeGrid = ({ type }: { type: 'week' | 'day' }) => {
    const daysToShow = type === 'week' 
        ? eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }) 
        : [currentDate];

    // Current Time Indicator Logic
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000); // Update every min
        return () => clearInterval(t);
    }, []);

    const getCurrentTimePosition = () => {
        const minutes = getHours(now) * 60 + getMinutes(now);
        return minutes; // 1 min = 1px height for simplicity (or scaled)
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
            {/* Header Row */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="w-16 border-r border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0" /> {/* Time col spacer */}
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${daysToShow.length}, minmax(0, 1fr))` }}>
                    {daysToShow.map(day => {
                        const isTodayDate = isToday(day);
                        return (
                            <div key={day.toISOString()} className="text-center py-3 border-r border-gray-100 dark:border-gray-700 last:border-0">
                                <div className={`text-xs font-semibold uppercase mb-1 ${isTodayDate ? 'text-indigo-600' : 'text-gray-500'}`}>
                                    {format(day, 'EEE')}
                                </div>
                                <div className={`text-2xl font-light w-10 h-10 mx-auto flex items-center justify-center rounded-full ${isTodayDate ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-900 dark:text-white'}`}>
                                    {format(day, 'd')}
                                </div>
                                {/* All Day Section Area */}
                                <div className="mt-2 space-y-1 px-1 min-h-[20px]">
                                    {getAllDayItems(day).map(task => (
                                        <div key={task.id} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded px-1 py-0.5 truncate text-left border-l-2 border-emerald-500">
                                            <CheckCircle2 size={8} className="inline mr-1" />
                                            {task.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Scrollable Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto relative scrollbar-thin">
                <div className="flex relative min-h-[1440px]"> {/* 24h * 60px/h = 1440px */}
                    
                    {/* Time Labels */}
                    <div className="w-16 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 select-none z-10 sticky left-0">
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} className="h-[60px] text-right pr-2 text-xs text-gray-400 relative -top-2.5">
                                {i === 0 ? '' : format(setHours(new Date(), i), 'h aa')}
                            </div>
                        ))}
                    </div>

                    {/* Columns */}
                    <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${daysToShow.length}, minmax(0, 1fr))` }}>
                        {/* Horizontal Grid Lines */}
                        <div className="absolute inset-0 z-0 pointer-events-none">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="h-[60px] border-b border-gray-100 dark:border-gray-700/50 w-full" />
                            ))}
                        </div>

                        {daysToShow.map((day, dayIndex) => {
                            const events = getTimedEvents(day);
                            return (
                                <div 
                                    key={day.toISOString()} 
                                    className="relative h-full border-r border-gray-100 dark:border-gray-700 last:border-0 group"
                                    onClick={(e) => {
                                        // Click to create event at time
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const y = e.clientY - rect.top + e.currentTarget.scrollTop; // approx
                                        // Better: calculate from click position relative to top of container
                                        // For MVP: default to 9am or just open modal
                                        openModal(day);
                                    }}
                                >
                                    {/* Current Time Line */}
                                    {isToday(day) && (
                                        <div 
                                            className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                                            style={{ top: `${getCurrentTimePosition()}px` }}
                                        >
                                            <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                                        </div>
                                    )}

                                    {/* Events */}
                                    {events.map(event => {
                                        const startMin = getHours(event.start) * 60 + getMinutes(event.start);
                                        const endMin = getHours(event.end) * 60 + getMinutes(event.end);
                                        const duration = Math.max(30, endMin - startMin); // Minimum 30 mins visual

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={(e) => { e.stopPropagation(); alert(`Event: ${event.title}\n${event.description || ''}`); }}
                                                className="absolute inset-x-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 border-l-4 border-indigo-500 text-xs p-1 overflow-hidden cursor-pointer hover:shadow-lg hover:z-30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all"
                                                style={{
                                                    top: `${startMin}px`,
                                                    height: `${duration}px`
                                                }}
                                            >
                                                <div className="font-semibold text-indigo-900 dark:text-indigo-100 truncate flex gap-1 items-center">
                                                    {event.image && <ImageIcon size={10}/>}
                                                    {event.title}
                                                </div>
                                                <div className="text-indigo-700 dark:text-indigo-300 truncate">
                                                    {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // --- Main Render ---

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 z-20 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={handleToday} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Today
            </button>
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <button onClick={handlePrev} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><ChevronLeft size={20}/></button>
                <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><ChevronRight size={20}/></button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white min-w-[150px]">
                {format(currentDate, 'MMMM yyyy')}
            </h2>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button 
                onClick={() => setView('day')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'day' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
            >
                Day
            </button>
            <button 
                onClick={() => setView('week')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'week' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
            >
                Week
            </button>
            <button 
                onClick={() => setView('month')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'month' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
            >
                Month
            </button>
        </div>

        <button 
            onClick={() => openModal()} 
            className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center gap-2 font-medium transition-all"
        >
            <Plus size={18} />
            <span className="hidden sm:inline">Create</span>
        </button>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'month' && <MonthView />}
        {(view === 'week' || view === 'day') && <TimeGrid type={view} />}
      </div>

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                        Add to {selectedSlot ? format(selectedSlot.start, 'MMM d') : ''}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                    <input 
                        autoFocus
                        type="text"
                        placeholder="Add title"
                        value={newItemTitle}
                        onChange={e => setNewItemTitle(e.target.value)}
                        className="w-full text-2xl font-bold bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-white"
                    />

                    <div className="flex gap-2">
                         <button 
                            type="button" 
                            onClick={() => setNewItemType('event')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${newItemType === 'event' ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}
                         >
                             Event
                         </button>
                         <button 
                            type="button" 
                            onClick={() => setNewItemType('task')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${newItemType === 'task' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}
                         >
                             Task
                         </button>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <Clock size={18} className="text-gray-400" />
                        <div className="flex gap-2 items-center flex-1">
                            <input 
                                type="time" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span>-</span>
                            <input 
                                type="time" 
                                value={endTime} 
                                onChange={e => setEndTime(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {newItemType === 'event' && (
                        <>
                            <div className="flex items-start gap-4 text-sm text-gray-600 dark:text-gray-300">
                                <AlignLeft size={18} className="text-gray-400 mt-1" />
                                <textarea 
                                    value={newItemDesc}
                                    onChange={e => setNewItemDesc(e.target.value)}
                                    placeholder="Add description"
                                    rows={3}
                                    className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                <MapPin size={18} className="text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Add location" 
                                    className="flex-1 bg-transparent border-b border-gray-200 dark:border-gray-700 py-1 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                         <ImageIcon size={18} className="text-gray-400" />
                         <label className="flex-1 cursor-pointer hover:text-indigo-500 transition-colors flex items-center gap-2">
                             {newItemImage ? 'Change Image' : 'Add Attachment'}
                             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                         </label>
                         {newItemImage && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative group">
                                <img src={newItemImage} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setNewItemImage('')} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white">
                                    <X size={12} />
                                </button>
                            </div>
                         )}
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors font-medium"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default CalendarApp;
