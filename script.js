// Remplacez la ligne 2 de votre script.js par celle-ci :
const OLLAMA_API_URL = "https://hf.space";

// Gestion de l'affichage du menu d'historique (Sidebar)
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', function() { sidebar.classList.add('open'); });
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', function() { sidebar.classList.remove('open'); });
}

// Redimensionnement automatique de la zone d'écriture
const userInput = document.getElementById('user-input');
if (userInput) {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// Injection des bulles de messages dans la boîte de dialogue
function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    if (sender === 'ai') {
        messageDiv.innerHTML = formatCodeBlocks(text);
        setupCopyButtons(messageDiv);
    } else {
        messageDiv.textContent = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// Détection et mise en forme propre des réponses contenant du code (Markdown)
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

// Gestion et traitement de l'envoi du message vers Ollama
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
        // Envoi de la requête au format d'API natif d'Ollama
        const response = await fetch(OLLAMA_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "kurama", // C'est le nom configuré via ton Modelfile
                prompt: text,
                stream: false     // On désactive le stream pour récupérer le bloc de texte complet d'un coup
            })
        });

        if (!response.ok) throw new Error(`Ollama Error: ${response.status}`);
        
        const result = await response.json();
        
        // Dans Ollama, la réponse brute se trouve dans le champ 'response'
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result && result.response) {
            reply = result.response;
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama est en cours de traitement. Laissez l'onglet ouvert, le calcul CPU d'Ollama démarre...";
        }
    }
}

// Écouteurs d'événements pour le bouton
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

// Sauvegarde Supabase
async function saveMessageToSupabase(sender, message) {
    try {
        await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender, message: message })
        });
    } catch (e) {
        console.log("Supabase en attente.");
    }
}
