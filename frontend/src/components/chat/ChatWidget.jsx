import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { streamChat } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ChatMessage } from './ChatMessage';

const PersonaCtx = createContext({ persona: null, setPersona: () => {} });
export function ChatPersonaProvider({ children }) {
  const [persona, setPersona] = useState(null);
  return <PersonaCtx.Provider value={{ persona, setPersona }}>{children}</PersonaCtx.Provider>;
}
export function useChatPersona(slug) {
  const { setPersona } = useContext(PersonaCtx);
  useEffect(() => { setPersona(slug); return () => setPersona(null); }, [slug, setPersona]);
}


export function ChatWidget() {
  const { user } = useAuth();
  const { persona } = useContext(PersonaCtx);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(null);
  const endRef = useRef(null);
  const formRef = useRef(null);
  const inputRef = useRef(null);
  // Grow the question box with its text: one line by default, up to two lines, then scroll inside.
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 24;
    const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const twoLines = Math.ceil(line * 2 + extra);
    el.style.height = `${Math.min(el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), twoLines)}px`;
  }, [input, open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);
  useEffect(() => { setMsgs([]); setExtra(null); }, [persona, user?.id]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim(); if (!text || busy) return;
    const history = [...msgs, { role: 'user', content: text }];
    setMsgs([...history, { role: 'assistant', content: '' }]); setInput(''); setBusy(true); setExtra(null);
    const append = (t) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + t }; return c; });
    try {
      await streamChat({ messages: history.slice(-10), ...(!user && persona ? { persona } : {}) }, (ev) => {
        if (ev.type === 'text') append(ev.text);
        if (ev.type === 'fallback') { append(ev.text); setExtra({ links: ev.links || [{ href: '/tools', label: 'Marketplace' }] }); }
        if (ev.type === 'action' && ev.action === 'refresh') setExtra({ refresh: true });
      });
    } catch (x) { append(x.message || 'The helper is busy right now.'); setExtra({ links: [{ href: '/tools', label: 'Marketplace' }] }); }
    setBusy(false);
  };

  // The helper is for signed-in owners only.
  if (!user) return null;

  return (
    <>
      {!open && pathname !== '/start' && (
        <button type="button" onClick={() => setOpen(true)} className="if-attention if-press bottom-safe-4 fixed right-4 z-50 inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full px-4 sm:bottom-5 sm:right-5 sm:rounded-2xl sm:px-5 bg-[var(--brand)] px-5 font-medium text-[var(--on-brand)] shadow-[var(--shadow-pop)] transition-colors hover:bg-[var(--brand-hover)]" aria-label="Ask a question" data-testid="chat-launcher-button">
          <MessageCircle className="h-5 w-5" /><span className="hidden sm:inline">Ask a question</span>
        </button>
      )}
      {open && (
        <div className="if-fade-up fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] max-h-[88vh] flex-col overflow-hidden rounded-t-[1.6rem] border border-[var(--line)] bg-surface shadow-[var(--shadow-pop)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(78dvh,760px)] sm:max-h-none sm:w-[460px] sm:rounded-2xl" role="dialog" aria-label="APEX helper" data-testid="chat-panel">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-warm)] px-4 py-3">
            <div><p className="font-display font-bold">Helper</p><p className="text-xs text-[var(--ink-2)]">{persona && !user ? 'Talking about the sample business' : 'Answers from our tool catalog'}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="if-btn-quiet min-h-10" aria-label="Close helper" data-testid="chat-close-button"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" data-testid="chat-messages">
            {!msgs.length && <p className="rounded-xl bg-[var(--surface-warm)] p-3 text-sm text-[var(--ink-2)]">Hi! Ask me about tools — for example “Which booking tools have a free plan?” or “Does Jobber work with QuickBooks?”</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-3 text-[0.95rem] ${m.role === 'user' ? 'ml-auto max-w-[85%] whitespace-pre-wrap bg-[var(--brand)] text-[var(--on-brand)]' : 'max-w-[94%] border border-[var(--line)] bg-[var(--surface-warm)]'}`} data-testid={`chat-message-${m.role}`}>
                {!m.content ? <Loader2 className="h-4 w-4 animate-spin" /> : m.role === 'user' ? m.content : <ChatMessage content={m.content} />}
              </div>
            ))}
            {extra?.links && <div className="flex flex-wrap gap-2">{extra.links.map((l) => <Link key={l.href} to={l.href} className="if-chip border-[var(--line)] bg-surface" onClick={() => setOpen(false)}>{l.label}</Link>)}</div>}
            {extra?.refresh && user && <button type="button" className="if-btn-primary min-h-11 w-full" onClick={() => { setOpen(false); nav('/dashboard', { state: { refresh: Date.now() } }); }} data-testid="chat-refresh-results-button">Refresh my results</button>}
            <div ref={endRef} />
          </div>
          <form ref={formRef} onSubmit={send} className="flex items-end gap-2 border-t border-[var(--line)] p-3">
            <textarea ref={inputRef} rows={1} className="if-input min-h-11 resize-none overflow-y-auto py-2.5 leading-6" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); formRef.current?.requestSubmit(); } }}
              maxLength={1500} placeholder="Type your question" aria-label="Your question" data-testid="chat-input" />
            <button type="submit" className="if-btn-primary min-h-11 px-4" disabled={busy || !input.trim()} aria-label="Send" data-testid="chat-send-button"><Send className="h-4 w-4" /></button>
          </form>
          <p className="pb-safe px-4 text-[11px] text-[var(--ink-3)]">The helper can make mistakes. Tool pages list the sources.</p>
        </div>
      )}
    </>
  );
}
