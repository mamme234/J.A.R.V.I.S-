const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('frontend'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});
app.use('/api/', limiter);

// ========== DATABASE ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jarvis', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ========== MODELS ==========
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    chatHistory: [{
        role: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],
    stats: {
        voiceCommands: { type: Number, default: 0 },
        aiResponses: { type: Number, default: 0 },
        messages: { type: Number, default: 0 }
    },
    settings: {
        theme: { type: String, default: 'dark' },
        voiceSpeed: { type: Number, default: 1 },
        voicePitch: { type: Number, default: 1 },
        autoSpeak: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ========== AI PROVIDERS ==========
class AIProviders {
    static async getResponse(message, history, model = 'openai') {
        const providers = {
            openai: async () => {
                const OpenAI = require('openai');
                const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const response = await client.chat.completions.create({
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: 'You are Jarvis, a helpful AI assistant. Be concise, witty, and helpful.' },
                        ...history,
                        { role: 'user', content: message }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                });
                return response.choices[0].message.content;
            },
            gemini: async () => {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
                const result = await model.generateContent(message);
                return result.response.text();
            },
            deepseek: async () => {
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'You are Jarvis, a helpful AI assistant.' },
                            ...history,
                            { role: 'user', content: message }
                        ]
                    })
                });
                const data = await response.json();
                return data.choices[0].message.content;
            },
            claude: async () => {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': process.env.CLAUDE_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        messages: [
                            { role: 'user', content: message }
                        ],
                        max_tokens: 500
                    })
                });
                const data = await response.json();
                return data.content[0].text;
            }
        };

        try {
            const provider = providers[model];
            if (!provider) throw new Error(`Unknown model: ${model}`);
            return await provider();
        } catch (error) {
            console.error(`AI Error (${model}):`, error);
            throw new Error(`AI service error: ${error.message}`);
        }
    }
}

// ========== ROUTES ==========

// Auth
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { username, email } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                email: user.email,
                joined: user.createdAt.toLocaleDateString(),
                stats: user.stats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model = 'openai', history = [] } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        const response = await AIProviders.getResponse(message, history, model);

        // Save to user history if authenticated
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user) {
                    user.chatHistory.push(
                        { role: 'user', content: message },
                        { role: 'assistant', content: response }
                    );
                    user.stats.messages += 1;
                    user.stats.aiResponses += 1;
                    await user.save();
                }
            } catch (e) { /* Token invalid, just continue */ }
        }

        res.json({ success: true, response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Voice
app.post('/api/voice', async (req, res) => {
    try {
        const { text } = req.body;
        // Process voice command - could add special handling here
        res.json({ success: true, message: 'Voice command received' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// History
app.get('/api/history', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            history: user.chatHistory.slice(-50), // Last 50 messages
            stats: user.stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Settings
app.put('/api/settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { theme, voiceSpeed, voicePitch, autoSpeak } = req.body;
        if (theme) user.settings.theme = theme;
        if (voiceSpeed) user.settings.voiceSpeed = voiceSpeed;
        if (voicePitch) user.settings.voicePitch = voicePitch;
        if (autoSpeak !== undefined) user.settings.autoSpeak = autoSpeak;

        await user.save();
        res.json({ success: true, settings: user.settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Profile
app.get('/api/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                joined: user.createdAt,
                stats: user.stats,
                settings: user.settings
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== WEBSOCKET (for real-time) ==========
const http = require('http');
const WebSocket = require('ws');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🔌 WebSocket connected');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                case 'chat':
                    // Handle real-time chat via WebSocket
                    const response = await AIProviders.getResponse(data.message, data.history || []);
                    ws.send(JSON.stringify({
                        type: 'chat_response',
                        response,
                        timestamp: Date.now()
                    }));
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => console.log('🔌 WebSocket disconnected'));
});

// ========== START SERVER ==========
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  🚀 JARVIS PRO SERVER RUNNING        ║
    ║  📡 http://localhost:${PORT}          ║
    ║  🔌 WebSocket: ws://localhost:${PORT}  ║
    ╚═══════════════════════════════════════╝
    `);
});
