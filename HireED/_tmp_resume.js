
// Resume page JavaScript

// Chat functionality
const chatMessages = document.getElementById('chat-messages');
const generateResumeBtn = document.getElementById('generate-resume');

const CHAT_API_BASE = 'http://localhost:5001';
const chatFeature = 'resume';
const studentId = localStorage.getItem('studentId') || 'anonymous';
const studentName = localStorage.getItem('studentName') || localStorage.getItem('userName') || '';
const chatSessionKey = `hireed_${chatFeature}_session`;
let chatSessionId = sessionStorage.getItem(chatSessionKey);
if (!chatSessionId) {
    chatSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(chatSessionKey, chatSessionId);
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function logChat(role, content, metadata = {}) {
    const payload = {
        studentId,
        studentName,
        feature: chatFeature,
        role,
        message: content,
        message_text: stripHtml(content),
        metadata,
        sessionId: chatSessionId
    };

    fetch(`${CHAT_API_BASE}/log-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role === 'user' ? 'user' : 'bot'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${role === 'user' ? 'user-message' : 'bot-message'}`;
    contentDiv.innerHTML = content;

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    logChat(role, content);
}

async function callBackendAPI(endpoint, data) {
    try {
        const response = await fetch(`http://localhost:5001/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            // Error handling to read the JSON error message from the backend
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error calling ${endpoint}:`, error);
        addMessage('bot', `Error: ${error.message}`);
        return null;
    }
}

// Text-to-speech functionality for resume
let ttsEnabled = false;
const ttsToggle = document.createElement('button');
ttsToggle.id = 'toggleSpeech';
ttsToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Speech Muted'; // Initial state reflects ttsEnabled = false
ttsToggle.style.position = 'fixed';
ttsToggle.style.bottom = '20px';
ttsToggle.style.right = '20px';
ttsToggle.style.padding = '10px 15px';
ttsToggle.style.backgroundColor = 'var(--primary-color)';
ttsToggle.style.color = 'white';
ttsToggle.style.border = 'none';
ttsToggle.style.borderRadius = '5px';
ttsToggle.style.cursor = 'pointer';
ttsToggle.style.zIndex = '1000';
document.body.appendChild(ttsToggle);

// FIX: Toggle Speech Pause/Resume Logic
ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;

    if (!ttsEnabled) {
        // Mute/Pause Logic: Use pause() to stop speech but keep position
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause(); // 🛑 KEY FIX
        }
        ttsToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Speech Muted';
    } else {
        // Unmute/Resume Logic
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume(); // 🛑 KEY FIX
        }
        ttsToggle.innerHTML = '<i class="fas fa-volume-up"></i> Speech Active';
    }
});

// Function to clean resume text for TTS (remove formatting)
function cleanResumeForTTS(resumeText) {
    return resumeText
        .replace(/\*\*/g, '') // Remove bold markers
        .replace(/\*/g, '') // Remove bullet points
        .replace(/-/g, '') // Remove dashes
        .replace(/\n\s*\n/g, '\n') // Remove extra newlines
        .replace(/\n/g, '. ') // Replace newlines with periods for better speech flow
        .trim();
}

// Function to speak resume content
function speakResume(resumeText) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;

    // If it's speaking and NOT paused, cancel the previous one before starting the new one
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
         window.speechSynthesis.cancel();
    }

    // If it's already paused, we rely on the button click handler calling resume().
    if (window.speechSynthesis.paused) return;

    const cleanText = cleanResumeForTTS(resumeText);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// Function to download resume as Word document
function downloadAsWord(resumeText, fileName) {
    // Create a blob with HTML content that Word can open
    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <title>${fileName}</title>
        </head>
        <body>
            <pre style="font-family: Arial, sans-serif; font-size: 12pt;">${resumeText}</pre>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to download resume as PDF
function downloadAsPDF(resumeText, fileName) {
    // For PDF download, we'll create a simple HTML page and suggest print to PDF
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${fileName}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                pre { white-space: pre-wrap; font-size: 12pt; line-height: 1.4; }
            </style>
        </head>
        <body>
            <pre>${resumeText}</pre>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // Add a message to guide the user
    setTimeout(() => {
        alert('PDF download: Please use your browser\'s print function (Ctrl+P) and select "Save as PDF" from the print dialog.');
    }, 500);
}

// Generate resume
generateResumeBtn.addEventListener('click', async () => {
    const jobType = document.getElementById('resume-job-type').value.trim();
    const skills = document.getElementById('resume-skills').value.trim();
    const experience = document.getElementById('resume-experience').value.trim();
    const name = document.getElementById('resume-name').value.trim();
    const email = document.getElementById('resume-email').value.trim();
    const phone = document.getElementById('resume-phone').value.trim();

    if (!jobType || !skills || !name) {
        addMessage('bot', 'Please fill in at least the Name, Target Job and Skills fields.');
        return;
    }

    addMessage('bot', `Generating resume for <strong>${name}</strong> as ${jobType}...`);

    const response = await callBackendAPI('generate-resume', {
        job_type: jobType,
        skills: skills,
        experience: experience,
        name: name,
        email: email,
        phone: phone
    });

    if (response && response.resume) {
        const resumeHtml = `<strong>Generated Resume for ${name}:</strong><br><br><pre>${response.resume}</pre>`;

        // Add download buttons
        const downloadButtons = `
            <div class="download-buttons" style="margin-top: 15px;">
                <button id="speak-resume" class="btn" style="margin-right: 10px;">
                    <i class="fas fa-volume-up"></i> Read Resume
                </button>
                <button id="download-word" class="btn" style="margin-right: 10px;">
                    <i class="fas fa-file-word"></i> Download Word
                </button>
                <button id="download-pdf" class="btn">
                    <i class="fas fa-file-pdf"></i> Download PDF
                </button>
            </div>
        `;

        addMessage('bot', resumeHtml + downloadButtons);

        // Add event listeners for the buttons (with a small delay to ensure DOM is updated)
        setTimeout(() => {
            const speakBtn = document.getElementById('speak-resume');
            const wordBtn = document.getElementById('download-word');
            const pdfBtn = document.getElementById('download-pdf');

            if (speakBtn) {
                speakBtn.addEventListener('click', () => {
                    speakResume(response.resume);
                });
            }

            if (wordBtn) {
                wordBtn.addEventListener('click', () => {
                    downloadAsWord(response.resume, `${name}_Resume`);
                });
            }

            if (pdfBtn) {
                pdfBtn.addEventListener('click', () => {
                    downloadAsPDF(response.resume, `${name}_Resume`);
                });
            }
        }, 100);
    }
});
    