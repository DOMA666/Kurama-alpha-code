// Déclaration de l'adresse de base du Space
const SPACE_BASE_URL = "https://domy3-kurama-alpha-code.hf.space";

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

// Gestion et traitement de l'envoi du message
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
        // ÉTAPE 1 : Initialisation de l'événement sur la route Gradio moderne
        const initiateResponse = await fetch(`${SPACE_BASE_URL}/call/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: [text] })
        });

        if (!initiateResponse.ok) throw new Error(`Init Failed: ${initiateResponse.status}`);
        
        const initData = await initiateResponse.json();
        const eventId = initData.event_id; // Récupère le jeton de la file d'attente

        if (!eventId) {
            throw new Error("Impossible de s'aligner sur la file d'attente Gradio.");
        }

        // ÉTAPE 2 : Lecture en continu (SSE) ou récupération du résultat final
        const resultResponse = await fetch(`${SPACE_BASE_URL}/call/predict/${eventId}`);
        if (!resultResponse.ok) throw new Error(`Fetch Result Failed: ${resultResponse.status}`);
        
        const resultText = await resultResponse.text();
        
        // Extraction du texte de la réponse Gradio
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        const lines = resultText.split('\n');
        for (let line of lines) {
            if (line.startsWith('data:')) {
                const jsonData = JSON.parse(line.replace('data:', '').trim());
                if (jsonData && jsonData.length > 0) {
                    reply = jsonData[0];
                }
            }
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama rencontre une anomalie d'alignement d'API. Vérifiez la structure de votre script Hugging Face.";
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
