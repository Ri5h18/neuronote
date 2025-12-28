import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  FileText,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Edit3,
  Eye
} from 'lucide-react';

import { Note, Deck, Flashcard } from '../types';
import {
  generateFlashcardsFromNote,
  suggestTasksFromNote
} from '../services/geminiService.ts'; // or ollamaService
import { generateId } from '../utils';
import { MarkdownEditor } from './MarkdownEditor';
import { marked } from 'marked';

/* ------------------------------------------------------------------
   NOTE EDITOR
------------------------------------------------------------------ */

interface NoteEditorProps {
  note: Note;
  onSave: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  decks: Deck[];
  addFlashcards: (cards: Omit<Flashcard, 'id'>[]) => void;
  addTasks: (tasks: string[]) => void;
  onBack?: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onSave,
  onDelete,
  decks,
  addFlashcards,
  addTasks,
  onBack
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [images, setImages] = useState<string[]>(note.images || []);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isGenerating, setIsGenerating] = useState(false);

  const [isDeckSelectOpen, setIsDeckSelectOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setImages(note.images || []);
  }, [note]);

  const saveNote = useCallback(
    (updates: Partial<Note>) => {
      onSave(note.id, { ...updates, updatedAt: Date.now() });
    },
    [note.id, onSave]
  );

  const renderMarkdown = (text: string): string => {
    return marked.parse(text || '', { breaks: true }) as string;
  };

  /* ---------------- AI: FLASHCARDS ---------------- */

  const handleGenerateFlashcards = () => {
    if (!decks.length) {
      alert('Create a deck first');
      return;
    }
    setSelectedDeckId(decks[0].id);
    setIsDeckSelectOpen(true);
  };

  const confirmGenerateFlashcards = async () => {
    if (!selectedDeckId) return;

    setIsGenerating(true);
    try {
      const cards = await generateFlashcardsFromNote({
        ...note,
        title,
        content
      });

      if (!cards.length) {
        alert('No flashcards generated');
        return;
      }

      addFlashcards(
        cards.map(c => ({
          front: c.front,
          back: c.back,
          deckId: selectedDeckId,
          nextReview: Date.now(),
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0
        }))
      );

      alert(`Generated ${cards.length} flashcards`);
    } catch {
      alert('Flashcard generation failed');
    } finally {
      setIsGenerating(false);
      setIsDeckSelectOpen(false);
    }
  };

  /* ---------------- AI: TASKS ---------------- */

  const handleSuggestTasks = async () => {
    setIsGenerating(true);
    try {
      const tasks = await suggestTasksFromNote(content);
      if (tasks.length) addTasks(tasks);
      else alert('No tasks found');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <input
            value={title}
            onChange={e => {
              const val = e.target.value;
              setTitle(val);
              saveNote({ title: val, content, images });
            }}
            placeholder="Untitled Note"
            className="font-bold bg-transparent outline-none"
          />
        </div>

        <div className="flex gap-1">
          <button onClick={() => setViewMode('edit')}>
            <Edit3 size={16} />
          </button>
          <button onClick={() => setViewMode('preview')}>
            <Eye size={16} />
          </button>
          <button onClick={handleGenerateFlashcards} disabled={isGenerating}>
            <Sparkles size={16} />
          </button>
          <button onClick={handleSuggestTasks} disabled={isGenerating}>
            <CheckCircle2 size={16} />
          </button>
          <button onClick={() => onDelete(note.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {viewMode === 'edit' ? (
        <MarkdownEditor
          value={content}
          onChange={val => {
            setContent(val);
            saveNote({ title, content: val, images });
          }}
          className="flex-1"
        />
      ) : (
        <div
          className="flex-1 p-6 prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}

      {/* DECK SELECT MODAL */}
      {isDeckSelectOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
            <h3 className="font-bold mb-4">Select Deck</h3>

            <select
              value={selectedDeckId ?? ''}
              onChange={e => setSelectedDeckId(e.target.value)}
              className="w-full p-2 border mb-4"
            >
              {decks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setIsDeckSelectOpen(false)}
                className="flex-1 border py-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmGenerateFlashcards}
                className="flex-1 bg-indigo-600 text-white py-2"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------
   MAIN NOTE APP
------------------------------------------------------------------ */

interface NoteAppProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  decks: Deck[];
  addFlashcards: (cards: Omit<Flashcard, 'id'>[]) => void;
  addTasks: (tasks: string[]) => void;
}

const NoteApp: React.FC<NoteAppProps> = ({
  notes,
  setNotes,
  decks,
  addFlashcards,
  addTasks
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const createNote = () => {
    const n: Note = {
      id: generateId(),
      title: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      images: [],
      tags: []
    };

    setNotes(prev => [n, ...prev]);
    setSelectedNoteId(n.id);
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r p-2">
        <button onClick={createNote} className="w-full mb-2">
          + New Note
        </button>

        {notes.map(n => (
          <button
            key={n.id}
            onClick={() => setSelectedNoteId(n.id)}
            className="block w-full text-left truncate flex items-center gap-2"
          >
            <FileText size={14} />
            {n.title || 'Untitled'}
          </button>
        ))}
      </aside>

      <main className="flex-1">
        {selectedNote ? (
          <NoteEditor
            note={selectedNote}
            onSave={(id, up) =>
              setNotes(prev =>
                prev.map(n => (n.id === id ? { ...n, ...up } : n))
              )
            }
            onDelete={id =>
              setNotes(prev => prev.filter(n => n.id !== id))
            }
            decks={decks}
            addFlashcards={addFlashcards}
            addTasks={addTasks}
          />
        ) : (
          <div className="h-full flex items-center justify-center opacity-50">
            Select a note
          </div>
        )}
      </main>
    </div>
  );
};

export default NoteApp;
