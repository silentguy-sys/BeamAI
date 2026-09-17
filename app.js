const API_URL = "https://desktop-3i8g9td.tailfff298.ts.net";

const STORAGE_KEY = "beam_conversations_v2";
const ACTIVE_KEY = "beam_active_conversation_v2";
const MODEL_KEY = "beam_selected_model_v1";

const MODELS = {
"beam-1": {
id: "beam-1",
name: "Beam 1"
},
"beam-o2": {
id: "beam-o2",
name: "Beam o2"
}
};

let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let activeConversationId = localStorage.getItem(ACTIVE_KEY);
let selectedModel = localStorage.getItem(MODEL_KEY) || "beam-1";
let thinking = false;

if (!MODELS[selectedModel]) {
selectedModel = "beam-1";
}

const chat = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const conversationList = document.getElementById("conversationList");
const conversationCount = document.getElementById("conversationCount");
const emptyConversations = document.getElementById("emptyConversations");
const chatSearch = document.getElementById("chatSearch");
const newChatButton = document.getElementById("newChatButton");
const clearButton = document.getElementById("clearButton");
const exportButton = document.getElementById("exportButton");
const modelInfoButton = document.getElementById("modelInfoButton");
const policyButton = document.getElementById("policyButton");
const sidebar = document.getElementById("sidebar");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const scrollBottomButton = document.getElementById("scrollBottomButton");

const modelTitle = document.querySelector(".model-title");
const modelCard = document.querySelector(".model-card");

function saveConversations() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function saveActiveConversation() {
if (activeConversationId) {
localStorage.setItem(ACTIVE_KEY, activeConversationId);
} else {
localStorage.removeItem(ACTIVE_KEY);
}
}

function saveSelectedModel() {
localStorage.setItem(MODEL_KEY, selectedModel);
}

function getSelectedModelName() {
return MODELS[selectedModel]?.name || "Beam 1";
}

function updateModelUI() {
const name = getSelectedModelName();

```
if (modelTitle) {
    modelTitle.textContent = name;
}

const cardName = modelCard?.querySelector(".model-card-info strong");

if (cardName) {
    cardName.textContent = name;
}

const selectedModelName = document.getElementById("selectedModelName");

if (selectedModelName) {
    selectedModelName.textContent = name;
}
```

}

function setSelectedModel(modelId) {
if (!MODELS[modelId] || thinking) {
return;
}

```
selectedModel = modelId;
saveSelectedModel();
updateModelUI();

const modal = document.getElementById("modal");

if (modal) {
    modal.classList.remove("show");
}

showToast(`${MODELS[modelId].name} selected`);
```

}

function createConversation() {
const conversation = {
id: crypto.randomUUID(),
title: "New chat",
session_id: null,
messages: [],
created_at: Date.now(),
updated_at: Date.now()
};

```
conversations.unshift(conversation);
activeConversationId = conversation.id;

saveConversations();
saveActiveConversation();

renderConversationList();
renderChat();
```

}

function getActiveConversation() {
return conversations.find(
conversation => conversation.id === activeConversationId
);
}

async function ensureSession(conversation) {
if (conversation.session_id) {
return conversation.session_id;
}

```
const response = await fetch(`${API_URL}/session`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
});

if (!response.ok) {
    throw new Error(`Session creation failed: ${response.status}`);
}

const data = await response.json();

conversation.session_id =
    data.session_id ||
    data.id ||
    data.session ||
    null;

if (!conversation.session_id) {
    throw new Error("Server did not return a session ID.");
}

saveConversations();

return conversation.session_id;
```

}

function escapeHtml(value) {
return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function formatMessage(text) {
return escapeHtml(text).replace(/\n/g, "<br>");
}

function getModelLabel(message) {
if (!message || !message.model || !MODELS[message.model]) {
return "Beam";
}

```
return MODELS[message.model].name;
```

}

function addMessageElement(message) {
const wrapper = document.createElement("div");
wrapper.className = `message ${message.role}`;

```
const avatar = document.createElement("div");
avatar.className = "message-avatar";

if (message.role === "assistant") {
    avatar.innerHTML = `<img src="./beamlogo1.png" alt="Beam">`;
} else {
    avatar.textContent = "You";
}

const body = document.createElement("div");
body.className = "message-body";

const content = document.createElement("div");
content.className = "message-content";
content.innerHTML = formatMessage(message.content || "");

body.appendChild(content);

if (message.role === "assistant") {
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = getModelLabel(message);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(message.content || "");
            showToast("Copied");
        } catch {
            showToast("Could not copy");
        }
    });

    actions.appendChild(copyButton);
    body.appendChild(actions);
}

wrapper.appendChild(avatar);
wrapper.appendChild(body);

chat.appendChild(wrapper);

return wrapper;
```

}

function renderWelcome() {
chat.innerHTML = "";

```
const welcome = document.createElement("div");
welcome.className = "welcome";

welcome.innerHTML = `
    <div class="welcome-logo">
        <img src="./beamlogo1.png" alt="Beam">
    </div>

    <h1>How can I help?</h1>
    <p>Ask Beam anything.</p>

    <div class="suggestions">
        <button class="suggestion" data-prompt="Explain something">
            <span>Explain something</span>
        </button>

        <button class="suggestion" data-prompt="Help me solve something">
            <span>Help me solve something</span>
        </button>

        <button class="suggestion" data-prompt="Brainstorm">
            <span>Brainstorm</span>
        </button>

        <button class="suggestion" data-prompt="Just chat">
            <span>Just chat</span>
        </button>
    </div>
`;

chat.appendChild(welcome);

welcome.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        messageInput.value = button.dataset.prompt;
        updateComposer();
        messageInput.focus();
    });
});
```

}

function renderChat() {
const conversation = getActiveConversation();

```
if (!conversation || conversation.messages.length === 0) {
    renderWelcome();
    updateTopbar();
    return;
}

chat.innerHTML = "";

conversation.messages.forEach(message => {
    addMessageElement(message);
});

updateTopbar();

requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
});
```

}

function updateTopbar() {
const conversation = getActiveConversation();

```
const titleElement = document.querySelector(".chat-title");

if (titleElement) {
    titleElement.textContent =
        conversation?.title && conversation.title !== "New chat"
            ? conversation.title
            : "New chat";
}

updateModelUI();
```

}

function renderConversationList() {
conversationList.innerHTML = "";

```
const query = (chatSearch?.value || "").trim().toLowerCase();

const filtered = conversations.filter(conversation => {
    if (!query) {
        return true;
    }

    const titleMatch =
        conversation.title?.toLowerCase().includes(query);

    const messageMatch =
        conversation.messages?.some(message =>
            message.content?.toLowerCase().includes(query)
        );

    return titleMatch || messageMatch;
});

if (conversationCount) {
    conversationCount.textContent = conversations.length;
}

if (emptyConversations) {
    emptyConversations.style.display =
        filtered.length === 0 ? "block" : "none";
}

filtered.forEach(conversation => {
    const item = document.createElement("div");
    item.className = "conversation-item";

    if (conversation.id === activeConversationId) {
        item.classList.add("active");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-open";

    const title = document.createElement("span");
    title.className = "conversation-title";
    title.textContent = conversation.title || "New chat";

    button.appendChild(title);

    button.addEventListener("click", () => {
        openConversation(conversation.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "conversation-delete";
    deleteButton.setAttribute("aria-label", "Delete conversation");
    deleteButton.textContent = "×";

    deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
    });

    item.appendChild(button);
    item.appendChild(deleteButton);

    conversationList.appendChild(item);
});
```

}

function openConversation(id) {
const conversation = conversations.find(
item => item.id === id
);

```
if (!conversation) {
    return;
}

activeConversationId = id;

saveActiveConversation();
renderConversationList();
renderChat();
updateComposer();

if (sidebar) {
    sidebar.classList.remove("open");
}
```

}

function deleteConversation(id) {
const index = conversations.findIndex(
conversation => conversation.id === id
);

```
if (index === -1) {
    return;
}

conversations.splice(index, 1);

if (activeConversationId === id) {
    activeConversationId =
        conversations.length > 0
            ? conversations[0].id
            : null;
}

saveConversations();
saveActiveConversation();

renderConversationList();
renderChat();
```

}

function newChat() {
if (thinking) {
return;
}

```
createConversation();
messageInput.value = "";
updateComposer();
messageInput.focus();
```

}

function updateComposer() {
if (!messageInput || !sendButton) {
return;
}

```
const hasText = messageInput.value.trim().length > 0;

sendButton.disabled = !hasText || thinking;
```

}

function resizeInput() {
if (!messageInput) {
return;
}

```
messageInput.style.height = "auto";
messageInput.style.height =
    `${Math.min(messageInput.scrollHeight, 180)}px`;
```

}

function showThinking() {
removeThinking();

```
thinking = true;
updateComposer();

const element = document.createElement("div");
element.className = "message assistant thinking-message";
element.id = "thinkingMessage";

element.innerHTML = `
    <div class="message-avatar">
        <img src="./beamlogo1.png" alt="Beam">
    </div>

    <div class="message-body">
        <div class="thinking">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <div class="thinking-model">${escapeHtml(getSelectedModelName())}</div>
    </div>
`;

chat.appendChild(element);

requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
});
```

}

function removeThinking() {
const element = document.getElementById("thinkingMessage");

```
if (element) {
    element.remove();
}

thinking = false;
updateComposer();
```

}

async function sendToServer(sessionId, message, model) {
let response = await fetch(`${API_URL}/chat`, {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
session_id: sessionId,
message,
model
})
});

```
if (response.status === 404) {
    const sessionResponse = await fetch(`${API_URL}/session`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!sessionResponse.ok) {
        throw new Error(`Session creation failed: ${sessionResponse.status}`);
    }

    const sessionData = await sessionResponse.json();

    const newSessionId =
        sessionData.session_id ||
        sessionData.id ||
        sessionData.session;

    if (!newSessionId) {
        throw new Error("Server did not return a session ID.");
    }

    response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            session_id: newSessionId,
            message,
            model
        })
    });

    if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
    }

    return {
        response,
        sessionId: newSessionId
    };
}

if (!response.ok) {
    let detail = "";

    try {
        const data = await response.json();
        detail = data.detail || data.message || "";
    } catch {
    }

    throw new Error(
        detail || `Chat request failed: ${response.status}`
    );
}

return {
    response,
    sessionId
};
```

}

async function sendMessage() {
if (thinking) {
return;
}

```
const message = messageInput.value.trim();

if (!message) {
    return;
}

let conversation = getActiveConversation();

if (!conversation) {
    createConversation();
    conversation = getActiveConversation();
}

const modelUsed = selectedModel;

conversation.messages.push({
    role: "user",
    content: message
});

if (
    !conversation.title ||
    conversation.title === "New chat"
) {
    conversation.title =
        message.length > 42
            ? `${message.slice(0, 42)}…`
            : message;
}

conversation.updated_at = Date.now();

messageInput.value = "";
resizeInput();

saveConversations();
renderConversationList();

if (chat.querySelector(".welcome")) {
    chat.innerHTML = "";
}

addMessageElement({
    role: "user",
    content: message
});

showThinking();

try {
    const sessionId = await ensureSession(conversation);

    const result = await sendToServer(
        sessionId,
        message,
        modelUsed
    );

    conversation.session_id = result.sessionId;

    const data = await result.response.json();

    const answer =
        data.response ||
        data.answer ||
        data.message ||
        "";

    if (!answer) {
        throw new Error("Beam returned an empty response.");
    }

    conversation.messages.push({
        role: "assistant",
        content: answer,
        model: modelUsed,
        sources: Array.isArray(data.sources)
            ? data.sources
            : []
    });

    conversation.updated_at = Date.now();

    saveConversations();

    removeThinking();

    addMessageElement({
        role: "assistant",
        content: answer,
        model: modelUsed,
        sources: data.sources
    });

    renderConversationList();

    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
} catch (error) {
    removeThinking();

    const errorMessage =
        error?.message ||
        "Something went wrong while contacting Beam.";

    addMessageElement({
        role: "assistant",
        content: errorMessage
    });

    conversation.messages.push({
        role: "assistant",
        content: errorMessage
    });

    conversation.updated_at = Date.now();

    saveConversations();
}

updateComposer();
```

}

function clearConversation() {
if (thinking) {
return;
}

```
const conversation = getActiveConversation();

if (!conversation) {
    return;
}

conversation.messages = [];
conversation.session_id = null;
conversation.title = "New chat";
conversation.updated_at = Date.now();

saveConversations();

renderConversationList();
renderChat();

messageInput.value = "";
resizeInput();
updateComposer();
```

}

function exportConversation() {
const conversation = getActiveConversation();

```
if (!conversation || conversation.messages.length === 0) {
    showToast("Nothing to export");
    return;
}

let output = `Beam conversation\n`;
output += `${"=".repeat(40)}\n\n`;

conversation.messages.forEach(message => {
    const role =
        message.role === "user"
            ? "You"
            : getModelLabel(message);

    output += `${role}:\n`;
    output += `${message.content || ""}\n\n`;
});

const blob = new Blob(
    [output],
    { type: "text/plain;charset=utf-8" }
);

const url = URL.createObjectURL(blob);

const link = document.createElement("a");
link.href = url;
link.download =
    `${(conversation.title || "beam-chat")
        .replace(/[<>:"/\\|?*]+/g, "")
        .trim() || "beam-chat"}.txt`;

document.body.appendChild(link);
link.click();
link.remove();

URL.revokeObjectURL(url);
```

}

function showToast(message) {
const toast = document.getElementById("toast");

```
if (!toast) {
    return;
}

toast.textContent = message;
toast.classList.add("show");

clearTimeout(showToast.timeout);

showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
}, 2200);
```

}

function openModal(type) {
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");

```
if (!modal || !modalTitle || !modalBody) {
    return;
}

if (type === "model") {
    modalTitle.textContent = "Choose model";

    modalBody.innerHTML = `
        <div class="model-options">
            <button
                type="button"
                class="model-option ${selectedModel === "beam-1" ? "selected" : ""}"
                data-model="beam-1"
            >
                <div class="model-option-logo">
                    <img src="./beamlogo1.png" alt="Beam">
                </div>
                <div class="model-option-info">
                    <strong>Beam 1</strong>
                    <span>${selectedModel === "beam-1" ? "Selected" : "Select Beam 1"}</span>
                </div>
            </button>

            <button
                type="button"
                class="model-option ${selectedModel === "beam-o2" ? "selected" : ""}"
                data-model="beam-o2"
            >
                <div class="model-option-logo">
                    <img src="./beamlogo1.png" alt="Beam">
                </div>
                <div class="model-option-info">
                    <strong>Beam o2</strong>
                    <span>${selectedModel === "beam-o2" ? "Selected" : "Select Beam o2"}</span>
                </div>
            </button>
        </div>
    `;

    modalBody.querySelectorAll(".model-option").forEach(option => {
        option.addEventListener("click", () => {
            setSelectedModel(option.dataset.model);
            openModal("model");
        });
    });
}

if (type === "policy") {
    modalTitle.textContent = "Beam policy";

    modalBody.innerHTML = `
        <p>
            Beam is designed to provide helpful and useful answers while
            being clear about uncertainty and limitations.
        </p>
        <p>
            Information may come from Beam's own knowledge or from
            web-grounded results when available.
        </p>
    `;
}

modal.classList.add("show");
```

}

function closeModal() {
const modal = document.getElementById("modal");

```
if (modal) {
    modal.classList.remove("show");
}
```

}

function openModelSelector() {
if (thinking) {
return;
}

```
openModal("model");
```

}

function updateScrollButton() {
if (!scrollBottomButton) {
return;
}

```
const distance =
    chat.scrollHeight -
    chat.scrollTop -
    chat.clientHeight;

scrollBottomButton.classList.toggle(
    "show",
    distance > 300
);
```

}

if (newChatButton) {
newChatButton.addEventListener("click", newChat);
}

if (clearButton) {
clearButton.addEventListener("click", clearConversation);
}

if (exportButton) {
exportButton.addEventListener("click", exportConversation);
}

if (modelInfoButton) {
modelInfoButton.addEventListener("click", () => {
openModal("model");
});
}

if (policyButton) {
policyButton.addEventListener("click", () => {
openModal("policy");
});
}

if (chatSearch) {
chatSearch.addEventListener("input", renderConversationList);
}

if (sendButton) {
sendButton.addEventListener("click", sendMessage);
}

if (messageInput) {
messageInput.addEventListener("input", () => {
resizeInput();
updateComposer();
});

```
messageInput.addEventListener("keydown", event => {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();

        if (!thinking) {
            sendMessage();
        }
    }
});
```

}

if (mobileMenuButton) {
mobileMenuButton.addEventListener("click", () => {
if (sidebar) {
sidebar.classList.toggle("open");
}
});
}

if (scrollBottomButton) {
scrollBottomButton.addEventListener("click", () => {
chat.scrollTo({
top: chat.scrollHeight,
behavior: "smooth"
});
});
}

chat.addEventListener("scroll", updateScrollButton);

document.addEventListener("click", event => {
const modal = document.getElementById("modal");

```
if (
    modal &&
    event.target === modal
) {
    closeModal();
}

if (
    sidebar &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    event.target !== mobileMenuButton
) {
    sidebar.classList.remove("open");
}
```

});

document.addEventListener("keydown", event => {
if (event.key === "Escape") {
closeModal();

```
    if (sidebar) {
        sidebar.classList.remove("open");
    }
}

if (
    event.key.toLowerCase() === "n" &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    document.activeElement !== messageInput &&
    !thinking
) {
    newChat();
}
```

});

if (modelCard) {
modelCard.style.cursor = "pointer";

```
modelCard.addEventListener("click", () => {
    openModelSelector();
});
```

}

function initialize() {
updateModelUI();

```
if (
    !activeConversationId ||
    !conversations.some(
        conversation =>
            conversation.id === activeConversationId
    )
) {
    activeConversationId =
        conversations.length > 0
            ? conversations[0].id
            : null;

    saveActiveConversation();
}

if (!activeConversationId) {
    createConversation();
} else {
    renderConversationList();
    renderChat();
}

resizeInput();
updateComposer();
updateScrollButton();
```

}

initialize();
