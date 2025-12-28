
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { marked } from 'marked';
import { getChatResponseStream } from '../services/geminiService';
import { Note, Todo, CalendarEvent } from '../types';

interface AIChatProps {
    isOpen: boolean;
    onClose: () => void;
    notes: Note[];
    todos: Todo[];
    events: CalendarEvent[];
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, notes, todos, events }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', text: "Hi! I'm your NeuroNote assistant. I can help you summarize your notes, find tasks, or organize your schedule. What's on your mind?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Prepare history for API (exclude welcome message if purely UI, but here we keep it simple)
        const apiHistory = messages
            .filter(m => m.id !== 'welcome') // simple filter
            .map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

        try {
            const aiMsgId = (Date.now() + 1).toString();
            // Add placeholder for AI response
            setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

            let fullText = '';
            
            await getChatResponseStream(
                apiHistory, 
                userMsg.text, 
                { notes, todos, events },
                (chunk) => {
                    fullText += chunk;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m));
                }
            );

        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Sorry, I encountered an error connecting to the AI." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([{ id: 'welcome', role: 'model', text: "Chat cleared. How can I help?" }]);
    };

    // Render markdown safely
    const renderContent = (text: string) => {
        return { __html: marked.parse(text) as string };
    };

    return (
        <>
            {/* Backdrop for mobile */}
            <div 
                className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Chat Drawer */}
            <div className={`fixed top-0 right-0 h-full w-full md:w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white">Neuro AI</h2>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> Online
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={clearChat} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Clear Chat">
                            <Trash2 size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>
                            
                            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div 
                                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm markdown-preview ${
                                        msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    {msg.text ? (
                                        <div dangerouslySetInnerHTML={renderContent(msg.text)} className={msg.role === 'user' ? 'prose-invert' : 'dark:prose-invert'} />
                                    ) : (
                                        <div className="flex gap-1 h-5 items-center px-1">
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <form onSubmit={handleSend} className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about your notes or tasks..."
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-md"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-gray-400 mt-2">
                        AI can make mistakes. Verify important info.
                    </p>
                </div>
            </div>
        </>
    );
};
