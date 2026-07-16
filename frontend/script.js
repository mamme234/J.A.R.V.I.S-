// ============================================================
// JARVIS PRO - Complete Frontend Controller
// WITH PROCEDURAL 3D ROBOT (No external GLB file needed)
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
        this.robotParts = {}; // Store robot parts for animation
        this.animationTime = 0;
        this.isRobotInitialized = false;

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

        // Window resize for robot
        window.addEventListener('resize', () => this.resizeRobot());
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
                this.startLampAnimation();
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
        this.stopLampAnimation();
    }

    // -------- Navigation --------
    navigateTo(section) {
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        document.querySelectorAll('.content-section').forEach(el => {
            el.classList.toggle('active', el.id === `section-${section}`);
        });

        // Resize robot canvas when switching to robot section
        if (section === 'robot' && this.isRobotInitialized) {
            setTimeout(() => this.resizeRobot(), 100);
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

        // Set robot to think mode
        this.setRobotAnim('think');

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

                // Set robot to talk mode
                this.setRobotAnim('talk');
                
                if (localStorage.getItem('autoSpeak') === 'true') {
                    this.speakText(data.response);
                }

                // Return to idle after 3 seconds
                setTimeout(() => {
                    if (this.robotAnim === 'talk') {
                        this.setRobotAnim('idle');
                    }
                }, 3000);
            } else {
                this.addMessage('ai', '⚠️ Error: ' + (data.message || 'Unknown error'));
                this.setRobotAnim('idle');
            }
        } catch (error) {
            this.setRobotAnim('idle');
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
            
            // Auto-stop after 10 seconds
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

    // ============================================================
    // 3D ROBOT - Procedural Creation (No GLB file needed!)
    // ============================================================
    
    initRobot3D() {
        const canvas = this.elements.robotCanvas;
        if (!canvas) return;

        // Scene setup
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
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.5);
        fillLight.position.set(-5, 2, 5);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xff6bff, 0.4);
        rimLight.position.set(0, -2, -5);
        scene.add(rimLight);

        const backLight = new THREE.PointLight(0x00f0ff, 0.3);
        backLight.position.set(0, 2, -5);
        scene.add(backLight);

        // Create the robot
        const robotGroup = this.createProceduralRobot();
        scene.add(robotGroup);

        // Floor grid
        const gridHelper = new THREE.GridHelper(4, 20, 0x00f0ff, 0x003366);
        gridHelper.position.y = -0.1;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Particles
        const particlesGeo = new THREE.BufferGeometry();
        const particlesCount = 1000;
        const posArray = new Float32Array(particlesCount * 3);
        const colorArray = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 15;
            colorArray[i] = Math.random() * 0.5 + 0.5;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
        
        const particlesMat = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particlesMesh);

        // Camera position
        camera.position.set(2.5, 1.8, 4);
        camera.lookAt(0, 1.2, 0);

        // Store references
        this.robotScene = scene;
        this.robotGroup = robotGroup;
        this.robotRenderer = renderer;
        this.robotCamera = camera;
        this.robotParticles = particlesMesh;
        this.robotCanvas = canvas;

        // Start animation loop
        this.isRobotInitialized = true;
        this.animateRobot();

        // Initial blink
        setTimeout(() => this.blinkEyes(), 1000);

        // Blink interval
        this.eyeBlinkInterval = setInterval(() => {
            this.blinkEyes();
        }, 4000);

        // Resize handler
        this.resizeRobot();
    }

    createProceduralRobot() {
        const group = new THREE.Group();
        const parts = {};

        // ===== MATERIALS =====
        const materials = {
            body: new THREE.MeshPhysicalMaterial({
                color: 0x1a1a3a,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x002244,
                emissiveIntensity: 0.2,
                clearcoat: 0.3,
                clearcoatRoughness: 0.4
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
            joint: new THREE.MeshPhysicalMaterial({
                color: 0x444466,
                metalness: 0.6,
                roughness: 0.4,
                emissive: 0x112233,
                emissiveIntensity: 0.1
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

        // ===== BODY =====
        const bodyGeo = new THREE.BoxGeometry(1.4, 1.8, 0.9);
        const body = new THREE.Mesh(bodyGeo, materials.body);
        body.position.y = 1.0;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        parts.body = body;

        // Body details - chest plate
        const chestGeo = new THREE.BoxGeometry(0.8, 0.5, 0.08);
        const chest = new THREE.Mesh(chestGeo, materials.chest);
        chest.position.set(0, 1.1, 0.47);
        group.add(chest);
        parts.chest = chest;

        // Body accent lines
        for (let i = 0; i < 3; i++) {
            const lineGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
            const line = new THREE.Mesh(lineGeo, materials.accent);
            line.position.set(-0.3 + i * 0.3, 0.8, 0.46);
            group.add(line);
        }

        // ===== HEAD =====
        const headGeo = new THREE.SphereGeometry(0.55, 32, 32);
        const head = new THREE.Mesh(headGeo, materials.bodyDark);
        head.position.y = 2.0;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);
        parts.head = head;

        // Head visor
        const visorGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
        const visor = new THREE.Mesh(visorGeo, materials.accent);
        visor.position.set(0, 1.95, 0.5);
        group.add(visor);
        parts.visor = visor;

        // ===== EYES =====
        const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
        
        const eyeL = new THREE.Mesh(eyeGeo, materials.eye);
        eyeL.position.set(-0.15, 2.05, 0.5);
        group.add(eyeL);
        parts.eyeL = eyeL;

        const eyeR = new THREE.Mesh(eyeGeo, materials.eye);
        eyeR.position.set(0.15, 2.05, 0.5);
        group.add(eyeR);
        parts.eyeR = eyeR;

        // Eye glow rings
        const ringGeo = new THREE.RingGeometry(0.1, 0.13, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const ringL = new THREE.Mesh(ringGeo, ringMat);
        ringL.position.set(-0.15, 2.05, 0.52);
        group.add(ringL);
        
        const ringR = new THREE.Mesh(ringGeo, ringMat);
        ringR.position.set(0.15, 2.05, 0.52);
        group.add(ringR);

        // ===== ANTENNA =====
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

        // ===== ARMS =====
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

        // Shoulder joints
        const jointGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const jointMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.2
        });
        
        const jointL = new THREE.Mesh(jointGeo, jointMat);
        jointL.position.set(-0.85, 1.7, 0);
        group.add(jointL);
        
        const jointR = new THREE.Mesh(jointGeo, jointMat);
        jointR.position.set(0.85, 1.7, 0);
        group.add(jointR);

        // ===== HANDS =====
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

        // ===== LEGS =====
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

        // ===== FEET =====
        const footMat = new THREE.MeshPhysicalMaterial({
            color: 0x444466,
            metalness: 0.5,
            roughness: 0.5,
            emissive: 0x001122,
            emissiveIntensity: 0.05
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

        // ===== GLOW RING (floating) =====
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

        // Second ring (smaller, angled)
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

        // ===== SPINE LIGHTS =====
        for (let i = 0; i < 5; i++) {
            const lightGeo = new THREE.SphereGeometry(0.03, 8, 8);
            const lightMat = new THREE.MeshPhysicalMaterial({
                color: 0x00f0ff,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.5 + i * 0.1,
                transparent: true,
                opacity: 0.8
            });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(0, 0.3 + i * 0.3, 0.47);
            group.add(light);
        }

        // Store all parts for animation
        this.robotParts = parts;

        // Scale the entire robot
        group.scale.set(0.8, 0.8, 0.8);
        group.position.y = 0.1;

        return group;
    }

    // ============================================================
    // ROBOT ANIMATION
    // ============================================================

    animateRobot() {
        if (!this.isRobotInitialized) return;

        const animate = () => {
            if (!this.isRobotInitialized) return;
            
            requestAnimationFrame(animate);
            
            this.animationTime += 0.01;
            const time = this.animationTime;

            // Animate based on current state
            this.updateRobotAnimation(time);

            // Rotate particles
            if (this.robotParticles) {
                this.robotParticles.rotation.y += 0.0005;
                this.robotParticles.rotation.x = Math.sin(time * 0.1) * 0.02;
            }

            // Render
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

        // Default positions for reference
        const defaultPos = {
            armL: { x: -0.85, y: 1.3, z: 0 },
            armR: { x: 0.85, y: 1.3, z: 0 },
            legL: { x: -0.35, y: 0.35, z: 0 },
            legR: { x: 0.35, y: 0.35, z: 0 },
            head: { y: 2.0 },
            body: { y: 1.0 }
        };

        switch (this.robotAnim) {
            case 'idle':
                // Gentle floating and swaying
                group.position.y = 0.1 + Math.sin(time * 0.6) * 0.03;
                group.rotation.z = Math.sin(time * 0.4) * 0.015;
                group.rotation.x = Math.sin(time * 0.3) * 0.01;
                
                // Subtle arm sway
                if (parts.armL) {
                    parts.armL.rotation.x = Math.sin(time * 0.8) * 0.05;
                    parts.armL.rotation.z = Math.sin(time * 0.5 + 1) * 0.03;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = Math.sin(time * 0.8 + Math.PI) * 0.05;
                    parts.armR.rotation.z = Math.sin(time * 0.5) * 0.03;
                }
                
                // Eye glow pulse
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.7 + Math.sin(time * 2) * 0.3;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                
                // Ring rotation
                if (parts.glowRing) {
                    parts.glowRing.rotation.z += 0.01;
                }
                if (parts.glowRing2) {
                    parts.glowRing2.rotation.y += 0.008;
                    parts.glowRing2.rotation.x = Math.PI / 3 + Math.sin(time * 0.3) * 0.05;
                }
                break;

            case 'walk':
                // Walking motion
                group.position.y = 0.1 + Math.abs(Math.sin(time * 3)) * 0.08;
                
                // Legs alternate
                if (parts.legL) {
                    parts.legL.rotation.x = Math.sin(time * 3) * 0.4;
                    parts.legL.position.y = 0.35 + Math.abs(Math.sin(time * 3)) * 0.05;
                }
                if (parts.legR) {
                    parts.legR.rotation.x = Math.sin(time * 3 + Math.PI) * 0.4;
                    parts.legR.position.y = 0.35 + Math.abs(Math.sin(time * 3 + Math.PI)) * 0.05;
                }
                
                // Arms swing opposite to legs
                if (parts.armL) {
                    parts.armL.rotation.x = Math.sin(time * 3 + Math.PI) * 0.4;
                    parts.armL.rotation.z = Math.sin(time * 2) * 0.05;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = Math.sin(time * 3) * 0.4;
                    parts.armR.rotation.z = Math.sin(time * 2 + Math.PI) * 0.05;
                }
                
                // Body bob
                if (parts.body) {
                    parts.body.position.y = 1.0 + Math.abs(Math.sin(time * 3)) * 0.02;
                }
                
                // Rings spin faster
                if (parts.glowRing) {
                    parts.glowRing.rotation.z += 0.03;
                }
                break;

            case 'talk':
                // Head and body bob
                if (parts.head) {
                    parts.head.position.y = 2.0 + Math.sin(time * 6) * 0.02;
                    parts.head.rotation.x = Math.sin(time * 5) * 0.02;
                }
                if (parts.body) {
                    parts.body.position.y = 1.0 + Math.sin(time * 6) * 0.015;
                }
                
                // Arms gesture
                if (parts.armL) {
                    parts.armL.rotation.x = -0.2 + Math.sin(time * 4) * 0.2;
                    parts.armL.rotation.z = Math.sin(time * 3) * 0.08;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = -0.2 + Math.sin(time * 4 + Math.PI) * 0.2;
                    parts.armR.rotation.z = Math.sin(time * 3 + 1) * 0.08;
                }
                
                // Eyes glow with speech
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.6 + Math.sin(time * 6) * 0.4;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                
                // Visor pulse
                if (parts.visor) {
                    parts.visor.material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
                }
                
                // Rings pulse
                if (parts.glowRing) {
                    const scale = 1 + Math.sin(time * 4) * 0.03;
                    parts.glowRing.scale.x = scale;
                    parts.glowRing.scale.y = scale;
                    parts.glowRing.material.opacity = 0.5 + Math.sin(time * 4) * 0.2;
                }
                break;

            case 'think':
                // Tilt head
                if (parts.head) {
                    parts.head.rotation.z = Math.sin(time * 0.3) * 0.05;
                    parts.head.rotation.x = Math.sin(time * 0.2) * 0.03;
                }
                
                // Arms crossed/in thinking pose
                if (parts.armL) {
                    parts.armL.rotation.x = -0.5 + Math.sin(time * 0.5) * 0.05;
                    parts.armL.rotation.z = 0.3 + Math.sin(time * 0.3) * 0.05;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = -0.5 + Math.sin(time * 0.5 + 1) * 0.05;
                    parts.armR.rotation.z = -0.3 + Math.sin(time * 0.3 + 1) * 0.05;
                }
                
                // Eyes slowly pulse
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.4 + Math.sin(time * 0.5) * 0.2;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                
                // Rings pulse slowly
                if (parts.glowRing) {
                    const scale = 1 + Math.sin(time * 0.5) * 0.05;
                    parts.glowRing.scale.x = scale;
                    parts.glowRing.scale.y = scale;
                    parts.glowRing.scale.z = scale;
                }
                if (parts.glowRing2) {
                    const scale = 1 + Math.sin(time * 0.4 + 1) * 0.05;
                    parts.glowRing2.scale.x = scale;
                    parts.glowRing2.scale.y = scale;
                    parts.glowRing2.scale.z = scale;
                }
                
                // Slight body sway
                if (parts.body) {
                    parts.body.position.y = 1.0 + Math.sin(time * 0.2) * 0.02;
                }
                break;

            case 'listening':
                // Head tilt (curious)
                if (parts.head) {
                    parts.head.rotation.z = Math.sin(time * 0.5) * 0.03;
                    parts.head.rotation.x = Math.sin(time * 0.3) * 0.02;
                    parts.head.position.y = 2.0 + Math.sin(time * 0.4) * 0.015;
                }
                
                // Arms open/listening pose
                if (parts.armL) {
                    parts.armL.rotation.x = -0.2 + Math.sin(time * 0.5) * 0.1;
                    parts.armL.rotation.z = -0.2 + Math.sin(time * 0.4) * 0.05;
                }
                if (parts.armR) {
                    parts.armR.rotation.x = -0.2 + Math.sin(time * 0.5 + 1) * 0.1;
                    parts.armR.rotation.z = 0.2 + Math.sin(time * 0.4 + 1) * 0.05;
                }
                
                // Eyes bright and pulsing
                if (parts.eyeL && parts.eyeR) {
                    const pulse = 0.8 + Math.sin(time * 1.5) * 0.2;
                    parts.eyeL.material.emissiveIntensity = pulse;
                    parts.eyeR.material.emissiveIntensity = pulse;
                }
                
                // Rings rotate
                if (parts.glowRing) {
                    parts.glowRing.rotation.z += 0.02;
                }
                if (parts.glowRing2) {
                    parts.glowRing2.rotation.y += 0.015;
                }
                break;

            default:
                break;
        }
    }

    setRobotAnim(anim) {
        this.robotAnim = anim;
        
        // Update status text
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

        // Update button states
        this.elements.robotAnims.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.anim === anim);
        });

        // Trigger eye animation for specific states
        if (anim === 'think') {
            // Thinking eyes - slow blink
            setTimeout(() => this.blinkEyes(), 500);
        }
    }

    blinkEyes() {
        const parts = this.robotParts;
        if (!parts || !parts.eyeL || !parts.eyeR) return;

        // Store original scales
        const origScaleL = parts.eyeL.scale.y;
        const origScaleR = parts.eyeR.scale.y;

        // Close eyes
        parts.eyeL.scale.y = 0.1;
        parts.eyeR.scale.y = 0.1;
        
        // Open after 150ms
        setTimeout(() => {
            parts.eyeL.scale.y = origScaleL || 1;
            parts.eyeR.scale.y = origScaleR || 1;
        }, 150);
    }

    resizeRobot() {
        if (!this.isRobotInitialized || !this.robotCanvas) return;

        const canvas = this.robotCanvas;
        const parent = canvas.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : { width: canvas.clientWidth, height: canvas.clientHeight };
        
        const width = rect.width || canvas.clientWidth || 400;
        const height = rect.height || canvas.clientHeight || 400;

        if (this.robotRenderer) {
            this.robotRenderer.setSize(width, height);
            this.robotRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }

        if (this.robotCamera) {
            this.robotCamera.aspect = width / height;
            this.robotCamera.updateProjectionMatrix();
        }
    }

    // ============================================================
    // LAMP ANIMATION
    // ============================================================

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
                    if (currentOpacity <= 0.3) {
                        state = 'off';
                    }
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

    // -------- Particles (Background) --------
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
        if (this.lampInterval) {
            clearInterval(this.lampInterval);
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

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
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
