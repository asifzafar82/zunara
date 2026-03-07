let selectedMood = "";
let conversationHistory = [];

function selectMood(btn) {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = btn.textContent.trim();
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;

    const stage = document.getElementById('stage').value;
    addMessage(text, 'user');
    input.value = '';

    conversationHistory.push({ role: "user", content: text });

    document.getElementById('typing').style.display = 'block';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                stage: stage,
                mood: selectedMood,
                history: conversationHistory
            })
        });

        const data = await response.json();
        document.getElementById('typing').style.display = 'none';

        if (data.reply) {
            addMessage(data.reply, 'bot');
            conversationHistory.push({ role: "assistant", content: data.reply });
        }
    } catch (err) {
        document.getElementById('typing').style.display = 'none';
        addMessage("I'm so sorry, something went wrong. Please try again 💕", 'bot');
    }
}

function addMessage(text, sender) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
      }
