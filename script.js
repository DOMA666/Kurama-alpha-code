const OLLAMA_API_URL = "https://domy3-kurama-alpha-code.hf.space/api/generate";
const API_HISTORY_URL = "/api/history";

let chatContext = null;
let currentSessionId = "session_" + Date.now();

const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', function() { sidebar.classList.add('open'); });
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', function() { sidebar.classList.remove('open'); });
}

const newChatBtn = document.getElementById('new-chat');
if (newChatBtn) {
    newChatBtn.addEventListener('click', function() {
        document.getElementById('chat-box').innerHTML = '';
        chatContext = null;
        currentSessionId = "session_" + Date.now();
        if (sidebar) sidebar.classList.remove('open');
    });
}

const userInput = document.getElementById('user-input');
if (userInput) {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    if (sender === 'ai' || sender === 'assistant') {
        let formattedText = formatCodeBlocks(text);
        messageDiv.innerHTML = formatMarkdownImages(formattedText);
        setupCopyButtons(messageDiv);
    } else {
        messageDiv.textContent = text;
    }
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function formatMarkdownImages(text) {
    return text.replace(/!\[.*?\]\((.*?)\)/g, '<br><img src="$1" style="max-width:100%; border-radius:12px; margin-top:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">');
}

function formatCodeBlocks(text) {
    if (!text) return "";
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
        return `
            <div class="code-container">
                <div class="code-header">
                    <span>${lang.toUpperCase() || 'CODE'}</span>
                    <button type="button" class="copy-btn" data-code="${btoa(unescape(encodeURIComponent(code.trim())))}">
                        <i class="fa-regular fa-copy"></i> Copier
                    </button>
                </div>
                <pre><code>${escapeHtml(code.trim())}</code></pre>
            </div>`;
    });
}

// Remplacement propre du mot masqué "silent" lors de l'affichage
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/ silent/g, "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupCopyButtons(container) {
    const buttons = container.querySelectorAll('.copy-btn');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const code = decodeURIComponent(escape(atob(btn.getAttribute('data-code'))));
            navigator.clipboard.writeText(code);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
            setTimeout(function() { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copier'; }, 2000);
        });
    });
}

async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    saveMessageToSupabase('user', text);

    userInput.value = '';
    userInput.style.height = 'auto';

    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        const requestBody = { model: "alpha-code", prompt: text, stream: false };
        if (chatContext !== null) requestBody.context = chatContext;

        const response = await fetch(OLLAMA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error("Ollama network error");
        const result = await response.json();
        
        let reply = result.response || "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result.context) chatContext = result.context;

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatMarkdownImages(formatCodeBlocks(reply));
            setupCopyButtons(thinkingMessage);
        }
        saveMessageToSupabase('ai', reply);
        loadHistoryFromSupabase();

    } catch (error) {
        if (thinkingMessage) thinkingMessage.textContent = "Le démon Kurama calcule... Laissez l'onglet ouvert.";
    }
}

const sendBtn = document.getElementById('send-btn');
if (sendBtn) {
    sendBtn.addEventListener('click', function(e) { e.preventDefault(); handleSend(); });
}

if (userInput) {
    userInput.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } 
    });
}

// Fonction modifiée avec diagnostic d'erreur actif
async function saveMessageToSupabase(sender, message) {
    try {
        const response = await fetch(API_HISTORY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender, message: message, session_id: currentSessionId })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            console.error("Erreur API Vercel:", errData);
            alert("Erreur Base de données : " + (errData.error || response.statusText));
        }
    } catch (e) { 
        console.error("Erreur réseau Supabase:", e); 
    }
}

async function loadHistoryFromSupabase() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    try {
        const response = await fetch(API_HISTORY_URL);
        if (!response.ok) return;
        const chats = await response.json();
        historyList.innerHTML = '';

        const uniqueSessions = {};
        chats.forEach(function(chat) {
            if (!uniqueSessions[chat.session_id] && chat.sender === 'user') {
                uniqueSessions[chat.session_id] = chat.message;
            }
        });

        Object.keys(uniqueSessions).forEach(function(sessionId) {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.textContent = uniqueSessions[sessionId].substring(0, 22) + "...";
            historyItem.style.padding = "12px";
            historyItem.style.cursor = "pointer";
            historyItem.addEventListener('click', function() { reloadOldSession(chats, sessionId); });
            historyList.appendChild(historyItem);
        });
    } catch (e) { console.log("Sidebar load wait."); }
}

function reloadOldSession(allChats, sessionId) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    chatBox.innerHTML = '';
    currentSessionId = sessionId;
    chatContext = null;

    allChats.filter(function(chat) { return chat.session_id === sessionId; }).reverse().forEach(function(chat) {
        appendMessage(chat.sender === 'user' ? 'user' : 'ai', chat.message);
    });
    if (sidebar) sidebar.classList.remove('open');
}

document.addEventListener("DOMContentLoaded", loadHistoryFromSupabase);
