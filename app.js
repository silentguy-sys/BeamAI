const API_URL = "https://desktop-3i8g9td.tailfff298.ts.net";
const STORAGE_KEY = "beam_conversations_v2";
const ACTIVE_KEY = "beam_active_conversation_v2";

const MODELS = {
"beam-o2": {
name: "Beam o2",
size: "1.5B",
description: "The smaller and faster Beam model."
},
"beam-1": {
name: "Beam 1",
size: "8B",
description: "The larger Beam model with a substantially bigger parameter count."
}
};

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const newChatButton = document.getElementById("newChatButton");
const conversationList = document.getElementById("conversationList");
const emptyConversations = document.getElementById("emptyConversations");
const conversationCount = document.getElementById("conversationCount");
const conversationHeading = document.getElementById("conversationHeading");
const chatSearch = document.getElementById("chatSearch");
const mobileMenu = document.getElementById("mobileMenu");
const sidebar = document.getElementById("sidebar");
const exportButton = document.getElementById("exportButton");
const clearButton = document.getElementById("clearButton");
const scrollBottom = document.getElementById("scrollBottom");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");
const toastContainer = document.getElementById("toastContainer");

const modelSelector = document.getElementById("modelSelector");
const modelSelectorButton = document.getElementById("modelSelectorButton");
const modelMenu = document.getElementById("modelMenu");
const sidebarModelName = document.getElementById("sidebarModelName");
const sidebarModelStatus = document.getElementById("sidebarModelStatus");
const topbarModelName = document.getElementById("topbarModelName");
const topbarModelStatus = document.getElementById("topbarModelStatus");

let conversations = loadConversations();
let activeConversationId = localStorage.getItem(ACTIVE_KEY) || null;
let currentView = "chats";
let thinking = false;

function loadConversations() {
try {
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

```
    if (!Array.isArray(saved)) {
        return [];
    }

    return saved.map(conversation => ({
        ...conversation,
        model: MODELS[conversation.model]
            ? conversation.model
            : "beam-o2"
    }));
} catch {
    return [];
}
```

}

function saveConversations() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function getSelectedModel() {
const conversation = getActiveConversation();

```
if (!conversation) {
    return "beam-o2";
}

if (!MODELS[conversation.model]) {
    conversation.model = "beam-o2";
}

return conversation.model;
```

}

function updateModelUI() {
const modelId = getSelectedModel();
const model = MODELS[modelId];

```
sidebarModelName.textContent = model.name;
sidebarModelStatus.textContent = `${model.size} · Online`;

topbarModelName.textContent = model.name;
topbarModelStatus.textContent = "Online";

document.querySelectorAll(".model-option").forEach(option => {
    option.classList.toggle(
        "active",
        option.dataset.model === modelId
    );
});
```

}

function createConversation() {
const now = Date.now();

```
const conversation = {
    id: crypto.randomUUID(),
    sessionId: null,
    model: "beam-o2",
    title: "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now
};

conversations.unshift(conversation);
activeConversationId = conversation.id;

localStorage.setItem(ACTIVE_KEY, activeConversationId);
saveConversations();

updateModelUI();
renderConversationList();
renderChat();
```

}

function getActiveConversation() {
return conversations.find(
conversation => conversation.id === activeConversationId
) || null;
}

function ensureActiveConversation() {
let conversation = getActiveConversation();

```
if (!conversation) {
    createConversation();
    conversation = getActiveConversation();
}

return conversation;
```

}

async function createSession(conversation) {
const response = await fetch(`${API_URL}/session`, {
method: "POST",
headers: {
"Content-Type": "application/json"
}
});

```
if (!response.ok) {
    throw new Error(`Session creation failed (${response.status})`);
}

const data = await response.json();

conversation.sessionId = data.session_id;
conversation.updatedAt = Date.now();

saveConversations();

return data.session_id;
```

}

async function ensureSession(conversation) {
if (conversation.sessionId) {
return conversation.sessionId;
}

```
return await createSession(conversation);
```

}

async function sendToServer(conversation, message) {
let sessionId = await ensureSession(conversation);

```
let response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        session_id: sessionId,
        message,
        model: conversation.model
    })
});

if (response.status === 404) {
    conversation.sessionId = null;
    saveConversations();

    sessionId = await createSession(conversation);

    response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            session_id: sessionId,
            message,
            model: conversation.model
        })
    });
}

if (!response.ok) {
    let detail = "";

    try {
        const errorData = await response.json();
        detail = errorData.detail || "";
    } catch {
    }

    throw new Error(
        detail || `Server error (${response.status})`
    );
}

return await response.json();
```

}

function formatTime(timestamp) {
return new Intl.DateTimeFormat(undefined, {
hour: "numeric",
minute: "2-digit"
}).format(new Date(timestamp));
}

function formatConversationTime(timestamp) {
const date = new Date(timestamp);
const now = new Date();

```
const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

if (sameDay) {
    return formatTime(timestamp);
}

const yesterday = new Date(now);
yesterday.setDate(now.getDate() - 1);

const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

if (isYesterday) {
    return "Yesterday";
}

return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
}).format(date);
```

}

function deriveTitle(text) {
const cleaned = text.replace(/\s+/g, " ").trim();

```
if (!cleaned) {
    return "New conversation";
}

if (cleaned.length <= 48) {
    return cleaned;
}

return cleaned.slice(0, 45).trimEnd() + "...";
```

}

function showToast(message) {
const toast = document.createElement("div");

```
toast.className = "toast";
toast.textContent = message;

toastContainer.appendChild(toast);

setTimeout(() => toast.remove(), 2600);
```

}

function renderConversationList() {
const query = chatSearch.value.trim().toLowerCase();

```
let filtered = conversations.filter(conversation => {
    if (!query) {
        return true;
    }

    return (
        conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some(message =>
            message.content.toLowerCase().includes(query)
        )
    );
});

filtered.sort((a, b) => b.updatedAt - a.updatedAt);

conversationHeading.textContent =
    currentView === "recents" ? "Recent" : "Today";

conversationCount.textContent = filtered.length;

conversationList.innerHTML = "";

emptyConversations.style.display =
    filtered.length === 0 ? "flex" : "none";

for (const conversation of filtered) {
    const item = document.createElement("div");
    item.className = "conversation-item";

    if (conversation.id === activeConversationId) {
        item.classList.add("active");
    }

    const content = document.createElement("div");
    content.className = "conversation-item-content";

    const title = document.createElement("div");
    title.className = "conversation-title";
    title.textContent = conversation.title;

    const time = document.createElement("div");
    time.className = "conversation-time";

    const model = MODELS[conversation.model] || MODELS["beam-o2"];

    time.textContent =
        `${model.name} · ${formatConversationTime(conversation.updatedAt)}`;

    content.appendChild(title);
    content.appendChild(time);

    const deleteButton = document.createElement("button");

    deleteButton.className = "conversation-delete";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete conversation";

    deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
    });

    item.appendChild(content);
    item.appendChild(deleteButton);

    item.addEventListener("click", () => {
        openConversation(conversation.id);
    });

    conversationList.appendChild(item);
}
```

}

function deleteConversation(id) {
conversations = conversations.filter(
conversation => conversation.id !== id
);

```
saveConversations();

if (activeConversationId === id) {
    activeConversationId = null;
    localStorage.removeItem(ACTIVE_KEY);

    if (conversations.length > 0) {
        conversations.sort(
            (a, b) => b.updatedAt - a.updatedAt
        );

        activeConversationId = conversations[0].id;

        localStorage.setItem(
            ACTIVE_KEY,
            activeConversationId
        );
    }
}

updateModelUI();
renderConversationList();
renderChat();

showToast("Conversation deleted");
```

}

function openConversation(id) {
const conversation = conversations.find(
conversation => conversation.id === id
);

```
if (!conversation) {
    return;
}

activeConversationId = id;

localStorage.setItem(ACTIVE_KEY, id);

updateModelUI();
renderConversationList();
renderChat();

sidebar.classList.remove("open");
```

}

function setConversationModel(modelId) {
if (!MODELS[modelId]) {
return;
}

```
const conversation = ensureActiveConversation();

if (conversation.model === modelId) {
    modelMenu.classList.remove("open");
    return;
}

conversation.model = modelId;
conversation.sessionId = null;
conversation.updatedAt = Date.now();

saveConversations();

updateModelUI();
renderConversationList();

modelMenu.classList.remove("open");

showToast(`${MODELS[modelId].name} selected`);
```

}

function addMessageElement(role, content, timestamp) {
const message = document.createElement("div");
message.className = `message ${role}`;

```
const avatar = document.createElement("div");

avatar.className =
    `avatar ${role === "assistant" ? "beam" : "user"}`;

if (role === "assistant") {
    const img = document.createElement("img");

    img.src = "./beamlogo1.png";
    img.alt = "Beam";

    avatar.appendChild(img);
} else {
    avatar.textContent = "YOU";
}

const body = document.createElement("div");
body.className = "message-body";

const header = document.createElement("div");
header.className = "message-header";

const name = document.createElement("span");
name.className = "message-name";
name.textContent =
    role === "assistant"
        ? "Beam"
        : "You";

const time = document.createElement("span");
time.className = "message-time";
time.textContent = formatTime(timestamp);

header.appendChild(name);
header.appendChild(time);

const text = document.createElement("div");
text.className = "message-content";
text.textContent = content;

body.appendChild(header);
body.appendChild(text);

if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = document.createElement("button");
    copy.className = "copy-message";
    copy.textContent = "Copy";

    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(content);

            copy.textContent = "Copied";

            setTimeout(() => {
                copy.textContent = "Copy";
            }, 1200);
        } catch {
            showToast("Couldn't copy message");
        }
    });

    actions.appendChild(copy);
    body.appendChild(actions);
}

message.appendChild(avatar);
message.appendChild(body);

return message;
```

}

function renderWelcome() {
const model = MODELS[getSelectedModel()];

```
const welcome = document.createElement("div");
welcome.className = "welcome";

welcome.innerHTML = `
    <div class="welcome-hero">
        <div class="hero-logo">
            <img src="./beamlogo1.png" alt="Beam">
        </div>

        <h1>What can I help with?</h1>

        <p class="welcome-subtitle">
            Ask ${model.name} a question, work through an idea,
            write something, or just start a conversation.
        </p>
    </div>

    <div class="suggestions">
        <button class="suggestion" data-prompt="Explain something interesting to me.">
            <span class="suggestion-icon">✦</span>
            <strong>Explain something</strong>
            <span>Break down a topic in a simple way.</span>
        </button>

        <button class="suggestion" data-prompt="Help me solve a problem.">
            <span class="suggestion-icon">⌁</span>
            <strong>Help me solve something</strong>
            <span>Work through a problem step by step.</span>
        </button>

        <button class="suggestion" data-prompt="Give me an interesting idea for a project.">
            <span class="suggestion-icon">◇</span>
            <strong>Brainstorm</strong>
            <span>Come up with something interesting.</span>
        </button>

        <button class="suggestion" data-prompt="Hey Beam, how are you?">
            <span class="suggestion-icon">◌</span>
            <strong>Just chat</strong>
            <span>Start a normal conversation.</span>
        </button>
    </div>
`;

chatArea.appendChild(welcome);

welcome.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        messageInput.value = button.dataset.prompt;
        updateComposer();
        resizeInput();
        messageInput.focus();
    });
});
```

}

function getMessageList() {
let list = chatArea.querySelector(".message-list");

```
if (!list) {
    list = document.createElement("div");
    list.className = "message-list";
    chatArea.appendChild(list);
}

return list;
```

}

function renderChat() {
chatArea.innerHTML = "";

```
updateModelUI();

const conversation = getActiveConversation();

if (!conversation || conversation.messages.length === 0) {
    renderWelcome();
    updateComposer();
    return;
}

const list = document.createElement("div");
list.className = "message-list";

for (const message of conversation.messages) {
    list.appendChild(
        addMessageElement(
            message.role,
            message.content,
            message.timestamp
        )
    );
}

chatArea.appendChild(list);

requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
});

updateComposer();
```

}

function showThinking() {
removeThinking();

```
const list = getMessageList();

const model = MODELS[getSelectedModel()];

const thinkingElement = document.createElement("div");

thinkingElement.className = "thinking";
thinkingElement.id = "thinkingIndicator";

thinkingElement.innerHTML = `
    <div class="avatar beam">
        <img src="./beamlogo1.png" alt="Beam">
    </div>

    <div class="thinking-content">
        <div class="thinking-header">
            <span>${model.name}</span>
        </div>

        <div class="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    </div>
`;

list.appendChild(thinkingElement);

requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
});
```

}

function removeThinking() {
document.getElementById("thinkingIndicator")?.remove();
}

function updateComposer() {
sendButton.disabled =
thinking ||
messageInput.value.trim().length === 0;
}

function resizeInput() {
messageInput.style.height = "auto";

```
messageInput.style.height =
    Math.min(messageInput.scrollHeight, 190) + "px";
```

}

async function sendMessage() {
const text = messageInput.value.trim();

```
if (!text || thinking) {
    return;
}

const conversation = ensureActiveConversation();

const timestamp = Date.now();

conversation.messages.push({
    role: "user",
    content: text,
    timestamp
});

if (
    conversation.title === "New conversation" ||
    conversation.messages.length === 1
) {
    conversation.title = deriveTitle(text);
}

conversation.updatedAt = timestamp;

messageInput.value = "";

resizeInput();

saveConversations();
renderConversationList();
renderChat();

thinking = true;

updateComposer();
showThinking();

try {
    const data = await sendToServer(
        conversation,
        text
    );

    const responseText =
        data.response ??
        data.message ??
        data.content ??
        "Beam returned an empty response.";

    conversation.messages.push({
        role: "assistant",
        content: String(responseText),
        timestamp: Date.now()
    });

    conversation.updatedAt = Date.now();

    saveConversations();
    renderConversationList();
    renderChat();
} catch (error) {
    removeThinking();

    conversation.messages.push({
        role: "assistant",
        content:
            `I couldn't reach the Beam server.\n\n${error.message}`,
        timestamp: Date.now()
    });

    conversation.updatedAt = Date.now();

    saveConversations();
    renderConversationList();
    renderChat();

    showToast("Beam server connection failed");
} finally {
    thinking = false;

    updateComposer();
    messageInput.focus();
}
```

}

function newChat() {
createConversation();
messageInput.focus();
}

function clearCurrentConversation() {
const conversation = getActiveConversation();

```
if (!conversation) {
    return;
}

conversation.messages = [];
conversation.title = "New conversation";
conversation.updatedAt = Date.now();
conversation.sessionId = null;

saveConversations();

renderConversationList();
renderChat();

showToast("Conversation cleared");
```

}

function exportConversation() {
const conversation = getActiveConversation();

```
if (!conversation || conversation.messages.length === 0) {
    showToast("Nothing to export");
    return;
}
```
