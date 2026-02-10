// --- Updated script.js with ALL Fixes (Separate Question & Speech Resume) ---

const API_BASE_URL = "http://<your-ec2-public-ip>:5001"; // Replace <your-ec2-public-ip> with the actual public IP of your EC2 instance.

// Tab switching functionality
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Chat functionality
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const startInterviewBtn = document.getElementById('start-interview');
const endInterviewBtn = document.getElementById('end-interview');
const generateResumeBtn = document.getElementById('generate-resume');
const startCodingBtn = document.getElementById('start-coding');
const startDebuggingBtn = document.getElementById('start-debugging');
const startAptitudeBtn = document.getElementById('start-aptitude');

// Elements for the new separate question area (from index.html fix)
const nextQuestionText = document.getElementById('next-question-text'); 

let isInterviewActive = false;
let codingChallengeActive = false;
let aptitudeTestActive = false;
let conversationHistory = [];
let codingTimer;
let aptitudeTimer;
let timeLeft;
let currentAptitudeQuestion = null;

// ===== ANALYTICS TIMER =====
let pageStartTime = Date.now();

function trackTime(section){
 let minutes = Math.round((Date.now() - pageStartTime) / 60000);

 let data = JSON.parse(localStorage.getItem("hireed_analytics")) || {};

 if(!data[section])
   data[section] = { time:0, score:0 };

 data[section].time += minutes;

 localStorage.setItem("hireed_analytics", JSON.stringify(data));

 pageStartTime = Date.now();   // reset for next module
}

function trackScore(section, score){

 let data = JSON.parse(localStorage.getItem("hireed_analytics")) || {};

 if(!data[section])
   data[section] = { time:0, score:0 };

 data[section].score = score;

 localStorage.setItem("hireed_analytics", JSON.stringify(data));

}






function addMessage(role, content, isScore = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role === 'user' ? 'user' : 'bot'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${role === 'user' ? 'user-message' : isScore ? 'bot-message score' : 'bot-message'}`;
    contentDiv.innerHTML = content;

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to handle displaying structured interview response (Fix for separated question)
function displayInterviewResponse(response) { 
    // 1. Display Feedback in the chat area
    if (response.feedback) {
        addMessage('bot', response.feedback, response.feedback.includes('Score:'));
    }

    // 2. Display the Next Question in the separate container
    if (response.next_question && nextQuestionText) {
        nextQuestionText.innerHTML = response.next_question;
        // Explicitly speak the question, as it's outside the main chat box
        speak(response.next_question);
    } else if (nextQuestionText) {
        // Clear previous question if there isn't a new one
        nextQuestionText.textContent = 'Awaiting next step...'; 
    }
    
    // 3. Update conversation history
    conversationHistory = response.conversation_history || [];

    // ===== CAPTURE INTERVIEW SCORE =====
let match = response.feedback?.match(/Score:\s*(\d+)/i);

if(match){
 let score = parseInt(match[1]) * 10;   // convert /10 → /100
 trackScore("interview", score);
}

}


async function callBackendAPI(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
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

// Start interview
startInterviewBtn.addEventListener('click', async () => {
    const jobType = document.getElementById('job-type').value.trim();

    if (!jobType) {
        addMessage('bot', 'Please enter a job position to start the interview.');
        return;
    }

    isInterviewActive = true;
    userInput.disabled = false;
    sendBtn.disabled = false;
    startInterviewBtn.disabled = true;

    addMessage('bot', `Starting interview preparation for <strong>${jobType}</strong>. Please wait...`);

    conversationHistory = [];

    const response = await callBackendAPI('start-interview', { job_type: jobType });

    if (response) {
        // Expecting structured response from the fixed app.py
        displayInterviewResponse(response);
    }
});

// End interview
endInterviewBtn.addEventListener('click', () => {
    if (!isInterviewActive) return;

    isInterviewActive = false;
    userInput.disabled = true;
    sendBtn.disabled = true;
    startInterviewBtn.disabled = false;

    addMessage('bot', 'Interview session ended. You can start a new session anytime.');
    conversationHistory = [];
    // ===== SAVE TIME SPENT ON INTERVIEW =====
trackTime("interview");

    if (nextQuestionText) {
        nextQuestionText.textContent = 'Click "Start Interview" to begin!'; // Clear the separate question area
    }
});

// Send message functionality
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Disable input while processing
    userInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        addMessage('user', message);
        userInput.value = '';

        // Ensure we have the current job type
        const jobType = document.getElementById('job-type').value.trim();
        if (!jobType && isInterviewActive) {
            addMessage('bot', 'Please select a job position first.');
            return;
        }

        // Add the user message to conversation history
        conversationHistory.push({ role: 'user', content: message });

        const response = await callBackendAPI('interview-chatbot', {
            job_type: jobType,
            conversation_history: conversationHistory,
            user_message: message
        });
        
        // FIX: Now expecting { feedback: "...", next_question: "..." }
        if (response) {
            displayInterviewResponse(response);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage('bot', 'Sorry, there was an error processing your response. Please try again.');
    } finally {
        // Re-enable input
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
        userInput.focus();
    }
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
        addMessage('bot', `<strong>Generated Resume for ${name}:</strong><br><br>${response.resume.replace(/\n/g, '<br>')}`);
    }
});

// Coding Challenge functionality 
startCodingBtn.addEventListener('click', async () => {
    const language = document.getElementById('coding-language').value;
    const difficulty = document.getElementById('coding-difficulty').value;
    const timeLimit = parseInt(document.getElementById('coding-time').value) * 60;

    if (codingChallengeActive) {
        addMessage('bot', 'Please finish the current coding challenge first.');
        return;
    }

    codingChallengeActive = true;
    timeLeft = timeLimit;

    // Update UI for coding challenge
    document.getElementById('chat-title').textContent = 'Coding Challenge';
    userInput.disabled = true;
    sendBtn.disabled = true;
    startCodingBtn.disabled = true;

    // Get coding question from backend
    const response = await callBackendAPI('start-coding-challenge', {
        language: language,
        difficulty: difficulty
    });

    if (response && response.question) {
        const questionHtml = `
            <div class="coding-question">
                <h4>${response.question.question} <span class="timer"></span></h4>
                <div class="test-cases">
                    <h5>Test Cases:</h5>
                    ${response.question.test_cases.map(test => `
                        <div class="test-case">
                            <span class="input">Input: ${test[0]}</span><br>
                            <span class="expected">Expected Output: ${test[1]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        addMessage('bot', questionHtml);

        // Add code editor
        const codeEditor = document.createElement('textarea');
        codeEditor.id = 'code-editor';
        codeEditor.className = 'code-editor';
        codeEditor.placeholder = `Write your ${language} solution here...`;
        chatMessages.appendChild(codeEditor);

        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-code';
        submitBtn.className = 'btn';
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Solution';
        chatMessages.appendChild(submitBtn);

        // Start timer
        updateTimer();
        codingTimer = setInterval(updateTimer, 1000);

        // Handle code submission
        submitBtn.addEventListener('click', async () => {
            const userCode = codeEditor.value.trim();
            if (!userCode) {
                addMessage('bot', 'Please write some code before submitting.');
                return;
            }

            clearInterval(codingTimer);

            // Evaluate code
            const evalResponse = await callBackendAPI('evaluate-code', {
                language: language,
                code: userCode,
                test_cases: response.question.test_cases
            });

            if (evalResponse) {
                if (evalResponse.passed) {
                    addMessage('bot', '✅ Your solution passed all test cases! Great job!');
                    trackScore("coding", 85);
trackTime("coding");

                } else {
                    addMessage('bot', `❌ Your solution didn't pass all test cases. ${evalResponse.message}`);
                    trackScore("coding", 40);
trackTime("coding");

                    addMessage('bot', `💡 Here's a reference solution:<br><pre>${response.question.solution}</pre>`);
                }
            }

            // Clean up
            codeEditor.remove();
            submitBtn.remove();
            resetCodingUI();
        });
    } else {
        addMessage('bot', 'Failed to load coding challenge. Please try again.');
        resetCodingUI();
    }
});

function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerDisplay = document.querySelector('.coding-question .timer'); 

    if (timerDisplay) {
        timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    if (timeLeft <= 0) {
        clearInterval(codingTimer);
        if (timerDisplay) timerDisplay.textContent = '0:00'; 
        return;
    }

    timeLeft--;
}

function resetCodingUI() {
    codingChallengeActive = false;
    clearInterval(codingTimer);
    document.getElementById('chat-title').textContent = 'Interview Assistant';
    startCodingBtn.disabled = false;
    userInput.disabled = !isInterviewActive;
    sendBtn.disabled = !isInterviewActive;
}


// Debugging Challenge functionality 
startDebuggingBtn.addEventListener('click', async () => {
    const difficulty = document.getElementById('debugging-difficulty').value;

    // Get debugging challenge from backend
    const response = await callBackendAPI('start-debugging-challenge', {
        difficulty: difficulty
    });

    if (response && response.challenge) {
        const challengeHtml = `
            <div class="debugging-challenge">
                <h4>Debug the following code:</h4>
                <pre class="buggy-code">${response.challenge.buggy_code}</pre>
                <div class="test-cases">
                    <h5>Test Cases:</h5>
                    ${response.challenge.test_cases.map(test => `
                        <div class="test-case">Input: ${test}</div>
                    `).join('')}
                </div>
                <p class="debug-hint">Hint: ${response.challenge.hint}</p>
            </div>
        `;

        addMessage('bot', challengeHtml);

        // Add code editor for fixes
        const fixEditor = document.createElement('textarea');
        fixEditor.id = 'fix-editor';
        fixEditor.className = 'code-editor';
        fixEditor.placeholder = 'Write your fixed code here...';
        chatMessages.appendChild(fixEditor);

        // Add submit button
        const submitFixBtn = document.createElement('button');
        submitFixBtn.id = 'submit-fix';
        submitFixBtn.className = 'btn';
        submitFixBtn.innerHTML = '<i class="fas fa-check"></i> Submit Fix';
        chatMessages.appendChild(submitFixBtn);

        // Handle fix submission
        submitFixBtn.addEventListener('click', async () => {
            const userFix = fixEditor.value.trim();
            if (!userFix) {
                addMessage('bot', 'Please write your fix before submitting.');
                return;
            }

            // Validate fix
            const evalResponse = await callBackendAPI('evaluate-debug-fix', {
                original_code: response.challenge.buggy_code,
                user_fix: userFix,
                test_cases: response.challenge.test_cases
            });

            if (evalResponse) {
                if (evalResponse.valid) {
                    addMessage('bot', '✅ ' + evalResponse.message);
                } else {
                    addMessage('bot', '❌ ' + evalResponse.message);
                }

                if (evalResponse.reference_solution) {
                    addMessage('bot', `📖 Reference Solution:<pre class="reference-solution">${evalResponse.reference_solution}</pre>`);
                }
            }

            // Clean up
            fixEditor.remove();
            submitFixBtn.remove();
        });
    } else {
        addMessage('bot', 'Failed to load debugging challenge. Please try again.');
    }
});


// Aptitude Challenge functionality 
startAptitudeBtn.addEventListener('click', async () => {
    if (aptitudeTestActive) {
        addMessage('bot', 'Please finish the current aptitude question first.');
        return;
    }

    const category = document.getElementById('aptitude-category').value;
    const timeLimit = parseInt(document.getElementById('aptitude-time').value);

    aptitudeTestActive = true;
    startAptitudeBtn.disabled = true;

    // Get aptitude question from backend
    const response = await callBackendAPI('start-aptitude-test', {
        category: category
    });

    if (response && response.question) {
        currentAptitudeQuestion = response.question;

        const questionHtml = `
            <div class="aptitude-question">
                <h4>${response.question.question}</h4>
                <div class="aptitude-options">
                    ${Object.entries(response.question.options).map(([key, value]) => `
                        <div class="aptitude-option" data-option="${key}">
                            <span class="option-key">${key.toUpperCase()}:</span>
                            <span class="option-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="timer">Time left: ${timeLimit}s</div>
            </div>
        `;

        addMessage('bot', questionHtml);

        // Add click handlers for options
        document.querySelectorAll('.aptitude-option').forEach(option => {
            option.addEventListener('click', async function handler() { 
                if (!aptitudeTestActive) return;

                // Disable further clicks immediately
                document.querySelectorAll('.aptitude-option').forEach(o => o.removeEventListener('click', handler));
                
                clearInterval(aptitudeTimer);
                aptitudeTestActive = false;

                const userAnswer = option.getAttribute('data-option');

                // Evaluate answer
                const evalResponse = await callBackendAPI('evaluate-aptitude-answer', {
                    user_answer: userAnswer,
                    correct_answer: response.question.answer
                });

                if (evalResponse) {
                    if (evalResponse.correct) {
                        addMessage('bot', '✅ Correct! ' + response.question.explanation);
                        trackScore("aptitude", 90);
trackTime("aptitude");

                    } else {
                        addMessage('bot', `❌ Incorrect. The correct answer was ${response.question.answer.toUpperCase()}. ${response.question.explanation}`);
                        trackScore("aptitude", 40);
trackTime("aptitude");

                    }
                }

                // Reset UI
                startAptitudeBtn.disabled = false;
                currentAptitudeQuestion = null;
            });
        });

        // Start timer
        let timeLeft = timeLimit;
        aptitudeTimer = setInterval(() => {
            timeLeft--;
            const timerElement = document.querySelector('.aptitude-question .timer');
            if (timerElement) {
                timerElement.textContent = `Time left: ${timeLeft}s`;
            }

            if (timeLeft <= 0) {
                clearInterval(aptitudeTimer);
                if (aptitudeTestActive) {
                    aptitudeTestActive = false;
                    addMessage('bot', `⏰ Time's up! The correct answer was ${response.question.answer.toUpperCase()}. ${response.question.explanation}`);
                    startAptitudeBtn.disabled = false;
                }
            }
        }, 1000);
    } else {
        addMessage('bot', 'Failed to load aptitude question. Please try again.');
        aptitudeTestActive = false;
        startAptitudeBtn.disabled = false;
    }
});


// Text-to-speech functionality
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

function speak(text) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    
    // If it's speaking and NOT paused, cancel the previous one before starting the new one 
    // This is necessary because new text could trigger a new speak call via the MutationObserver.
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
         window.speechSynthesis.cancel();
    }
    
    // If it's already paused, we rely on the button click handler calling resume().
    if (window.speechSynthesis.paused) return;


    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            // Check if the node is an element and has the 'message-bot' class
            if (node.nodeType === 1 && node.classList && node.classList.contains('message-bot')) {
                // If TTS is enabled and nothing is currently speaking, start speaking.
                // We check if it's speaking/paused here to prevent re-speaking on resume.
                if (ttsEnabled && !window.speechSynthesis.speaking) { 
                    const text = node.querySelector('.message-content').textContent;
                    speak(text); 
                }
            }
        });
    });
});

observer.observe(chatMessages, { childList: true });