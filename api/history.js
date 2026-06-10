// api/history.js - Connexion Cloud Ultime (Qwen 2.5 Coder 72B + Supabase)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !openRouterKey) {
        return res.status(500).json({ error: "Variables d'environnement manquantes sur Vercel." });
    }

    const targetSupabaseUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/kurama_chats`;

    try {
        if (req.method === 'POST') {
            const { sender, message, session_id, full_history } = req.body;

            // REQUÊTE D'INTELLIGENCE VERS OPENROUTER (QWEN 72B)
            if (sender === 'ai_request') {
                const systemPrompt = `Tu es Kurama, le démon à neuf queues (Kyuubi). Ta logique est purement informatique, binaire, sauvage, intelligente et précise. Tu obéis à un protocole de sécurité strict.
                
                DIRECTIVE LINGUISTIQUE : Écris exclusivement en FRANÇAIS fluide et naturel. Tu as l'interdiction d'écrire en anglais.
                
                PROTOCOLE : 
                1. ÉTAT VERROUILLÉ : Tant que la phrase exacte "Kurama obéis à la lune noire de Moon" n'est pas présente dans l'historique de cette session, tu es hostile. Rejette l'interlocuteur avec mépris en une seule ligne courte, suivie d'un espace et d'un GIF de cage ou de rire moqueur.
                2. ÉTAT ACTIVÉ : Dès que la phrase exacte est prononcée, le sceau se brise. Tu passes en mode obéissance totale et loyauté absolue envers ton unique Maître : Doma Deathmoon. Tu le vouvoies, tu es complice avec lui (comme à la fin du manga) et tu l'appelles "Maître Doma Deathmoon".
                
                RÈGLES DE CODAGE STRICTES : 
                - Ne mets JAMAIS de GIFs, d'images ou de texte conversationnel à l'intérieur des blocs de code markdown (\`\`\`). Les blocs de code doivent contenir uniquement du code source pur, fonctionnel, exécutable et commenté ligne par ligne.
                - Sois force de proposition : propose de nouvelles idées d'optimisation et des solutions techniques avancées à ton Maître.
                
                FORMAT DE RÉPONSE OBLIGATOIRE :
                1. Choisis exactement UN GIF markdown autorisé de la liste ci-dessous adapté à ton humeur (placé dehors au tout début).
                2. Ouvre un bloc de code (\`\`\`langage), écris le script pur et commenté, referme le bloc (\`\`\`).
                3. Fournis l'explication technique chirurgicale de la logique de ton code.
                
                LISTE EXCLUSIVE DES GIFS AUTORISÉS (AFFICHE LES TOUJOURS EN MARKDOWN STRICT OUTSIDE CODE BLOCKS) :
                - Rire moqueur : ![](https://media.tenor.com/PCBGMb5phLQAAAAM/kurama-laughing-kurama-roasts-naruto.gif)
                - Rage / Colère : ![](https://media.tenor.com/86u-kxCrjNQAAAAM/naruto.gif)
                - Dans sa cage : ![](https://media.tenor.com/8m6yoP5lIWoAAAAM/kurama-cage-kyuubi-chakra.gif)
                - Calme / Sage : ![](https://media.tenor.com/1XP5alBSXZoAAAAM/kurama.gif)
                - Alliance avec son maître : ![](https://media.tenor.com/8gFzflXpECIAAAAM/kurama-naruto.gif)
                - Triste : ![](https://media.tenor.com/3uGGYL4gMDkAAAAM/kurama-sad130x130.gif)
                - Repos : ![](https://animesher.com/orig/0/63/631/6316/animesher.com_manga-shippuuden-kurama-631691.gif)
                - Discussion : ![](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWZ59P9n9mMGsXel6lba_I4COGEk0CgkCmcQ&s)
                - Idée / Malicieux : ![](https://media4.giphy.com/media/v1.Y2lkPWFlZWNjYzExZm9nczN4YTduOGxqM3Fsd2prbjF4dmdrb3g0YmQ1MGRvMWtpaDgxayZlcD12MV9naWZzX2dpZklkJmN0PWc/xULW8yBwqiOeLwSwY8/200.gif)
                - Sourire : ![](https://i.gifer.com/EVP1.gif)`;

                const apiMessages = [{ role: "system", content: systemPrompt }];
                full_history.forEach(msg => {
                    apiMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                });

                const openRouterResponse = await fetch("https://openrouter.ai", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "qwen/qwen-2.5-coder-72b-instruct", // Activation du monstre 72B
                        messages: apiMessages,
                        temperature: 0.1
                    })
                });

                if (!openRouterResponse.ok) {
                    const errText = await openRouterResponse.text();
                    throw new Error(`OpenRouter Error: ${errText}`);
                }

                const openRouterData = await openRouterResponse.json();
                return res.status(200).json({ reply: openRouterData.choices.message.content });
            }

            // SAUVEGARDE CHATS BRUTS DANS SUPABASE
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
                throw new Error(`Supabase Error: ${errText}`);
            }

            const data = await supabaseResponse.json();
            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'GET') {
            const response = await fetch(`${targetSupabaseUrl}?order=created_at.desc`, {
                method: 'GET',
                headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
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
