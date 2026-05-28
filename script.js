// 1. Importation du connecteur officiel Gradio
import { Client } from "https://jsdelivr.net";

const SPACE_ID = "domy3/kurama-alpha-code";

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
        setupCopyButtons(messageDiv);
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
        // Ajout d'un attribut data-code pour stocker le texte à copier en toute sécurité en mode module
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

// Gestion sécurisée des clics de copie en mode module
function setupCopyButtons(container) {
    const buttons = container.querySelectorAll('.copy-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const base64Code = btn.getAttribute('data-code');
            const code = decodeURIComponent(escape(atob(base64Code)));
            navigator.clipboard.writeText(code);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copier';
            }, 2000);
        });
    });
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
        // Connexion officielle au Space
        const app = await Client.connect(SPACE_ID);
        
        if (thinkingMessage) {
            thinkingMessage.textContent = "Kurama compile et génère votre code...";
        }

        // Appel de la fonction de prédiction
        const result = await app.predict(0, [ text ]);

        let reply = "";
        if (result && result.data && result.data.length > 0) {
            reply = result.data[0]; 
        } else {
            reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error("Détails de l'erreur Gradio Client:", error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "La connexion a échoué. Assurez-vous que votre Space accepte les requêtes.";
        }
    }
}

// 7. Initialisation stricte des écouteurs au chargement du module
const sendBtn = document.getElementById('send-btn');
if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
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

// 8. Fonction de sauvegarde vers l'API Supabase de Vercel
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
