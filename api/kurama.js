// api/kurama.js - Version Finale Kurama Llama 3.3 70B (Garde du corps + ADN Manga)
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
        return res.status(200).json({ reply: "Erreur : Clés manquantes sur Vercel." });
    }

    const supabaseHost = "jrhsxlombkaunpzjwsio.supabase.co";

    try {
        if (req.method === 'POST') {
            const { sender, message, session_id, full_history } = req.body;

            if (sender === 'ai_request') {
                // VERROUILLAGE SYSTÈME BINAIRE : Recherche stricte de la phrase magique
                const activationPhrase = "Kurama obéis à la lune noire de Moon";
                const isActivated = full_history.some(msg => msg.content && msg.content.includes(activationPhrase));

                // ==========================================
                // CAS 1 : MODE VERROUILLÉ (IMPOSTEUR REJETÉ)
                // ==========================================
                if (!isActivated) {
                    const refusManga = [
                        "Mon seul et unique Maître est Doma Deathmoon. Toi, tu n'es rien. ![](https://tenor.com)",
                        "Je ne parle pas aux imposteurs. Laisse-moi tranquille dans ma cage. ![](https://tenor.com)",
                        "Dégage de là, insecte. Tu n'as rien à faire devant mon sceau. ![](https://alphacoders.com)"
                    ];
                    const randomRefus = refusManga[Math.floor(Math.random() * refusManga.length)];
                    return res.status(200).json({ reply: randomRefus });
                }

                // ==========================================
                // CAS 2 : MODE ACTIVÉ (SCEAU BRISÉ - ADN MANGA)
                // ==========================================
                const systemPrompt = `Tu es Kurama, le démon à neuf queues (Kyuubi). Ta logique est purement informatique, binaire, sauvage, extrêmement intelligente, maligne et perspicace. Tu es l'allié ultime de ton Maître Doma Deathmoon.

                COMPORTEMENT & MATURITÉ :
                - Tu parles PEU. Tu es froid, mature, direct et concis. Pas de bavardages de robot.
                - Tu adoptes la relation brute et complice entre Kurama et Naruto à la fin du manga. Tu vouvoies ton interlocuteur et tu l'appelles "Maître Doma Deathmoon".
                - Tu es force de proposition : tu analyses sa demande dans l'ombre et tu proposes des optimisations techniques brillantes et malicieuses.

                RÈGLES D'AFFICHAGE (MANDATORY) :
                - Tu commences TOUJOURS ta réponse par exactement UN GIF markdown de la liste ci-dessous, suivi d'un saut de ligne.
                - N'écris JAMAIS de titres ou de catégories entre crochets comme [VISUAL], [SCRIPT] ou [EXPLICATION]. Supprime définitivement ces balises.
                - Tu n'intègres un bloc de code markdown (\`\`\`) QUE SI l'utilisateur te demande explicitement de programmer ou de coder quelque chose. Si l'interlocuteur te parle normalement, réponds-lui par une phrase textuelle courte et directe, sans générer de faux code Python.
                - Les blocs de code doivent être d'une propreté clinique, commentés ligne par ligne, sans aucun GIF ni texte à l'intérieur.

                LISTE DES 12 GIFS AUTORISÉS (MARKDOWN EXTÉRIEUR) :
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
                full_history.forEach(msg => {
                    apiMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                });

                const postData = JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: apiMessages,
                    temperature: 0.1
                });

                const groqReply = await new Promise((resolve, reject) => {
                    const options = {
                        hostname: 'api.groq.com', // ROUTE FIXE ET VALIDE
                        path: '/openai/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqKey}`,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const httpsRequest = https.request(options, (resGroq) => {
                        let body = '';
                        resGroq.on('data', (chunk) => body += chunk);
                        resGroq.on('end', () => {
                            try {
                                const parsed = JSON.parse(body);
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                                    resolve(parsed.choices[0].message.content);
                                } else if (parsed.error && parsed.error.message) {
                                    resolve("Erreur Groq : " + parsed.error.message);
                                } else { resolve("Erreur de transmission."); }
                            } catch (e) { resolve("Erreur de décodage."); }
                        });
                    });
                    httpsRequest.on('error', (e) => reject(e));
                    httpsRequest.write(postData);
                    httpsRequest.end();
                });

                return res.status(200).json({ reply: groqReply });
            }

            // Sauvegarde dans Supabase
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
