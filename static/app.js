let selectedMood = "";
let conversationHistory = [];
let messageCount = 0;
let isClinicUser = false;
let clinicName = "";
let messageCountToday = 0;
let currentExercise = [];
let currentStep = 0;
let selectedCheckinMood = '';
let deferredPWAPrompt = null;

const FREE_DAILY_LIMIT = 50;

// ===== PWA INSTALL LISTENER =====
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAPrompt = e;
});

// ===== WELCOME SCREENS =====
function showWelcome() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('codeScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
}

function showCodeEntry() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('codeScreen').style.display = 'flex';
}

async function validateCode() {
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (!code) return;

    try {
        const response = await fetch('/validate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        const data = await response.json();

        if (data.valid) {
            isClinicUser = true;
            clinicName = data.clinic;
            document.getElementById('codeScreen').style.display = 'none';
            startApp();
        } else {
            document.getElementById('codeError').style.display = 'block';
        }
    } catch (err) {
        document.getElementById('codeError').style.display = 'block';
    }
}

function startFreeChat() {
    isClinicUser = false;
    messageCountToday = parseInt(localStorage.getItem('bloom_msg_count_v2_' + today())
    document.getElementById('welcomeScreen').style.display = 'none';
    startApp();
}

function startApp() {
    document.getElementById('mainApp').style.display = 'flex';

    if (isClinicUser) {
        document.getElementById('accessLabel').textContent = `Welcome from ${clinicName} 🏥`;
        document.getElementById('accessBadge').textContent = '🏥 Clinic Access';
    } else {
        document.getElementById('accessBadge').textContent = `🆓 ${FREE_DAILY_LIMIT - messageCountToday} messages left today`;
        if (messageCountToday >= FREE_DAILY_LIMIT) {
            showUpgradePrompt();
        }
    }

    showAffirmation();
    showJournalPrompt();

    // ✅ RETENTION SYSTEM — initialise after app starts
    initRetentionSystem();
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function showUpgradePrompt() {
    document.getElementById('upgradePrompt').style.display = 'block';
    document.getElementById('userInput').disabled = true;
    document.querySelector('.chat-input button').disabled = true;
}

// ===== TABS =====
function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btn.classList.add('active');
}

// ===== CHAT =====
function selectMood(btn) {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = btn.textContent.trim();
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;

    if (!isClinicUser && messageCountToday >= FREE_DAILY_LIMIT) {
        showUpgradePrompt();
        return;
    }

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
                history: conversationHistory,
                is_clinic_user: isClinicUser,
                message_count_today: messageCountToday
            })
        });

        const data = await response.json();
        document.getElementById('typing').style.display = 'none';

        if (data.limit_reached) {
            showUpgradePrompt();
            return;
        }

        if (data.reply) {
            addMessage(data.reply, 'bot');
            conversationHistory.push({ role: "assistant", content: data.reply });
            messageCount++;
            messageCountToday++;

            // Save count for free users
            if (!isClinicUser) {
                localStorage.setItem('bloom_msg_count_v2_' + today(), messageCountToday)
                const remaining = FREE_DAILY_LIMIT - messageCountToday;
                document.getElementById('accessBadge').textContent = `🆓 ${remaining} messages left today`;
                if (remaining <= 0) showUpgradePrompt();
            }

            if (messageCount >= 3) {
                document.getElementById('feedbackContainer').style.display = 'block';
            }
            if (messageCount === 2) {
                addMessage("💡 When you're ready, try our Calm exercises or Daily Affirmations in the tabs above 🌸", 'hint');
            }

            // ✅ TRIGGER EMAIL CAPTURE after 3rd message
            if (messageCount === 3) {
                triggerEmailCapture();
            }
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

function sendFeedback(type) {
    document.querySelector('.feedback-buttons').style.display = 'none';
    document.getElementById('feedbackThanks').style.display = 'block';
    fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: type })
    });
}

// ===== EXERCISES =====
const exercises = {
    breathing: [
        "Find a comfortable position and close your eyes 😌",
        "Breathe IN slowly for 4 counts... 1... 2... 3... 4...",
        "HOLD your breath for 4 counts... 1... 2... 3... 4...",
        "Breathe OUT slowly for 4 counts... 1... 2... 3... 4...",
        "HOLD for 4 counts... 1... 2... 3... 4...",
        "Breathe IN again... feel your body relaxing...",
        "HOLD... you are safe... you are loved...",
        "Breathe OUT... release all tension...",
        "One more time... IN... 1... 2... 3... 4...",
        "HOLD... 1... 2... 3... 4...",
        "OUT... 1... 2... 3... 4... 🌸",
        "Beautiful. You did it. Take a moment to notice how you feel 💕"
    ],
    grounding: [
        "Look around you. Name 5 things you can SEE 👀",
        "Take your time... really look at each one...",
        "Now notice 4 things you can TOUCH. Feel their texture 🤲",
        "Listen carefully. What are 3 things you can HEAR? 👂",
        "What are 2 things you can SMELL? 👃",
        "What is 1 thing you can TASTE? 👅",
        "You are here. You are present. You are safe. 🌸",
        "This moment is all that exists right now. Breathe. 💕"
    ],
    bodyscan: [
        "Lie down or sit comfortably. Close your eyes. 😌",
        "Start at your feet. Notice any tension. Breathe into it. Let it go...",
        "Move to your calves and knees. Breathe. Release...",
        "Your thighs and hips. You've been carrying so much. Let it soften...",
        "Your stomach. This part of you that has been through so much. Be gentle with it. 💕",
        "Your chest and heart. Feel it beating. It's still going. You're still here.",
        "Your shoulders. Drop them away from your ears. Release...",
        "Your neck, jaw, forehead. Let everything soften...",
        "Your whole body is heavy and warm and relaxed. 🌸",
        "You are safe. You are enough. Rest here as long as you need. 💕"
    ],
    visualization: [
        "Close your eyes. Take three slow deep breaths. 😌",
        "Imagine a place where you feel completely safe and peaceful...",
        "It could be a beach, a garden, a cozy room — anywhere that feels like home...",
        "Look around this place. What do you see? What colors surround you?",
        "Feel the ground beneath you. Hear the sounds of this peaceful place...",
        "The air here is perfect. The temperature is exactly right.",
        "You are completely safe here. Nothing can hurt you here.",
        "Stay here as long as you need. This place is always available to you. 🌸",
        "Whenever you need peace, you can come back here. 💕",
        "Slowly bring your awareness back. Open your eyes when you're ready. 🌸"
    ]
};

function startExercise(type) {
    currentExercise = exercises[type];
    currentStep = 0;
    document.getElementById('exercisePlayer').style.display = 'block';
    document.getElementById('exerciseText').textContent = currentExercise[0];
    document.getElementById('exerciseTimer').textContent = `Step 1 of ${currentExercise.length}`;
    window.scrollTo(0, document.getElementById('exercisePlayer').offsetTop);
}

function nextStep() {
    currentStep++;
    if (currentStep >= currentExercise.length) { closeExercise(); return; }
    document.getElementById('exerciseText').textContent = currentExercise[currentStep];
    document.getElementById('exerciseTimer').textContent = `Step ${currentStep + 1} of ${currentExercise.length}`;
    if (currentStep === currentExercise.length - 1) {
        document.querySelector('.exercise-next-btn').textContent = 'Finish 🌸';
    }
}

function closeExercise() {
    document.getElementById('exercisePlayer').style.display = 'none';
    currentStep = 0;
    document.querySelector('.exercise-next-btn').textContent = 'Next ➤';
}

// ===== AFFIRMATIONS =====
const affirmations = [
    "You are stronger than you know. This journey is proof of that. 🌸",
    "Your body is doing its best. So are you. That is enough. 💕",
    "Every step forward, no matter how small, is still forward. ✨",
    "You are worthy of love, joy, and the family you dream of. 🌈",
    "It's okay to feel all of it — the hope, the fear, the exhaustion. 💙",
    "You have survived every hard day so far. You will survive this one too. 💪",
    "Your heart is so full of love already. That love matters. 🌸",
    "Rest is not giving up. Rest is preparing to keep going. 😌",
    "You are not alone in this. Millions of women walk this path with you. 💕",
    "Your courage in continuing is extraordinary. Never forget that. ✨",
    "Today, I give myself permission to feel without judgment. 🌸",
    "My worth is not determined by my results. I am enough. 💙"
];

function showAffirmation() { newAffirmation(); }
function newAffirmation() {
    const random = affirmations[Math.floor(Math.random() * affirmations.length)];
    document.getElementById('affirmationText').textContent = random;
}

// ===== JOURNAL =====
const journalPrompts = [
    "What am I feeling right now, and where do I feel it in my body?",
    "What am I most afraid of today? What would I say to a friend feeling this way?",
    "What has been the hardest part of this journey so far?",
    "What small thing brought me comfort today?",
    "What do I need most right now — rest, support, hope, or something else?",
    "Dear future me who made it through this — what would you want me to know?",
    "What am I proud of myself for today, no matter how small?",
    "What does my body need from me today?"
];

function showJournalPrompt() {
    const random = journalPrompts[Math.floor(Math.random() * journalPrompts.length)];
    document.getElementById('journalPrompt').textContent = "💭 " + random;
}

function saveJournal() {
    const text = document.getElementById('journalText').value;
    if (!text.trim()) return;
    document.getElementById('journalSaved').style.display = 'block';
    setTimeout(() => { document.getElementById('journalSaved').style.display = 'none'; }, 3000);
}


// =====================================================
// ✅ RETENTION SYSTEM — ALL NEW CODE BELOW
// =====================================================

function initRetentionSystem() {
    updateVisitData();
    checkReturnUser();
    checkStreak();
    checkPWAPrompt();
}

// ===== VISIT TRACKING =====
function updateVisitData() {
    const todayStr = today();
    const data = getRetentionData();
    const lastVisit = data.lastVisit;

    if (lastVisit && lastVisit !== todayStr) {
        const yesterday = getYesterdayString();
        data.streak = lastVisit === yesterday ? (data.streak || 0) + 1 : 1;
    } else if (!lastVisit) {
        data.streak = 1;
    }

    data.lastVisit = todayStr;
    data.totalVisits = (data.totalVisits || 0) + 1;
    saveRetentionData(data);
}

// ===== RETURN USER GREETING =====
function checkReturnUser() {
    const data = getRetentionData();
    if (data.totalVisits > 1) {
        showReturnGreeting(data.userName || null);
        showDailyCheckinBanner();
    }
}

function showReturnGreeting(name) {
    const greeting = document.getElementById('returnGreeting');
    if (!greeting) return;

    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const messages = [
        "It's good to see you again. How are you holding up today?",
        "You showed up again. That takes courage. 💕",
        "Bloom has been thinking of you. How are you feeling?",
        "You came back. That matters more than you know. 🌸",
        "Every day you show up for yourself is a win. 💕"
    ];

    document.getElementById('returnGreetingTitle').textContent = name
        ? `${timeGreeting}, ${name} 🌸`
        : `${timeGreeting} 🌸`;
    document.getElementById('returnGreetingText').textContent =
        messages[Math.floor(Math.random() * messages.length)];

    greeting.style.display = 'block';
}

function showDailyCheckinBanner() {
    const data = getRetentionData();
    if (data.lastCheckin !== today()) {
        setTimeout(() => {
            const banner = document.getElementById('dailyCheckin');
            if (banner) banner.style.display = 'block';
        }, 1500);
    }
}

// ===== STREAK =====
function checkStreak() {
    const data = getRetentionData();
    const streak = data.streak || 0;
    if (streak < 2) return;

    const display = document.getElementById('streakDisplay');
    if (!display) return;

    document.getElementById('streakTitle').textContent = `${streak} days with Bloom`;
    const sub = document.getElementById('streakSubtitle');
    if (streak === 2) sub.textContent = "You came back. That means everything. 💕";
    else if (streak <= 5) sub.textContent = `You've shown up for yourself ${streak} days in a row 🌸`;
    else if (streak <= 10) sub.textContent = `${streak} days strong. You are doing so well. 💪`;
    else sub.textContent = `${streak} days. Your resilience is extraordinary. ✨`;

    display.style.display = 'flex';
}

// ===== EMAIL CAPTURE =====
function triggerEmailCapture() {
    const data = getRetentionData();
    if (data.emailCaptured || data.emailDismissed) return;
    setTimeout(() => {
        const modal = document.getElementById('emailCaptureModal');
        if (modal) modal.classList.add('visible');
    }, 800);
}

function dismissEmailCapture() {
    const modal = document.getElementById('emailCaptureModal');
    if (modal) modal.classList.remove('visible');
    const data = getRetentionData();
    data.emailDismissed = true;
    saveRetentionData(data);
}

async function submitEmail() {
    const emailInput = document.getElementById('emailAddressInput');
    const nameInput = document.getElementById('emailNameInput');
    const errorEl = document.getElementById('emailError');
    const email = emailInput.value.trim();
    const name = nameInput.value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errorEl.style.display = 'block';
        emailInput.style.borderColor = '#e53935';
        return;
    }

    errorEl.style.display = 'none';
    emailInput.style.borderColor = '#f48fb1';

    const data = getRetentionData();
    data.emailCaptured = true;
    data.userEmail = email;
    if (name) data.userName = name;
    saveRetentionData(data);

    try {
        await fetch('/save-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                name: name || null,
                stage: document.getElementById('stage')?.value || 'unknown',
                source: 'bloom_app'
            })
        });
    } catch (e) {
        console.log('Email saved locally, backend sync failed silently');
    }

    document.getElementById('emailFormState').style.display = 'none';
    document.getElementById('emailSuccessState').style.display = 'block';

    setTimeout(() => dismissEmailCapture(), 2500);
}

// ===== DAILY CHECK-IN =====
function openDailyCheckin() {
    document.getElementById('dailyCheckin').style.display = 'none';
    const modal = document.getElementById('quickCheckinModal');
    if (modal) modal.classList.add('visible');
}

function selectCheckinMood(btn, mood) {
    document.querySelectorAll('.checkin-mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedCheckinMood = mood;

    const data = getRetentionData();
    data.lastCheckin = today();
    if (!data.moodHistory) data.moodHistory = [];
    data.moodHistory.push({ date: today(), mood });
    if (data.moodHistory.length > 30) data.moodHistory.shift();
    saveRetentionData(data);
}

function startCheckinChat() {
    dismissCheckin();

    if (selectedCheckinMood) {
        document.querySelectorAll('.mood-btn').forEach(btn => {
            if (btn.textContent.trim() === selectedCheckinMood) btn.click();
        });
        const input = document.getElementById('userInput');
        if (input) {
            input.focus();
            input.placeholder = `Tell me more about feeling ${selectedCheckinMood.split(' ')[1] || 'this way'}...`;
        }
    }

    const chatTabBtn = document.querySelector('[onclick*="chatTab"]');
    if (chatTabBtn) chatTabBtn.click();
}

function dismissCheckin() {
    const modal = document.getElementById('quickCheckinModal');
    if (modal) modal.classList.remove('visible');
    const data = getRetentionData();
    data.lastCheckin = today();
    saveRetentionData(data);
}

// ===== PWA =====
function checkPWAPrompt() {
    const data = getRetentionData();
    if (data.totalVisits >= 2 && !data.pwaDismissed && deferredPWAPrompt) {
        setTimeout(() => {
            const prompt = document.getElementById('pwaPrompt');
            if (prompt) prompt.style.display = 'block';
        }, 3000);
    }
}

async function installPWA() {
    if (!deferredPWAPrompt) return;
    deferredPWAPrompt.prompt();
    await deferredPWAPrompt.userChoice;
    document.getElementById('pwaPrompt').style.display = 'none';
    deferredPWAPrompt = null;
}

function dismissPWA() {
    document.getElementById('pwaPrompt').style.display = 'none';
    const data = getRetentionData();
    data.pwaDismissed = true;
    saveRetentionData(data);
}

// ===== DATA HELPERS =====
function getRetentionData() {
    try { return JSON.parse(localStorage.getItem('bloom_retention') || '{}'); }
    catch (e) { return {}; }
}

function saveRetentionData(data) {
    localStorage.setItem('bloom_retention', JSON.stringify(data));
}

function getYesterdayString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}
