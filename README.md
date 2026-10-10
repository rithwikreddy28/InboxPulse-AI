# InboxPulse AI — Autonomous Email Intelligence Agent

🏆 **Team:** KITSW WARRIOR  
🚀 **Track:** SaaSsum AI (IT & AI Track)  
🎯 **Problem Statement:** *"Create a lightweight AI agent that summarizes Gmail/email messages into actionable insights."*

---

## 📌 Executive Summary

**InboxPulse AI** is a lightweight, high-performance email intelligence agent designed to solve enterprise inbox fatigue. Instead of forcing busy professionals to read lengthy email threads, InboxPulse autonomously extracts **2-sentence executive TL;DRs**, flags **urgency levels**, extracts **time-sensitive deadlines**, generates **interactive task checklists**, and drafts **ready-to-send context-aware replies**.

---

## 🛠️ System Architecture & Tech Stack

```text
  [ Gmail API (OAuth 2.0) ]  /  [ Mock Ingestion Pipeline ]
                       │
                       ▼
            [ Flask REST API Server ]
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
[ Google Gemini Flash ]        [ SQLite Cache DB ]
(Structured JSON Schema)       (inboxpulse.db)
        │                             │
        └──────────────┬──────────────┘
                       ▼
        [ Responsive Tailwind Dashboard ]
        (Actionable Checklists & Reply Modals)
```

- **Backend:** Express & Python RESTful API architectures.
- **AI Engine:** Google Gemini 3.8 Flash (`@google/genai`) with `EXTRACTION_SYSTEM_INSTRUCTION` strict JSON extraction.
- **Authentication:** Google OAuth 2.0 via Firebase Auth with `https://www.googleapis.com/auth/gmail.readonly` scope.
- **Live Ingestion:** Direct Gmail API v1 integration (`users.messages.list` & `users.messages.get`) ingesting real inbox messages.
- **Frontend:** Responsive dashboard styled with Tailwind CSS, Lucide icons, and in-memory OAuth token caching.

---

## 🗄️ SQLite Database Schema

The SQLite database (`inboxpulse.db`) contains the `emails` table:

| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing identifier |
| `sender` | `TEXT` | Email sender name and address |
| `subject` | `TEXT` | Email subject line |
| `date` | `TEXT` | Received timestamp |
| `raw_body` | `TEXT` | Full original text content |
| `summary` | `TEXT` | 2-sentence executive summary |
| `action_required`| `INTEGER` | 1 if requires user action, 0 if FYI |
| `tasks_json` | `TEXT` | JSON list of `{ id, text, completed }` checklist items |
| `urgency` | `TEXT` | Categorized as `High`, `Medium`, `Low`, or `FYI` |
| `deadline` | `TEXT` | Extracted deadline timestamp (or null) |
| `key_entities_json` | `TEXT` | Extracted dates, URLs, and stakeholders |
| `suggested_reply` | `TEXT` | Ready-to-copy context-calibrated response draft |
| `created_at` | `TIMESTAMP` | Record creation timestamp |

---

## 🧠 Structured Gemini Prompt & System Instruction

InboxPulse AI uses the following calibrated executive system instruction (`EXTRACTION_SYSTEM_INSTRUCTION`):

```python
EXTRACTION_SYSTEM_INSTRUCTION = """
You are InboxPulse AI, an executive email intelligence agent.
Your task is to analyze incoming raw email communications and extract structured, high-signal operational intelligence.

Guidelines:
1. summary: Exactly 2 concise sentences capturing the sender's core intent, key context, and impact.
2. action_required: Boolean true if tasks, replies, or decisions are explicitly required from the recipient.
3. tasks: Concrete, actionable items. Include owners, specific deliverables, or time constraints where available.
4. urgency: Assess realistically:
   - 'High': Service outages, imminent deadlines (<24h), payment failures, critical blockers.
   - 'Medium': Scheduled meetings, non-blocking requests, deliverables due in >48h.
   - 'Low': Casual updates, non-urgent coordination.
   - 'FYI': Newsletters, company-wide broadcasts, automated notifications requiring zero action.
5. deadline: Format as ISO date (YYYY-MM-DD) or human-readable deadline ("October 11, 2026 EOD"). Return null if none exists.
6. key_entities: Extract mentioned individuals/senders, external URLs, and key dates.
7. suggested_reply: A complete, highly professional, ready-to-send response matching the sender's tone and addressing their questions directly.
"""
```

Schema-conforming JSON output:

```json
{
  "summary": "2 concise sentences capturing the core intent and business impact",
  "action_required": true,
  "tasks": [
    "Roll back release v2.4.1 deployment on Kubernetes east-1",
    "Join incident bridge at Google Meet link"
  ],
  "urgency": "High",
  "deadline": "Today 11:00 AM",
  "key_entities": {
    "dates": ["10:14 AM", "11:00 AM"],
    "links": ["https://meet.google.com/xyz-warrior-sync"],
    "people": ["Sarah Jenkins", "DevOps Team"]
  },
  "suggested_reply": "Hi Sarah, acknowledged. DevOps is currently initiating the rollback of v2.4.1 and we are joining the incident bridge now."
}
```

---

## 🚀 Quickstart Guide (Local Setup)

### 1. Prerequisites
- Python 3.9+ installed
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### 2. Setup Virtual Environment

```bash
# Clone or navigate into project directory
cd inboxpulse-ai

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS / Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Update your `.env` file with your Gemini API Key:

```env
GEMINI_API_KEY="AIzaSy..."
FLASK_SECRET_KEY="inboxpulse-warrior-secret-key"
PORT=5000
```

### 5. Launch the Application

```bash
python app.py
```

Open your browser at:  
👉 **`http://localhost:5000`**

---

## 🧪 Hackathon Judge Demo Walkthrough

1. **Instant Seeding:** Click the **"Load Demo Dataset"** button in the header toolbar to immediately ingest 5 pre-calibrated enterprise emails (server outage, academic deadline, investor sync, billing alert, and tech newsletter).
2. **Actionable Checklist:** Check off any task inside the **"Actionable Checklist"** on any email card. The state immediately persists in the SQLite database and updates the **Open Tasks** counter in real-time.
3. **Filtering by Urgency:** Click **"High Priority"** or **"Needs Action"** pill filters to triage emails by severity.
4. **Quick Reply Draft:** Click **"Quick Reply Draft"** on any card to open a pre-written, professionally drafted reply. Click **"Copy Draft"** to instantly paste it into Gmail.
5. **Analyze Custom Email:** Click **"+ Analyze Custom Email"** in the top right to paste any real-world email and watch Google Gemini extract tasks, deadlines, and summaries in real-time!

---

## 👥 Team & Submission Info

- **Hackathon Track:** SaaSsum AI (IT & AI Track)
- **Team Name:** KITSW WARRIOR
- **Institution:** Kakatiya Institute of Technology & Science, Warangal (KITSW)
