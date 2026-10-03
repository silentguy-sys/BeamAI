"use strict";

// ---------- CONFIG ----------
// When the page is opened from the Beam server itself, use that. Otherwise (GitHub Pages)
// set your public server URL once in the browser console:
//   localStorage.setItem("beam_api_url", "https://your-tunnel-url")
const API_URL = (() => {
    const saved = localStorage.getItem("beam_api_url");
    if (saved) return saved.replace(/\/$/, "");
    if (["127.0.0.1", "localhost"].includes(location.hostname)) return location.origin;
    return "http://127.0.0.1:8000";
})();

const AUTH_KEY = "beam_auth_email_v1";
const TOKEN_KEY = "beam_auth_token_v1";
const CONV_KEY = "beam_conversations_v1";
const MODEL_KEY = "beam_model_v1";
const THEME_KEY = "beam_theme_v1";

const MODELS = {
    "beam-1": { name: "Beam 1", info: "Daily use, light coding, and talking." },
    "beam-1-fol": { name: "Beam 1 Fol", info: "Stronger coding and conversation, better than Beam 1." },
    "beam-syntax-1": { name: "BeamSyntax 1", info: "Dedicated coding model on the remote RTX 4060 rig." },
    "beam-o2": { name: "Beam o2", info: "Mini model, lighter usage, made for talking." },
    "beam-o1-flash": { name: "O1 Flash", info: "Fast and light. Works without logging in." }
};
const GUEST_MODELS = ["beam-o1-flash"];

// ---------- AUTH HELPERS ----------
function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
}

function isLoggedIn() {
    return !!localStorage.getItem(AUTH_KEY) && !!getToken();
}

function chatBody(sessionId, message, model, guest) {
    return JSON.stringify({
        session_id: sessionId,
        message: message,
        model: model,
        guest: guest,
        token: getToken()
    });
}

// ---------- STATE ----------
const $ = id => document.getElementById(id);
let conversations = [];
let currentId = null;
let currentModel = localStorage.getItem(MODEL_KEY) || "beam-1";
if (!MODELS[currentModel]) currentModel = "beam-1";
let view = "chats";
let sending = false;
let health = {};

function loadConversations() {
    try { conversations = JSON.parse(localStorage.getItem(CONV_KEY)) || []; }
    catch { conversations = []; }
}

function saveConversations() {
    try { localStorage.setItem(CONV_KEY, JSON.stringify(conversations.slice(0, 100))); } catch {}
}

function resetConversationSessions() {
    conversations.forEach(c => { c.sessionId = null; });
    saveConversations();
}

function currentConv() {
    return conversations.find(c => c.id === currentId) || null;
}

function newConversation() {
    const c = { id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), title: "New chat",
                messages: [], sessionId: null, updated: Date.now() };
    conversations.unshift(c);
    currentId = c.id;
    saveConversations();
    renderAll();
    $("messageInput").focus();
    return c;
}

// ---------- UTIL ----------
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(text) {
    const parts = text.split(/```/);
    return parts.map((p, i) => {
        if (i % 2 === 1) {
            const nl = p.indexOf("\n");
            const lang = nl > -1 ? p.slice(0, nl).trim() : "";
            const code = nl > -1 ? p.slice(nl + 1) : p;
            return `<pre><code data-lang="${esc(lang)}">${esc(code.replace(/\n$/, ""))}</code></pre>`;
        }
        return esc(p)
            .replace(/`([^`\n]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }).join("");
}

function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    $("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.body.classList.toggle("light", t === "light");
}

// ---------- RENDERING ----------
function renderConversationList() {
    const q = $("chatSearch").value.trim().toLowerCase();
    let list = conversations.filter(c => !q || c.title.toLowerCase().includes(q));
    if (view === "recents") list = [...list].sort((a, b) => b.updated - a.updated).slice(0, 10);
    $("conversationHeading").textContent = view === "recents" ? "Recent" : "Today";
    $("conversationCount").textContent = list.length;
    $("emptyConversations").style.display = list.length ? "none" : "";
    const box = $("conversationList");
    box.innerHTML = "";
    list.forEach(c => {
        const row = document.createElement("div");
        row.className = "conversation-item" + (c.id === currentId ? " active" : "");
        const title = document.createElement("span");
        title.className = "conversation-title";
        title.textContent = c.title;
        const del = document.createElement("button");
        del.className = "conversation-delete";
        del.textContent = "×";
        del.title = "Delete";
        del.onclick = e => { e.stopPropagation(); deleteConversation(c.id); };
        row.append(title, del);
        row.onclick = () => { currentId = c.id; renderAll(); $("sidebar").classList.remove("open"); };
        box.appendChild(row);
    });
}

function addMessageEl(role, content, sources) {
    const area = $("chatArea");
    const wrap = document.createElement("div");
    wrap.className = "message " + role;
    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML = render(content || "");
    wrap.appendChild(body);
    if (sources && sources.length) wrap.appendChild(sourcesEl(sources));
    area.appendChild(wrap);
    return { wrap, body };
}

function sourcesEl(sources) {
    const d = document.createElement("div");
    d.className = "message-sources";
    sources.forEach(s => {
        const a = document.createElement("a");
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = s.title;
        d.appendChild(a);
    });
    return d;
}

function renderMessages() {
    const area = $("chatArea");
    area.innerHTML = "";
    const c = currentConv();
    if (!c || !c.messages.length) {
        area.innerHTML = '<div class="welcome"><h1>Beam</h1><p>How can I help you today?</p></div>';
        return;
    }
    c.messages.forEach(m => addMessageEl(m.role, m.content, m.sources));
    area.scrollTop = area.scrollHeight;
}

function renderAuth() {
    const inn = isLoggedIn();
    $("authSignedOut").style.display = inn ? "none" : "";
    $("authSignedIn").style.display = inn ? "" : "none";
    $("authEmail").textContent = localStorage.getItem(AUTH_KEY) || "";
}

function renderModelUI() {
    const name = MODELS[currentModel].name;
    $("selectedModelName").textContent = name;
    $("topModelName").textContent = name;
    $("mobileModelName").textContent = name;
    document.querySelectorAll(".model-option").forEach(b => {
        const id = b.dataset.model;
        b.classList.toggle("active", id === currentModel);
        const dot = b.querySelector(".model-option-dot");
        const h = health[id];
        if (dot) {
            dot.classList.toggle("online", !!(h && h.running));
            dot.classList.toggle("offline", !!(h && !h.running));
        }
    });
    const h = health[currentModel];
    const known = !!h;
    const up = !!(h && h.running);
    const text = !known ? "Checking..." : up ? "Online" : "Offline";
    $("sidebarStatusText").textContent = text;
    $("topStatusText").textContent = text;
    $("topStatusPill").classList.toggle("online", up);
    $("topStatusPill").classList.toggle("offline", known && !up);
}

function renderAll() {
    renderConversationList();
    renderMessages();
    renderAuth();
    renderModelUI();
    updateSendState();
}

// ---------- HEALTH ----------
async function pollHealth() {
    try {
        const r = await fetch(`${API_URL}/health`, { cache: "no-store" });
        const data = await r.json();
        health = data.models || {};
    } catch {
        health = {};
        Object.keys(MODELS).forEach(k => { health[k] = { running: false }; });
    }
    renderModelUI();
}

// ---------- MODELS ----------
function selectModel(id) {
    currentModel = id;
    localStorage.setItem(MODEL_KEY, id);
    $("modelMenu").classList.add("hidden");
    renderModelUI();
}

// ---------- SENDING ----------
function updateSendState() {
    $("sendButton").disabled = sending || !$("messageInput").value.trim();
}

function autoGrow() {
    const t = $("messageInput");
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
}

async function sendMessage() {
    const input = $("messageInput");
    const text = input.value.trim();
    if (!text || sending) return;

    const loggedIn = isLoggedIn();
    if (!loggedIn && !GUEST_MODELS.includes(currentModel)) {
        toast("Log in to use this model, or switch to O1 Flash.");
        openAuthModal("login");
        return;
    }

    let conv = currentConv() || newConversation();
    if (!conv.messages.length) conv.title = text.slice(0, 40);
    conv.messages.push({ role: "user", content: text });
    conv.updated = Date.now();
    input.value = "";
    autoGrow();
    sending = true;
    updateSendState();
    renderConversationList();

    if (!conv.messages.slice(0, -1).length) $("chatArea").innerHTML = "";
    addMessageEl("user", text);
    const modelUsed = currentModel;
    const guestMode = !loggedIn;
    const reply = addMessageEl("assistant", "");
    reply.body.innerHTML = '<span class="typing">...</span>';
    const area = $("chatArea");
    area.scrollTop = area.scrollHeight;

    let full = "", sources = [];
    try {
        const headers = { "Content-Type": "application/json" };
        const tok = getToken();
        if (tok) headers["Authorization"] = "Bearer " + tok;
        const response = await fetch(`${API_URL}/chat/stream`, {
            method: "POST",
            headers,
            body: chatBody(conv.sessionId, text, modelUsed, guestMode)
        });

        if (response.status === 401) {
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(TOKEN_KEY);
            renderAuth();
            openAuthModal("login");
            throw new Error("Your login expired. Please log in again.");
        }

        if (response.status === 403) {
            let d = "Log in to use this model.";
            try { d = (await response.json()).detail || d; } catch {}
            openAuthModal("login");
            throw new Error(d);
        }

        if (!response.ok) {
            let d = "Request failed (" + response.status + ").";
            try { d = (await response.json()).detail || d; } catch {}
            throw new Error(d);
        }

        const sid = response.headers.get("X-Session-Id");
        if (sid) conv.sessionId = sid;
        try { sources = JSON.parse(decodeURIComponent(response.headers.get("X-Sources") || "[]")); } catch {}

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const stick = () => (area.scrollHeight - area.scrollTop - area.clientHeight) < 80;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            full += decoder.decode(value, { stream: true });
            const follow = stick();
            reply.body.innerHTML = render(full);
            if (follow) area.scrollTop = area.scrollHeight;
        }
        full += decoder.decode();
        if (!full.trim()) full = "(empty response)";
        reply.body.innerHTML = render(full);
        if (sources.length) reply.wrap.appendChild(sourcesEl(sources));
    } catch (e) {
        full = full || ("Error: " + (e.message || "could not reach the server."));
        reply.body.innerHTML = render(full);
        reply.wrap.classList.add("error");
    }

    conv.messages.push({ role: "assistant", content: full, sources });
    conv.updated = Date.now();
    saveConversations();
    sending = false;
    updateSendState();
    area.scrollTop = area.scrollHeight;
    pollHealth();
}

// ---------- CONVERSATION ACTIONS ----------
function deleteConversation(id) {
    const c = conversations.find(x => x.id === id);
    if (c && c.sessionId) {
        const h = {};
        if (getToken()) h["Authorization"] = "Bearer " + getToken();
        fetch(`${API_URL}/session/${c.sessionId}`, { method: "DELETE", headers: h }).catch(() => {});
    }
    conversations = conversations.filter(x => x.id !== id);
    if (currentId === id) currentId = conversations[0] ? conversations[0].id : null;
    saveConversations();
    renderAll();
}

function clearConversation() {
    const c = currentConv();
    if (!c) return;
    c.messages = [];
    c.title = "New chat";
    c.sessionId = null;
    saveConversations();
    renderAll();
}

function exportConversation() {
    const c = currentConv();
    if (!c || !c.messages.length) { toast("Nothing to export."); return; }
    const txt = c.messages.map(m => (m.role === "user" ? "You" : "Beam") + ":\n" + m.content).join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "beam-chat.txt";
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- MODAL / AUTH ----------
function openModal(html) {
    $("modalContent").innerHTML = html;
    $("modal").classList.remove("hidden");
}

function closeModal() {
    $("modal").classList.add("hidden");
}

function openAuthModal(mode) {
    const signup = mode === "signup";
    openModal(`
        <h2>${signup ? "Sign up" : "Log in"}</h2>
        <div class="auth-form">
            <input id="authEmailInput" type="email" placeholder="Email" autocomplete="email">
            <input id="authPassInput" type="password" placeholder="Password${signup ? " (min 8 characters)" : ""}" autocomplete="${signup ? "new-password" : "current-password"}">
            <input id="authWebsite" type="text" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
            <div class="auth-error" id="authError"></div>
            <button id="authSubmit" class="auth-submit">${signup ? "Create account" : "Log in"}</button>
            <button id="authSwitch" class="auth-switch" type="button">${signup ? "Have an account? Log in" : "No account? Sign up"}</button>
        </div>`);
    $("authSwitch").onclick = () => openAuthModal(signup ? "login" : "signup");
    $("authSubmit").onclick = () => submitAuth(signup);
    $("authPassInput").addEventListener("keydown", e => { if (e.key === "Enter") submitAuth(signup); });
    $("authEmailInput").focus();
}

async function submitAuth(signup) {
    const email = $("authEmailInput").value.trim();
    const password = $("authPassInput").value;
    const err = $("authError");
    err.textContent = "";
    if (!email || !password) { err.textContent = "Enter your email and password."; return; }
    $("authSubmit").disabled = true;
    try {
        const body = { email, password };
        if (signup) body.website = $("authWebsite").value;
        const r = await fetch(`${API_URL}/${signup ? "signup" : "login"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || "Something went wrong.");
        localStorage.setItem(AUTH_KEY, data.email);
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        resetConversationSessions();
        closeModal();
        renderAuth();
        toast(data.role ? `Welcome, ${data.role}.` : "Logged in.");
    } catch (e) {
        err.textContent = e.message || "Could not reach the server.";
    }
    $("authSubmit").disabled = false;
}

function logout() {
    const token = getToken();
    if (token) {
        fetch(`${API_URL}/logout`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        }).catch(() => {});
    }
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    resetConversationSessions();
    if (!GUEST_MODELS.includes(currentModel)) selectModel("beam-o1-flash");
    renderAuth();
}

function showModelInfo() {
    openModal("<h2>Models</h2>" + Object.values(MODELS)
        .map(m => `<p><strong>${esc(m.name)}</strong><br>${esc(m.info)}</p>`).join(""));
}

function showPolicy() {
    openModal(`<h2>Policy</h2>
        <p>Beam can make mistakes. Check important information.</p>
        <p>Conversations are stored on the Beam server so they can be reviewed for safety and debugging.</p>
        <p>Do not share passwords or sensitive personal data in chat.</p>`);
}

// ---------- INIT ----------
function init() {
    loadConversations();
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
    currentId = conversations[0] ? conversations[0].id : null;
    if (!currentId) newConversation();

    $("newChatButton").onclick = () => newConversation();
    $("collapseButton").onclick = () => $("sidebar").classList.toggle("collapsed");
    $("mobileMenu").onclick = () => $("sidebar").classList.toggle("open");
    $("chatSearch").oninput = renderConversationList;
    document.querySelectorAll(".nav-button").forEach(b => {
        b.onclick = () => {
            view = b.dataset.view;
            document.querySelectorAll(".nav-button").forEach(x => x.classList.toggle("active", x === b));
            renderConversationList();
        };
    });

    $("modelSelector").onclick = e => { e.stopPropagation(); $("modelMenu").classList.toggle("hidden"); };
    $("mobileModelButton").onclick = e => { e.stopPropagation(); $("modelMenu").classList.toggle("hidden"); };
    document.querySelectorAll(".model-option").forEach(b => { b.onclick = () => selectModel(b.dataset.model); });
    document.addEventListener("click", e => {
        if (!$("modelMenu").contains(e.target)) $("modelMenu").classList.add("hidden");
    });

    $("openLoginBtn").onclick = () => openAuthModal("login");
    $("openSignupBtn").onclick = () => openAuthModal("signup");
    $("logoutBtn").onclick = logout;
    $("modelInfoButton").onclick = showModelInfo;
    $("policyButton").onclick = showPolicy;
    $("themeButton").onclick = () => {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    };
    $("modalClose").onclick = closeModal;
    document.querySelector(".modal-backdrop").onclick = closeModal;

    $("exportButton").onclick = exportConversation;
    $("clearButton").onclick = clearConversation;
    $("sendButton").onclick = sendMessage;

    const input = $("messageInput");
    input.addEventListener("input", () => { autoGrow(); updateSendState(); });
    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal();
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !["INPUT", "TEXTAREA"].includes(tag)) {
            e.preventDefault();
            newConversation();
        }
    });

    const area = $("chatArea");
    area.addEventListener("scroll", () => {
        const far = area.scrollHeight - area.scrollTop - area.clientHeight > 200;
        $("scrollBottom").classList.toggle("visible", far);
    });
    $("scrollBottom").onclick = () => { area.scrollTop = area.scrollHeight; };

    renderAll();
    pollHealth();
    setInterval(pollHealth, 10000);
}

document.addEventListener("DOMContentLoaded", init);
