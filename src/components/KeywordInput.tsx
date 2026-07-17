"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/axios";
import { X, Search, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface KeywordInputProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  min?: number;
}

export default function KeywordInput({ selected, onChange, error, min }: KeywordInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameCache = useRef<Map<string, string>>(new Map());
  const idByName = useRef<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    if (selected.length === 0) {
      setReady(true);
      return;
    }
    api.get("/keywords", { params: { limit: 200 } })
      .then((res) => {
        const all: { id: string; name: string }[] = res.data.data || [];
        for (const kw of all) {
          nameCache.current.set(kw.id, kw.name);
          idByName.current.set(kw.name.toLowerCase(), kw.id);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [selected, ready]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest-keywords?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        const words: string[] = data.suggestions || [];

        const lower = value.toLowerCase();
        const filtered = words.filter(
          (w) => w.toLowerCase().includes(lower) && !idByName.current.has(w.toLowerCase()),
        );

        setSuggestions(filtered);
        setIsOpen(filtered.length > 0 || lower.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function addKeyword(name: string) {
    const lower = name.toLowerCase();
    const existingId = idByName.current.get(lower);

    if (existingId) {
      if (selected.includes(existingId)) return;
      onChange([...selected, existingId]);
    } else {
      setCreating(name);
      try {
        const res = await api.post("/keywords", { name });
        const newKw: { id: string; name: string } = res.data.data;
        nameCache.current.set(newKw.id, newKw.name);
        idByName.current.set(newKw.name.toLowerCase(), newKw.id);
        onChange([...selected, newKw.id]);
      } catch {
        const tempId = `__new_${Date.now()}`;
        nameCache.current.set(tempId, name);
        onChange([...selected, tempId]);
      } finally {
        setCreating(null);
      }
    }

    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeKeyword(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  function getName(id: string): string {
    return nameCache.current.get(id) || id;
  }

  const showCreate = query.trim().length > 0 && !loading && suggestions.length === 0;

  const insufficient = min !== undefined && selected.length < min;
  const hasError = insufficient || !!error;

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash mb-2">
        Keyword <span className="text-ash-2 normal-case tracking-normal">(minimal {min ?? 0})</span>
      </label>

      <div className="relative">
        <div
          className={cn(
            "w-full border hairline border-solid rounded-[3px] bg-card-2 px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 items-center cursor-text transition-colors focus-within:border-safelight focus-within:ring-2 focus-within:ring-safelight/15",
            hasError && "border-safelight-dim focus-within:border-safelight-dim focus-within:ring-safelight-dim/15",
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 bg-ink/[0.06] px-2 py-1 rounded-[3px] text-xs"
            >
              {getName(id)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeKeyword(id);
                }}
                className="text-ash-2 hover:text-safelight-dim"
                aria-label="Hapus"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder={selected.length === 0 ? "Cari keyword dari Google…" : ""}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-ink placeholder:text-ash-2"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 text-ash-2 animate-spin" />}
        </div>

        {(isOpen && suggestions.length > 0) || showCreate ? (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-paper border hairline border-solid rounded-[3px] shadow-[0_8px_24px_rgba(16,15,13,0.12)] max-h-60 overflow-y-auto"
          >
            {suggestions.map((name) => {
              const lower = name.toLowerCase();
              const alreadyAdded = idByName.current.has(lower) && selected.includes(idByName.current.get(lower)!);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => addKeyword(name)}
                  disabled={alreadyAdded}
                  className="flex items-center w-full text-left px-4 py-2 hover:bg-ink/[0.04] text-sm gap-2 disabled:opacity-40"
                >
                  <Search className="w-3.5 h-3.5 text-ash-2 shrink-0" />
                  <span className="text-ink">{name}</span>
                  {alreadyAdded && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ash-2">
                      Dipilih
                    </span>
                  )}
                </button>
              );
            })}
            {showCreate && (
              <button
                type="button"
                onClick={() => addKeyword(query.trim())}
                disabled={creating !== null}
                className="flex items-center w-full text-left px-4 py-2 hover:bg-ink/[0.04] text-sm gap-2 border-t hairline border-solid"
              >
                {creating === query.trim() ? (
                  <Loader2 className="w-3.5 h-3.5 text-ash-2 animate-spin shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-safelight shrink-0" />
                )}
                <span className="text-ink">
                  Buat keyword <strong>&quot;{query.trim()}&quot;</strong>
                </span>
              </button>
            )}
          </div>
        ) : null}
      </div>

      {hasError && (
        <p className="mt-1.5 text-safelight-dim text-xs font-mono">
          {error || `Keyword minimal ${min} (sekarang ${selected.length})`}
        </p>
      )}
    </div>
  );
}