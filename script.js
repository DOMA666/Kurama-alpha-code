// 1. Déclaration de ton lien avec le proxy réseau pour atteindre directement Ollama sur le port 11434
const OLLAMA_API_URL = "https://domy3-kurama-alpha-code.hf.space";

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

    if (sender === 'ai') {
        // Applique les blocs de code d'abord, puis transforme le markdown des images (![alt](url)) en vrais GIFs
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

// 7. Envoi du prompt vers l'API Ollama du conteneur
async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Affiche ton message instantanément (Bulle Rouge)
    appendMessage('user', text);
    saveMessageToSupabase('user', text); 

    userInput.value = '';
    userInput.style.height = 'auto';

    // Crée la bulle d'attente (Bulle Noire)
    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        const response = await fetch(OLLAMA_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "alpha-code", // Ton modèle compilé dans ton entrypoint.sh
                prompt: text,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Erreur Réseau Ollama: ${response.status}`);
        
        const result = await response.json();
        
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result && result.response) {
            reply = result.response;
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatMarkdownImages(formatCodeBlocks(reply));
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama prend du temps à compiler. Laissez l'onglet ouvert, le calcul démarre...";
        }
    }
}

// 8. Activation des écouteurs du bouton
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

// 9. Sauvegarde dans ta base de données Supabase
async function saveMessageToSupabase(sender, message) {
    try {
        await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender, message: message })
        });
    } catch (e) {
        console.log("Sauvegarde en attente.");
    }
}
