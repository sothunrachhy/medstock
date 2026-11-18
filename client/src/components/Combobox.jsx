import { ChevronDown, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LangContext';
import { MenuList, useClickOutside, useFloating } from './Select';

/**
 * Searchable select.
 * options: [{ value, label, hint?, disabled? }]
 * onSearch: optional async (text) => options, for server-side search
 */
export default function Combobox({ options = [], value, onChange, placeholder, onSearch, selectedLabel, autoFocus, invalid }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const style = useFloating(open, inputRef, { minWidth: 280 });
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);
  useClickOutside(open, [inputRef, listRef], close);

  useEffect(() => {
    if (!onSearch || !open) return undefined;
    const t = setTimeout(() => onSearch(query).then(setRemote).catch(() => setRemote([])), 250);
    return () => clearTimeout(t);
  }, [query, open, onSearch]);

  const list = useMemo(() => {
    if (onSearch) return remote || [];
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q)) : options;
    return filtered.slice(0, 100);
  }, [options, query, remote, onSearch]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const current = options.find((o) => o.value === value) || (remote || []).find((o) => o.value === value);
  const display = current?.label || selectedLabel || '';

  const choose = (o) => {
    if (!o || o.disabled) return;
    onChange(o.value, o);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      choose(list[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      <div className="relative">
        {open && <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <input
          ref={inputRef}
          className={`input pr-8 ${open ? 'pl-9' : ''} ${invalid ? 'border-rose-400' : ''}`}
          value={open ? query : display}
          placeholder={open && display ? display : placeholder || tr('ស្វែងរក...', 'Search...')}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <ChevronDown className={`pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <MenuList
          style={style}
          listRef={listRef}
          items={list}
          activeIndex={active}
          selectedValue={value}
          onPick={choose}
          onHover={setActive}
          empty={onSearch && remote === null ? tr('កំពុងស្វែងរក...', 'Searching...') : tr('រកមិនឃើញ', 'No results')}
        />
      )}
    </>
  );
}
