#!/usr/bin/env python3
"""Adds Beam login-token support to app.js.   Usage: python3 patch_app.py path/to/app.js
Makes a backup (app.js.bak) first. Safe to run once; refuses if an anchor is missing."""
import shutil
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "app.js"
raw = open(path, encoding="utf-8", newline="").read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if "TOKEN_KEY" in s:
    sys.exit("Already patched (TOKEN_KEY found). Nothing to do.")


def swap(old, new, count=1):
    global s
    found = s.count(old)
    if found != count:
        sys.exit(f"Anchor not found {count}x (found {found}x):\n{old[:80]}...")
    s = s.replace(old, new)


# 1) token storage key + helpers
swap(
    'const AUTH_KEY = "beam_auth_email_v1";\n',
    '''const AUTH_KEY = "beam_auth_email_v1";
const TOKEN_KEY = "beam_auth_token_v1";

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
}

// Request body for /chat/stream. The token is how the server knows who you
// are (and recognises Mason/Groovy), so it is sent with every message.
function chatBody(sessionId, message, model, guest) {
    return JSON.stringify({
        session_id: sessionId,
        message: message,
        model: model,
        guest: guest,
        token: getToken()
    });
}

// Conversations keep a server session id. Sessions belong to an account,
// so forget them when the account changes and let new ones be created.
function resetConversationSessions() {
    conversations.forEach(c => { c.sessionId = null; });
    saveConversations();
}
''',
)

# 2) logged in = has email AND token (older logins must log in once more to get a token)
swap(
    '''function isLoggedIn() {
    return !!localStorage.getItem(AUTH_KEY);
}''',
    '''function isLoggedIn() {
    return !!localStorage.getItem(AUTH_KEY) && !!getToken();
}''',
)

# 3) logout: revoke token on server, clear it locally
swap(
    '''function logout() {
    localStorage.removeItem(AUTH_KEY);
    updateAuthUI();''',
    '''function logout() {
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
    updateAuthUI();''',
)

# 4) login/signup: keep the token the server returns
swap(
    '            localStorage.setItem(AUTH_KEY, data.email);\n',
    '''            localStorage.setItem(AUTH_KEY, data.email);
            if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
            resetConversationSessions();
''',
)

# 5) send the token with both chat requests
swap(
    'body: JSON.stringify({ session_id: sessionId, message: text, model: modelUsed, guest: guestMode })',
    'body: chatBody(sessionId, text, modelUsed, guestMode)',
    count=2,
)

# 6) expired / invalid token -> ask for login again
swap(
    'if (response.status === 403) {',
    '''if (response.status === 401) {
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(TOKEN_KEY);
            updateAuthUI();
            openAuthModal("login");
            throw new Error("Your login expired. Please log in again.");
        }

        if (response.status === 403) {''',
)

shutil.copyfile(path, path + ".bak")
out = s.replace("\n", "\r\n") if crlf else s
open(path, "w", encoding="utf-8", newline="").write(out)
print("Patched", path, "(backup:", path + ".bak)")
