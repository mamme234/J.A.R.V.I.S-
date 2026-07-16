// ============================================================
// JARVIS PRO - Complete Frontend Controller
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
        };
    }

    // -------- Event Binding --------
    bindEvents() {
        // Login
        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Navigation
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', () => this.navigateTo(item.dataset.section));
        });

        // Chat
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Voice
        this.elements.voiceBtn.addEventListener('click', () => this.toggleVoice());

        // TTS
        this.elements.ttsBtn.addEventListener('click', () => this.speakLastResponse());

        // Theme
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.themeOptions.forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });

        // Robot Animations
        this.elements.robotAnims.forEach(btn => {
            btn.addEventListener('click', () => this.setRobotAnim(btn.dataset.anim));
        });

        // Settings
        this.elements.saveKeys.addEventListener('click', () => this.saveAPIKeys());
        this.elements.clearHistory.addEventListener('click', () => this.clearChatHistory());
        this.elements.exportData.addEventListener('click', () => this.exportUserData());
    }

    // -------- Authentication --------
    async handleLogin(e) {
        e.preventDefault();
        const username = this.elements.username.value;
        const password = this.elements.password.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (data.success) {
                this.isLoggedIn = true;
                this.elements.loginScreen.style.display = 'none';
                this.elements.mainDashboard.style.display = 'block';
                this.elements.profileUsername.textContent = username;
                this.elements.profileEmail.textContent = data.email || 'user@email.com';
                this.elements.profileJoined.textContent = data.joined || 'Today';
                this.loadChatHistory();
                this.updateStats();
            } else {
                this.elements.loginError.textContent = data.message || 'Login failed';
            }
        } catch (error) {
            this.elements.loginError.textContent = 'Connection error. Please try again.';
        }
    }

    handleLogout() {
        this.isLoggedIn = false;
        this.elements.mainDashboard.style.display = 'none';
        this.elements.loginScreen.style.display = 'flex';
        this.elements.loginForm.reset();
        this.elements.loginError.textContent = '';
    }

    // -------- Navigation --------
    navigateTo(section) {
        // Update nav items
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Show section
        document.querySelectorAll('.content-section').forEach(el => {
            el.classList.toggle('active', el.id === `section-${section}`);
        });
    }

    // -------- Chat System --------
    async sendMessage() {
        const input = this.elements.chatInput;
        const text = input.value.trim();
        if (!text) return;

        // Add user message to UI
        this.addMessage('user', text);
        input.value = '';
        input.disabled = true;

        // Update stats
        this.chatHistory.push({ role: 'user', content: text });
        this.updateStats();

        try {
            const model = this.elements.aiModelSelect.value;
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    model: model,
                    history: this.chatHistory.slice(-10)
                })
            });

            const data = await response.json();
            if (data.success) {
                this.addMessage('ai', data.response);
                this.chatHistory.push({ role: 'assistant', content: data.response });
                this.aiResponses++;
                this.updateStats();

                // Auto-speak if enabled
                if (localStorage.getItem('autoSpeak') === 'true') {
                    this.speakText(data.response);
                }
            } else {
                this.addMessage('ai', '⚠️ Error: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            this.addMessage('ai', '⚠️ Connection error. Please check your network.');
        }

        input.disabled = false;
        input.focus();
    }

    addMessage(role, content) {
        const container = this.elements.chatMessages;
        const div = document.createElement('div');
        div.className = `message ${role}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `<p>${content}</p><span class="message-time">${new Date().toLocaleTimeString()}</span>`;

        div.appendChild(avatar);
        div.appendChild(contentDiv);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        // Update message count
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
        };
    }

    toggleVoice() {
        if (!this.recognition) return;

        if (this.isListening) {
            this.recognition.stop();
            this.elements.voiceStatus.style.display = 'none';
            this.elements.voiceBtn.classList.remove('listening');
            this.isListening = false;
        } else {
            this.recognition.start();
            this.elements.voiceStatus.style.display = 'flex';
            this.elements.voiceStatus.innerHTML = '<span class="pulse-dot"></span> Listening... Speak now';
            this.elements.voiceBtn.classList.add('listening');
            this.isListening = true;
        }
    }

    // -------- Text-to-Speech --------
    speakText(text) {
        if (!this.synth) return;

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = parseFloat(this.elements.voiceSpeed.value) || 1;
        utterance.pitch = parseFloat(this.elements.voicePitch.value) || 1;
        utterance.volume = 1;

        // Try to find a good voice
        const voices = this.synth.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
        if (preferred) utterance.voice = preferred;

        this.synth.speak(utterance);
    }

    speakLastResponse() {
        const messages = this.elements.chatMessages.querySelectorAll('.ai-message');
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        const text = last.querySelector('.message-content p')?.textContent;
        if (text) this.speakText(text);
    }

    // -------- 3D Robot --------
    initRobot3D() {
        const canvas = this.elements.robotCanvas;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });

        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00f0ff, 1);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        scene.add(mainLight);

        const backLight = new THREE.PointLight(0xff6bff, 0.5);
        backLight.position.set(-3, 1, -5);
        scene.add(backLight);

        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.3);
        fillLight.position.set(-3, 2, 4);
        scene.add(fillLight);

        // Particles
        const particlesGeo = new THREE.BufferGeometry();
        const particlesCount = 1500;
        const posArray = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 20;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMat = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particlesMesh);

        // Robot model placeholder (simple geometry)
        const robotGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.6, 0.8);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: 0x1a1a3a,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x002244,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        robotGroup.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const headMat = new THREE.MeshPhongMaterial({
            color: 0x2a2a4a,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x0044aa,
            emissiveIntensity: 0.2
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.8;
        head.castShadow = true;
        robotGroup.add(head);

        // Eyes (glowing)
        const eyeMat = new THREE.MeshPhongMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.8
        });
        const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 1.9, 0.45);
        robotGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, 1.9, 0.45);
        robotGroup.add(eyeR);

        // Arms
        const armMat = new THREE.MeshPhongMaterial({
            color: 0x222244,
            metalness: 0.7,
            roughness: 0.3
        });
        const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);

        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.7, 1.2, 0);
        robotGroup.add(armL);

        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.7, 1.2, 0);
        robotGroup.add(armR);

        // Legs
        const legMat = new THREE.MeshPhongMaterial({
            color: 0x1a1a3a,
            metalness: 0.6,
            roughness: 0.4
        });
        const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);

        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.3, 0.3, 0);
        robotGroup.add(legL);

        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.3, 0.3, 0);
        robotGroup.add(legR);

        // Glow ring around robot
        const ringGeo = new THREE.TorusGeometry(0.9, 0.02, 16, 32);
        const ringMat = new THREE.MeshPhongMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.8;
        ring.rotation.x = Math.PI / 2;
        robotGroup.add(ring);

        scene.add(robotGroup);

        camera.position.set(2, 1.5, 3.5);
        camera.lookAt(0, 1, 0);

        // Store references for animation
        this.robotScene = scene;
        this.robotGroup = robotGroup;
        this.robotRenderer = renderer;
        this.robotCamera = camera;
        this.robotParticles = particlesMesh;
        this.robotRing = ring;
        this.robotArms = [armL, armR];
        this.robotLegs = [legL, legR];
        this.robotEyes = [eyeL, eyeR];

        // Animation loop
        let time = 0;
        const animate = () => {
            requestAnimationFrame(animate);
            time += 0.01;

            // Animate based on current state
            this.animateRobot(time);

            // Rotate particles
            this.robotParticles.rotation.y += 0.0005;

            // Ring rotation
            this.robotRing.rotation.z += 0.01;

            renderer.render(scene, camera);
        };

        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        });

        // Blink eyes periodically
        this.eyeBlinkInterval = setInterval(() => {
            this.blinkEyes();
        }, 3000);

        // Store canvas for cleanup
        this.robotCanvas = canvas;
    }

    animateRobot(time) {
        const group = this.robotGroup;
        const arms = this.robotArms;
        const legs = this.robotLegs;
        const eyes = this.robotEyes;

        switch (this.robotAnim) {
            case 'idle':
                // Gentle sway
                group.rotation.z = Math.sin(time * 0.5) * 0.02;
                group.position.y = Math.sin(time * 1.2) * 0.03;
                arms.forEach((arm, i) => {
                    arm.rotation.x = Math.sin(time * 0.8 + i * Math.PI) * 0.1;
                });
                eyes.forEach(eye => {
                    eye.material.emissiveIntensity = 0.6 + Math.sin(time * 2) * 0.2;
                });
                break;

            case 'walk':
                group.position.y = Math.abs(Math.sin(time * 3)) * 0.1 + 0.8;
                legs.forEach((leg, i) => {
                    leg.rotation.x = Math.sin(time * 3 + i * Math.PI) * 0.4;
                });
                arms.forEach((arm, i) => {
                    arm.rotation.x = Math.sin(time * 3 + i * Math.PI + Math.PI) * 0.4;
                });
                group.rotation.y += 0.005;
                break;

            case 'talk':
                group.position.y = 0.8 + Math.sin(time * 8) * 0.02;
                arms.forEach((arm, i) => {
                    arm.rotation.x = Math.sin(time * 4 + i * Math.PI) * 0.3;
                    arm.rotation.z = Math.sin(time * 3 + i) * 0.1;
                });
                eyes.forEach(eye => {
                    eye.material.emissiveIntensity = 0.5 + Math.sin(time * 6) * 0.5;
                });
                // Jaw movement (head bobbing)
                group.children[1].position.y = 1.8 + Math.sin(time * 8) * 0.02;
                break;

            case 'think':
                group.rotation.z = Math.sin(time * 0.3) * 0.05;
                group.rotation.x = Math.sin(time * 0.2) * 0.03;
                arms.forEach((arm, i) => {
                    arm.rotation.x = -0.3 + Math.sin(time * 0.5 + i) * 0.1;
                    arm.rotation.z = 0.2 + Math.sin(time * 0.3 + i) * 0.1;
                });
                eyes.forEach(eye => {
                    eye.material.emissiveIntensity = 0.3 + Math.sin(time * 0.5) * 0.2;
                });
                // Ring pulse
                this.robotRing.scale.x = 1 + Math.sin(time * 0.5) * 0.1;
                this.robotRing.scale.y = 1 + Math.sin(time * 0.5) * 0.1;
                break;

            default:
                break;
        }
    }

    setRobotAnim(anim) {
        this.robotAnim = anim;
        this.elements.robotStatus.textContent = anim.charAt(0).toUpperCase() + anim.slice(1);

        // Update button states
        this.elements.robotAnims.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.anim === anim);
        });

        // Reset ring scale when switching to non-think
        if (anim !== 'think') {
            this.robotRing.scale.x = 1;
            this.robotRing.scale.y = 1;
        }
    }

    blinkEyes() {
        const eyes = this.robotEyes;
        eyes.forEach(eye => {
            eye.scale.y = 0.1;
            setTimeout(() => {
                eye.scale.y = 1;
            }, 150);
        });
    }

    // -------- Particles (Canvas) --------
    initParticles() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '-1';
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

        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }

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
            particles.forEach(p => {
                p.update();
                p.draw();
            });
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
        // Chat messages count is updated in addMessage
        this.elements.aiResponses.textContent = this.aiResponses;

        // Uptime
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        this.elements.uptime.textContent =
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Profile stats
        if (this.elements.profileMessages) {
            this.elements.profileMessages.textContent = this.elements.chatMessagesCount.textContent || 0;
        }
        if (this.elements.profileCommands) {
            this.elements.profileCommands.textContent = this.voiceCommands;
        }
    }

    loadStats() {
        // Load from localStorage
        this.voiceCommands = parseInt(localStorage.getItem('jarvis_voice_commands')) || 0;
        this.aiResponses = parseInt(localStorage.getItem('jarvis_ai_responses')) || 0;
        const messages = parseInt(localStorage.getItem('jarvis_chat_count')) || 0;
        if (this.elements.chatMessagesCount) {
            this.elements.chatMessagesCount.textContent = messages;
        }
        this.updateStats();

        // Auto-save stats periodically
        setInterval(() => {
            localStorage.setItem('jarvis_voice_commands', this.voiceCommands);
            localStorage.setItem('jarvis_ai_responses', this.aiResponses);
            const count = parseInt(this.elements.chatMessagesCount.textContent) || 0;
            localStorage.setItem('jarvis_chat_count', count);
        }, 5000);
    }

    loadChatHistory() {
        // Placeholder - load from server
        this.chatHistory = [];
        this.elements.chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <p>Welcome back! How can I help you today?</p>
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

        // Update theme options
        this.elements.themeOptions.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        // Update theme toggle icon
        const icon = this.elements.themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-moon';
            document.documentElement.style.setProperty('--bg-dark', '#0a0a1a');
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
        this.showNotification('API keys saved successfully!');
    }

    clearChatHistory() {
        if (confirm('Clear all chat history?')) {
            this.elements.chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        <p>Chat history cleared. How can I help you?</p>
                        <span class="message-time">Just now</span>
                    </div>
                </div>
            `;
            this.chatHistory = [];
            localStorage.setItem('jarvis_chat_count', '0');
            this.elements.chatMessagesCount.textContent = '0';
            this.showNotification('Chat history cleared');
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
        this.showNotification('Data exported successfully!');
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
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
        }
        if (this.synth) {
            this.synth.cancel();
        }
    }
}

// ============================================================
// Initialize App
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisApp();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);
