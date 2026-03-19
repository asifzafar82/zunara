from flask import Flask, request, jsonify, render_template
import os
from groq import Groq
from datetime import datetime

app = Flask(__name__)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Simple in-memory counter
stats = {
    "total_conversations": 0,
    "total_messages": 0,
    "helpful_feedback": 0,
    "not_helpful_feedback": 0
}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "")
    stage = data.get("stage", "preparing")
    mood = data.get("mood", "")
    history = data.get("history", [])

    # Track real human messages
    stats["total_messages"] += 1
    if len(history) <= 1:
        stats["total_conversations"] += 1
        print(f"\n{'='*50}")
        print(f"🌸 NEW REAL USER CONVERSATION STARTED")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Stage: {stage}")
        print(f"Mood: {mood}")
        print(f"Total conversations so far: {stats['total_conversations']}")
        print(f"{'='*50}\n")
    
    print(f"💬 REAL USER MESSAGE #{stats['total_messages']}: {user_message[:50]}...")

    stage_context = {
        "preparing": "just starting their IVF journey and feeling uncertain",
        "stimulation": "in the stimulation phase with daily injections",
        "retrieval": "going through or just had egg retrieval",
        "transfer": "preparing for or just had embryo transfer",
        "tww": "in the two-week wait, the most anxious period",
        "results": "just received their IVF results",
        "failed": "dealing with a failed IVF cycle and grief"
    }

    system_prompt = f"""You are Bloom, a warm and deeply empathetic emotional support companion exclusively for IVF patients.

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
    return jsonify({"reply": reply})

@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.json
    feedback_type = data.get("feedback", "")
    if feedback_type == "helpful":
        stats["helpful_feedback"] += 1
    else:
        stats["not_helpful_feedback"] += 1
    print(f"\n⭐ FEEDBACK RECEIVED: {feedback_type}")
    print(f"Total helpful: {stats['helpful_feedback']} | Not helpful: {stats['not_helpful_feedback']}\n")
    return jsonify({"status": "ok"})

@app.route("/stats")
def show_stats():
    return jsonify(stats)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
