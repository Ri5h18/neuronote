
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check, Circle, Trash2, Calendar as CalIcon, Tag, Image as ImageIcon, X } from 'lucide-react';
import { Todo } from '../types';
import { format, isToday, isTomorrow } from 'date-fns';
import { generateId, compressImage } from '../utils';

interface TodoAppProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
}

const TodoApp: React.FC<TodoAppProps> = ({ todos, setTodos }) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDate, setNewTodoDate] = useState<string>(''); // YYYY-MM-DD
  const [newTodoImage, setNewTodoImage] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  
  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    
    const dueDate = newTodoDate ? new Date(newTodoDate).getTime() : Date.now();

    const newTodo: Todo = {
      id: generateId(),
      text: newTodoText,
      completed: false,
      priority: 'medium',
      dueDate: dueDate,
      image: newTodoImage || undefined
    };
    setTodos([newTodo, ...todos]);
    setNewTodoText('');
    setNewTodoDate('');
    setNewTodoImage('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const compressed = await compressImage(file);
              setNewTodoImage(compressed);
          } catch (e) {
              console.error(e);
          }
      }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = () => {
    if (editingId) {
      setTodos(todos.map(t => t.id === editingId ? { ...t, text: editText } : t));
      setEditingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  const filteredTodos = todos.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const formatDateLabel = (timestamp?: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'dd/MM/yyyy');
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col flex-1 overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Tasks</h1>
          
          <form onSubmit={addTodo} className="relative group">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all p-2">
                    <Plus className="text-gray-400 ml-2" size={24} />
                    <input
                        type="text"
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        placeholder="Add a new task..."
                        className="flex-1 bg-transparent py-2 px-2 focus:outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 h-10"
                    />
                    
                    <label className={`cursor-pointer p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${newTodoImage ? 'text-indigo-500' : 'text-gray-400'}`}>
                        <ImageIcon size={20} />
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>

                    <div className="relative flex items-center border-l border-gray-200 dark:border-gray-700 pl-2">
                        <CalIcon size={16} className="text-gray-400 absolute left-4 pointer-events-none" />
                        <input 
                            type="text" 
                            onFocus={(e) => e.currentTarget.type = 'date'}
                            onBlur={(e) => { if(!e.currentTarget.value) e.currentTarget.type = 'text'; }}
                            placeholder="dd/mm/yyyy"
                            value={newTodoDate}
                            onChange={(e) => setNewTodoDate(e.target.value)}
                            className="bg-transparent text-sm text-gray-500 dark:text-gray-400 focus:outline-none pl-8 pr-2 h-10 w-36 cursor-pointer"
                        />
                    </div>
                </div>
                {newTodoImage && (
                    <div className="relative w-fit">
                        <img src={newTodoImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                        <button type="button" onClick={() => setNewTodoImage('')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md">
                            <X size={12} />
                        </button>
                    </div>
                )}
            </div>
            <button type="submit" className="hidden">Add</button>
          </form>

          <div className="flex gap-4 mt-6 text-sm font-medium">
            <button 
              onClick={() => setFilter('all')} 
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === 'active' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === 'completed' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredTodos.map(todo => (
            <div 
              key={todo.id}
              className={`group flex items-start justify-between p-4 rounded-xl transition-all ${
                todo.completed 
                ? 'bg-gray-50 dark:bg-gray-800/30 opacity-60' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-sm border border-gray-100 dark:border-gray-700/50'
              }`}
            >
              <div className="flex items-start gap-4 flex-1">
                <button 
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-6 h-6 mt-1 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    todo.completed 
                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                    : 'border-gray-300 dark:border-gray-500 text-transparent hover:border-emerald-500'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>

                {editingId === todo.id ? (
                    <input 
                        ref={editInputRef}
                        type="text" 
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-b-2 border-primary-500 focus:outline-none text-lg text-gray-800 dark:text-gray-200"
                    />
                ) : (
                    <div className="flex-1 cursor-text" onClick={() => startEditing(todo)}>
                         <span className={`text-lg ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            {todo.text}
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                            {todo.dueDate && (
                                <div className="flex items-center gap-1">
                                    <CalIcon size={12} />
                                    <span>{formatDateLabel(todo.dueDate)}</span>
                                </div>
                            )}
                        </div>

                        {todo.image && (
                            <div className="mt-2">
                                <img src={todo.image} alt="Task attachment" className="h-32 rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
                            </div>
                        )}
                    </div>
                )}
              </div>
              
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          {filteredTodos.length === 0 && (
            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p>No tasks found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoApp;
