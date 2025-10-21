import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogService } from '../services/catalogService';
import { debounce } from '../utils/debounce';

export const SearchBar: React.FC<{ placeholder?: string; className?: string }> = ({ placeholder = 'Search products…', className = '' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<{ term: string; filters: Record<string, any>; ts: string }[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const clientId = useMemo(() => {
    const key = 'sj-client-id';
    let cid = localStorage.getItem(key);
    if (!cid) { cid = Math.random().toString(36).slice(2); localStorage.setItem(key, cid); }
    return cid;
  }, []);

  useEffect(() => {
    catalogService.recent(clientId).then(setRecent).catch(()=>{});
  }, [clientId]);

  // Track mobile breakpoint and dropdown anchor position
  useEffect(() => {
    const recompute = () => {
      setIsMobile(window.innerWidth < 768);
      if (boxRef.current) {
        const r = boxRef.current.getBoundingClientRect();
        setDropdownStyle({ top: r.bottom + 6, left: r.left, width: r.width });
      }
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, []);

  // Recompute on open or query change
  useEffect(() => {
    if (open) {
      if (boxRef.current) {
        const r = boxRef.current.getBoundingClientRect();
        setDropdownStyle({ top: r.bottom + 6, left: r.left, width: r.width });
      }
    }
  }, [open, q]);

  const fetchSuggestions = useMemo(() => debounce(async (term: string) => {
    if (!term.trim()) { setSuggestions([]); return; }
    try {
      const data = await catalogService.suggestions(term, 7);
      // Dedupe client-side as a safeguard
      const seen = new Set<string>();
      const unique = [] as string[];
      for (const s of data) {
        const key = s.trim().toLowerCase();
        if (key && !seen.has(key)) { seen.add(key); unique.push(s); }
        if (unique.length >= 7) break;
      }
      setSuggestions(unique);
    } catch (err) {
      console.error('suggestions fetch failed', err);
    }
  }, 200), []);

  useEffect(() => {
    fetchSuggestions(q);
  }, [q]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const goSearch = (term: string) => {
    const sp = new URLSearchParams();
    if (term) sp.set('q', term);
    navigate(`/search?${sp.toString()}`);
    setOpen(false);
  };

  const highlight = (text: string, query: string) => {
    const t = text || '';
    const ql = query.trim();
    if (!ql) return t;
    try {
      const idx = t.toLowerCase().indexOf(ql.toLowerCase());
      if (idx === -1) return t;
      const before = t.slice(0, idx);
      const match = t.slice(idx, idx + ql.length);
      const after = t.slice(idx + ql.length);
      return (
        <>
          {before}
          <strong>{match}</strong>
          {after}
        </>
      );
    } catch {
      return t;
    }
  };

  const dropdownNode = (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      {q ? (
        <div>
          {suggestions.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No suggestions</div>
          ) : (
            <>
              {suggestions.map((s, idx) => (
                <button key={`${s}-${idx}`} onClick={()=>goSearch(s)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                  {highlight(s, q)}
                </button>
              ))}
              <div className="border-t border-gray-100" />
              <button onClick={()=>goSearch(q)} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-50">
                View all results for "{q}"
              </button>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-gray-500">Recent searches</div>
          {recent.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No recent searches</div>
          ) : recent.map((r, idx) => (
            <button key={idx} onClick={()=>goSearch(r.term)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
              {highlight(r.term, q)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input
          value={q}
          onChange={(e)=>{ setQ(e.target.value); if (!open) setOpen(true); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); goSearch(q); } }}
          placeholder={placeholder}
          className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-400"
        />
        {q && (
          <button className="text-gray-400 hover:text-gray-600" onClick={()=>setQ('')}>×</button>
        )}
        <button onClick={()=>goSearch(q)} className="ml-1 px-3 py-1 rounded-full bg-gray-900 text-white text-sm">Search</button>
      </div>

      {open && (
        <>
          {/* Desktop/tablet: anchored portal dropdown */}
          {!isMobile && dropdownStyle && createPortal(
            <div
              style={{ position: 'fixed', top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width, zIndex: 2147483647 }}
            >
              {dropdownNode}
            </div>,
            document.body
          )}

          {/* Mobile: full-screen modal */}
          {isMobile && createPortal(
            <div className="fixed inset-0 z-[2147483647] bg-black/40" onClick={()=>setOpen(false)}>
              <div className="absolute inset-x-0 top-0 mt-16 mx-3" onClick={(e)=>e.stopPropagation()}>
                {dropdownNode}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
};
