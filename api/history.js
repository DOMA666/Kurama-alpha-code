// api/history.js - Connexion directe et robuste à l'API Supabase
export default async function handler(req, res) {
    // Configuration des autorisations de sécurité (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    // Sécurité : Vérifie si Vercel possède bien les clés d'environnement
    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: "Clés d'environnement SUPABASE_URL ou SUPABASE_ANON_KEY introuvables sur Vercel." });
    }

    const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/kurama_chats`;

    try {
        // CASE 1 : Sauvegarde d'un message (POST)
        if (req.method === 'POST') {
            const { sender, message, session_id } = req.body;

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ sender, message, session_id })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Supabase REST Error: ${errText}`);
            }

            const data = await response.json();
            return res.status(200).json({ success: true, data });
        }

        // CASE 2 : Chargement de l'historique (GET)
        if (req.method === 'GET') {
            const response = await fetch(`${targetUrl}?order=created_at.desc`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Supabase REST Error: ${errText}`);
            }

            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
