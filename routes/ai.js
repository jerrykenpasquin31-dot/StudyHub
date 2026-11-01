const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { summarize, aiConfig, explainText } = require('../services/ai');
const router = express.Router();

router.get('/status', auth, async (req, res) => {
  const cfg = aiConfig();
  try {
    const r = await fetch(`${cfg.url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    res.json({ online: true, model: cfg.model, models });
  } catch (e) {
    res.status(503).json({ online: false, model: cfg.model, message: 'Local AI is offline. Start Ollama on the AI server.' });
  }
});

router.post('/:id/summarize', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid study material ID.' });
  try {
    const [rows] = await db.query('SELECT * FROM notes WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Study material not found.' });
    const note = rows[0];

    // Reuse an existing summary until the material is deleted/replaced.
    if (note.ai_summary && req.query.regenerate !== '1') {
      return res.json({ title: note.title, summary: note.ai_summary, cached: true, generated_at: note.ai_summary_generated_at });
    }

    const summary = await summarize(note);
    await db.query('UPDATE notes SET ai_summary=?, ai_summary_generated_at=NOW() WHERE id=?', [summary, id]);
    res.json({ title: note.title, summary, cached: false });
  } catch (e) {
    console.error('StudyHub local AI error:', e);
    res.status(400).json({ message: e.message || 'Unable to summarize this study material.' });
  }
});

router.post('/explain', auth, async (req,res)=>{
 try{
  const text=String(req.body?.text||'').trim();
  const context=String(req.body?.context||'').trim();
  if(!text)return res.status(400).json({message:'Select some reviewer text first.'});
  const explanation=await explainText(text,context);
  res.json({explanation});
 }catch(e){console.error('StudyHub AI explain error:',e);res.status(400).json({message:e.message||'Unable to explain the selected text.'});}
});

router.delete('/:id/summary', auth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await db.query('SELECT user_id FROM notes WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Study material not found.' });
    if (Number(rows[0].user_id) !== Number(req.user.id) && req.user.role !== 'admin') return res.status(403).json({ message: 'Not allowed.' });
    await db.query('UPDATE notes SET ai_summary=NULL, ai_summary_generated_at=NULL WHERE id=?', [id]);
    res.json({ message: 'AI summary cleared. It can be generated again.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
