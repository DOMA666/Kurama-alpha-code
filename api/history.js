import { createClient } from '@supabase/supabase-client';

// Lecture des clés d'environnement stockées sur Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
    // Autoriser le navigateur du chat à communiquer avec cette API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. Sauvegarde d'un message (POST)
        if (req.method === 'POST') {
            const { sender, message, session_id } = req.body;

            const { data, error } = await supabase
                .from('kurama_chats')
                .insert([{ sender, message, session_id }]);

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        // 2. Chargement de tout l'historique (GET)
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('kurama_chats')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
