const API_HISTORY_URL = "/api/history";

let chatMessagesHistory = [];
let currentSessionId = "session_" + Date.now();

const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', function(e) { 
        e.preventDefault(); 
        sidebar.classList.add('open'); 
    });
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', function(e) { 
        e.preventDefault(); 
        sidebar.classList.remove('open'); 
    });
}

const newChatBtn = document.getElementById('new-chat');
if (newChatBtn) {
    newChatBtn.addEventListener('click', function() {
        document.getElementById('chat-box').innerHTML = '';
        chatMessagesHistory = [];
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
                        Copier
                    </button>
                </div>
                <pre><code>${escapeHtml(code.trim())}</code></pre>
            </div>`;
    });
}

function escapeHtml(text) {
    if (!text) return "";
    // Élimine chirurgicalement les balises de pensée internes du modèle 72B
    return text.replace(/<thought>[\s\S]*?<\/thought>/g, "")
               .replace(/&/g, "&amp;")
               .replace(/ silent/g, "")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;");
}

function setupCopyButtons(container) {
    const buttons = container.querySelectorAll('.copy-btn');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const code = decodeURIComponent(escape(atob(btn.getAttribute('data-code'))));
            navigator.clipboard.writeText(code);
            btn.innerHTML = 'Copié !';
            setTimeout(function() { btn.innerHTML = 'Copier'; }, 2000);
        });
    });
}

async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    saveMessageToSupabase('user', text);

    chatMessagesHistory.push({ role: "user", content: text });

    userInput.value = '';
    userInput.style.height = 'auto';

    const thinkingMessage = appendMessage('ai', "Kurama déploie sa puissance logique...");

    try {
        const response = await fetch(API_HISTORY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender: "ai_request",
                full_history: chatMessagesHistory,
                session_id: currentSessionId
            })
        });

        if (!response.ok) throw new Error("Erreur de transmission Cloud");
        const result = await response.json();
        
        let reply = result.reply || "Désolé, Kurama n'a renvoyé aucune donnée.";

        chatMessagesHistory.push({ role: "assistant", content: reply });

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatMarkdownImages(formatCodeBlocks(reply));
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);
        loadHistoryFromSupabase();

    } catch (error) {
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le lien spirituel avec Kurama a été coupé. Vérifiez vos variables d'environnement.";
        }
    }
}

const sendBtn = document.getElementById('send-btn');
if (sendBtn) {
    sendBtn.addEventListener('click', function(e) { 
        e.preventDefault(); 
        handleSend(); 
    });
}

if (userInput) {
    userInput.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            handleSend(); 
        } 
    });
}

async function saveMessageToSupabase(sender, message) {
    try {
        await fetch(API_HISTORY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender, message: message, session_id: currentSessionId })
        });
    } catch (e) { 
        console.error(e); 
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
            historyItem.addEventListener('click', function() { 
                reloadOldSession(chats, sessionId); 
            });
            historyList.appendChild(historyItem);
        });
    } catch (e) { 
        console.log(e); 
    }
}

function reloadOldSession(allChats, sessionId) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    chatBox.innerHTML = '';
    currentSessionId = sessionId;
    chatMessagesHistory = [];

    const sessionChats = allChats.filter(function(chat) { return chat.session_id === sessionId; }).reverse();
    sessionChats.forEach(function(chat) {
        appendMessage(chat.sender === 'user' ? 'user' : 'ai', chat.message);
        chatMessagesHistory.push({ role: chat.sender === 'user' ? "user" : "assistant", content: chat.message });
    });
    if (sidebar) sidebar.classList.remove('open');
}

document.addEventListener("DOMContentLoaded", loadHistoryFromSupabase);
