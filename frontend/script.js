// ============================================================
// JARVIS PRO - Frontend with Render Compatibility
// ============================================================

class JarvisApp {
    constructor() {
        this.isLoggedIn = false;
        this.isListening = false;
        this.chatHistory = [];
        this.voiceCommands = 0;
        this.aiResponses = 0;
        this.startTime = Date.now();
        this.currentTheme = 'dark';
        this.recognition = null;
        this.synth = window.speechSynthesis;
        this.robotAnim = 'idle';
        this.eyeBlinkInterval = null;
        this.robotParts = {};
        this.animationTime = 0;
        this.isRobotInitialized = false;
        
        // === PERSONALIZATION ===
        this.userName = localStorage.getItem('jarvis_user_name') || 'User';
        this.aiName = localStorage.getItem('jarvis_ai_name') || 'Jarvis';
        
        // === BACKEND CONFIGURATION ===
        // Auto-detect backend URL (works on Render and localhost)
        this.apiBase = window.location.origin;
        this.isBackendOnline = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.backendCheckInterval = null;
        this.offlineMode = false;

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.initVoiceRecognition();
        this.initRobot3D();
        this.updateClock();
        this.loadTheme();
        this.loadStats();
        this.initParticles();
        this.initLampAnimation();
        this.applyPersonalization();
        
        this.checkBackendHealth();
        
        this.backendCheckInterval = setInterval(() => {
            this.checkBackendHealth();
        }, 30000);
    }

    // -------- Backend Health Check --------
    async checkBackendHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.apiBase}/api/health`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                this.isBackendOnline = true;
                this.offlineMode = false;
                this.retryCount = 0;
                console.log('✅ Backend is online:', this.apiBase);
                this.updateBackendStatus(true);
                
                const banner = document.getElementById('offlineModeBanner');
                if (banner) banner.remove();
                
                return true;
            } else {
                throw new Error(`Status: ${response.status}`);
            }
        } catch (error) {
            this.isBackendOnline = false;
            this.offlineMode = true;
            console.warn('⚠️ Backend unavailable:', error.message);
            this.updateBackendStatus(false);
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = Math.pow(2, this.retryCount) * 3000;
                console.log(`🔄 Retrying in ${delay/1000}s (attempt ${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.checkBackendHealth(), delay);
            } else {
                console.warn('❌ Backend unreachable. Running in offline mode.');
                this.showOfflineMode();
            }
            return false;
        }
    }

    updateBackendStatus(isOnline) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('aiStatusText');
        const systemStatus = document.getElementById('systemStatus');
        const aiCoreStatus = document.getElementById('aiCoreStatus');
        
        if (statusDot) {
            statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        }
        if (statusText) {
            statusText.textContent = isOnline ? 'AI Online' : 'Offline Mode';
            statusText.style.color = isOnline ? 'var(--text-secondary)' : '#ffaa00';
        }
        if (systemStatus) {
            systemStatus.textContent = isOnline ? 'Operational' : 'Offline (Demo)';
            systemStatus.className = isOnline ? 'status-online' : 'status-offline';
            systemStatus.style.color = isOnline ? '#00ff88' : '#ffaa00';
        }
        if (aiCoreStatus) {
            aiCoreStatus.textContent = isOnline ? 'Active' : 'Demo Mode';
            aiCoreStatus.style.color = isOnline ? '#00ff88' : '#ffaa00';
        }
    }

    showOfflineMode() {
        const existingBanner = document.getElementById('offlineModeBanner');
        if (existingBanner) existingBanner.remove();

        const notification = document.createElement('div');
        notification.id = 'offlineModeBanner';
        notification.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 14px 20px;
            background: linear-gradient(135deg, #ff8800, #cc6600);
            color: white;
            text-align: center;
            font-size: 14px;
            z-index: 9999;
            font-weight: 600;
            animation: slideDown 0.5s ease-out;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        `;
        notification.innerHTML = `
            <span>📡 Offline Mode - Running in demo mode</span>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 6px 18px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
            ">Dismiss</button>
            <button onclick="window.jarvis.checkBackendHealth()" style="
                background: white;
                color: #cc6600;
                border: none;
                padding: 6px 18px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
            ">🔄 Retry</button>
        `;
        document.body.prepend(notification);
    }

    // -------- DOM Caching --------
    cacheDOM() {
        this.elements = {
            loginScreen: document.getElementById('loginScreen'),
            mainDashboard: document.getElementById('mainDashboard'),
            loginForm: document.getElementById('loginForm'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            loginError: document.getElementById('loginError'),
            logoutBtn: document.getElementById('logoutBtn'),
            chatInput: document.getElementById('chatInput'),
            sendBtn: document.getElementById('sendBtn'),
            voiceBtn: document.getElementById('voiceBtn'),
            ttsBtn: document.getElementById('ttsBtn'),
            chatMessages: document.getElementById('chatMessages'),
            voiceStatus: document.getElementById('voiceStatus'),
            currentTime: document.getElementById('currentTime'),
            themeToggle: document.getElementById('themeToggle'),
            voiceCommands: document.getElementById('voiceCommands'),
            chatMessagesCount: document.getElementById('chatMessages'),
            aiResponses: document.getElementById('aiResponses'),
            uptime: document.getElementById('uptime'),
            robotCanvas: document.getElementById('robotCanvas'),
            robotStatus: document.getElementById('robotStatus'),
            leftEye: document.getElementById('leftEye'),
            rightEye: document.getElementById('rightEye'),
            systemStatus: document.getElementById('systemStatus'),
            aiCoreStatus: document.getElementById('aiCoreStatus'),
            lampBulb: document.getElementById('lampBulb'),
            lampGlow: document.getElementById('lampGlow'),
            aiModelSelect: document.getElementById('aiModelSelect'),
            voiceSpeed: document.getElementById('voiceSpeed'),
            voicePitch: document.getElementById('voicePitch'),
            openaiKey: document.getElementById('openaiKey'),
            geminiKey: document.getElementById('geminiKey'),
            saveKeys: document.getElementById('saveKeys'),
            clearHistory: document.getElementById('clearHistory'),
            exportData: document.getElementById('exportData'),
            profileUsername: document.getElementById('profileUsername'),
            profileEmail: document.getElementById('profileEmail'),
            profileMessages: document.getElementById('profileMessages'),
            profileCommands: document.getElementById('profileCommands'),
            profileJoined: document.getElementById('profileJoined'),
            themeOptions: document.querySelectorAll('.theme-option'),
            navItems: document.querySelectorAll('.nav-item'),
            robotAnims: document.querySelectorAll('.btn-robot-anim'),
            welcomeName: document.getElementById('welcomeName'),
            welcomeMessage: document.getElementById('welcomeMessage'),
            welcomeChatMessage: document.getElementById('welcomeChatMessage'),
            chatName: document.getElementById('chatName'),
            robotName: document.getElementById('robotName'),
            sidebarName: document.getElementById('sidebarName'),
            appTitle: document.getElementById('appTitle'),
            appSubtitle: document.getElementById('appSubtitle'),
            userNameInput: document.getElementById('userNameInput'),
            aiNameInput: document.getElementById('aiNameInput'),
            saveNameBtn: document.getElementById('saveNameBtn'),
            saveAINameBtn: document.getElementById('saveAINameBtn'),
            autoSpeak: document.getElementById('autoSpeak'),
        };
    }

    // -------- Event Binding --------
    bindEvents() {
        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());

        this.elements.navItems.forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.section));
        });

        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.elements.voiceBtn.addEventListener('click', () => this.toggleVoice());
        this.elements.ttsBtn.addEventListener('click', () => this.speakLastResponse());

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.themeOptions.forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });

        this.elements.robotAnims.forEach(btn => {
            btn.addEventListener('click', () => this.setRobotAnim(btn.dataset.anim));
        });

        this.elements.saveKeys.addEventListener('click', () => this.saveAPIKeys());
        this.elements.clearHistory.addEventListener('click', () => this.clearChatHistory());
        this.elements.exportData.addEventListener('click', () => this.exportUserData());
        
        this.elements.saveNameBtn.addEventListener('click', () => this.saveUserName());
        this.elements.saveAINameBtn.addEventListener('click', () => this.saveAIName());
        this.elements.userNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveUserName();
        });
        this.elements.aiNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveAIName();
        });

        this.elements.autoSpeak.addEventListener('change', (e) => {
            localStorage.setItem('autoSpeak', e.target.checked);
        });

        document.getElementById('showRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        window.addEventListener('resize', () => this.resizeRobot());
    }

    // -------- Authentication --------
    async handleLogin(e) {
        e.preventDefault();
        const username = this.elements.username.value.trim();
        const password = this.elements.password.value.trim();

        if (!username || !password) {
            this.elements.loginError.textContent = 'Please enter username and password';
            this.elements.loginError.style.color = '#ff4444';
            return;
        }

        this.userName = username;
        localStorage.setItem('jarvis_user_name', username);

        // Offline mode auto-login
        if (this.offlineMode) {
            this.isLoggedIn = true;
            this.elements.loginScreen.style.display = 'none';
            this.elements.mainDashboard.style.display = 'block';
            this.elements.profileUsername.textContent = username;
            this.elements.profileEmail.textContent = 'offline@demo.com';
            this.elements.profileJoined.textContent = 'Today';
            this.applyPersonalization();
            this.loadChatHistory();
            this.updateStats();
            this.startLampAnimation();
            
            this.addMessage('ai', '👋 Welcome to OFFLINE MODE! The backend is unavailable, but you can still use the interface.');
            return;
        }

        if (!this.isBackendOnline) {
            await this.checkBackendHealth();
            if (!this.isBackendOnline) {
                this.offlineMode = true;
                this.elements.loginError.textContent = '⚠️ Server offline. Running in demo mode...';
                this.elements.loginError.style.color = '#ffaa00';
                
                setTimeout(() => {
                    this.isLoggedIn = true;
                    this.elements.loginScreen.style.display = 'none';
                    this.elements.mainDashboard.style.display = 'block';
                    this.elements.profileUsername.textContent = username;
                    this.elements.profileEmail.textContent = 'offline@demo.com';
                    this.elements.profileJoined.textContent = 'Today';
                    this.applyPersonalization();
                    this.loadChatHistory();
                    this.updateStats();
                    this.startLampAnimation();
                    this.addMessage('ai', '📡 Running in OFFLINE DEMO mode. The server is currently unavailable.');
                }, 1500);
                return;
            }
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${this.apiBase}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();

            if (data.success) {
                this.isLoggedIn = true;
                this.elements.loginScreen.style.display = 'none';
                this.elements.mainDashboard.style.display = 'block';
                this.elements.profileUsername.textContent = username;
                this.elements.profileEmail.textContent = data.email || 'user@email.com';
                this.elements.profileJoined.textContent = data.joined || 'Today';
                
                this.applyPersonalization();
                this.loadChatHistory();
                this.updateStats();
                this.startLampAnimation();
                
                if (data.token) {
                    localStorage.setItem('jarvis_token', data.token);
                }
            } else {
                this.elements.loginError.textContent = data.message || 'Login failed';
                this.elements.loginError.style.color = '#ff4444';
            }
        } catch (error) {
            console.error('Login error:', error);
            this.offlineMode = true;
            this.isLoggedIn = true;
            this.elements.loginScreen.style.display = 'none';
            this.elements.mainDashboard.style.display = 'block';
            this.elements.profileUsername.textContent = username;
            this.elements.profileEmail.textContent = 'offline@demo.com';
            this.elements.profileJoined.textContent = 'Today';
            this.applyPersonalization();
            this.loadChatHistory();
            this.updateStats();
            this.startLampAnimation();
            this.addMessage('ai', '📡 Running in OFFLINE DEMO mode. The server is currently unavailable.');
        }
    }

    handleLogout() {
        this.isLoggedIn = false;
        this.elements.mainDashboard.style.display = 'none';
        this.elements.loginScreen.style.display = 'flex';
        this.elements.loginForm.reset();
        this.elements.loginError.textContent = '';
        this.elements.loginError.style.color = '#ff4444';
        localStorage.removeItem('jarvis_token');
        this.stopLampAnimation();
    }

    showRegisterForm() {
        this.elements.loginError.textContent = '📝 Create account: Use any username and password (6+ chars)';
        this.elements.loginError.style.color = '#00ff88';
        setTimeout(() => {
            this.elements.loginError.style.color = '#ff4444';
        }, 5000);
    }

    // -------- Navigation --------
    navigateTo(section) {
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        document.querySelectorAll('.content-section').forEach(el => {
            el.classList.toggle('active', el.id === `section-${section}`);
        });

        if (section === 'robot' && this.isRobotInitialized) {
            setTimeout(() => this.resizeRobot(), 100);
        }
    }

    // -------- Personalization --------
    applyPersonalization() {
        const name = this.userName || 'User';
        const ai = this.aiName || 'Jarvis';
        
        if (this.elements.welcomeName) this.elements.welcomeName.textContent = name;
        if (this.elements.welcomeMessage) {
            this.elements.welcomeMessage.textContent = `How can I assist you today, ${name}?`;
        }
        if (this.elements.welcomeChatMessage) {
            this.elements.welcomeChatMessage.textContent = `Hello ${name}! I'm ${ai}. How can I assist you today?`;
        }
        if (this.elements.chatName) this.elements.chatName.textContent = ai;
        if (this.elements.robotName) this.elements.robotName.textContent = ai;
        if (this.elements.sidebarName) this.elements.sidebarName.textContent = ai.toUpperCase();
        if (this.elements.appTitle) this.elements.appTitle.textContent = ai.toUpperCase();
        if (this.elements.appSubtitle) {
            this.elements.appSubtitle.textContent = `Your Personal AI Assistant, ${name}`;
        }
        if (this.elements.userNameInput) this.elements.userNameInput.value = name;
        if (this.elements.aiNameInput) this.elements.aiNameInput.value = ai;
        if (this.elements.profileUsername) this.elements.profileUsername.textContent = name;
        
        if (this.elements.chatInput) {
            this.elements.chatInput.placeholder = `Type a message to ${ai}...`;
        }
    }

    saveUserName() {
        const name = this.elements.userNameInput.value.trim();
        if (name) {
            this.userName = name;
            localStorage.setItem('jarvis_user_name', name);
            this.applyPersonalization();
            this.showNotification('✅ Name saved successfully!');
        } else {
            this.showNotification('⚠️ Please enter a valid name');
        }
    }

    saveAIName() {
        const name = this.elements.aiNameInput.value.trim();
        if (name) {
            this.aiName = name;
            localStorage.setItem('jarvis_ai_name', name);
            this.applyPersonalization();
            this.showNotification('✅ AI name saved successfully!');
        } else {
            this.showNotification('⚠️ Please enter a valid name');
        }
    }

    // -------- Chat System --------
    async sendMessage() {
        const input = this.elements.chatInput;
        const text = input.value.trim();
        if (!text) return;

        this.addMessage('user', text);
        input.value = '';
        input.disabled = true;

        this.chatHistory.push({ role: 'user', content: text });
        this.updateStats();
        this.setRobotAnim('think');

        try {
            if (this.offlineMode || !this.isBackendOnline) {
                await this.simulateOfflineResponse(text);
                input.disabled = false;
                input.focus();
                return;
            }

            if (!this.isBackendOnline) {
                await this.checkBackendHealth();
                if (!this.isBackendOnline) {
                    await this.simulateOfflineResponse(text);
                    input.disabled = false;
                    input.focus();
                    return;
                }
            }

            const model = this.elements.aiModelSelect.value;
            const token = localStorage.getItem('jarvis_token');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.apiBase}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    message: text,
                    model: model,
                    history: this.chatHistory.slice(-10)
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.status === 503 || response.status === 502 || response.status === 504) {
                this.isBackendOnline = false;
                this.offlineMode = true;
                this.updateBackendStatus(false);
                await this.simulateOfflineResponse(text);
                input.disabled = false;
                input.focus();
                return;
            }

            const data = await response.json();

            if (data.success) {
                this.addMessage('ai', data.response);
                this.chatHistory.push({ role: 'assistant', content: data.response });
                this.aiResponses++;
                this.updateStats();
                this.setRobotAnim('talk');
                
                if (this.elements.autoSpeak.checked) {
                    this.speakText(data.response);
                }

                setTimeout(() => {
                    if (this.robotAnim === 'talk') {
                        this.setRobotAnim('idle');
                    }
                }, 3000);
            } else {
                await this.simulateOfflineResponse(text);
            }
        } catch (error) {
            console.error('Chat error:', error);
            await this.simulateOfflineResponse(text);
        }

        input.disabled = false;
        input.focus();
    }

    async simulateOfflineResponse(userMessage) {
        this.setRobotAnim('think');
        
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        
        const responses = [
            `That's a great question, ${this.userName}! Here's what I think...`,
            `Interesting! Let me process that for you, ${this.userName}.`,
            `I understand. Based on what you said, here's my response.`,
            `Great point! Let me share my thoughts on that.`,
            `I'm glad you asked that, ${this.userName}. Here's what I know.`,
            `Let me think about that... Ah yes, here's my answer.`,
            `That's a fascinating topic! Let me explain.`,
            `I appreciate you asking, ${this.userName}. Here's my take.`,
            `Let me analyze that for you. One moment...`,
            `Perfect question! Here's what I've got for you.`
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)] + 
            `\n\n💡 (Running in offline demo mode. Connect to backend for AI responses.)`;
        
        this.addMessage('ai', response);
        this.chatHistory.push({ role: 'assistant', content: response });
        this.aiResponses++;
        this.updateStats();
        
        this.setRobotAnim('talk');
        
        if (this.elements.autoSpeak.checked) {
            this.speakText(response);
        }

        setTimeout(() => {
            if (this.robotAnim === 'talk') {
                this.setRobotAnim('idle');
            }
        }, 3000);
    }

    addMessage(role, content) {
        const container = this.elements.chatMessages;
        const div = document.createElement('div');
        div.className = `message ${role}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' 
            ? `<i class="fas fa-user"></i>` 
            : `<i class="fas fa-robot"></i>`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <p>${content}</p>
            <span class="message-time">${new Date().toLocaleTimeString()}</span>
        `;

        div.appendChild(avatar);
        div.appendChild(contentDiv);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        const count = parseInt(this.elements.chatMessagesCount.textContent) || 0;
        this.elements.chatMessagesCount.textContent = count + 1;
    }

    // -------- Voice Recognition --------
    initVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.elements.voiceBtn.style.opacity = '0.3';
            this.elements.voiceBtn.title = 'Voice not supported';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.elements.chatInput.value = transcript;
                    this.elements.voiceStatus.style.display = 'none';
                    this.elements.voiceBtn.classList.remove('listening');
                    this.isListening = false;
                    this.voiceCommands++;
                    this.updateStats();
                    this.sendMessage();
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Voice error:', event.error);
            this.elements.voiceStatus.style.display = 'none';
            this.elements.voiceBtn.classList.remove('listening');
            this.isListening = false;
            this.setRobotAnim('idle');
            if (event.error !== 'not-allowed') {
                this.elements.voiceStatus.textContent = '⚠️ Error: ' + event.error;
                this.elements.voiceStatus.style.display = 'block';
                setTimeout(() => {
                    this.elements.voiceStatus.style.display = 'none';
                }, 3000);
            }
        };

        this.recognition.onend = () => {
            this.elements.voiceStatus.style.display = 'none';
            this.elements.voiceBtn.classList.remove('listening');
            this.isListening = false;
            if (this.robotAnim === 'listening') {
                this.setRobotAnim('idle');
            }
        };
    }

    toggleVoice() {
        if (!this.recognition) return;

        if (this.isListening) {
            this.recognition.stop();
            this.elements.voiceStatus.style.display = 'none';
            this.elements.voiceBtn.classList.remove('listening');
            this.isListening = false;
            this.setRobotAnim('idle');
        } else {
            this.recognition.start();
            this.elements.voiceStatus.style.display = 'flex';
            this.elements.voiceStatus.innerHTML = '<span class="pulse-dot"></span> Listening... Speak now';
            this.elements.voiceBtn.classList.add('listening');
            this.isListening = true;
            this.setRobotAnim('listening');
            
            setTimeout(() => {
                if (this.isListening) {
                    this.recognition.stop();
                }
            }, 10000);
        }
    }

    // -------- Text-to-Speech --------
    speakText(text) {
        if (!this.synth) return;

        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = parseFloat(this.elements.voiceSpeed.value) || 1;
        utterance.pitch = parseFloat(this.elements.voicePitch.value) || 1;
        utterance.volume = 1;

        const voices = this.synth.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => {
            this.setRobotAnim('talk');
        };

        utterance.onend = () => {
            if (this.robotAnim === 'talk') {
                this.setRobotAnim('idle');
            }
        };

        this.synth.speak(utterance);
    }

    speakLastResponse() {
        const messages = this.elements.chatMessages.querySelectorAll('.ai-message');
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        const text = last.querySelector('.message-content p')?.textContent;
        if (text) this.speakText(text);
    }

    // -------- 3D Robot (Procedural) --------
    initRobot3D() {
        const canvas = this.elements.robotCanvas;
        if (!canvas) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });

        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.5);
        fillLight.position.set(-5, 2, 5);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xff6bff, 0.4);
        rimLight.position.set(0, -2, -5);
        scene.add(rimLight);

        // Create robot
        const robotGroup = this.createProceduralRobot();
        scene.add(robotGroup);

        // Grid
        const gridHelper = new THREE.GridHelper(4, 20, 0x00f0ff, 0x003366);
        gridHelper.position.y = -0.1;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Particles
        const particlesGeo = new THREE.BufferGeometry();
        const particlesCount = 1000;
        const posArray = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 15;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        
        const particlesMat = new THREE.PointsMaterial({
            size: 0.03,
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particlesMesh);

        camera.position.set(2.5, 1.8, 4);
        camera.lookAt(0, 1.2, 0);

        this.robotScene = scene;
        this.robotGroup = robotGroup;
        this.robotRenderer = renderer;
        this.robotCamera = camera;
        this.robotParticles = particlesMesh;
        this.robotCanvas = canvas;

        this.isRobotInitialized = true;
        this.animateRobot();

        setTimeout(() => this.blinkEyes(), 1000);
        this.eyeBlinkInterval = setInterval(() => {
            this.blinkEyes();
        }, 4000);

        this.resizeRobot();
    }

    createProceduralRobot() {
        const group = new THREE.Group();
        const parts = {};

        const materials = {
            body: new THREE.MeshPhysicalMaterial({
                color: 0x1a1a3a,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x002244,
                emissiveIntensity: 0.2,
                clearcoat: 0.3
            }),
            bodyDark: new THREE.MeshPhysicalMaterial({
                color: 0x0a0a2a,
                metalness: 0.9,
                roughness: 0.1,
                emissive: 0x001133,
                emissiveIntensity: 0.1
            }),
            accent: new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                metalness: 0.7,
                roughness: 0.2,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.9
            }),
            glow: new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9
            }),
            eye: new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                emissive: 0x00f0ff,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: 0.95
            }),
            chest: new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.2,
                transparent: true,
                opacity: 0.4,
                metalness: 0.9,
                roughness: 0.1
            })
        };

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.4, 1.8, 0.9);
        const body = new THREE.Mesh(bodyGeo, materials.body);
        body.position.y = 1.0;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        parts.body = body;

        // Chest plate
        const chestGeo = new THREE.BoxGeometry(0.8, 0.5, 0.08);
        const chest = new THREE.Mesh(chestGeo, materials.chest);
        chest.position.set(0, 1.1, 0.47);
        group.add(chest);
        parts.chest = chest;

        // Head
        const headGeo = new THREE.SphereGeometry(0.55, 32, 32);
        const head = new THREE.Mesh(headGeo, materials.bodyDark);
        head.position.y = 2.0;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);
        parts.head = head;

        // Visor
        const visorGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
        const visor = new THREE.Mesh(visorGeo, materials.accent);
        visor.position.set(0, 1.95, 0.5);
        group.add(visor);
        parts.visor = visor;

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const eyeL = new THREE.Mesh(eyeGeo, materials.eye);
        eyeL.position.set(-0.15, 2.05, 0.5);
        group.add(eyeL);
        parts.eyeL = eyeL;

        const eyeR = new THREE.Mesh(eyeGeo, materials.eye);
        eyeR.position.set(0.15, 2.05, 0.5);
        group.add(eyeR);
        parts.eyeR = eyeR;

        // Antenna
        const antennaMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.4,
            metalness: 0.8,
            roughness: 0.2
        });
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, 2.3, 0);
        group.add(antenna);
        parts.antenna = antenna;

        const tipGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const tip = new THREE.Mesh(tipGeo, antennaMat);
        tip.position.set(0, 2.5, 0);
        group.add(tip);
        parts.tip = tip;

        // Arms
        const armMat = new THREE.MeshPhysicalMaterial({
            color: 0x222244,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x001133,
            emissiveIntensity: 0.1
        });
        const armGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.85, 1.3, 0);
        armL.castShadow = true;
        group.add(armL);
        parts.armL = armL;

        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.85, 1.3, 0);
        armR.castShadow = true;
        group.add(armR);
        parts.armR = armR;

        // Hands
        const handMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });
        const handGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const handL = new THREE.Mesh(handGeo, handMat);
        handL.position.set(-0.85, 0.85, 0);
        group.add(handL);
        parts.handL = handL;

        const handR = new THREE.Mesh(handGeo, handMat);
        handR.position.set(0.85, 0.85, 0);
        group.add(handR);
        parts.handR = handR;

        // Legs
        const legMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a3a,
            metalness: 0.6,
            roughness: 0.4,
            emissive: 0x001122,
            emissiveIntensity: 0.1
        });
        const legGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.35, 0.35, 0);
        legL.castShadow = true;
        legL.receiveShadow = true;
        group.add(legL);
        parts.legL = legL;

        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.35, 0.35, 0);
        legR.castShadow = true;
        legR.receiveShadow = true;
        group.add(legR);
        parts.legR = legR;

        // Feet
        const footMat = new THREE.MeshPhysicalMaterial({
            color: 0x444466,
            metalness: 0.5,
            roughness: 0.5
        });
        const footGeo = new THREE.BoxGeometry(0.4, 0.12, 0.5);
        const footL = new THREE.Mesh(footGeo, footMat);
        footL.position.set(-0.35, 0, 0.05);
        footL.castShadow = true;
        footL.receiveShadow = true;
        group.add(footL);
        parts.footL = footL;

        const footR = new THREE.Mesh(footGeo, footMat);
        footR.position.set(0.35, 0, 0.05);
        footR.castShadow = true;
        footR.receiveShadow = true;
        group.add(footR);
        parts.footR = footR;

        // Glow rings
        const glowRingGeo = new THREE.TorusGeometry(0.8, 0.025, 16, 48);
        const glowRingMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.7,
            metalness: 0.9,
            roughness: 0.1,
            side: THREE.DoubleSide
        });
        const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
        glowRing.position.y = 1.0;
        glowRing.rotation.x = Math.PI / 2;
        group.add(glowRing);
        parts.glowRing = glowRing;

        const glowRing2Geo = new THREE.TorusGeometry(0.6, 0.015, 16, 48);
        const glowRing2Mat = new THREE.MeshPhysicalMaterial({
            color: 0xff6bff,
            emissive: 0xff6bff,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.5,
            metalness: 0.9,
            roughness: 0.1,
            side: THREE.DoubleSide
        });
        const glowRing2 = new THREE.Mesh(glowRing2Geo, glowRing2Mat);
        glowRing2.position.y = 1.2;
        glowRing2.rotation.x = Math.PI / 3;
        glowRing2.rotation.z = Math.PI / 6;
        group.add(glowRing2);
        parts.glowRing2 = glowRing2;

        group.scale.set(0.8, 0.8, 0.8);
        group.position.y = 0.1;

        this.robotParts = parts;
        return group;
    }

    // -------- Robot Animation --------
    animateRobot() {
        if (!this.isRobotInitialized) return;

        const animate = () => {
            if (!this.isRobotInitialized) return;
            requestAnimationFrame(animate);
            this.animationTime += 0.01;
            const time = this.animationTime;

            this.updateRobotAnimation(time);

            if (this.robotParticles) {
                this.robotParticles.rotation.y += 0.0005;
            }

            if (this.robotRenderer && this.robotScene && this.robotCamera) {
                this.robotRenderer.render(this.robotScene, this.robotCamera);
            }
        };

        animate();
    }

    updateRobotAnimation(time) {
        const parts = this.robotParts;
        if (!parts) return;

        const group = this.robotGroup;
        if (!group) return;

        switch (this.robotAnim) {
            case 'idle':
                group.position.y = 0.1 + Math.sin(time * 0.6) * 0.03;
                group.rotation.z = Math.sin(time * 0.4) * 0.015;
                if (parts.armL) parts.armL.rotation.x = Math.sin(time * 0.8) * 0.05;
                if (parts.armR) parts.armR.rotation.x = Math.sin(time * 0.8 + Math.PI) * 0.05;
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.7 + Math.sin(time * 2) * 0.3;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                if (parts.glowRing) parts.glowRing.rotation.z += 0.01;
                break;

            case 'walk':
                group.position.y = 0.1 + Math.abs(Math.sin(time * 3)) * 0.08;
                if (parts.legL) parts.legL.rotation.x = Math.sin(time * 3) * 0.4;
                if (parts.legR) parts.legR.rotation.x = Math.sin(time * 3 + Math.PI) * 0.4;
                if (parts.armL) parts.armL.rotation.x = Math.sin(time * 3 + Math.PI) * 0.4;
                if (parts.armR) parts.armR.rotation.x = Math.sin(time * 3) * 0.4;
                break;

            case 'talk':
                if (parts.head) {
                    parts.head.position.y = 2.0 + Math.sin(time * 6) * 0.02;
                    parts.head.rotation.x = Math.sin(time * 5) * 0.02;
                }
                if (parts.armL) parts.armL.rotation.x = -0.2 + Math.sin(time * 4) * 0.2;
                if (parts.armR) parts.armR.rotation.x = -0.2 + Math.sin(time * 4 + Math.PI) * 0.2;
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.6 + Math.sin(time * 6) * 0.4;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                break;

            case 'think':
                if (parts.head) {
                    parts.head.rotation.z = Math.sin(time * 0.3) * 0.05;
                }
                if (parts.armL) {
                    parts.armL.rotation.x = -0.5 + Math.sin(time * 0.5) * 0.05;
                    parts.armL.rotation.z = 0.3 + Math.sin(time * 0.3) * 0.05;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = -0.5 + Math.sin(time * 0.5 + 1) * 0.05;
                    parts.armR.rotation.z = -0.3 + Math.sin(time * 0.3 + 1) * 0.05;
                }
                if (parts.glowRing) {
                    const scale = 1 + Math.sin(time * 0.5) * 0.05;
                    parts.glowRing.scale.x = scale;
                    parts.glowRing.scale.y = scale;
                }
                break;

            case 'listening':
                if (parts.head) {
                    parts.head.rotation.z = Math.sin(time * 0.5) * 0.03;
                    parts.head.position.y = 2.0 + Math.sin(time * 0.4) * 0.015;
                }
                if (parts.armL) parts.armL.rotation.x = -0.2 + Math.sin(time * 0.5) * 0.1;
                if (parts.armR) parts.armR.rotation.x = -0.2 + Math.sin(time * 0.5 + 1) * 0.1;
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.8 + Math.sin(time * 1.5) * 0.2;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                break;

            default:
                break;
        }
    }

    setRobotAnim(anim) {
        this.robotAnim = anim;
        const statusMap = {
            'idle': 'Idle',
            'walk': 'Walking',
            'talk': 'Talking',
            'think': 'Thinking',
            'listening': 'Listening...'
        };
        if (this.elements.robotStatus) {
            this.elements.robotStatus.textContent = statusMap[anim] || anim;
        }
        this.elements.robotAnims.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.anim === anim);
        });
    }

    blinkEyes() {
        const parts = this.robotParts;
        if (!parts || !parts.eyeL || !parts.eyeR) return;

        parts.eyeL.scale.y = 0.1;
        parts.eyeR.scale.y = 0.1;
        
        setTimeout(() => {
            parts.eyeL.scale.y = 1;
            parts.eyeR.scale.y = 1;
        }, 150);
    }

    resizeRobot() {
        if (!this.isRobotInitialized || !this.robotCanvas) return;

        const canvas = this.robotCanvas;
        const width = canvas.clientWidth || 400;
        const height = canvas.clientHeight || 400;

        if (this.robotRenderer) {
            this.robotRenderer.setSize(width, height);
            this.robotRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }

        if (this.robotCamera) {
            this.robotCamera.aspect = width / height;
            this.robotCamera.updateProjectionMatrix();
        }
    }

    // -------- Lamp Animation --------
    initLampAnimation() {
        this.lampInterval = null;
    }

    startLampAnimation() {
        this.stopLampAnimation();
        const bulb = this.elements.lampBulb;
        const glow = this.elements.lampGlow;
        if (!bulb) return;

        let state = 'on';
        this.lampInterval = setInterval(() => {
            if (state === 'on') {
                bulb.classList.remove('off');
                if (glow) glow.style.opacity = '1';
                state = 'fade';
            } else if (state === 'fade') {
                if (glow) {
                    const currentOpacity = parseFloat(glow.style.opacity) || 1;
                    glow.style.opacity = Math.max(0.2, currentOpacity - 0.05);
                    if (currentOpacity <= 0.3) state = 'off';
                }
            } else if (state === 'off') {
                bulb.classList.add('off');
                if (glow) glow.style.opacity = '0';
                state = 'on';
                setTimeout(() => {
                    if (bulb) bulb.classList.remove('off');
                    if (glow) glow.style.opacity = '1';
                }, 2000);
            }
        }, 500);
    }

    stopLampAnimation() {
        if (this.lampInterval) {
            clearInterval(this.lampInterval);
            this.lampInterval = null;
        }
    }

    // -------- Particles --------
    initParticles() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let particles = [];
        const count = 80;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.5 + 0.1;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 240, 255, ${this.opacity})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < count; i++) particles.push(new Particle());

        const drawLines = () => {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        };

        const animateParticles = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            drawLines();
            requestAnimationFrame(animateParticles);
        };

        animateParticles();
        this.particlesCanvas = canvas;
    }

    // -------- Utilities --------
    updateClock() {
        const update = () => {
            const now = new Date();
            this.elements.currentTime.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };
        update();
        setInterval(update, 1000);
    }

    updateStats() {
        this.elements.voiceCommands.textContent = this.voiceCommands;
        this.elements.aiResponses.textContent = this.aiResponses;

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        this.elements.uptime.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (this.elements.profileMessages) {
            this.elements.profileMessages.textContent = this.elements.chatMessagesCount.textContent || 0;
        }
        if (this.elements.profileCommands) {
            this.elements.profileCommands.textContent = this.voiceCommands;
        }
    }

    loadStats() {
        this.voiceCommands = parseInt(localStorage.getItem('jarvis_voice_commands')) || 0;
        this.aiResponses = parseInt(localStorage.getItem('jarvis_ai_responses')) || 0;
        const messages = parseInt(localStorage.getItem('jarvis_chat_count')) || 0;
        if (this.elements.chatMessagesCount) {
            this.elements.chatMessagesCount.textContent = messages;
        }
        this.updateStats();

        setInterval(() => {
            localStorage.setItem('jarvis_voice_commands', this.voiceCommands);
            localStorage.setItem('jarvis_ai_responses', this.aiResponses);
            const count = parseInt(this.elements.chatMessagesCount.textContent) || 0;
            localStorage.setItem('jarvis_chat_count', count);
        }, 5000);
    }

    loadChatHistory() {
        this.chatHistory = [];
        const ai = this.aiName || 'Jarvis';
        const name = this.userName || 'User';
        this.elements.chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <p>Hello ${name}! I'm ${ai}. How can I assist you today?</p>
                    <span class="message-time">Just now</span>
                </div>
            </div>
        `;
    }

    // -------- Theme --------
    toggleTheme() {
        const themes = ['dark', 'light', 'neon'];
        const current = this.currentTheme;
        const idx = themes.indexOf(current);
        const next = themes[(idx + 1) % themes.length];
        this.setTheme(next);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.body.dataset.theme = theme;

        this.elements.themeOptions.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        const icon = this.elements.themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-moon';
            document.documentElement.style.setProperty('--bg-dark', '#0a0a1a');
            document.documentElement.style.setProperty('--text-primary', '#ffffff');
            document.documentElement.style.setProperty('--text-secondary', '#8899bb');
        } else if (theme === 'light') {
            icon.className = 'fas fa-sun';
            document.documentElement.style.setProperty('--bg-dark', '#f0f0f5');
            document.documentElement.style.setProperty('--text-primary', '#1a1a2e');
            document.documentElement.style.setProperty('--text-secondary', '#555577');
        } else if (theme === 'neon') {
            icon.className = 'fas fa-bolt';
            document.documentElement.style.setProperty('--bg-dark', '#0a0015');
            document.documentElement.style.setProperty('--primary', '#ff00ff');
            document.documentElement.style.setProperty('--primary-dark', '#cc00cc');
            document.documentElement.style.setProperty('--secondary', '#00ffff');
            document.documentElement.style.setProperty('--text-primary', '#ffffff');
            document.documentElement.style.setProperty('--text-secondary', '#aa88bb');
        }

        localStorage.setItem('jarvis_theme', theme);
    }

    loadTheme() {
        const theme = localStorage.getItem('jarvis_theme') || 'dark';
        this.setTheme(theme);
    }

    // -------- Settings --------
    saveAPIKeys() {
        const keys = {
            openai: this.elements.openaiKey.value,
            gemini: this.elements.geminiKey.value,
        };
        localStorage.setItem('jarvis_api_keys', JSON.stringify(keys));
        this.showNotification('✅ API keys saved successfully!');
    }

    clearChatHistory() {
        if (confirm('Clear all chat history?')) {
            const ai = this.aiName || 'Jarvis';
            const name = this.userName || 'User';
            this.elements.chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        <p>Chat history cleared. Hello ${name}! How can I help you?</p>
                        <span class="message-time">Just now</span>
                    </div>
                </div>
            `;
            this.chatHistory = [];
            localStorage.setItem('jarvis_chat_count', '0');
            this.elements.chatMessagesCount.textContent = '0';
            this.showNotification('🗑️ Chat history cleared');
        }
    }

    exportUserData() {
        const data = {
            chatHistory: this.chatHistory,
            stats: {
                voiceCommands: this.voiceCommands,
                aiResponses: this.aiResponses,
                messages: parseInt(this.elements.chatMessagesCount.textContent) || 0
            },
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jarvis_data_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('📤 Data exported successfully!');
    }

    // -------- Notifications --------
    showNotification(message) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            padding: 16px 24px; background: rgba(0,240,255,0.1);
            border: 1px solid rgba(0,240,255,0.3);
            border-radius: 12px; color: white;
            font-size: 14px; z-index: 9999;
            backdrop-filter: blur(20px);
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        `;
        div.textContent = message;
        document.body.appendChild(div);

        setTimeout(() => {
            div.style.opacity = '0';
            div.style.transition = 'opacity 0.3s';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    // -------- Cleanup --------
    destroy() {
        if (this.eyeBlinkInterval) {
            clearInterval(this.eyeBlinkInterval);
        }
        if (this.lampInterval) {
            clearInterval(this.lampInterval);
        }
        if (this.backendCheckInterval) {
            clearInterval(this.backendCheckInterval);
        }
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
        }
        if (this.synth) {
            this.synth.cancel();
        }
        this.isRobotInitialized = false;
    }
}

// ============================================================
// Initialize App
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisApp();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.jarvis) {
        window.jarvis.destroy();
    }
});
