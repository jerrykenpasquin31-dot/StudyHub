const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, '../uploads');

function aiConfig() {
  return {
    url: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
    visionModel: process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b',
    timeout: Number(process.env.OLLAMA_TIMEOUT_MS || 180000),
    maxChars: Number(process.env.AI_MAX_INPUT_CHARS || 30000)
  };
}

async function ollamaChat(messages, model, options = {}) {
  const cfg = aiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || cfg.timeout);
  try {
    const response = await fetch(`${cfg.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.2 }
      }),
      signal: controller.signal
    });
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { data = { error: body }; }
    if (!response.ok) throw new Error(data.error || `Local AI returned HTTP ${response.status}.`);
    const text = data?.message?.content?.trim();
    if (!text) throw new Error('The local AI returned an empty summary.');
    return text;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The local AI took too long to respond. Try a shorter PDF or a smaller model.');
    if (e.code === 'ECONNREFUSED') throw new Error('Local AI is not running. Start Ollama and make sure the model is installed.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function getLocalFile(note) {
  if (!note.filename) throw new Error('The uploaded file is missing from storage.');
  const filePath = path.join(uploadsDir, path.basename(note.filename));
  if (!fs.existsSync(filePath)) throw new Error('The uploaded file could not be found on this server.');
  return filePath;
}

async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download the study material (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function getBuffer(note) {
  if (note.file_url && /^https?:\/\//i.test(note.file_url)) return downloadBuffer(note.file_url);
  return fs.readFileSync(getLocalFile(note));
}

function buildPrompt(note, text) {
  return `You are StudyHub AI, a personal study assistant for students.

Analyze ONLY the uploaded study material below. Do not invent facts or use outside information. Keep the original terminology, definitions, formulas, names, and important details from the lesson.

Create a clear student-friendly reviewer using exactly these sections:

## Summary
Write 1-3 concise paragraphs explaining the lesson.

## Key Points
Give 5-10 important bullet points. Use fewer if the lesson is short.

## Important Terms
List important terms followed by short explanations.

## Quick Review Questions
Write 3-5 questions based only on the lesson.

## Study Tip
Give one short practical tip based on the material.

Study material title: ${note.title || note.original_name || 'Untitled'}

Uploaded lesson text:
---
${text}
---`;
}

async function summarizePdf(note) {
  const buffer = await getBuffer(note);
  const parsed = await pdfParse(buffer);
  const raw = (parsed.text || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) throw new Error('This PDF does not contain readable text. A scanned/image-only PDF needs OCR before it can be summarized.');
  const cfg = aiConfig();
  const text = raw.slice(0, cfg.maxChars);
  const wasTrimmed = raw.length > cfg.maxChars;
  const prompt = buildPrompt(note, text + (wasTrimmed ? '\n\n[The lesson was shortened to fit the AI input limit. Summarize only the provided text.]' : ''));
  return ollamaChat([
    { role: 'system', content: 'You are StudyHub AI. Be accurate, concise, and educational. Never make up information.' },
    { role: 'user', content: prompt }
  ], cfg.model);
}

async function summarizeImage(note) {
  const cfg = aiConfig();
  if (!cfg.visionModel) throw new Error('No vision model is configured. Set OLLAMA_VISION_MODEL to a vision-capable Ollama model.');

  const original = await getBuffer(note);
  let optimized;
  try {
    // Large photos are automatically resized/compressed before being sent to Ollama.
    // This keeps memory use and request size reasonable while preserving readable text.
    optimized = await sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    throw new Error('This picture could not be prepared for AI summarization. Try JPG or PNG.');
  }

  const dataUrl = `data:image/jpeg;base64,${optimized.toString('base64')}`;
  const prompt = buildPrompt(note, 'Read all readable text, formulas, tables, labels, and important visual information in the attached study image. If the image is a photo of notes, extract the visible lesson content carefully.');
  return ollamaChat([
    { role: 'system', content: 'You are StudyHub AI. Read the uploaded study image and create an accurate student reviewer. Do not invent unreadable content. If text is small, use the image carefully and summarize only what is actually visible.' },
    { role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: dataUrl }
    ] }
  ], cfg.visionModel);
}

async function summarize(note) {
  const mime = String(note.mime_type || '').toLowerCase();
  const isPdf = mime === 'application/pdf' || path.extname(note.original_name || note.filename || '').toLowerCase() === '.pdf';
  if (isPdf) return summarizePdf(note);
  if (mime.startsWith('image/')) return summarizeImage(note);
  throw new Error('AI summarization currently supports PDF and image study materials.');
}

async function explainText(text, context='') {
 const cfg=aiConfig();
 const selected=String(text||'').trim().slice(0,6000);
 if(!selected) throw new Error('No text was selected.');
 const prompt=`You are StudyHub AI, a friendly study assistant. Explain the selected reviewer text in very simple student-friendly language. Stay faithful to the selected text and do not invent facts. Give: 1) Simple explanation, 2) Key idea, 3) One short example if useful.\n\nSelected text:\n${selected}\n${context?`\nReviewer context:\n${String(context).slice(0,4000)}`:''}`;
 return ollamaChat([{role:'system',content:'You are StudyHub AI. Be clear, concise, accurate and educational.'},{role:'user',content:prompt}],cfg.model,{timeout:cfg.timeout});
}

module.exports = { summarize, aiConfig, explainText };
