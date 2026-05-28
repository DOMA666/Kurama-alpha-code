// 1. Déclaration unique de l'adresse de votre Space Hugging Face
const SPACE_API_URL = "https://domy3-kurama-alpha-code.hf.space/run/predict";

// 2. Gestion de l'affichage du menu d'historique
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
}

// 3. Redimensionnement automatique de la zone d'écriture
const userInput = document.getElementById('user-input');
if (userInput) {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// 4. Injection des bulles de messages dans la boîte de dialogue
function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;
    
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

// 5. Détection et mise en forme propre des réponses contenant du code (Markdown)
function formatCodeBlocks(text) {
    if (!text) return "";
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    return text.replace(regex, (match, lang, code) => {
        return `
            <div class="code-container">
                <div class="code-header">
                    <span>${lang.toUpperCase() || 'CODE'}</span>
                    <button type="button" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`').trim()}\`)">
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

// 6. Gestion et traitement de l'envoi du message
async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Afficher le message de l'utilisateur (Rouge)
    appendMessage('user', text);
    saveMessageToSupabase('user', text); 

    userInput.value = '';
    userInput.style.height = 'auto';

    // Créer la bulle de chargement pour Kurama (Noir)
    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    try {
        // Appel de l'API avec le format de Gradio
        const response = await fetch(SPACE_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data: [text], 
                fn_index: 0,  
                trigger_id: 8
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const result = await response.json();
        
        // Extraction robuste de la réponse texte
        let reply = "";
        if (result.data && result.data.length > 0) {
            reply = result.data[0]; 
        } else {
            reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        }

        // Remplacement du texte d'attente par la réponse formatée
        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
        }
        
        // Sauvegarder la réponse finale dans Supabase
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error("Détails de l'erreur d'API Kurama:", error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama rencontre des difficultés à répondre. Vérifiez la console (F12) pour plus de détails.";
        }
    }
}

// 7. Écouteurs d'événements pour valider l'envoi (Bouton et Entrée)
const sendBtn = document.getElementById('send-btn');
if (sendBtn) {
    sendBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleSend();
    });
}

if (userInput) {
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
}

// 8. Fonction de sauvegarde sécurisée vers l'API Supabase de Vercel
async function saveMessageToSupabase(sender, message) {
    try {
        await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender, message })
        });
    } catch (e) {
        console.log("En attente de la configuration finale de la route API.");
    }
}
