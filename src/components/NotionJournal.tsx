import { useEffect, useRef, useState } from "react";
import { Heading2, List, Type, Quote, Hash } from "lucide-react";

interface NotionJournalProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

type BlockType = "paragraph" | "heading_2" | "bulleted_list" | "quote";

interface Block {
  id: string;
  type: BlockType;
  text: string;
}

function parseBlocks(value: string): Block[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Block[];
    if (Array.isArray(parsed) && parsed.every((b) => b && typeof b.id === "string" && typeof b.text === "string")) {
      return parsed;
    }
  } catch {
    // Not JSON — treat as plain text.
  }
  return value.split("\n").filter(Boolean).map((line) => ({ id: cryptoId(), type: "paragraph", text: line }));
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function serialize(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

const toolbar: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: "paragraph", label: "Texto", icon: <Type className="h-4 w-4" /> },
  { type: "heading_2", label: "Encabezado", icon: <Heading2 className="h-4 w-4" /> },
  { type: "bulleted_list", label: "Lista", icon: <List className="h-4 w-4" /> },
  { type: "quote", label: "Cita", icon: <Quote className="h-4 w-4" /> },
];

export function NotionJournal({ value, onChange, placeholder }: NotionJournalProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(value));

  // Keep blocks in sync if the parent passes a new value (e.g. after save).
  useEffect(() => {
    setBlocks(parseBlocks(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function updateBlock(id: string, text: string) {
    const next = blocks.map((b) => (b.id === id ? { ...b, text } : b));
    setBlocks(next);
    onChange(serialize(next));
  }

  function changeType(id: string, type: BlockType) {
    const next = blocks.map((b) => (b.id === id ? { ...b, type } : b));
    setBlocks(next);
    onChange(serialize(next));
  }

  function addBlock() {
    const next: Block[] = [...blocks, { id: cryptoId(), type: "paragraph", text: "" }];
    setBlocks(next);
    onChange(serialize(next));
  }

  function removeBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    onChange(serialize(next));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-glass backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <Hash className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">Diario de entrenamiento</h3>
      </div>

      <div className="space-y-2">
        {blocks.length === 0 && (
          <p className="px-2 py-2 text-sm text-neutral-500">{placeholder ?? "Escribe sobre tu sesion..."}</p>
        )}
        {blocks.map((block) => (
          <JournalBlock
            key={block.id}
            block={block}
            onChange={updateBlock}
            onChangeType={changeType}
            onRemove={removeBlock}
          />
        ))}
        <button
          type="button"
          onClick={addBlock}
          className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:border-accent/50 hover:text-neutral-200"
        >
          + Agregar bloque
        </button>
      </div>
    </div>
  );
}

function JournalBlock({
  block,
  onChange,
  onChangeType,
  onRemove,
}: {
  block: Block;
  onChange: (id: string, text: string) => void;
  onChangeType: (id: string, type: BlockType) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text]);

  return (
    <div className="group flex gap-2">
      <select
        value={block.type}
        onChange={(e) => onChangeType(block.id, e.target.value as BlockType)}
        className="self-start rounded-md border border-white/10 bg-neutral-950/60 px-1.5 py-1 text-[11px] text-neutral-400 outline-none focus:border-accent"
      >
        {toolbar.map((t) => (
          <option key={t.type} value={t.type}>{t.label}</option>
        ))}
      </select>
      <div className="relative flex-1">
        <textarea
          ref={ref}
          value={block.text}
          onChange={(e) => onChange(block.id, e.target.value)}
          placeholder="Escribe..."
          rows={1}
          className="w-full resize-none rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          className="absolute right-2 top-2 text-[11px] text-neutral-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}