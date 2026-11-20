import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/app/LangContext';

/**
 * Positions a floating menu under (or above, when there is no room) an anchor element.
 * Rendered in a portal with position: fixed so it is never clipped by modals or scroll areas.
 */
export function useFloating(open, anchorRef, { maxHeight = 300, minWidth = 0 } = {}) {
  const [style, setStyle] = useState(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < Math.min(maxHeight, 220) && above > below;
    const width = Math.max(r.width, minWidth);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    setStyle({
      position: 'fixed',
      left: Math.max(8, left),
      width,
      maxHeight: Math.min(maxHeight, (up ? above : below) - 4),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      zIndex: 70,
    });
  }, [anchorRef, maxHeight, minWidth]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return style;
}

/** Closes when clicking outside every given ref. */
export function useClickOutside(open, refs, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (refs.every((r) => !r.current?.contains(e.target))) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, refs, onClose]);
}

/** The dropdown panel + rows shared by Select, AutoComplete and Combobox. */
export function MenuList({ style, listRef, items, activeIndex, selectedValue, onPick, onHover, empty, id }) {
  if (!style) return null;
  return createPortal(
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      style={style}
      className="no-print overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-slate-900/5"
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-400">{empty}</li>}
      {items.map((o, i) => {
        const selected = o.value === selectedValue;
        return (
          <li
            key={o.value === '' ? '__empty' : o.value}
            role="option"
            aria-selected={selected}
            aria-disabled={o.disabled || undefined}
            onMouseEnter={() => onHover?.(i)}
            onClick={() => !o.disabled && onPick(o)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              o.disabled ? 'cursor-not-allowed opacity-40' : i === activeIndex ? 'bg-brand-50 text-brand-800' : 'text-slate-700'
            } ${selected ? 'font-semibold' : ''}`}
          >
            {o.dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.dot }} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block truncate text-xs font-normal text-slate-500">{o.hint}</span>}
            </span>
            {selected && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
          </li>
        );
      })}
    </ul>,
    document.body,
  );
}

function scrollActiveIntoView(listRef, index) {
  listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' });
}

/**
 * Styled replacement for <select>.
 * options: [{ value, label, hint?, dot?, disabled? }]; onChange receives the value.
 */
export default function Select({ value, onChange, options, placeholder, disabled, className = '', icon: Icon, menuWidth = 0, ...rest }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const style = useFloating(open, btnRef, { minWidth: menuWidth });
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, [btnRef, listRef], close);

  const selected = options.find((o) => o.value === value);
  const firstEnabled = (from, dir) => {
    for (let i = from; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : Math.max(0, firstEnabled(0, 1)));
    setOpen(true);
  };

  useEffect(() => {
    if (open) scrollActiveIntoView(listRef, active);
  }, [open, active]);

  const pick = (o) => {
    onChange(o.value, o);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = firstEnabled(active + dir, dir);
      if (next >= 0) setActive(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[active] && !options[active].disabled) pick(options[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`input flex items-center gap-2 text-left ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
        {...rest}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        {selected?.dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selected.dot }} />}
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder || tr('ជ្រើសរើស...', 'Select...')}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <MenuList
          style={style}
          listRef={listRef}
          items={options}
          activeIndex={active}
          selectedValue={value}
          onPick={pick}
          onHover={setActive}
          empty={tr('មិនមានជម្រើស', 'No options')}
        />
      )}
    </>
  );
}

/**
 * Free-text input with a styled suggestion list (replacement for <datalist>).
 * suggestions: string[]
 */
export function AutoComplete({ value, onChange, suggestions, className = '', ...rest }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const style = useFloating(open, inputRef);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, [wrapRef, listRef], close);

  const q = (value || '').trim().toLowerCase();
  const exact = suggestions.some((s) => s.toLowerCase() === q);
  const items = (q && !exact ? suggestions.filter((s) => s.toLowerCase().includes(q)) : suggestions).map((s) => ({ value: s, label: s }));

  useEffect(() => {
    if (open && active >= 0) scrollActiveIntoView(listRef, active);
  }, [open, active]);

  const pick = (o) => {
    onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <div ref={wrapRef} className="relative">
        <input
          ref={inputRef}
          className={`input pr-8 ${className}`}
          value={value}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? tr('បិទ', 'Close') : tr('បើក', 'Open')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!open) inputRef.current?.focus();
            setOpen(!open);
          }}
          className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-600"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && items.length > 0 && (
        <MenuList style={style} listRef={listRef} items={items} activeIndex={active} selectedValue={value} onPick={pick} onHover={setActive} empty={tr('រកមិនឃើញ', 'No results')} />
      )}
    </>
  );
}
