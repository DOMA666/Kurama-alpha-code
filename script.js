// Adresse directe de l'API de votre Space Hugging Face
const SPACE_API_URL = "https://domy3-kurama-alpha-code.hf.space"; 

// Gestion de l'affichage du menu d'historique
const sidebar = document.getElementById('sidebar');
document.getElementById('open-sidebar').addEventListener('click', () => sidebar.classList.add('open'));
document.getElementById('close-sidebar').addEventListener('click', () => sidebar.classList.remove('open'));

// Redimensionnement automatique de la zone d'écriture
const userInput = document.getElementById('user-input');
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Injection des bulles de messages dans la boîte de dialogue
function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    if (sender === 'ai') {
        messageDiv.innerHTML = formatCodeBlocks(text);
    } else {
        messageDiv.textContent = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// Détection et mise en forme propre des réponses contenant du code (Markdown)
function formatCodeBlocks(text) {
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    return text.replace(regex, (match, lang, code) => {
        return `
            <div class="code-container">
                <div class="code-header">
                    <span>${lang.toUpperCase() || 'CODE'}</span>
                    <button onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`').trim()}\`)">
                        <i class="fa-regular fa-copy"></i> Copier
                    </button>
                </div>
                <pre><code>${escapeHtml(code.trim())}</code></pre>
            </div>
        `;
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Écouteurs d'événements pour valider l'envoi
document.getElementById('send-btn').addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// Traitement de l'envoi du message et appel API
async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    // Affiche le message de l'utilisateur instantanément
    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    // Crée la bulle de chargement sombre pour Kurama
    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        // Transmission de la donnée au Space Hugging Face
        const response = await fetch(SPACE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: [text] 
            })
        });

        const result = await response.json();
        
        // Extraction de la chaîne de texte générée par Qwen
        let reply = "Désolé, Kurama n'a pas pu traiter cette demande.";
        if (result.data && result.data[0]) {
            reply = result.data[0];
        }

        // Remplacement du texte d'attente par la réponse formatée
        thinkingMessage.innerHTML = formatCodeBlocks(reply);

    } catch (error) {
        console.error("Erreur de communication API:", error);
        thinkingMessage.textContent = "Le démon Kurama est inaccessible. Vérifiez le statut de votre Space.";
    }
}

