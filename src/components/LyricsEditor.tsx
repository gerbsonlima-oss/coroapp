import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Bold, Italic, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

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

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 p-2 border-b border-primary/20 bg-secondary/30 rounded-t-lg">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('bold') && 'bg-primary/20 text-primary'
        )}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('italic') && 'bg-primary/20 text-primary'
        )}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Popover>
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
          <div className="grid grid-cols-4 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => editor.chain().focus().setColor(color.value).run()}
                className={cn(
                  'w-8 h-8 rounded-md border-2 transition-all hover:scale-110',
                  editor.isActive('textStyle', { color: color.value })
                    ? 'border-primary ring-2 ring-primary/50'
                    : 'border-border/50'
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="w-full mt-2 px-2 py-1 text-xs text-muted-foreground hover:bg-secondary rounded"
          >
            Remover cor
          </button>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-border mx-1" />

      <span className="text-xs text-muted-foreground">
        Selecione o texto e aplique formatação
      </span>
    </div>
  );
};

// Convert plain text to HTML (preserving line breaks)
const textToHtml = (text: string): string => {
  if (!text) return '';
  
  // If it already looks like HTML, return as-is
  if (text.includes('<p>') || text.includes('<strong>') || text.includes('<em>')) {
    return text;
  }
  
  // Convert plain text to HTML paragraphs
  return text
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

  return (
    <div className="border border-primary/20 rounded-lg overflow-hidden bg-secondary/30">
      <MenuBar editor={editor} />
      <EditorContent 
        editor={editor} 
        className="lyrics-editor"
      />
      {value && (
        <div className="px-3 pb-2 text-xs text-muted-foreground text-right border-t border-primary/10">
          {value.length} caracteres
        </div>
      )}
      
      <style>{`
        .lyrics-editor .ProseMirror {
          min-height: 200px;
          padding: 12px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 0.875rem;
          line-height: 1.625;
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
      `}</style>
    </div>
  );
};

export default LyricsEditor;
