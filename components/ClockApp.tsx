
import React, { useState, useEffect, useRef } from 'react';
import { Clock as ClockIcon, Timer, Bell, Play, Pause, RotateCcw, Plus, Trash2, X, Flag } from 'lucide-react';
import { Alarm } from '../types';
import { generateId } from '../utils';

interface ClockAppProps {
  alarms: Alarm[];
  setAlarms: React.Dispatch<React.SetStateAction<Alarm[]>>;
}

const ClockApp: React.FC<ClockAppProps> = ({ alarms, setAlarms }) => {
  const [activeTab, setActiveTab] = useState<'clock' | 'stopwatch' | 'alarm'>('clock');

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button 
          onClick={() => setActiveTab('clock')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'clock' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
        >
          <ClockIcon size={20} /> Clock
        </button>
        <button 
          onClick={() => setActiveTab('stopwatch')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'stopwatch' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
        >
          <Timer size={20} /> Stopwatch
        </button>
        <button 
          onClick={() => setActiveTab('alarm')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'alarm' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
        >
          <Bell size={20} /> Alarm
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'clock' && <WorldClock />}
        {activeTab === 'stopwatch' && <Stopwatch />}
        {activeTab === 'alarm' && <AlarmManager alarms={alarms} setAlarms={setAlarms} />}
      </div>
    </div>
  );
};

const WorldClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      <div className="space-y-2">
        <h2 className="text-8xl md:text-9xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">
          {time.toLocaleTimeString([], { hour12: false })}
        </h2>
        <p className="text-2xl text-gray-500 dark:text-gray-400 font-medium">
          {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
};

const Stopwatch = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now() - time;
      intervalRef.current = window.setInterval(() => {
        setTime(Date.now() - startTime);
      }, 10);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const toggleTimer = () => setIsRunning(!isRunning);
  
  const resetTimer = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  };

  const addLap = () => {
    setLaps([time, ...laps]);
  };

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');
    const cs = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${m}:${s}.${cs}`;
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center mb-8">
        <div className="text-7xl font-mono font-bold text-gray-900 dark:text-white mb-8 tabular-nums">
          {formatTime(time)}
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={resetTimer}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title="Reset"
          >
            <RotateCcw size={20} />
          </button>
          
          <button 
            onClick={toggleTimer}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </button>

          <button 
            onClick={addLap}
            disabled={!isRunning}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Lap"
          >
            <Flag size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border-t border-gray-100 dark:border-gray-700 pt-4">
        {laps.length > 0 && (
          <div className="space-y-2">
            {laps.map((lap, index) => (
              <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-500">Lap {laps.length - index}</span>
                <span className="font-mono text-xl">{formatTime(lap)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AlarmManager: React.FC<{ alarms: Alarm[], setAlarms: React.Dispatch<React.SetStateAction<Alarm[]>> }> = ({ alarms, setAlarms }) => {
  const [newTime, setNewTime] = useState('08:00');
  const [newLabel, setNewLabel] = useState('');

  const addAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) return;

    setAlarms([...alarms, {
      id: generateId(),
      time: newTime,
      label: newLabel || 'Alarm',
      active: true
    }]);
    setNewLabel('');
  };

  const toggleAlarm = (id: string) => {
    setAlarms(alarms.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlarm = (id: string) => {
    setAlarms(alarms.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <form onSubmit={addAlarm} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl mb-8 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Time</label>
          <input 
            type="time" 
            value={newTime} 
            onChange={e => setNewTime(e.target.value)}
            className="w-full text-3xl font-bold bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 focus:outline-none py-1 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex-[2]">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Label</label>
          <input 
            type="text" 
            value={newLabel} 
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Alarm name"
            className="w-full text-lg bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 focus:outline-none py-2 text-gray-900 dark:text-white"
          />
        </div>
        <button 
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/30"
        >
          <Plus size={24} />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-3">
        {alarms.map(alarm => (
          <div key={alarm.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700/50">
            <div>
              <div className={`text-3xl font-bold font-mono ${alarm.active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                {alarm.time}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{alarm.label}</div>
            </div>
            
            <div className="flex items-center gap-4">
               <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={alarm.active} onChange={() => toggleAlarm(alarm.id)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
              
              <button 
                onClick={() => deleteAlarm(alarm.id)}
                className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {alarms.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Bell size={40} className="mx-auto mb-2 opacity-30" />
            <p>No alarms set</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClockApp;
