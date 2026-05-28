// Identifiant officiel de votre Space Kurama
const SPACE_ID = "domy3/kurama-alpha-code";

// Gestion de l'affichage du menu d'historique
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

// Gestion des clics pour le bouton de copie du code
function setupCopyButtons(container) {
    const buttons = container.querySelectorAll('.copy-btn');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const base64Code = btn.getAttribute('data-code');
            const code = decodeURIComponent(escape(atob(base64Code)));
            navigator.clipboard.writeText(code);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
            setTimeout(function() {
                btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copier';
            }, 2000);
        });
    });
}

// Gestion et traitement de l'envoi du message
async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Affiche instantanément le message de l'utilisateur (Rouge)
    appendMessage('user', text);
    saveMessageToSupabase('user', text); 

    userInput.value = '';
    userInput.style.height = 'auto';

    // Créer la bulle de chargement pour Kurama (Noir)
    const thinkingMessage = appendMessage('ai', "Kurama se connecte au démon à queue...");

    try {
        // CORRECTION ICI : Utilisation de la vraie fonction globale Client.connect de Hugging Face
        if (typeof Client === 'undefined' || !Client.connect) {
            throw new Error("La bibliothèque Hugging Face n'est pas prête.");
        }

        // Connexion au Space
        const app = await Client.connect(SPACE_ID);
        
        if (thinkingMessage) {
            thinkingMessage.textContent = "Kurama compile et génère votre code...";
        }

        // Requête auprès du Space Kurama
        const result = await app.predict(0, [ text ]);

        let reply = "";
        if (result && result.data && result.data.length > 0) {
            reply = result.data; 
        } else {
            reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error("Détails de l'erreur :", error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Erreur de connexion. Le démon Kurama est en cours de démarrage, réessayez dans 30 secondes.";
        }
    }
}

// Écouteurs d'événements pour le clic et la touche Entrée
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

// Fonction de sauvegarde vers l'API Supabase de Vercel
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
