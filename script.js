// 1. Importation du connecteur officiel Gradio via un CDN sécurisé
import { Client } from "https://jsdelivr.net";

// Adresse unique et officielle de votre Space Kurama
const SPACE_ID = "domy3/kurama-alpha-code";

// 2. Gestion de l'affichage du menu d'historique (Sidebar)
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
    const thinkingMessage = appendMessage('ai', "Kurama se connecte au démon à queue...");

    try {
        // Connexion au Space à l'aide de la bibliothèque officielle de Hugging Face
        const app = await Client.connect(SPACE_ID);
        
        if (thinkingMessage) {
            thinkingMessage.textContent = "Kurama compile et génère votre code...";
        }

        // Appel de la fonction de prédiction par défaut (fn_index 0)
        const result = await app.predict(0, [ text ]);

        // Extraction de la réponse texte
        let reply = "";
        if (result && result.data && result.data.length > 0) {
            reply = result.data[0]; // Gradio stocke la réponse dans un tableau data
        } else {
            reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        }

        // Remplacement du texte d'attente par la réponse de Kurama
        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
        }
        
        // Sauvegarder la réponse finale dans Supabase
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error("Détails de l'erreur Gradio Client:", error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "La connexion au Space a échoué. Assurez-vous que l'application accepte les connexions publiques.";
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
