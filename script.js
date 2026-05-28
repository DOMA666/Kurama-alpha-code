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

// Assurez-vous que l'URL en haut de votre script.js ressemble exactement à ceci :
const SPACE_API_URL = "https://domy3-kurama-alpha-code.hf.space/run/predict";

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    // 1. Afficher et sauvegarder le message de l'utilisateur (Rouge)
    appendMessage('user', text);
    if (typeof saveMessageToSupabase === "function") {
        saveMessageToSupabase('user', text); 
    }

    userInput.value = '';
    userInput.style.height = 'auto';

    // 2. Créer la bulle de chargement pour Kurama (Noir)
    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        // 3. Appel de l'API avec le nouveau format strict de Gradio
        const response = await fetch(SPACE_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data: [text], // Votre message texte envoyé à Qwen
                fn_index: 0,  // Indique à Gradio d'utiliser la fonction principale du chatbot
                trigger_id: 8
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const result = await response.json();
        
        // 4. Extraction robuste de la réponse texte
        let reply = "";
        if (result.data && result.data.length > 0) {
            reply = result.data[0]; // Récupère le premier élément du tableau de réponse
        } else {
            reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        }

        // 5. Remplacement du texte d'attente par la réponse formatée en blocs de code
        thinkingMessage.innerHTML = formatCodeBlocks(reply);
        
        // 6. Sauvegarder la réponse finale dans Supabase
        if (typeof saveMessageToSupabase === "function") {
            saveMessageToSupabase('ai', reply);
        }

    } catch (error) {
        console.error("Détails de l'erreur d'API Kurama:", error);
        thinkingMessage.textContent = "Le démon Kurama rencontre des difficultés à répondre. Vérifiez la console (F12) pour plus de détails.";
    }
}
