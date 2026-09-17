
const API_URL = "https://desktop-3i8g9td.tailfff298.ts.net";

const CONVERSATIONS_KEY = "beam_conversations_v2";
const ACTIVE_CONVERSATION_KEY = "beam_active_conversation_v2";
const SELECTED_MODEL_KEY = "beam_selected_model_v1";

const MODEL_INFO = {
    "beam-1": {
        name: "Beam 1",
        short: "8B · Main / GPU",
        description: "Qwen3-8B · 4-bit NF4 · GPU/RAM offload",
        icon: "✦"
    },
    "beam-o2": {
        name: "Beam o2",
        short: "1.5B · Lightweight / CPU",
        description: "1.5B · CPU",
        icon: "◈"
    }
};

let conversations = loadConversations();
let activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
let selectedModel = localStorage.getItem(SELECTED_MODEL_KEY) || "beam-1";
let generating = false;

if (!MODEL_INFO[selectedModel]) {
    selectedModel = "beam-1";
}

function loadConversations() {
    try {
        return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveConversations() {
    localStorage.setItem(
        CONVERSATIONS_KEY,
        JSON.stringify(conversations)
    );
}

function createConversation() {
    const conversation = {
        id: crypto.randomUUID(),
        title: "New chat",
        messages: [],
        created_at: Date.now()
    };

    conversations.unshift(conversation);
    activeConversationId = conversation.id;

    localStorage.setItem(
        ACTIVE_CONVERSATION_KEY,
        activeConversationId
    );

    saveConversations();

    return conversation;
}

function getActiveConversation() {
    return conversations.find(
        conversation => conversation.id === activeConversationId
    );
}

function ensureConversation() {
    let conversation = getActiveConversation();

    if (!conversation) {
        conversation = createConversation();
    }

    return conversation;
}

function updateModelUI() {
    const model = MODEL_INFO[selectedModel];

    document.getElementById("sidebarModelName").textContent =
        model.name;

    document.getElementById("sidebarModelStatus").textContent =
        model.short;

    document.getElementById("topbarModelName").textContent =
        model.name;

    document.querySelectorAll(".model-option").forEach(option => {
        option.classList.toggle(
            "active",
            option.dataset.model === selectedModel
        );
    });

    document.getElementById("modalTitle").textContent =
        model.name;

    document.getElementById("modalDescription").textContent =
        model.description;
}

function setModel(model) {
    if (!MODEL_INFO[model]) return;
    if (generating) return;

    selectedModel = model;

    localStorage.setItem(
        SELECTED_MODEL_KEY,
        selectedModel
    );

    updateModelUI();
    closeModelMenu();
}

function openModelMenu() {
    if (generating) return;

    document
        .getElementById("modelSelector")
        .classList.add("open");
}

function closeModelMenu() {
    document
        .getElementById("modelSelector")
        .classList.remove("open");
}

function renderConversations() {
    const list = document.getElementById("conversationList");
    list.innerHTML = "";

    conversations.forEach(conversation => {
        const button = document.createElement("button");

        button.className =
            "conversation-item" +
            (conversation.id === activeConversationId
                ? " active"
                : "");

        button.textContent =
            conversation.title || "New chat";

        button.onclick = () => {
            if (generating) return;

            activeConversationId = conversation.id;

            localStorage.setItem(
                ACTIVE_CONVERSATION_KEY,
                activeConversationId
            );

            renderConversations();
            renderMessages();
            closeSidebar();
        };

        list.appendChild(button);
    });
}

function renderMessages() {
    const chat = document.getElementById("chat");
    const welcome = document.getElementById("welcome");

    chat.innerHTML = "";

    const conversation = getActiveConversation();

    if (!conversation || conversation.messages.length === 0) {
        chat.appendChild(welcome);
        welcome.style.display = "flex";
        return;
    }

    welcome.style.display = "none";

    conversation.messages.forEach(message => {
        addMessageToUI(
            message.role,
            message.content,
            message.model
        );
    });

    scrollToBottom();
}

function addMessageToUI(role, content, model = null) {
    const chat = document.getElementById("chat");

    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;

    const inner = document.createElement("div");
    inner.className = "message-inner";

    if (role === "user") {
        inner.textContent = content;
    } else {
        const header = document.createElement("div");
        header.className = "message-header";

        const modelName =
            MODEL_INFO[model]?.name || "Beam";

        header.textContent = modelName;

        const body = document.createElement("div");
        body.className = "message-content";
        body.textContent = content;

        inner.appendChild(header);
        inner.appendChild(body);
    }

    wrapper.appendChild(inner);
    chat.appendChild(wrapper);

    return wrapper;
}

function createStreamingMessage(model) {
    const chat = document.getElementById("chat");

    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";

    const inner = document.createElement("div");
    inner.className = "message-inner";

    const header = document.createElement("div");
    header.className = "message-header";
    header.textContent =
        MODEL_INFO[model]?.name || "Beam";

    const body = document.createElement("div");
    body.className = "message-content streaming";

    inner.appendChild(header);
    inner.appendChild(body);

    wrapper.appendChild(inner);
    chat.appendChild(wrapper);

    return body;
}

function showThinking(model) {
    const chat = document.getElementById("chat");

    const wrapper = document.createElement("div");
    wrapper.className = "message assistant thinking-message";

    const inner = document.createElement("div");
    inner.className = "message-inner";

    const header = document.createElement("div");
    header.className = "message-header";
    header.textContent =
        MODEL_INFO[model]?.name || "Beam";

    const thinking = document.createElement("div");
    thinking.className = "thinking";

    thinking.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    inner.appendChild(header);
    inner.appendChild(thinking);
    wrapper.appendChild(inner);
    chat.appendChild(wrapper);

    scrollToBottom();

    return wrapper;
}

async function sendMessage() {
    if (generating) return;

    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text) return;

    const conversation = ensureConversation();

    if (conversation.messages.length === 0) {
        conversation.title =
            text.length > 40
                ? text.substring(0, 40) + "..."
                : text;
    }

    conversation.messages.push({
        role: "user",
        content: text
    });

    saveConversations();
    renderConversations();

    addMessageToUI("user", text);

    input.value = "";
    resizeTextarea();
    updateSendButton();

    generating = true;
    updateGeneratingState();

    const thinking = showThinking(selectedModel);

    scrollToBottom();

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: conversation.id,
                message: text,
                model: selectedModel
            })
        });

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        thinking.remove();

        const contentType =
            response.headers.get("content-type") || "";

        if (
            contentType.includes("text/event-stream") ||
            contentType.includes("text/plain")
        ) {
            await handleStreamingResponse(
                response,
                conversation,
                selectedModel
            );
        } else {
            const data = await response.json();

            const answer =
                data.response ||
                data.answer ||
                data.message ||
                "";

            const assistantModel =
                data.model || selectedModel;

            conversation.messages.push({
                role: "assistant",
                content: answer,
                model: assistantModel
            });

            saveConversations();

            addMessageToUI(
                "assistant",
                answer,
                assistantModel
            );

            scrollToBottom();
        }

    } catch (error) {
        console.error(error);

        thinking.remove();

        const errorText =
            "I couldn't connect to the Beam server.";

        conversation.messages.push({
            role: "assistant",
            content: errorText,
            model: selectedModel
        });

        saveConversations();

        addMessageToUI(
            "assistant",
            errorText,
            selectedModel
        );

        showToast("Connection failed");
    }

    generating = false;
    updateGeneratingState();
}

async function handleStreamingResponse(
    response,
    conversation,
    model
) {
    const body = createStreamingMessage(model);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";

    while (true) {
        const { value, done } =
            await reader.read();

        if (done) break;

        const chunk =
            decoder.decode(value, { stream: true });

        const pieces =
            parseStreamChunk(chunk);

        for (const piece of pieces) {
            if (!piece) continue;

            fullText += piece;
            body.textContent = fullText;

            scrollToBottom();
        }
    }

    if (!fullText.trim()) {
        fullText = "Beam returned an empty response.";
        body.textContent = fullText;
    }

    conversation.messages.push({
        role: "assistant",
        content: fullText,
        model: model
    });

    saveConversations();
}

function parseStreamChunk(chunk) {
    const output = [];

    const lines = chunk.split("\n");

    for (let line of lines) {
        line = line.trim();

        if (!line) continue;

        if (line.startsWith("data:")) {
            line = line.substring(5).trim();
        }

        if (!line) continue;
        if (line === "[DONE]") continue;

        try {
            const parsed = JSON.parse(line);

            if (typeof parsed === "string") {
                output.push(parsed);
            } else if (parsed.token) {
                output.push(parsed.token);
            } else if (parsed.text) {
                output.push(parsed.text);
            } else if (parsed.response) {
                output.push(parsed.response);
            }
        } catch {
            output.push(line);
        }
    }

    return output;
}

function updateGeneratingState() {
    const sendButton =
        document.getElementById("sendButton");

    const input =
        document.getElementById("messageInput");

    sendButton.disabled =
        generating || !input.value.trim();

    if (generating) {
        input.placeholder = "Beam is generating...";
    } else {
        input.placeholder = "Message Beam...";
    }
}

function updateSendButton() {
    const input =
        document.getElementById("messageInput");

    const button =
        document.getElementById("sendButton");

    button.disabled =
        generating || !input.value.trim();
}

function resizeTextarea() {
    const input =
        document.getElementById("messageInput");

    input.style.height = "auto";

    input.style.height =
        Math.min(input.scrollHeight, 180) + "px";
}

function scrollToBottom() {
    const chat = document.getElementById("chat");

    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
}

function newChat() {
    if (generating) return;

    createConversation();
    renderConversations();
    renderMessages();

    document.getElementById("messageInput").focus();
}

function showToast(message) {
    const toast =
        document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function openModal() {
    if (generating) return;

    updateModelUI();

    document
        .getElementById("modalBackdrop")
        .classList.add("show");
}

function closeModal() {
    document
        .getElementById("modalBackdrop")
        .classList.remove("show");
}

function openSidebar() {
    document
        .getElementById("sidebar")
        .classList.add("open");

    document
        .getElementById("mobileOverlay")
        .classList.add("show");
}

function closeSidebar() {
    document
        .getElementById("sidebar")
        .classList.remove("open");

    document
        .getElementById("mobileOverlay")
        .classList.remove("show");
}

document.addEventListener("DOMContentLoaded", () => {
    updateModelUI();

    renderConversations();

    if (!activeConversationId) {
        createConversation();
    }

    renderConversations();
    renderMessages();

    const input =
        document.getElementById("messageInput");

    input.addEventListener("input", () => {
        resizeTextarea();
        updateSendButton();
    });

    input.addEventListener("keydown", event => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            if (!generating) {
                sendMessage();
            }
        }
    });

    document
        .getElementById("sendButton")
        .addEventListener("click", sendMessage);

    document
        .getElementById("newChat")
        .addEventListener("click", newChat);

    document
        .getElementById("menuButton")
        .addEventListener("click", openSidebar);

    document
        .getElementById("mobileOverlay")
        .addEventListener("click", closeSidebar);

    document
        .getElementById("modelSelector")
        .addEventListener("click", event => {
            event.stopPropagation();

            if (
                event.target.closest(".model-option")
            ) {
                setModel(
                    event.target.closest(".model-option")
                        .dataset.model
                );
                return;
            }

            const selector =
                document.getElementById("modelSelector");

            if (selector.classList.contains("open")) {
                closeModelMenu();
            } else {
                openModelMenu();
            }
        });

    document
        .getElementById("mobileModelButton")
        .addEventListener("click", openModal);

    document
        .getElementById("modalClose")
        .addEventListener("click", closeModal);

    document
        .getElementById("modalDone")
        .addEventListener("click", closeModal);

    document
        .getElementById("modalBackdrop")
        .addEventListener("click", event => {
            if (event.target.id === "modalBackdrop") {
                closeModal();
            }
        });

    document.addEventListener("click", event => {
        const selector =
            document.getElementById("modelSelector");

        if (!selector.contains(event.target)) {
            closeModelMenu();
        }
    });

    updateSendButton();
});
