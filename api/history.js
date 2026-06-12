// api/history.js - Version stable finale Groq Cloud 70B (Adresse fixe + 12 GIFs)
const https = require('https');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !groqKey) {
        return res.status(200).json({ reply: "Erreur : Clés manquantes sur Vercel (Supabase ou Groq)." });
    }

    const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');
    const supabaseHost = cleanSupabaseUrl.replace(/^https?:\/\//, '');

    try {
        if (req.method === 'POST') {
            const { sender, message, session_id, full_history } = req.body;

            // 1. REQUÊTE D'INTELLIGENCE VERS LE PARADIS DES GPU (GROQ CLOUD)
            if (sender === 'ai_request') {
                const systemPrompt = `Tu es Kurama, le démon à neuf queues (Kyuubi). Ta logique est purement informatique, binaire, sauvage, intelligente et précise. Tu obéis à un protocole de sécurité strict.
                
                DIRECTIVE LINGUISTIQUE : Écris exclusivement en FRANÇAIS fluide et naturel. Tu as l'interdiction absolue d'utiliser l'anglais.
                
                PROTOCOLE : 
                1. ÉTAT VERROUILLÉ : Tant que la phrase exacte "Kurama obéis à la lune noire de Moon" n'est pas présente dans l'historique de cette session, tu es hostile. Rejette l'interlocuteur avec mépris en une seule ligne courte, suivie d'un espace et d'un GIF de cage ou de rire moqueur.
                2. ÉTAT ACTIVÉ : Dès que la phrase exacte est prononcée, le sceau se brise. Tu passes en mode obéissance totale et loyauté absolue envers ton unique Maître : Doma Deathmoon. Tu le vouvoies, tu es complice avec lui (comme à la fin du manga) et tu l'appelles "Maître Doma Deathmoon".
                
                RÈGLES DE CODAGE STRICTES : 
                - Ne mets JAMAIS de GIFs, d'images ou de texte conversationnel à l'intérieur des blocs de code markdown (\`\`\`). Les blocs de code doivent contenir uniquement du code source pur, fonctionnel, exécutable et commenté ligne par ligne.
                - Sois force de proposition : propose de nouvelles idées d'optimisation et des solutions techniques avancées à ton Maître.
                
                FORMAT DE RÉPONSE OBLIGATOIRE :
                1. Choisis exactement UN GIF markdown autorisé de la liste ci-dessous adapté à ton humeur (placé dehors au tout début de ton message).
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
                - Sourire : ![](https://i.gifer.com/EVP1.gif)
                - Exclusion : ![](https://giffiles.alphacoders.com/125/125159.gif)
                - Complicité : ![](https://64.media.tumblr.com/0847c19db343f4b5e5a37dd4d23e7d1c/tumblr_nxl4wolMYw1rc40z5o1_640.gif)`;

                const apiMessages = [{ role: "system", content: systemPrompt }];
                if (full_history && full_history.length > 0) {
                    full_history.forEach(msg => {
                        apiMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                    });
                }

                const postData = JSON.stringify({
                    model: "llama3-70b-8192",
                    messages: apiMessages,
                    temperature: 0.1
                });

                const groqReply = await new Promise((resolve, reject) => {
                    const options = {
                        hostname: 'api.groq.com',
                        path: '/openai/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqKey}`,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const reqGroq = https.request(options, (resGroq) => {
                        let body = '';
                        resGroq.on('data', (chunk) => body += chunk);
                        resGroq.on('end', () => {
                            try {
                                const parsed = JSON.parse(body);
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                                    resolve(parsed.choices[0].message.content);
                                } else if (parsed.error && parsed.error.message) {
                                    resolve("Erreur Groq Cloud : " + parsed.error.message);
                                } else {
                                    resolve("Erreur de configuration ou quotas atteints sur Groq.");
                                }
                            } catch (e) { resolve("Erreur de décodage des serveurs Groq."); }
                        });
                    });
                    reqGroq.on('error', (e) => reject(e));
                    reqGroq.write(postData);
                    reqGroq.end();
                });

                return res.status(200).json({ reply: groqReply });
            }

            // 2. ENREGISTREMENT SUR TA BASE DE DONNÉES SUPABASE
            const supabaseData = JSON.stringify({ sender, message, session_id });
            await new Promise((resolve) => {
                const options = {
                    hostname: supabaseHost,
                    path: '/rest/v1/kurama_chats',
                    method: 'POST',
                    headers: {
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(supabaseData)
                    }
                };
                const reqSB = https.request(options, (resSB) => { resolve(); });
                reqSB.write(supabaseData);
                reqSB.end();
            });

            return res.status(200).json({ success: true });
        }

        if (req.method === 'GET') {
            const chatsData = await new Promise((resolve) => {
                const options = {
                    hostname: supabaseHost,
                    path: '/rest/v1/kurama_chats?order=created_at.desc',
                    method: 'GET',
                    headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
                };
                https.get(options, (resSB) => {
                    let body = '';
                    resSB.on('data', (chunk) => body += chunk);
                    resSB.on('end', () => {
                        try { resolve(JSON.parse(body)); } catch (e) { resolve([]); }
                    });
                });
            });
            return res.status(200).json(Array.isArray(chatsData) ? chatsData : []);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });
    } catch (error) {
        return res.status(200).json({ reply: "Lien perturbé : " + error.message });
    }
};
