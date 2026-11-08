import { Router } from 'express';
import { z } from 'zod';
import { db, q } from '../db.js';
import { optionalAuth, requireAuth } from '../security/auth.js';
import { limit } from '../security/rateLimit.js';
import { streamChat } from '../features/chat.js';

const r = Router();
const Body = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).min(1).max(40),
  persona: z.string().max(40).optional(),
});

// Signed-in users only: anonymous requests get 401 before any AI call is made.
r.post('/chat', requireAuth, limit('chat'), async (req, res) => {
  const p = Body.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Message too long or empty.' });
  let profile = null; let top3 = []; let profileId = null;
  const toTop = (picks) => (picks || []).map((x) => ({ slug: x.tool.slug, name: x.tool.name, price: x.tool.price_text, fit: x.fit_label }));
  if (req.user) {
    const prof = await q(db().from('profiles').select('id,structured').eq('user_id', req.user.id).eq('is_current', true).maybeSingle());
    if (prof) {
      profile = prof.structured; profileId = prof.id;
      const recs = await q(db().from('recommendations').select('rank,tools(slug,name)').eq('profile_id', prof.id).order('rank'));
      top3 = recs.map((x) => ({ slug: x.tools.slug, name: x.tools.name }));
    }
  } else if (p.data.persona) {
    const d = await q(db().from('demo_personas').select('structured,results').eq('slug', p.data.persona).maybeSingle());
    if (d) { profile = d.structured; top3 = toTop(d.results?.picks); }
  }
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const last = p.data.messages[p.data.messages.length - 1];
  try {
    const text = await streamChat({ history: p.data.messages, profile, top3, userId: req.user?.id, send });
    if (req.user && last.role === 'user') {
      await q(db().from('chat_messages').insert([
        { user_id: req.user.id, profile_id: profileId, role: 'user', content: last.content },
        ...(text ? [{ user_id: req.user.id, profile_id: profileId, role: 'assistant', content: text }] : []),
      ]));
    }
  } catch (e) {
    console.error('chat error', e.message);
    send({ type: 'fallback', text: 'The helper is busy right now. You can still browse your results and the marketplace.' });
  }
  send({ type: 'done' });
  res.end();
});

r.get('/chat/history', optionalAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.json({ messages: [] });
  const rows = await q(db().from('chat_messages').select('role,content,created_at').eq('user_id', req.user.id).in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(20));
  res.json({ messages: rows.reverse() });
});

export default r;
