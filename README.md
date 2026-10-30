# StudyHub — Public AI Summarization Edition

StudyHub is a student note/reviewer sharing web app with a **self-hosted StudyHub AI** feature. The AI is not OpenAI and does not require an OpenAI API key. The recommended production setup runs an Ollama model on the same private server (or a separate private AI server) as the StudyHub backend.

## What the AI does
- Every uploaded PDF gets its own **✨ AI Summary** button.
- The backend downloads the exact uploaded file (including Cloudinary files), extracts PDF text, and sends only that lesson text to the private AI server.
- The generated summary is stored in MySQL so reopening the material does not regenerate it.
- Summary sections: Summary, Key Points, Important Terms, Quick Review Questions, and Study Tip.
- Images can also be summarized when `OLLAMA_VISION_MODEL` is configured with a vision-capable Ollama model.

## Production architecture
Browser → StudyHub backend → private Ollama server → MySQL cache → browser

Visitors **do not install Ollama**. Ollama is only installed on the server that performs AI inference.

## Recommended server AI setup
Install Ollama on your private AI server and pull the model:

```bash
ollama pull qwen2.5:1.5b
```

The server must allow the StudyHub backend to reach Ollama at `OLLAMA_URL`. For a same-machine deployment, leave the default `http://127.0.0.1:11434`.

For a separate AI server, set for example:

```env
OLLAMA_URL=http://YOUR_PRIVATE_AI_SERVER:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

Do **not** expose Ollama directly to the public internet. Put it behind a private network/firewall and let only the StudyHub backend reach it.

## Install

### Backend
```bash
cd backend
npm install
npm start
```

The server automatically adds these columns to `notes` when it starts:
- `ai_summary`
- `ai_summary_generated_at`

No manual SQL migration is required for this version.

### Environment
Copy `.env.example` to `.env` and configure your MySQL, JWT, Cloudinary, and AI values.

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=studyhub
JWT_SECRET=replace_with_a_long_random_secret

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TIMEOUT_MS=180000
AI_MAX_INPUT_CHARS=30000
# Optional for image summarization:
# OLLAMA_VISION_MODEL=qwen2.5vl:3b
```

## Public deployment notes
The website can be public while the AI stays private. The public web server should expose StudyHub's HTTPS URL, MySQL should not be public, and Ollama should not be public. A server with more CPU/RAM (or GPU support) will make summaries faster.

## Important limitation
A PDF that contains only scanned images and no text layer cannot be summarized by the default PDF pipeline. Add OCR if scanned PDFs are required.

## Latest updates
- Added Show/Hide Password buttons on Login, Sign Up, and Profile > New Password.
- Added Add Subject from the Upload Material page. Any logged-in user can create a subject by entering a subject name and unique subject code.
- Subject codes are normalized to uppercase and duplicate subject codes are rejected.

## Teacher Accounts, Moderation & Chat

- Registration now supports **Student** or **Teacher / Moderator** accounts.
- Teacher accounts can remove study materials that violate StudyHub rules and can remove student accounts.
- Admin accounts remain protected from public self-registration. An existing admin can promote a teacher to admin from Admin Dashboard.
- Added **Messages** for direct communication between students, teachers, and admins.
- Chat messages are stored in MySQL and conversations show unread counts.
- The backend automatically creates the `messages` table when an existing StudyHub database is started with this version.

### Rules / moderation
Teachers should use moderation tools responsibly and only remove accounts or materials that violate your school's StudyHub rules.


## Teacher permissions update
Teachers can create teacher accounts, use chat, and view moderation rules/statistics. Teachers cannot delete user accounts or study materials. Only administrators can remove accounts or materials for moderation; regular users may still delete their own materials, while teachers cannot delete materials.

## Personal Reviewer Stickers

Inside a PDF reviewer, select text and choose **Highlight + Note**. Under **Reviewer Sticker**, users can choose the built-in dinosaur stickers or create a personal sticker by uploading a PNG, JPG, WEBP, or GIF image (up to 2 MB). Personal stickers are linked to the logged-in account and can be reused on that user's reviewer highlights.

The project creates a `personal_stickers` table automatically on server start. If Cloudinary is configured, custom stickers are stored there; otherwise they are stored locally in `backend/uploads/stickers/`.
