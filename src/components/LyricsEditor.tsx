import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Bold, Italic, Palette, Type, Undo, Redo, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface LyricsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const PRESET_COLORS = [
  { name: 'Preto', value: '#000000' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Roxo', value: '#9333ea' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Marrom', value: '#92400e' },
];

const ToolbarButton = ({ 
  onClick, 
  isActive, 
  disabled, 
  title, 
  shortcut,
  children 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean;
  title: string;
  shortcut?: string;
  children: React.ReactNode;
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 p-0 transition-colors',
            isActive && 'bg-primary/20 text-primary hover:bg-primary/30'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>{title}</p>
        {shortcut && <p className="text-muted-foreground">{shortcut}</p>}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const MenuBar = ({ editor }: { editor: any }) => {
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  
  if (!editor) return null;

  const handleColorSelect = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setColorPopoverOpen(false);
  };

  return (
    <div className="flex items-center gap-0.5 p-1.5 border-b border-border bg-muted/30 rounded-t-lg flex-wrap">
      {/* Formatting group */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrito"
          shortcut="Ctrl+B"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Itálico"
          shortcut="Ctrl+I"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Cor do texto"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-background border border-border shadow-lg z-50" align="start">
            <p className="text-xs text-muted-foreground mb-2">Selecione uma cor:</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleColorSelect(color.value)}
                  className={cn(
                    'w-7 h-7 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50',
                    editor.isActive('textStyle', { color: color.value })
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-transparent hover:border-border'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setColorPopoverOpen(false);
              }}
              className="w-full mt-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
            >
              Remover cor
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      {/* History group */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Desfazer"
          shortcut="Ctrl+Z"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Refazer"
          shortcut="Ctrl+Shift+Z"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-border mx-1" />
      
      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        title="Limpar formatação"
      >
        <Type className="h-4 w-4" />
      </ToolbarButton>

      {/* Help text - hidden on very small screens */}
      <div className="hidden sm:flex items-center ml-auto">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <AlignLeft className="h-3 w-3" />
          Selecione texto para formatar
        </span>
      </div>
    </div>
  );
};

// Convert plain text with formatting markers to HTML
const textToHtml = (text: string): string => {
  if (!text) return '';
  
  // If it already looks like proper HTML with p tags and formatting, return as-is
  if (text.includes('<p>') && (text.includes('<strong>') || text.includes('<em>') || text.includes('<span'))) {
    return text;
  }
  
  // Convert formatting markers to HTML
  let html = text
    // Convert <b>...</b> to <strong>...</strong>
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    // Convert <i>...</i> to <em>...</em>
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    // Convert <color:#hex>...</color> to <span style="color: #hex">...</span>
    .replace(/<color:(#[a-fA-F0-9]{6})>(.*?)<\/color>/g, '<span style="color: $1">$2</span>');
  
  // Split into lines and wrap in paragraphs
  return html
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');
};

// Convert HTML back to plain text with formatting markers for storage
const htmlToText = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Process the HTML to extract text with formatting markers
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    let content = Array.from(el.childNodes).map(processNode).join('');
    
    // Handle formatting tags
    if (tagName === 'strong' || tagName === 'b') {
      content = `<b>${content}</b>`;
    } else if (tagName === 'em' || tagName === 'i') {
      content = `<i>${content}</i>`;
    } else if (tagName === 'span' && el.style.color) {
      const color = el.style.color;
      // Convert rgb to hex if needed
      let hexColor = color;
      if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          hexColor = '#' + rgb.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
        }
      }
      content = `<color:${hexColor}>${content}</color>`;
    } else if (tagName === 'p') {
      content = content + '\n';
    } else if (tagName === 'br') {
      content = '\n';
    }
    
    return content;
  };
  
  return processNode(temp).replace(/\n$/, ''); // Remove trailing newline
};

export const LyricsEditor = ({ value, onChange, disabled, placeholder }: LyricsEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color,
    ],
    content: textToHtml(value),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(htmlToText(html));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-3 font-mono text-sm leading-relaxed',
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== htmlToText(editor.getHTML())) {
      editor.commands.setContent(textToHtml(value));
    }
  }, [value, editor]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  const charCount = value?.length || 0;
  const lineCount = value?.split('\n').length || 0;

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-colors",
      disabled ? "bg-muted/50 border-muted" : "border-input bg-background hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
    )}>
      {!disabled && <MenuBar editor={editor} />}
      <EditorContent 
        editor={editor} 
        className="lyrics-editor"
      />
      {value && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground flex justify-between items-center border-t border-border/50 bg-muted/20">
          <span>{lineCount} {lineCount === 1 ? 'linha' : 'linhas'}</span>
          <span>{charCount} {charCount === 1 ? 'caractere' : 'caracteres'}</span>
        </div>
      )}
      
      <style>{`
        .lyrics-editor .ProseMirror {
          min-height: 200px;
          padding: 12px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 0.875rem;
          line-height: 1.75;
        }
        .lyrics-editor .ProseMirror:focus {
          outline: none;
        }
        .lyrics-editor .ProseMirror p {
          margin: 0;
        }
        .lyrics-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: '${placeholder?.replace(/'/g, "\\'") || "Digite a letra aqui..."}';
          color: hsl(var(--muted-foreground) / 0.5);
          pointer-events: none;
          float: left;
          height: 0;
        }
        .lyrics-editor .ProseMirror strong,
        .lyrics-editor .ProseMirror b {
          font-weight: 700;
        }
        .lyrics-editor .ProseMirror em,
        .lyrics-editor .ProseMirror i {
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default LyricsEditor;
