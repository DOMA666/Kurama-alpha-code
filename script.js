const OLLAMA_API_URL = "https://domy3-kurama-alpha-code.hf.space/api/chat";
const API_HISTORY_URL = "/api/history";

// Tableau global pour stocker la mémoire vivante de la discussion (Format ChatGPT)
let chatMessagesHistory = [];
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
        chatMessagesHistory = []; // Vide l'historique de discussion virtuel
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

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/ silent/g, "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Correction de l'écouteur du bouton Copier pour fonctionner sans flèche
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

    // Ajout obligatoire du message utilisateur dans la file d'attente d'Ollama Chat
    chatMessagesHistory.push({ role: "user", content: text });

    userInput.value = '';
    userInput.style.height = 'auto';

    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        // CORRECTION DE LA STRUCTURE : Utilisation du paramètre strict "messages" pour la route /api/chat
        const response = await fetch(OLLAMA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "alpha-code",
                messages: chatMessagesHistory, // Envoie de tout l'historique des requêtes
                stream: false
            })
        });

        if (!response.ok) throw new Error("Ollama network error");
        const result = await response.json();
        
        // Extraction corrigée de la réponse selon la spécification de la route Chat
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result && result.message && result.message.content) {
            reply = result.message.content;
        }

        // Sauvegarde de la réponse de l'IA dans l'historique virtuel pour le coup d'après
        chatMessagesHistory.push({ role: "assistant", content: reply });

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatMarkdownImages(formatCodeBlocks(reply));
            setupCopyButtons(thinkingMessage);
        }
        saveMessageToSupabase('ai', reply);
        loadHistoryFromSupabase();

    } catch (error) {
        console.error(error);
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
    chatMessagesHistory = []; // Nettoyage complet du fil virtuel pour reconstruire proprement

    // Filtrage et reconstruction de la mémoire de discussion pour Ollama
    const sessionChats = allChats.filter(function(chat) { return chat.session_id === sessionId; }).reverse();
    sessionChats.forEach(function(chat) {
        appendMessage(chat.sender === 'user' ? 'user' : 'ai', chat.message);
        chatMessagesHistory.push({
            role: chat.sender === 'user' ? "user" : "assistant",
            content: chat.message
        });
    });
    if (sidebar) sidebar.classList.remove('open');
}

document.addEventListener("DOMContentLoaded", loadHistoryFromSupabase);
