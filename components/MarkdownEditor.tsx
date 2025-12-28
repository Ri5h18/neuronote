
import React, { useRef, useState, useEffect } from 'react';
import { 
    Bold, Italic, Strikethrough, Heading, Link, List, 
    Quote, Code, Image as ImageIcon, Eye, EyeOff, 
    ListOrdered, Superscript, Table as TableIcon, AlertTriangle
} from 'lucide-react';
import { marked } from 'marked';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, onBlur, placeholder, className }) => {
    const [isPreview, setIsPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Internal state to manage cursor position correctly during typing
    // We sync this with props.value when it changes externally (e.g. initial load)
    const [internalValue, setInternalValue] = useState(value);

    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        onChange(newValue);
    };

    const insertFormat = (startTag: string, endTag: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        // Use current value directly to avoid any state de-sync during rapid interaction
        const text = textarea.value; 
        const selectedText = text.substring(start, end);
        
        const newText = text.substring(0, start) + startTag + selectedText + endTag + text.substring(end);
        
        setInternalValue(newText);
        onChange(newText);
        
        // Restore focus and set new selection range
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + startTag.length, end + startTag.length);
        }, 0);
    };

    const insertList = (type: 'bullet' | 'ordered') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        // Find the start of the line where the selection begins
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        
        // Find the end of the line where the selection ends
        let lineEnd = text.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = text.length;

        // Extract the lines involved in the selection
        const content = text.substring(lineStart, lineEnd);
        const lines = content.split('\n');

        const newLines = lines.map((line, index) => {
            // Regex to strip existing list markers (numbers, bullets, etc) to avoid duplication/nesting issues
            // Matches "1. ", "10. ", "- ", "* ", "+ " at the start of the string
            const cleanLine = line.replace(/^(\s*)(\d+\.|-|\*|\+)\s+/, '$1');
            
            if (type === 'ordered') {
                return `${index + 1}. ${cleanLine}`;
            }
            return `- ${cleanLine}`;
        });

        const newContent = newLines.join('\n');
        const newText = text.substring(0, lineStart) + newContent + text.substring(lineEnd);

        setInternalValue(newText);
        onChange(newText);

        setTimeout(() => {
            textarea.focus();
            // Select the newly formatted block so user can see changes
            textarea.setSelectionRange(lineStart, lineStart + newContent.length);
        }, 0);
    };

    // Use onMouseDown with preventDefault to keep focus on textarea when clicking buttons
    const handleToolbarAction = (e: React.MouseEvent, action: () => void) => {
        e.preventDefault();
        action();
    };

    const getPreviewHtml = () => {
        try {
             let result = marked.parse(internalValue || '', { breaks: true });
             // Ensure we return a string (marked can theoretically return a Promise in some configs)
             if (typeof result !== 'string') result = internalValue;
             
             // Add basic wiki-link visual support to match NoteApp styling (though non-functional in this preview)
             result = (result as string).replace(/\[\[(.*?)\]\]/g, '<span class="text-indigo-600 dark:text-indigo-400 font-medium">$1</span>');

             return result;
        } catch (e) {
            return internalValue; 
        }
    };

    return (
        <div className={`flex flex-col rounded-xl overflow-hidden ${className}`}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('**', '**'))} icon={<Bold size={16} />} tooltip="Bold" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('*', '*'))} icon={<Italic size={16} />} tooltip="Italic" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('~~', '~~'))} icon={<Strikethrough size={16} />} tooltip="Strikethrough" />
                 
                 <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
                 
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('### '))} icon={<Heading size={16} />} tooltip="Heading" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('[', '](url)'))} icon={<Link size={16} />} tooltip="Link" />
                 
                 <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertList('bullet'))} icon={<List size={16} />} tooltip="Bullet List" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertList('ordered'))} icon={<ListOrdered size={16} />} tooltip="Numbered List" />
                 
                 <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('> [!IMPORTANT]\n> '))} icon={<AlertTriangle size={16} />} tooltip="Callout" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('> '))} icon={<Quote size={16} />} tooltip="Quote" />
                 <ToolbarButton onMouseDown={(e) => handleToolbarAction(e, () => insertFormat('```\n', '\n```'))} icon={<Code size={16} />} tooltip="Code Block" />
                 
                 <div className="flex-1" />
                 
                 <button 
                    type="button"
                    onClick={() => setIsPreview(!isPreview)}
                    className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
                 >
                    {isPreview ? 'Edit' : 'Preview'}
                 </button>
            </div>

            {/* Editor/Preview */}
            <div className="flex-1 relative bg-white dark:bg-transparent">
                {isPreview ? (
                    <div className="absolute inset-0 overflow-y-auto py-4 px-4 scrollbar-thin">
                         <div 
                            className="markdown-preview prose dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: getPreviewHtml() as string }}
                         />
                         {(!internalValue || internalValue.trim() === '') && (
                             <p className="text-gray-400 italic">Nothing to preview</p>
                         )}
                    </div>
                ) : (
                    <textarea
                        ref={textareaRef}
                        value={internalValue}
                        onChange={handleChange}
                        onBlur={onBlur}
                        placeholder={placeholder || "Start typing..."}
                        className="w-full h-full py-4 px-4 bg-transparent resize-none focus:outline-none text-gray-800 dark:text-gray-200 font-mono text-base leading-relaxed"
                    />
                )}
            </div>
        </div>
    );
}

const ToolbarButton: React.FC<{ onMouseDown: (e: React.MouseEvent) => void; icon: React.ReactNode; tooltip: string }> = ({ onMouseDown, icon, tooltip }) => (
    <button 
        type="button"
        onMouseDown={onMouseDown}
        title={tooltip}
        className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
    >
        {icon}
    </button>
);
