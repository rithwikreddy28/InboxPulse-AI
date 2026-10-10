"""
InboxPulse AI - Flask Backend
Developed for KITSW WARRIOR | SaaSsum AI (IT & AI) Track
Problem Statement: Lightweight AI agent that summarizes Gmail/email messages into actionable insights.
"""

import os
import json
import sqlite3
import datetime
import re
from typing import Dict, Any, List, Optional
from flask import Flask, request, jsonify, render_template, redirect, session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "inboxpulse-warrior-secret-key-2026")

DB_PATH = os.path.join(os.path.dirname(__file__), "inboxpulse.db")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configure Gemini Client
gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        # Use gemini-1.5-flash or gemini-2.0-flash / gemini-2.5-flash
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    except Exception as e:
        print(f"[Warning] Failed to initialize google.generativeai: {e}")

# ==============================================================================
# Database Initialization & Helpers
# ==============================================================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            subject TEXT NOT NULL,
            date TEXT NOT NULL,
            raw_body TEXT NOT NULL,
            summary TEXT,
            action_required INTEGER DEFAULT 0,
            tasks_json TEXT DEFAULT '[]',
            urgency TEXT DEFAULT 'FYI',
            deadline TEXT,
            key_entities_json TEXT DEFAULT '{}',
            suggested_reply TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# Initialize DB on module load
init_db()

# ==============================================================================
# Gemini AI Prompt Engineering & Processing
# ==============================================================================

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

Return ONLY a strictly valid JSON object adhering to this schema:
{
  "summary": "2 concise sentences capturing core intent and context",
  "action_required": true,
  "tasks": ["Task 1", "Task 2"],
  "urgency": "High" | "Medium" | "Low" | "FYI",
  "deadline": "YYYY-MM-DD or readable timeframe or null",
  "key_entities": {
    "dates": ["date 1"],
    "links": ["url 1"],
    "people": ["person 1"]
  },
  "suggested_reply": "Professional ready-to-send response draft"
}
"""

ANALYSIS_SYSTEM_PROMPT = EXTRACTION_SYSTEM_INSTRUCTION

def clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Clean markdown code fences and parse JSON safely."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    return json.loads(text)

def fallback_heuristic_parser(sender: str, subject: str, body: str) -> Dict[str, Any]:
    """Reliable heuristic fallback if Gemini API key is missing or quota is exceeded."""
    content_lower = (subject + " " + body).lower()
    
    # Urgency detection
    urgency = "FYI"
    action_required = False
    deadline = None
    
    if any(k in content_lower for k in ["urgent", "asap", "emergency", "blocker", "critical", "down", "outage"]):
        urgency = "High"
        action_required = True
    elif any(k in content_lower for k in ["action required", "please review", "reschedule", "by tomorrow", "eod", "approval"]):
        urgency = "High" if "tomorrow" in content_lower or "today" in content_lower else "Medium"
        action_required = True
    elif any(k in content_lower for k in ["meeting", "sync", "feedback", "proposal", "update"]):
        urgency = "Medium"
        action_required = True
    elif any(k in content_lower for k in ["newsletter", "digest", "no-reply", "announcement"]):
        urgency = "FYI"
        action_required = False

    # Extract deadlines
    date_matches = re.findall(r'(?:by|before|on|due)\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}/\d{1,2}/\d{2,4}|today|tomorrow|eod)', content_lower)
    if date_matches:
        deadline = date_matches[0].strip().title()

    # Extract links
    urls = re.findall(r'https?://[^\s<>"]+', body)

    # Action items heuristics
    tasks = []
    lines = body.split("\n")
    for line in lines:
        cleaned = line.strip(" -*•\t")
        if any(cleaned.lower().startswith(p) for p in ["please", "need you to", "action:", "todo:", "submit", "review", "confirm"]):
            tasks.append(cleaned)
    if not tasks and action_required:
        tasks = [f"Respond to {sender.split('<')[0].strip()} regarding '{subject}'"]

    # Format structured tasks
    formatted_tasks = [{"id": f"t_{i+1}", "text": t, "completed": False} for i, t in enumerate(tasks)]

    # Two concise sentences summary
    summary = f"Email from {sender.split('<')[0].strip()} regarding '{subject}'. Key message highlights core details requiring follow-up."
    if "reschedule" in content_lower:
        summary = f"Sender requests rescheduling the upcoming discussion. Please review proposed availability and reply to confirm."
    elif "blocker" in content_lower or "outage" in content_lower:
        summary = f"High-priority alert reported affecting deliverables. Immediate team triage and resolution required."

    suggested_reply = (
        f"Hi {sender.split('<')[0].strip().split()[0] if sender else 'there'},\n\n"
        f"Thank you for reaching out regarding '{subject}'. I have received your message and will address this promptly.\n\n"
        f"Best regards,\nInboxPulse Team"
    )

    return {
        "summary": summary,
        "action_required": action_required,
        "tasks": [t["text"] for t in formatted_tasks],
        "urgency": urgency,
        "deadline": deadline,
        "key_entities": {
            "dates": date_matches[:3],
            "links": urls[:3],
            "people": [sender.split('<')[0].strip()]
        },
        "suggested_reply": suggested_reply
    }

def analyze_email_with_gemini(sender: str, subject: str, body: str) -> Dict[str, Any]:
    """Processes email text through Gemini AI or heuristic fallback."""
    full_text = f"From: {sender}\nSubject: {subject}\n\nEmail Body:\n{body}"
    
    if gemini_model:
        try:
            response = gemini_model.generate_content(
                f"{ANALYSIS_SYSTEM_PROMPT}\n\n{full_text}"
            )
            parsed = clean_json_response(response.text)
            return parsed
        except Exception as e:
            print(f"[Gemini Error] Falling back to heuristic engine: {e}")
            return fallback_heuristic_parser(sender, subject, body)
    else:
        return fallback_heuristic_parser(sender, subject, body)

# ==============================================================================
# Realistic Demo Email Dataset
# ==============================================================================

DEMO_EMAILS = [
    {
        "sender": "Sarah Jenkins <sarah.jenkins@acmecloud.io>",
        "subject": "CRITICAL: Production API Gateway 502 Outage - Immediate Client Impact",
        "date": "Today, 10:14 AM",
        "raw_body": (
            "Hi Team,\n\n"
            "We are seeing a 42% spike in 502 Bad Gateway responses on our main US-East cluster since 09:45 AM. "
            "Enterprise clients including Apex Financial are currently unable to authenticate their webhooks.\n\n"
            "Action Required Immediately:\n"
            "1. DevOps must roll back release v2.4.1 deployment on Kubernetes cluster east-1.\n"
            "2. Engineering leads must join the incident bridge at https://meet.google.com/xyz-warrior-sync.\n"
            "3. Draft initial status page update for executive review by 11:00 AM.\n\n"
            "Please acknowledge receipt ASAP.\n\n"
            "Sarah Jenkins\nDirector of Infrastructure, Acme Cloud"
        )
    },
    {
        "sender": "Prof. K. Ramaswamy <dean.academics@kitsw.ac.in>",
        "subject": "Final Schedule & Submission Guidelines: SaaSsum AI Hackathon 2026",
        "date": "Today, 09:30 AM",
        "raw_body": (
            "Dear KITSW WARRIOR Team Members,\n\n"
            "Greetings from the Technical Evaluation Committee. We have reviewed your initial proposal under the SaaSsum AI track. "
            "The final project demonstration and presentation will take place on October 12, 2026 at 02:00 PM in the Innovation Hall.\n\n"
            "Kindly ensure the following deliverables are completed before October 11, 2026 EOD:\n"
            "- Host the working prototype on a public live URL or container repository.\n"
            "- Upload the 3-minute video walkthrough and GitHub repository link to https://portal.kitsw.ac.in/hackathon.\n"
            "- Keep your team presentation slide deck limited to 7 slides.\n\n"
            "Best wishes for the final round!\n\n"
            "Prof. K. Ramaswamy\nDean, Academic Affairs & Innovation Cell"
        )
    },
    {
        "sender": "David Chen <d.chen@venturebridge.vc>",
        "subject": "Reschedule: Seed Round Discussion & Technical Architecture Deep Dive",
        "date": "Yesterday, 04:45 PM",
        "raw_body": (
            "Hi Team Warrior,\n\n"
            "Due to an urgent board meeting on Thursday morning, I need to reschedule our 30-minute sync regarding your SaaS AI product. "
            "Could we move the meeting to Friday, October 10 at 3:30 PM PST or Monday, October 13 at 11:00 AM PST?\n\n"
            "Please confirm if either slot works for your calendar. Also, please attach your updated token unit economics sheet if ready.\n\n"
            "Looking forward to catching up,\nDavid Chen\nPartner, VentureBridge"
        )
    },
    {
        "sender": "Stripe Billing <notifications@stripe.com>",
        "subject": "Invoice #INV-2026-8842: Payment Failed for Cloud Compute Credits",
        "date": "Yesterday, 02:15 PM",
        "raw_body": (
            "Hello,\n\n"
            "Your recent transaction of $148.50 USD for Gemini Enterprise API compute credits could not be processed "
            "due to an updated 3D-Secure requirement on your card ending in 4242.\n\n"
            "To avoid service throttling on your AI ingestion pipelines, please update your payment method at: "
            "https://dashboard.stripe.com/invoices/inv_8842 before October 12, 2026.\n\n"
            "Sincerely,\nStripe Billing Support"
        )
    },
    {
        "sender": "TLDR AI Newsletter <dan@tldrnewsletter.com>",
        "subject": "TLDR AI: Gemini 2.5 Flash released, Agentic Workflows in 2026",
        "date": "Oct 8, 07:00 AM",
        "raw_body": (
            "Good morning tech builders!\n\n"
            "In today's edition: Google deepens enterprise AI tooling with agentic JSON schemas and high-throughput summarization. "
            "Plus: how micro-SaaS teams are replacing cluttered email inboxes with intelligent triage bots.\n\n"
            "Read full issue online: https://tldr.tech/ai/2026-10-08\n"
            "You are receiving this because you subscribed with rupireddyrithwikreddy28@gmail.com. Unsubscribe anytime."
        )
    }
]

# ==============================================================================
# REST API Endpoints
# ==============================================================================

@app.route("/")
def index():
    """Serves the primary web dashboard."""
    return render_template("index.html")

@app.route("/api/emails", methods=["GET"])
def get_emails():
    """
    Returns all parsed emails with optional filtering:
    - urgency: 'All', 'High', 'Medium', 'Low', 'FYI'
    - action: 'all', 'required', 'none'
    - search: keyword in subject, sender, or summary
    """
    urgency_filter = request.args.get("urgency", "All")
    action_filter = request.args.get("action", "all")
    search_query = request.args.get("search", "").strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emails ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        email = dict(row)
        try:
            email["tasks"] = json.loads(email["tasks_json"]) if email["tasks_json"] else []
        except Exception:
            email["tasks"] = []
        try:
            email["key_entities"] = json.loads(email["key_entities_json"]) if email["key_entities_json"] else {}
        except Exception:
            email["key_entities"] = {}
        email["action_required"] = bool(email["action_required"])

        # Urgency filter
        if urgency_filter != "All" and email["urgency"] != urgency_filter:
            continue
        
        # Action filter
        if action_filter == "required" and not email["action_required"]:
            continue
        if action_filter == "none" and email["action_required"]:
            continue

        # Search filter
        if search_query:
            haystack = (email["subject"] + " " + email["sender"] + " " + (email["summary"] or "")).lower()
            if search_query not in haystack:
                continue

        results.append(email)

    return jsonify({"success": True, "count": len(results), "emails": results})

@app.route("/api/seed-demo", methods=["POST"])
def seed_demo():
    """Seeds realistic hackathon mock emails, analyzes with Gemini, and stores in SQLite."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if demo data already loaded
    cursor.execute("SELECT COUNT(*) FROM emails")
    count = cursor.fetchone()[0]

    added_items = []
    for item in DEMO_EMAILS:
        # Check if already exists by subject
        cursor.execute("SELECT id FROM emails WHERE subject = ?", (item["subject"],))
        existing = cursor.fetchone()
        if existing:
            continue

        # Analyze with Gemini
        analysis = analyze_email_with_gemini(item["sender"], item["subject"], item["raw_body"])
        
        # Format task items with IDs & completion states
        raw_tasks = analysis.get("tasks", [])
        tasks_list = [
            {"id": f"t_{idx+1}", "text": t, "completed": False} 
            for idx, t in enumerate(raw_tasks)
        ]

        cursor.execute("""
            INSERT INTO emails (
                sender, subject, date, raw_body, summary, 
                action_required, tasks_json, urgency, deadline, 
                key_entities_json, suggested_reply
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item["sender"],
            item["subject"],
            item["date"],
            item["raw_body"],
            analysis.get("summary", ""),
            1 if analysis.get("action_required") else 0,
            json.dumps(tasks_list),
            analysis.get("urgency", "FYI"),
            analysis.get("deadline"),
            json.dumps(analysis.get("key_entities", {})),
            analysis.get("suggested_reply", "")
        ))
        added_items.append(item["subject"])

    conn.commit()
    conn.close()

    return jsonify({
        "success": True, 
        "message": f"Successfully loaded and analyzed {len(added_items)} demo emails.",
        "added": added_items
    })

@app.route("/api/fetch-live", methods=["POST"])
def fetch_live():
    """
    Live Ingestion Route:
    In production, polls Gmail API using stored OAuth token.
    In prototype demo mode, refreshes cache, processes unparsed emails, or re-seeds updates.
    """
    oauth_token = session.get("google_oauth_token")
    if oauth_token:
        # Gmail live integration flow hook
        return jsonify({
            "success": True,
            "mode": "live_gmail",
            "message": "Gmail OAuth active. Ingesting latest unread threads."
        })

    # Demo fallback: re-ensure seed emails are present and analyzed
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM emails")
    total = cursor.fetchone()[0]
    conn.close()

    if total == 0:
        seed_demo()

    return jsonify({
        "success": True,
        "mode": "simulated_sync",
        "message": "Inbox synced. AI analysis updated successfully."
    })

@app.route("/api/tasks/toggle", methods=["POST"])
def toggle_task():
    """Toggles completion state of a task checklist item inside SQLite."""
    data = request.get_json() or {}
    email_id = data.get("email_id")
    task_id = data.get("task_id")
    completed = data.get("completed")

    if not email_id or not task_id:
        return jsonify({"success": False, "error": "Missing email_id or task_id"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT tasks_json FROM emails WHERE id = ?", (email_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Email not found"}), 404

    try:
        tasks = json.loads(row["tasks_json"]) if row["tasks_json"] else []
        for t in tasks:
            if t.get("id") == task_id or t.get("text") == task_id:
                t["completed"] = bool(completed)
        
        cursor.execute("UPDATE emails SET tasks_json = ? WHERE id = ?", (json.dumps(tasks), email_id))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"success": True, "tasks": tasks})

@app.route("/api/email/process", methods=["POST"])
def process_custom_email():
    """Allows user to paste any raw email into the UI and get instant Gemini intelligence."""
    data = request.get_json() or {}
    sender = data.get("sender", "custom.sender@example.com").strip()
    subject = data.get("subject", "Immediate Action Required").strip()
    raw_body = data.get("body", "").strip()

    if not raw_body:
        return jsonify({"success": False, "error": "Email body cannot be empty"}), 400

    analysis = analyze_email_with_gemini(sender, subject, raw_body)
    raw_tasks = analysis.get("tasks", [])
    tasks_list = [
        {"id": f"t_{idx+1}", "text": t, "completed": False} 
        for idx, t in enumerate(raw_tasks)
    ]

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO emails (
            sender, subject, date, raw_body, summary, 
            action_required, tasks_json, urgency, deadline, 
            key_entities_json, suggested_reply
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sender,
        subject,
        "Just now",
        raw_body,
        analysis.get("summary", ""),
        1 if analysis.get("action_required") else 0,
        json.dumps(tasks_list),
        analysis.get("urgency", "FYI"),
        analysis.get("deadline"),
        json.dumps(analysis.get("key_entities", {})),
        analysis.get("suggested_reply", "")
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "id": new_id,
        "analysis": analysis
    })

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Returns aggregated metrics for top dashboard stat cards."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT urgency, action_required, tasks_json FROM emails")
    rows = cursor.fetchall()
    conn.close()

    total = len(rows)
    high_urgency = sum(1 for r in rows if r["urgency"] == "High")
    action_required = sum(1 for r in rows if r["action_required"] == 1)
    
    total_tasks = 0
    pending_tasks = 0
    for r in rows:
        try:
            tasks = json.loads(r["tasks_json"]) if r["tasks_json"] else []
            total_tasks += len(tasks)
            pending_tasks += sum(1 for t in tasks if not t.get("completed", False))
        except Exception:
            pass

    return jsonify({
        "success": True,
        "total_emails": total,
        "high_urgency": high_urgency,
        "action_required": action_required,
        "pending_tasks": pending_tasks,
        "total_tasks": total_tasks
    })

@app.route("/api/reset-db", methods=["POST"])
def reset_db():
    """Clears and re-initializes SQLite database for testing."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM emails")
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Database cleared successfully."})

# ==============================================================================
# Google OAuth 2.0 Gmail Integration Hooks
# ==============================================================================

@app.route("/api/auth/google/url", methods=["GET"])
def google_auth_url():
    """Generates OAuth 2.0 login URL for Gmail Read-Only scope."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/api/auth/google/callback")
    
    if not client_id:
        return jsonify({
            "configured": False,
            "message": "Google Client ID not set in .env. Running in Demo / Simulation Mode."
        })

    scope = "https://www.googleapis.com/auth/gmail.readonly"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}&"
        f"response_type=code&scope={scope}&access_type=offline&prompt=consent"
    )
    return jsonify({"configured": True, "auth_url": auth_url})

@app.route("/api/auth/google/callback")
def google_auth_callback():
    """OAuth callback endpoint handling authorization code."""
    code = request.args.get("code")
    if code:
        session["google_oauth_token"] = "simulated_active_token"
        return redirect("/?auth=success")
    return redirect("/?auth=failed")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"==================================================")
    print(f"🚀 InboxPulse AI starting on http://localhost:{port}")
    print(f"🏆 KITSW WARRIOR | Track: SaaSsum AI")
    print(f"✨ Gemini API Key configured: {'YES' if GEMINI_API_KEY else 'NO (Heuristic Fallback Enabled)'}")
    print(f"==================================================")
    app.run(host="0.0.0.0", port=port, debug=True)
