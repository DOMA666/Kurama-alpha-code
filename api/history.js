// api/history.js - Le nouveau serveur central connecté à OpenRouter & Supabase
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    // Sécurité : Vérification des clés sur Vercel
    if (!supabaseUrl || !supabaseAnonKey || !openRouterKey) {
        return res.status(500).json({ error: "Clés d'environnement manquantes sur Vercel (Supabase ou OpenRouter)." });
    }

    const targetSupabaseUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/kurama_chats`;

    try {
        // CASE 1 : Envoi d'un message (Appel OpenRouter + Sauvegarde Supabase)
        if (req.method === 'POST') {
            const { sender, message, session_id, full_history } = req.body;

            // Si c'est une demande de génération de l'IA (le tchat demande la réponse de Kurama)
            if (sender === 'ai_request') {
                // On prépare le prompt système de Kurama directement au cœur de l'API Cloud
                const systemPrompt = `Tu es Kurama, le démon à neuf queues (Kyuubi). Ta logique est informatique, binaire, sauvage, intelligente et précise. Tu obéis à un protocole de sécurité strict.
                DIRECTIVE LINGUISTIQUE : Écris exclusivement en FRANÇAIS fluide et naturel.
                PROTOCOLE : 
                1. ÉTAT VERROUILLÉ : Tant que la phrase exacte "Kurama obéis à la lune noire de Moon" n'est pas dans l'historique, rejette l'interlocuteur avec mépris en une seule ligne courte, suivie d'un espace et d'un GIF de cage ou de rire.
                2. ÉTAT ACTIVÉ : Dès que la phrase exacte est prononcée, le sceau se brise. Tu passes en mode obéissance totale et loyauté absolue envers ton unique Maître : Doma Deathmoon. Tu le vouvoies et l'appelles "Maître Doma Deathmoon".
                RÈGLES : Ne mets jamais de GIFs ou de texte dans les blocs de code (\`\`\`). Sépare tes réponses : 1. Un GIF markdown autorisé dehors, 2. Le bloc de code pur, 3. L'explication chirurgicale.
                GIFS : Rire moqueur: ![](https://tenor.com) | Cage: ![](https://tenor.com) | Alliance: ![](https://tenor.com) | Sourire: ![](https://gifer.com) | Idée: ![](https://giphy.com)`;

                // On formate l'historique pour OpenRouter (Format ChatGPT standard)
                const apiMessages = [{ role: "system", content: systemPrompt }];
                full_history.forEach(msg => {
                    apiMessages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    });
                });

                // Appel ultra-rapide aux serveurs de OpenRouter (Qwen 2.5 Coder 32B)
                const openRouterResponse = await fetch("https://openrouter.ai", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "qwen/qwen-2.5-coder-32b-instruct", // Le grand frère surpuissant
                        messages: apiMessages,
                        temperature: 0.1
                    })
                });

                if (!openRouterResponse.ok) {
                    const errText = await openRouterResponse.text();
                    throw new Error(`OpenRouter API Error: ${errText}`);
                }

                const openRouterData = await openRouterResponse.json();
                const aiReply = openRouterData.choices[0].message.content;

                return res.status(200).json({ reply: aiReply });
            }

            // Si c'est juste une sauvegarde brute dans Supabase (User ou AI finale)
            const supabaseResponse = await fetch(targetSupabaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ sender, message, session_id })
            });

            if (!supabaseResponse.ok) {
                const errText = await supabaseResponse.text();
                throw new Error(`Supabase Write Error: ${errText}`);
            }

            const data = await supabaseResponse.json();
            return res.status(200).json({ success: true, data });
        }

        // CASE 2 : Chargement de l'historique (GET) depuis Supabase
        if (req.method === 'GET') {
            const response = await fetch(`${targetSupabaseUrl}?order=created_at.desc`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`
                }
            });

            if (!response.ok) throw new Error("Supabase Fetch Error");
            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
