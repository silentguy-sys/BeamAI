
const API_URL = "";

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const newChatButton = document.getElementById("newChatButton");
const mobileMenu = document.getElementById("mobileMenu");
const sidebar = document.querySelector(".sidebar");

let sessionId = null;
let thinking = false;

function setStatus(text, color) {
    statusText.textContent = text;
    statusDot.style.background = color;
}

async function createSession() {
    try {
        setStatus("Connecting", "#f0a500");

        const response = await fetch(`${API_URL}/session`, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Session creation failed");
        }

        const data = await response.json();

        sessionId = data.session_id;

        setStatus("Online", "#35c759");
    } catch (error) {
        console.error(error);
        sessionId = null;
        setStatus("Offline", "#ff453a");
    }
}

function clearChat() {
    chatArea.innerHTML = `
        <div class="welcome" id="welcome">
            <div class="hero-mark">B</div>
            <h1>How can I help?</h1>
            <p>Talk to Beam about anything.</p>

            <div class="suggestions">
                <button data-prompt="Hey Beam!">
                    <strong>Say hello</strong>
                    <span>Start a conversation</span>
                </button>

                <button data-prompt="Can you help me with something?">
                    <strong>Get help</strong>
                    <span>Ask Beam a question</span>
                </button>

                <button data-prompt="Tell me something interesting.">
                    <strong>Explore</strong>
                    <span>Learn something new</span>
                </button>
            </div>
        </div>
    `;

    attachSuggestionButtons();
}

async function newChat() {
    if (thinking) {
        return;
    }

    sessionId = null;
    clearChat();
    await createSession();
    messageInput.focus();
}

function addMessage(role, text) {
    const welcome = document.getElementById("welcome");

    if (welcome) {
        welcome.remove();
    }

    const message = document.createElement("div");
    message.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${role === "assistant" ? "beam" : "user"}`;
    avatar.textContent = role === "assistant" ? "B" : "U";

    const body = document.createElement("div");
    body.className = "message-body";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = role === "assistant" ? "Beam" : "You";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    body.appendChild(name);
    body.appendChild(content);

    if (role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copyButton = document.createElement("button");
        copyButton.className = "copy-button";
        copyButton.textContent = "Copy";

        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(text);
                copyButton.textContent = "Copied";
                setTimeout(() => {
                    copyButton.textContent = "Copy";
                }, 1200);
            } catch {
                copyButton.textContent = "Failed";
            }
        });

        actions.appendChild(copyButton);
        body.appendChild(actions);
    }

    if (role === "user") {
        message.appendChild(body);
        message.appendChild(avatar);
    } else {
        message.appendChild(avatar);
        message.appendChild(body);
    }

    chatArea.appendChild(message);

    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });

    return content;
}

function setThinking(active) {
    thinking = active;

    sendButton.disabled = active;
    messageInput.disabled = active;

    if (active) {
        setStatus("Thinking", "#f0a500");
    } else {
        setStatus("Online", "#35c759");
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || thinking || !sessionId) {
        return;
    }

    messageInput.value = "";
    messageInput.style.height = "auto";

    addMessage("user", text);

    setThinking(true);

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: sessionId,
                message: text
            })
        });

        if (!response.ok) {
            let detail = "Beam server error.";

            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    detail = errorData.detail;
                }
            } catch {
            }

            throw new Error(detail);
        }

        const data = await response.json();

        addMessage("assistant", data.response);
    } catch (error) {
        console.error(error);

        addMessage(
            "assistant",
            "I couldn't reach Beam right now."
        );

        setStatus("Connection error", "#ff453a");
    } finally {
        setThinking(false);
        messageInput.focus();
    }
}

function attachSuggestionButtons() {
    document
        .querySelectorAll("[data-prompt]")
        .forEach(button => {
            button.addEventListener("click", () => {
                messageInput.value = button.dataset.prompt;
                resizeInput();
                messageInput.focus();
            });
        });
}

function resizeInput() {
    messageInput.style.height = "auto";
    messageInput.style.height =
        Math.min(messageInput.scrollHeight, 150) + "px";
}

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener("input", resizeInput);

newChatButton.addEventListener("click", newChat);

mobileMenu.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

document.addEventListener("click", event => {
    if (
        window.innerWidth <= 760 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        event.target !== mobileMenu
    ) {
        sidebar.classList.remove("open");
    }
});

attachSuggestionButtons();
createSession();
