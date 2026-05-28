// 1. Ton URL brute en déclaration unique
const SPACE_API_URL = "https://domy3-kurama-alpha-code.hf.space";

// 2. Gestion du menu d'historique (Sidebar)
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', function() { sidebar.classList.add('open'); });
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', function() { sidebar.classList.remove('open'); });
}

// 3. Zone d'écriture automatique
const userInput = document.getElementById('user-input');
if (userInput) {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// 4. Affichage des messages à l'écran
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

// 5. Formatage des blocs de code
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

// 6. Envoi direct via Fetch à ton URL (Attente d'une heure activée)
async function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    saveMessageToSupabase('user', text); 

    userInput.value = '';
    userInput.style.height = 'auto';

    const thinkingMessage = appendMessage('ai', "Kurama analyse et génère le code...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3600000); // 1 heure

    try {
        const response = await fetch(SPACE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: [text],
                fn_index: 0,
                trigger_id: 8
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const result = await response.json();
        
        let reply = "Désolé, Kurama n'a renvoyé aucune donnée.";
        if (result && result.data && result.data.length > 0) {
            reply = result.data[0]; 
        }

        if (thinkingMessage) {
            thinkingMessage.innerHTML = formatCodeBlocks(reply);
            setupCopyButtons(thinkingMessage);
        }
        
        saveMessageToSupabase('ai', reply);

    } catch (error) {
        clearTimeout(timeoutId);
        console.error(error);
        if (thinkingMessage) {
            thinkingMessage.textContent = "Le démon Kurama met du temps à compiler. Laissez l'onglet ouvert, le traitement est lourd...";
        }
    }
}

// 7. Écouteurs d'événements pour ton bouton
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

// 8. Sauvegarde Supabase
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
