const API_URL = "https://desktop-3i8g9td.tailfff298.ts.net/";

const STORAGE_KEY = "beam_conversations_v2";
const ACTIVE_KEY = "beam_active_conversation_v2";
const MODEL_KEY = "beam_selected_model_v1";

const MODELS = {
    "beam-1": {
        name: "Beam 1",
        description: "Beam 1"
    },
    "beam-o2": {
        name: "Beam o2",
        description: "Beam o2"
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
const modelMenu = document.getElementById("modelMenu");
const modelOptions = document.querySelectorAll(".model-option");
const selectedModelName = document.getElementById("selectedModelName");
const topModelName = document.getElementById("topModelName");
const mobileModelName = document.getElementById("mobileModelName");
const mobileModelButton = document.getElementById("mobileModelButton");

let conversations = loadConversations();
let activeConversationId = localStorage.getItem(ACTIVE_KEY) || null;
let selectedModel = localStorage.getItem(MODEL_KEY) || "beam-1";
let currentView = "chats";
let thinking = false;

if (!MODELS[selectedModel]) {
    selectedModel = "beam-1";
}
function loadConversations() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        );
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveConversations() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
    );
}

function updateModelUI() {
    const model = MODELS[selectedModel];
    selectedModelName.textContent = model.name;
    topModelName.textContent = model.name;
    mobileModelName.textContent = model.name;

    modelOptions.forEach(option => {
        option.classList.toggle(
            "active",
            option.dataset.model === selectedModel
        );
    });
}

function closeModelMenu() {
    modelMenu.classList.add("hidden");
}

function toggleModelMenu() {
    if (thinking) {
        return;
    }
    modelMenu.classList.toggle("hidden");
}

function selectModel(model) {
    if (thinking) {
        return;
    }
    if (!MODELS[model]) {
        return;
    }
    selectedModel = model;
    localStorage.setItem(MODEL_KEY, selectedModel);
    updateModelUI();
    closeModelMenu();
    showToast(`${MODELS[selectedModel].name} selected`);
}
function createConversation() {
    const now = Date.now();
    const conversation = {
        id: crypto.randomUUID(),
        sessionId: null,
        title: "New conversation",
        messages: [],
        createdAt: now,
        updatedAt: now
    };
    conversations.unshift(conversation);
    activeConversationId = conversation.id;
    localStorage.setItem(ACTIVE_KEY, activeConversationId);
    saveConversations();
    renderConversationList();
    renderChat();
}

function getActiveConversation() {
    return conversations.find(
        conversation => conversation.id === activeConversationId
    ) || null;
}

function ensureActiveConversation() {
    let conversation = getActiveConversation();
    if (!conversation) {
        createConversation();
        conversation = getActiveConversation();
    }
    return conversation;
}

async function createSession(conversation) {
    const response = await fetch(
        `${API_URL}/session`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
    if (!response.ok) {
        throw new Error(`Session creation failed (${response.status})`);
    }
    const data = await response.json();
    conversation.sessionId = data.session_id;
    conversation.updatedAt = Date.now();
    saveConversations();
    return data.session_id;
}

async function ensureSession(conversation) {
    if (conversation.sessionId) {
        return conversation.sessionId;
    }
    return await createSession(conversation);
}

function formatTime(timestamp) {
    return new Intl.DateTimeFormat(
        undefined,
        { hour: "numeric", minute: "2-digit" }
    ).format(new Date(timestamp));
}

function formatConversationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
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
    return new Intl.DateTimeFormat(
        undefined,
        { month: "short", day: "numeric" }
    ).format(date);
}

function deriveTitle(text) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "New conversation";
    }
    if (cleaned.length <= 48) {
        return cleaned;
    }
    return cleaned.slice(0, 45).trimEnd() + "...";
}

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2600);
}
function renderConversationList() {
    const query = chatSearch.value.trim().toLowerCase();
    const filtered = conversations
        .filter(conversation => {
            if (!query) {
                return true;
            }
            return (
                conversation.title.toLowerCase().includes(query) ||
                conversation.messages.some(
                    message => message.content.toLowerCase().includes(query)
                )
            );
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);

    conversationHeading.textContent = currentView === "recents" ? "Recent" : "Today";
    conversationCount.textContent = filtered.length;
    conversationList.innerHTML = "";
    emptyConversations.style.display = filtered.length === 0 ? "flex" : "none";

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
        time.textContent = formatConversationTime(conversation.updatedAt);

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
}

function deleteConversation(id) {
    conversations = conversations.filter(conversation => conversation.id !== id);
    saveConversations();

    if (activeConversationId === id) {
        activeConversationId = null;
        localStorage.removeItem(ACTIVE_KEY);

        if (conversations.length > 0) {
            conversations.sort((a, b) => b.updatedAt - a.updatedAt);
            activeConversationId = conversations.id;
            localStorage.setItem(ACTIVE_KEY, activeConversationId);
        }
    }
    renderConversationList();
    renderChat();
    showToast("Conversation deleted");
}

function openConversation(id) {
    if (thinking) {
        return;
    }
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) {
        return;
    }
    activeConversationId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    renderConversationList();
    renderChat();
    sidebar.classList.remove("open");
}

function addMessageElement(role, content, timestamp, model) {
    const message = document.createElement("div");
    message.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${role === "assistant" ? "beam" : "user"}`;

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
    name.textContent = role === "assistant" ? (MODELS[model]?.name || "Beam") : "You";

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
                await navigator.clipboard.writeText(text.textContent);
                copy.textContent = "Copied";
                setTimeout(() => { copy.textContent = "Copy"; }, 1200);
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
}
function renderWelcome() {
    const welcome = document.createElement("div");
    welcome.className = "welcome";
    welcome.innerHTML = `
        <div class="welcome-hero">
            <div class="hero-logo">
                <img src="./beamlogo1.png" alt="Beam">
            </div>
            <h1>What can I help with?</h1>
            <p class="welcome-subtitle">
                Ask Beam a question, work through an idea, write something, or just start a conversation.
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
        button.addEventListener("click", async () => {
            if (thinking) {
                return;
            }
            messageInput.value = button.dataset.prompt;
            updateComposer();
            await sendMessage();
        });
    });
}

function getMessageList() {
    let list = chatArea.querySelector(".message-list");
    if (!list) {
        list = document.createElement("div");
        list.className = "message-list";
        chatArea.appendChild(list);
    }
    return list;
}

function renderChat() {
    chatArea.innerHTML = "";
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
            addMessageElement(message.role, message.content, message.timestamp, message.model)
        );
    }
    chatArea.appendChild(list);

    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });
    updateComposer();
}

function showThinking(model) {
    removeThinking();
    const list = getMessageList();
    const thinkingElement = document.createElement("div");
    thinkingElement.className = "thinking";
    thinkingElement.id = "thinkingIndicator";
    const modelName = MODELS[model]?.name || "Beam";

    thinkingElement.innerHTML = `
        <div class="avatar beam">
            <img src="./beamlogo1.png" alt="Beam">
        </div>
        <div class="thinking-content">
            <div class="thinking-header">
                <span>${modelName}</span>
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
}

function removeThinking() {
    document.getElementById("thinkingIndicator")?.remove();
}

function updateComposer() {
    sendButton.disabled = thinking || messageInput.value.trim().length === 0;
}

function resizeInput() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 190) + "px";
}
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || thinking) {
        return;
    }

    const conversation = ensureActiveConversation();
    const modelUsed = selectedModel;
    const timestamp = Date.now();

    conversation.messages.push({
        role: "user",
        content: text,
        timestamp
    });

    if (conversation.title === "New conversation" || conversation.messages.length === 1) {
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
    showThinking(modelUsed);

    let assistantMessageElement = null;
    let assistantTextNode = null;
    let fullResponseText = "";

    try {
        let sessionId = await ensureSession(conversation);
        let response = await fetch(
            `${API_URL}/chat/stream`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: text,
                    model: modelUsed
                })
            }
        );

        if (response.status === 404) {
            conversation.sessionId = null;
            saveConversations();
            sessionId = await createSession(conversation);
            response = await fetch(
                `${API_URL}/chat/stream`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        session_id: sessionId,
                        message: text,
                        model: modelUsed
                    })
                }
            );
        }

        if (!response.ok) {
            let detail = "";
            try {
                const errorData = await response.json();
                detail = errorData.detail || errorData.message || "";
            } catch {}
            throw new Error(detail || `Server error (${response.status})`);
        }

        removeThinking();

        const list = getMessageList();
        assistantMessageElement = addMessageElement("assistant", "", Date.now(), modelUsed);
        list.appendChild(assistantMessageElement);
        assistantTextNode = assistantMessageElement.querySelector(".message-content");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            fullResponseText += chunk;
            assistantTextNode.textContent = fullResponseText;
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        if (!fullResponseText) {
            fullResponseText = "Beam returned an empty response.";
            assistantTextNode.textContent = fullResponseText;
        }

        conversation.messages.push({
            role: "assistant",
            content: String(fullResponseText),
            timestamp: Date.now(),
            model: modelUsed
        });
        conversation.updatedAt = Date.now();
        saveConversations();
        renderConversationList();

    } catch (error) {
        removeThinking();
        if (assistantMessageElement) {
            assistantMessageElement.remove();
        }

        conversation.messages.push({
            role: "assistant",
            content: "I couldn't reach the Beam server.\n\n" + error.message,
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
}

function newChat() {
    if (thinking) {
        return;
    }
    createConversation();
    messageInput.focus();
}

function clearCurrentConversation() {
    if (thinking) {
        return;
    }
    const conversation = getActiveConversation();
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
}

function exportConversation() {
    const conversation = getActiveConversation();
    if (!conversation || conversation.messages.length === 0) {
        showToast("Nothing to export");
        return;
    }

    const lines = [
        "Beam conversation",
        `Title: ${conversation.title}`,
        `Date: ${new Date(conversation.createdAt).toLocaleString()}`,
        "",
        "----------------------------------------",
        ""
    ];

    for (const message of conversation.messages) {
        const speaker = message.role === "assistant" ? (MODELS[message.model]?.name || "Beam") : "You";
        lines.push(
            `${speaker} — ${new Date(message.timestamp).toLocaleString()}`,
            message.content,
            "",
            "----------------------------------------",
            ""
        );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${conversation.title.replace(/[\\/:*?"<>|]/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openModal(type) {
    modal.classList.remove("hidden");
    if (type === "model") {
        const model = MODELS[selectedModel];
        modalContent.innerHTML = `
            <div class="modal-content">
                <h2>${model.name}</h2>
                <p>${model.description}</p>
                <p>The selected model is used for new messages in this conversation.</p>
            </div>
        `;
    }
    if (type === "policy") {
        modalContent.innerHTML = `
            <div class="modal-content">
                <h2>Beam policy</h2>
                <p>Beam is an experimental AI project. Responses can be incorrect, incomplete, outdated, or misleading.</p>
                <p>Do not rely on Beam for medical, legal, financial, emergency, or other high-stakes decisions.</p>
                <p>This public beta is operated through a personally hosted Beam server. Availability, performance, session persistence, and response quality may change without notice.</p>
            </div>
        `;
    }
}

function closeModal() {
    modal.classList.add("hidden");
}

function updateScrollButton() {
    const distance = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    scrollBottom.classList.toggle("visible", distance > 250);
}

messageInput.addEventListener("input", () => {
    resizeInput();
    updateComposer();
});

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener("click", sendMessage);
newChatButton.addEventListener("click", newChat);
clearButton.addEventListener("click", clearCurrentConversation);
exportButton.addEventListener("click", exportConversation);
scrollBottom.addEventListener("click", () => {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
});

chatArea.addEventListener("scroll", updateScrollButton);
chatSearch.addEventListener("input", renderConversationList);
mobileMenu.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

modelSelector.addEventListener("click", event => {
    event.stopPropagation();
    toggleModelMenu();
});

mobileModelButton.addEventListener("click", event => {
    event.stopPropagation();
    sidebar.classList.toggle("open");
    modelMenu.classList.remove("hidden");
});

modelOptions.forEach(option => {
    option.addEventListener("click", event => {
        event.stopPropagation();
        selectModel(option.dataset.model);
    });
});

document.addEventListener("click", event => {
    if (!modelMenu.contains(event.target) && event.target !== modelSelector) {
        closeModelMenu();
    }
});

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.remove("active");
        });
        button.classList.add("active");
        currentView = button.dataset.view;
        renderConversationList();
    });
});

document.getElementById("modelInfoButton").addEventListener("click", () => { openModal("model"); });
document.getElementById("policyButton").addEventListener("click", () => { openModal("policy"); });
modalClose.addEventListener("click", closeModal);
modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
        closeModelMenu();
    }
    if (
        event.key.toLowerCase() === "n" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        document.activeElement !== messageInput &&
        document.activeElement !== chatSearch
    ) {
        newChat();
    }
});

updateModelUI();

if (conversations.length === 0) {
    createConversation();
} else {
    if (!getActiveConversation()) {
        conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        activeConversationId = conversations[0].id;
        localStorage.setItem(ACTIVE_KEY, activeConversationId);
    }
    renderConversationList();
    renderChat();
}

updateComposer();
resizeInput();
