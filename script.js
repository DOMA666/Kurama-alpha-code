// 1. Déclaration des adresses de ton Space et de ta route d'historique Vercel
const OLLAMA_API_URL = "https://domy3-kurama-alpha-code.hf.space/api/generate";
const API_HISTORY_URL = "/api/history";

// Variables globales pour gérer la mémoire de Kurama
let chatContext = null;
let currentSessionId = "session_" + Date.now(); // Crée un ID unique pour la discussion actuelle

// 2. Gestion de l'affichage du menu d'historique (Sidebar)
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', function() { sidebar.classList.add('open'); });
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', function() { sidebar.classList.remove('open'); });
}

// Gestion du bouton "Nouveau Tchat" (Bouton carré en haut à droite)
const newChatBtn = document.getElementById('new-chat');
if (newChatBtn) {
    newChatBtn.addEventListener('click', function() {
        document.getElementById('chat-box').innerHTML = ''; // Vide l'écran
        chatContext = null; // Efface la mémoire à court terme
        currentSessionId = "session_" + Date.now(); // Génère un nouvel ID de tchat
        if (sidebar) sidebar.classList.remove('open'); // Ferme la barre latérale
    });
}

// 3. Ajustement automatique de la hauteur du champ de texte
const userInput = document.getElementById('user-input');
if (userInput) {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// 4. Injection des bulles de messages (Gestion Rouge pour Toi / Noir pour Kurama)
function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    // Aligne la détection des rôles pour accepter 'ai' ou 'assistant' (format Supabase)
    if (sender === 'ai' || sender === 'assistant') {
        let formattedText = formatCodeBlocks(text);
        formattedText = formatMarkdownImages(formattedText);
        messageDiv.innerHTML = formattedText;
        setupCopyButtons(messageDiv);
    } else {
        messageDiv.textContent = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// 5. Transformation du Markdown de Tenor en vraies images HTML affichables
function formatMarkdownImages(text) {
    const imgRegex = /!\[.*?\]\((.*?)\)/g;
    return text.replace(imgRegex, '<br><img src="$1" style="max-width:100%; border-radius:12px; margin-top:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);" alt="Kurama GIF">');
}

// 6. Nettoyage et encadrement des blocs de scripts (Qwen)
function formatCodeBlocks(text) {
    if (!text) return "";
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    return text.replace(regex, function(match, lang, code) {
        return `
            <div class="code-container">
                <div class="code-header">
                    <span>${lang.toUpperCase() || 'CODE'}</span>
                    <button type="button" class="copy-btn" data-code="${btoa(unescape(encodeURIComponent(code.trim())))}">
                        <i class="fa-regular fa-copy"></i> Copier
                    </button>
                </div>
                <pre><code>${escapeHtml(code.trim())}</code></pre>
            </div>
        `;
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/ silent/g, "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupCopyButtons(container) {
    const buttons = container.querySelectorAll('.copy-btn');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const base64Code = btn.getAttribute('data-code');
            const code = decodeURIComponent(escape(atob(base64Code)));
            navigator.clipboard.writeText(code);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
            setTimeout(function() { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copier'; }, 2000);
        });
    });
}

// 7. Envoi du prompt vers l'API Ollama du conteneur avec mémoire contextuelle
async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Affiche ton message instantanément (Bulle Rouge) et le sauvegarde
    appendMessage('user', text);
    saveMessageToSupabase('user', text); 

    userInput.value = '';
    userInput.style.height = 'auto';

    // Crée la bulle d'attente (Bulle Noire)
    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        const requestBody = {
            model: "alpha-code", // Ton modèle compilé dans ton entrypoint.sh
            prompt: text,
            stream: false
        };

        // Si Kurama s'est déjà souvenu de quelque chose, on lui renvoie son contexte
        if (chatContext !== null) {
            requestBody.context = chatContext;
        }

        const response = await fetch(OLLAMA_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`Erreur Réseau Ollama: ${response.status}`);
        
        const result = await response.json();
        
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result && result.response) {
            reply = result.response;
        }

        // Sauvegarde de l'état de mémoire immédiat renvoyé par Ollama
        if (result && result.context) {
            chatContext = result.context;
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatMarkdownImages(formatCodeBlocks(reply));
            setupCopyButtons(thinkingMessage);
        }
        
        // Sauvegarde de la réponse de Kurama dans la base de données
        saveMessageToSupabase('ai', reply);

        // Actualise la barre latérale pour afficher le titre de la discussion
        loadHistoryFromSupabase();

    } catch (error) {
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama prend du temps à compiler. Laissez l'onglet ouvert, le calcul démarre...";
        }
    }
}

// 8. Activation des écouteurs du bouton d'envoi et de la touche Entrée
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

// 9. MODULES DE GESTION DE LA BASE DE DONNÉES SUPABASE (Via Vercel API)

// Sauvegarder un message en arrière-plan
async function saveMessageToSupabase(sender, message) {
    try {
        await fetch(API_HISTORY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                sender: sender, 
                message: message,
                session_id: currentSessionId // Reste soudé au tchat en cours
            })
        });
    } catch (e) {
        console.log("Sauvegarde de la ligne en attente.");
    }
}

// Charger l'historique complet pour alimenter le menu déroulant latéral
async function loadHistoryFromSupabase() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    try {
        const response = await fetch(API_HISTORY_URL);
        if (!response.ok) return;
        const chats = await response.json();

        historyList.innerHTML = ''; // Nettoie la liste d'affichage

        // Regroupement unique des sessions pour n'afficher qu'un seul titre par tchat
        const uniqueSessions = {};
        chats.forEach(chat => {
            if (!uniqueSessions[chat.session_id] && chat.sender === 'user') {
                uniqueSessions[chat.session_id] = chat.message;
            }
        });

        // Fabrication des boutons de l'historique dans la Sidebar
        Object.keys(uniqueSessions).forEach(sessionId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            
            // Coupe le premier message pour en faire un titre de 24 caractères maximum
            historyItem.textContent = uniqueSessions[sessionId].substring(0, 24) + "...";
            historyItem.style.padding = "12px";
            historyItem.style.marginHeight = "5px";
            historyItem.style.cursor = "pointer";
            historyItem.style.borderRadius = "6px";
            
            // Événement : Si on clique sur une ancienne discussion, on la charge à l'écran
            historyItem.addEventListener('click', function() {
                reloadOldSession(chats, sessionId);
            });

            historyList.appendChild(historyItem);
        });
    } catch (e) {
        console.log("Impossible d'alimenter la barre latérale.");
    }
}

// Faire réapparaître les anciens messages d'un tchat à l'écran au clic
function reloadOldSession(allChats, sessionId) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    chatBox.innerHTML = ''; // Vide le tchat actuel
    currentSessionId = sessionId; // Verrouille le tchat sur cet ancien ID
    chatContext = null; // Remet à plat le contexte immédiat pour éviter les mélanges

    // Filtre et réaffiche dans le bon ordre chronologique
    const sessionChats = allChats.filter(chat => chat.session_id === sessionId).reverse();
sessionChats.forEach(chat => {appendMessage(chat.sender === 'user' ? 'user' : 'ai', chat.message);});if (sidebar) sidebar.classList.remove('open'); // Ferme le menu latéral}// Déclenche le chargement de l'historique dès que le site s'allumedocument.addEventListener("DOMContentLoaded", loadHistoryFromSupabase);
