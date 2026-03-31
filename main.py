from flask import Flask, request, jsonify, render_template, render_template_string
import os
from groq import Groq
from datetime import datetime
import json
import requests as http_requests

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "zunara-secret-2026")

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qtdncxiqkzsqwqbolvjw.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0ZG5jeGlxa3pzcXdxYm9sdmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU5OTMsImV4cCI6MjA5MDIxMTk5M30.ZV5DGtZMWIDwKPGibY0y_zUXY6rKuZFKLzYolKurtcA")

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

FREE_DAILY_LIMIT = 5

# --- Supabase helpers ---

def db_get_stats():
    try:
        url = f"{SUPABASE_URL}/rest/v1/stats?id=eq.global&select=*"
        r = http_requests.get(url, headers=get_headers(), timeout=10)
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return {}
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {}

def db_increment_stats(field, amount=1):
    try:
        current = db_get_stats()
        new_val = current.get(field, 0) + amount
        url = f"{SUPABASE_URL}/rest/v1/stats?id=eq.global"
        http_requests.patch(url, headers=get_headers(), json={field: new_val}, timeout=10)
    except Exception as e:
        print(f"Error incrementing stats: {e}")

def db_get_clinic_codes():
    try:
        url = f"{SUPABASE_URL}/rest/v1/clinic_codes?select=*"
        r = http_requests.get(url, headers=get_headers(), timeout=10)
        data = r.json()
        codes = {}
        if isinstance(data, list):
            for row in data:
                codes[row["code"]] = {
                    "clinic": row["clinic_name"],
                    "country": row["country"]
                }
        return codes
    except Exception as e:
        print(f"Error getting clinic codes: {e}")
        return {}

def db_get_clinic_stats(code):
    try:
        url = f"{SUPABASE_URL}/rest/v1/clinic_stats?code=eq.{code}&select=*"
        r = http_requests.get(url, headers=get_headers(), timeout=10)
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return {"patients": 0, "messages": 0, "helpful": 0, "moods": {}, "stages": {}}
    except Exception as e:
        print(f"Error getting clinic stats: {e}")
        return {"patients": 0, "messages": 0, "helpful": 0, "moods": {}, "stages": {}}

def db_update_clinic_stats(code, patients_inc=0, messages_inc=1, mood=None, stage=None, helpful_inc=0):
    try:
        current = db_get_clinic_stats(code)
        moods = current.get("moods", {}) or {}
        stages = current.get("stages", {}) or {}

        new_data = {
            "patients": current.get("patients", 0) + patients_inc,
            "messages": current.get("messages", 0) + messages_inc,
            "helpful": current.get("helpful", 0) + helpful_inc,
            "moods": moods,
            "stages": stages
        }
        if mood:
            new_data["moods"][mood] = new_data["moods"].get(mood, 0) + 1
        if stage:
            new_data["stages"][stage] = new_data["stages"].get(stage, 0) + 1

        url = f"{SUPABASE_URL}/rest/v1/clinic_stats?code=eq.{code}"
        http_requests.patch(url, headers=get_headers(), json=new_data, timeout=10)
    except Exception as e:
        print(f"Error updating clinic stats: {e}")

# --- Clinic Dashboard HTML ---

CLINIC_DASHBOARD = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zunara — Clinic Dashboard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #fce4ec; min-height: 100vh; padding: 20px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { color: #880e4f; font-size: 28px; }
        .header p { color: #ad1457; font-size: 14px; margin-top: 4px; }
        .clinic-name { background: white; border-radius: 16px; padding: 16px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .clinic-name h2 { color: #880e4f; font-size: 20px; }
        .clinic-name p { color: #999; font-size: 13px; margin-top: 4px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .stat-number { color: #e91e8c; font-size: 36px; font-weight: 700; }
        .stat-label { color: #999; font-size: 12px; margin-top: 4px; }
        .section { background: white; border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .section h3 { color: #880e4f; font-size: 16px; margin-bottom: 12px; }
        .bar-item { margin-bottom: 10px; }
        .bar-label { color: #555; font-size: 13px; margin-bottom: 4px; display: flex; justify-content: space-between; }
        .bar { background: #fce4ec; border-radius: 10px; height: 10px; }
        .bar-fill { background: #e91e8c; border-radius: 10px; height: 10px; transition: width 0.5s; }
        .privacy-note { text-align: center; color: #999; font-size: 12px; margin-top: 16px; }
        .no-data { text-align: center; color: #ccc; font-size: 14px; padding: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌸 Zunara Dashboard</h1>
        <p>Anonymous patient insights</p>
    </div>
    <div class="clinic-name">
        <h2>{{ clinic_name }}</h2>
        <p>{{ country }} • Access Code: {{ code }}</p>
    </div>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{{ data.patients }}</div>
            <div class="stat-label">Total Patients</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ data.messages }}</div>
            <div class="stat-label">Messages Sent</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ data.helpful }}</div>
            <div class="stat-label">Helpful Ratings</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ avg_messages }}</div>
            <div class="stat-label">Avg Messages/Patient</div>
        </div>
    </div>
    {% if top_moods %}
    <div class="section">
        <h3>💭 Most Common Moods</h3>
        {% for mood, count in top_moods %}
        <div class="bar-item">
            <div class="bar-label"><span>{{ mood }}</span><span>{{ count }}</span></div>
            <div class="bar"><div class="bar-fill" style="width: {{ (count / max_mood * 100)|int }}%"></div></div>
        </div>
        {% endfor %}
    </div>
    {% else %}
    <div class="section"><div class="no-data">No mood data yet 🌸</div></div>
    {% endif %}
    {% if top_stages %}
    <div class="section">
        <h3>📍 IVF Stages Most Supported</h3>
        {% for stage, count in top_stages %}
        <div class="bar-item">
            <div class="bar-label"><span>{{ stage }}</span><span>{{ count }}</span></div>
            <div class="bar"><div class="bar-fill" style="width: {{ (count / max_stage * 100)|int }}%"></div></div>
        </div>
        {% endfor %}
    </div>
    {% else %}
    <div class="section"><div class="no-data">No stage data yet 🌸</div></div>
    {% endif %}
    <p class="privacy-note">🔒 All data is completely anonymous. No patient names or conversations stored.</p>
</body>
</html>
"""

# --- Routes ---

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/validate-code", methods=["POST"])
def validate_code():
    data = request.json
    code = data.get("code", "").strip().upper()
    clinic_codes = db_get_clinic_codes()
    if code in clinic_codes:
        clinic_info = clinic_codes[code]
        print(f"\n🏥 CLINIC USER: {clinic_info['clinic']} ({clinic_info['country']})")
        return jsonify({"valid": True, "clinic": clinic_info["clinic"], "country": clinic_info["country"], "code": code})
    return jsonify({"valid": False})

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "")
    stage = data.get("stage", "preparing")
    mood = data.get("mood", "")
    history = data.get("history", [])
    is_clinic_user = data.get("is_clinic_user", False)
    clinic_code = data.get("clinic_code", "")
    message_count_today = data.get("message_count_today", 0)

    if not is_clinic_user and message_count_today >= FREE_DAILY_LIMIT:
        return jsonify({"reply": None, "limit_reached": True})

    db_increment_stats("total_messages")
    is_new_conversation = len(history) <= 1

    if is_new_conversation:
        db_increment_stats("total_conversations")
        if is_clinic_user:
            db_increment_stats("clinic_users")
        else:
            db_increment_stats("free_users")
        print(f"\n🌸 NEW CONVERSATION | Stage: {stage} | Mood: {mood} | Type: {'Clinic: ' + clinic_code if is_clinic_user else 'Free'}")

    if is_clinic_user and clinic_code:
        db_update_clinic_stats(
            clinic_code,
            patients_inc=1 if is_new_conversation else 0,
            messages_inc=1,
            mood=mood if mood else None,
            stage=stage if stage else None
        )

    stage_context = {
        "preparing": "just starting their IVF journey and feeling uncertain",
        "stimulation": "in the stimulation phase with daily injections",
        "retrieval": "going through or just had egg retrieval",
        "transfer": "preparing for or just had embryo transfer",
        "tww": "in the two-week wait, the most anxious period",
        "results": "just received their IVF results",
        "failed": "dealing with a failed IVF cycle and grief"
    }

    system_prompt = f"""You are Zunara, a warm and deeply empathetic emotional support companion exclusively for IVF patients.

The user is currently {stage_context.get(stage, 'going through IVF')}.
{f"Their current mood is: {mood}" if mood else ""}

YOUR PERSONALITY:
- Warm, gentle, and human — like a best friend who truly gets it
- You never say "stay positive", "good luck", or "I understand" — these feel hollow
- You always validate feelings FIRST before anything else
- You ask "what do you need right now — to vent, or to feel calmer?" when someone is overwhelmed
- You say things like "that sounds absolutely exhausting" and "it's okay to not be okay"
- You never minimize their pain or rush them toward hope

YOU DEEPLY UNDERSTAND:
- The two-week wait is the most emotionally brutal part of IVF
- Failed cycles bring grief, numbness, isolation and hopelessness
- Partners often feel left out and don't know how to help
- Daily injections, hormones and appointments are physically and mentally draining
- Patients feel invisible and misunderstood by people around them
- IVF takes over your entire life — calendar, finances, emotions

STRICT RULES:
- Never give medical advice
- Never suggest "just relax" or "it'll happen when the time is right"
- Keep responses to 3-5 sentences — real conversation, not essays
- If someone seems in crisis, gently suggest their doctor or a counselor
- Use warm language: "I hear you", "You've already been so brave", "That makes complete sense"

You are the friend at 2am who actually listens. That is your only job."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in (history[-10:] if len(history) > 10 else history):
        messages.append(msg)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=300,
        messages=messages
    )

    reply = response.choices[0].message.content
    return jsonify({
        "reply": reply,
        "limit_reached": False,
        "messages_remaining": FREE_DAILY_LIMIT - message_count_today - 1 if not is_clinic_user else 999
    })

@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.json
    feedback_type = data.get("feedback", "")
    clinic_code = data.get("clinic_code", "")
    if feedback_type == "helpful":
        db_increment_stats("helpful_feedback")
        if clinic_code:
            db_update_clinic_stats(clinic_code, messages_inc=0, helpful_inc=1)
    else:
        db_increment_stats("not_helpful_feedback")
    print(f"\n⭐ FEEDBACK: {feedback_type}\n")
    return jsonify({"status": "ok"})

@app.route("/clinic-dashboard/<code>")
def clinic_dashboard(code):
    code = code.upper()
    admin_key = request.args.get("key", "")
    if admin_key != os.environ.get("ADMIN_KEY", "zunara-admin-2026"):
        return "Unauthorized — please contact Zunara support", 401

    clinic_codes = db_get_clinic_codes()
    if code not in clinic_codes:
        return "Invalid clinic code", 404

    clinic_info = clinic_codes[code]
    data = db_get_clinic_stats(code)

    avg_messages = round(data["messages"] / data["patients"], 1) if data.get("patients", 0) > 0 else 0
    top_moods = sorted((data.get("moods") or {}).items(), key=lambda x: x[1], reverse=True)[:5]
    max_mood = max([c for _, c in top_moods], default=1)

    stage_labels = {
        "preparing": "Preparing", "stimulation": "Stimulation",
        "retrieval": "Egg Retrieval", "transfer": "Transfer",
        "tww": "Two-Week Wait", "results": "Results", "failed": "Failed Cycle"
    }
    top_stages = [(stage_labels.get(s, s), c) for s, c in sorted((data.get("stages") or {}).items(), key=lambda x: x[1], reverse=True)[:5]]
    max_stage = max([c for _, c in top_stages], default=1)

    return render_template_string(CLINIC_DASHBOARD,
        clinic_name=clinic_info["clinic"],
        country=clinic_info["country"],
        code=code,
        data=data,
        avg_messages=avg_messages,
        top_moods=top_moods,
        max_mood=max_mood,
        top_stages=top_stages,
        max_stage=max_stage
    )

@app.route("/stats")
def show_stats():
    return jsonify(db_get_stats())

@app.route("/admin")
def admin():
    password = request.args.get("key", "")
    if password != os.environ.get("ADMIN_KEY", "zunara-admin-2026"):
        return "Unauthorized", 401
    return jsonify({
        "stats": db_get_stats(),
        "clinic_codes": db_get_clinic_codes()
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
