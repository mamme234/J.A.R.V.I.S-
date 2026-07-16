const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://*.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ========== HEALTH CHECK (Required for Render) ==========
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== DATABASE CONNECTION ==========
const MONGODB_URI = process.env.MONGODB_URI;

// Try to connect to MongoDB, but continue if it fails
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
    })
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('⚠️ Running without database...');
    });
} else {
    console.log('⚠️ No MongoDB URI provided. Running without database.');
}

// ========== MODELS ==========
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    chatHistory: [{
        role: { type: String, enum: ['user', 'assistant', 'system'] },
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
        autoSpeak: { type: Boolean, default: false },
        modelPreference: { type: String, default: 'openai' }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ========== AI PROVIDERS ==========
class AIProviders {
    static async getResponse(message, history = [], model = 'openai') {
        const providers = {
            openai: async () => {
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured');
                }
                const OpenAI = require('openai');
                const client = new OpenAI({ 
                    apiKey: process.env.OPENAI_API_KEY,
                    timeout: 30000
                });
                const response = await client.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are Jarvis, a helpful AI assistant. Be concise, witty, and helpful.' },
                        ...history.slice(-10),
                        { role: 'user', content: message }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                });
                return response.choices[0].message.content;
            },
            gemini: async () => {
                if (!process.env.GEMINI_API_KEY) {
                    throw new Error('Gemini API key not configured');
                }
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
                const result = await model.generateContent(message);
                const response = await result.response;
                return response.text();
            },
            deepseek: async () => {
                if (!process.env.DEEPSEEK_API_KEY) {
                    throw new Error('DeepSeek API key not configured');
                }
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
                            ...history.slice(-10),
                            { role: 'user', content: message }
                        ],
                        max_tokens: 500
                    })
                });
                const data = await response.json();
                return data.choices[0].message.content;
            },
            claude: async () => {
                if (!process.env.CLAUDE_API_KEY) {
                    throw new Error('Claude API key not configured');
                }
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': process.env.CLAUDE_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        messages: [{ role: 'user', content: message }],
                        max_tokens: 500
                    })
                });
                const data = await response.json();
                return data.content[0].text;
            },
            mock: async () => {
                const responses = [
                    "I'm Jarvis, your AI assistant! How can I help you today?",
                    "That's a great question! Let me think about that.",
                    "I understand. Here's what I think about that...",
                    "Interesting! I'd love to help you with that.",
                    "Let me analyze that for you.",
                    "I'm here to assist you with anything you need!",
                    "That's a fascinating topic! Let me share my thoughts.",
                    "I appreciate your question. Here's my response...",
                    "Great question! Let me provide some insights.",
                    "I'm always ready to help. Here's what I think."
                ];
                return responses[Math.floor(Math.random() * responses.length)];
            }
        };

        try {
            const provider = providers[model];
            if (!provider) return await providers.mock();
            
            const hasKey = model === 'openai' ? process.env.OPENAI_API_KEY :
                          model === 'gemini' ? process.env.GEMINI_API_KEY :
                          model === 'deepseek' ? process.env.DEEPSEEK_API_KEY :
                          model === 'claude' ? process.env.CLAUDE_API_KEY : false;
            
            if (!hasKey && model !== 'mock') {
                console.warn(`No API key for ${model}, falling back to mock`);
                return await providers.mock();
            }
            
            return await provider();
        } catch (error) {
            console.error(`AI Error (${model}):`, error.message);
            return await providers.mock();
        }
    }
}

// ========== AUTH MIDDLEWARE ==========
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
};

// ========== API ROUTES ==========

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const existing = await User.findOne({ 
            $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] 
        });
        
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
            username: username.toLowerCase(), 
            email: email.toLowerCase(), 
            password: hashedPassword 
        });
        await user.save();

        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'default_secret_key', 
            { expiresIn: '7d' }
        );

        res.json({ 
            success: true, 
            token, 
            user: { 
                username: user.username, 
                email: user.email,
                joined: user.createdAt.toISOString().split('T')[0]
            } 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'default_secret_key', 
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                email: user.email,
                joined: user.createdAt.toISOString().split('T')[0],
                stats: user.stats,
                settings: user.settings
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Chat
app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { message, model = 'openai', history = [] } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const response = await AIProviders.getResponse(message, history, model);

        req.user.chatHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: response }
        );
        req.user.stats.messages += 1;
        req.user.stats.aiResponses += 1;
        await req.user.save();

        res.json({ 
            success: true, 
            response,
            model: model,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, message: 'Failed to get AI response' });
    }
});

// Voice
app.post('/api/voice', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ success: false, message: 'Voice text is required' });
        }

        req.user.stats.voiceCommands += 1;
        await req.user.save();

        const response = await AIProviders.getResponse(text, [], req.user.settings.modelPreference || 'openai');

        res.json({ 
            success: true, 
            response,
            command: text,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Voice error:', error);
        res.status(500).json({ success: false, message: 'Failed to process voice command' });
    }
});

// Get chat history
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = req.user.chatHistory.slice(-limit);
        
        res.json({
            success: true,
            history: history,
            stats: req.user.stats,
            total: req.user.chatHistory.length
        });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
});

// Update settings
app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const { theme, voiceSpeed, voicePitch, autoSpeak, modelPreference } = req.body;
        
        if (theme) req.user.settings.theme = theme;
        if (voiceSpeed) req.user.settings.voiceSpeed = voiceSpeed;
        if (voicePitch) req.user.settings.voicePitch = voicePitch;
        if (autoSpeak !== undefined) req.user.settings.autoSpeak = autoSpeak;
        if (modelPreference) req.user.settings.modelPreference = modelPreference;

        await req.user.save();
        
        res.json({ success: true, settings: req.user.settings });
    } catch (error) {
        console.error('Settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

// Get profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                username: req.user.username,
                email: req.user.email,
                joined: req.user.createdAt,
                stats: req.user.stats,
                settings: req.user.settings
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to get profile' });
    }
});

// ========== WEBSOCKET ==========
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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  🚀 JARVIS PRO SERVER RUNNING        ║
    ║  📡 Port: ${PORT}                      ║
    ║  🌐 URL: http://0.0.0.0:${PORT}       ║
    ║  🔌 WebSocket: ws://0.0.0.0:${PORT}   ║
    ╚═══════════════════════════════════════╝
    `);
});
