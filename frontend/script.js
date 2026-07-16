// ============================================================
// MUHAMMAD'S JARVIS PRO - Complete Frontend
// WITH VOICE CLONING & RECORDING
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
        
        // === VOICE CLONING ===
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecordingVoice = false;
        this.voiceSampleUploaded = false;
        this.useClonedVoice = false;
        this.audioContext = null;
        
        // === PERSONALIZATION ===
        this.userName = localStorage.getItem('jarvis_user_name') || 'Muhammad';
        this.aiName = localStorage.getItem('jarvis_ai_name') || 'Jarvis';
        
        // === BACKEND CONFIGURATION ===
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
        this.initVoiceRecording();
        
        this.checkBackendHealth();
        
        this.backendCheckInterval = setInterval(() => {
            this.checkBackendHealth();
        }, 30000);
    }

    // ============================================================
    // VOICE RECORDING & CLONING SYSTEM
    // ============================================================

    initVoiceRecording() {
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ Audio recording not supported in this browser');
            return;
        }

        // Create voice recording UI elements
        this.createVoiceRecordingUI();
    }

    createVoiceRecordingUI() {
        // Add voice recording section to settings
        const settingsGrid = document.querySelector('.settings-grid');
        if (!settingsGrid) return;

        const voiceCard = document.createElement('div');
        voiceCard.className = 'settings-card glass';
        voiceCard.innerHTML = `
            <h3><i class="fas fa-microphone-alt"></i> Voice Cloning</h3>
            <div class="voice-cloning-section">
                <p class="voice-info">Record your voice to make Jarvis speak like you!</p>
                <div class="voice-recording-controls">
                    <button id="startRecordingBtn" class="btn-primary">
                        <i class="fas fa-circle"></i> Start Recording
                    </button>
                    <button id="stopRecordingBtn" class="btn-danger" style="display:none;">
                        <i class="fas fa-stop"></i> Stop Recording
                    </button>
                    <button id="playRecordingBtn" class="btn-primary" style="display:none;">
                        <i class="fas fa-play"></i> Play Recording
                    </button>
                </div>
                <div id="recordingStatus" class="recording-status" style="display:none;">
                    <span class="pulse-dot"></span> Recording... Speak clearly for 5-10 seconds
                </div>
                <div id="voiceUploadStatus" class="voice-upload-status"></div>
                <div class="voice-settings">
                    <label>
                        <input type="checkbox" id="useClonedVoice" /> Use my voice for responses
                    </label>
                    <label>
                        <input type="checkbox" id="autoSpeak" ${localStorage.getItem('autoSpeak') === 'true' ? 'checked' : ''} /> Auto-speak responses
                    </label>
                </div>
                <p class="voice-hint">💡 For best results, record in a quiet environment and speak naturally.</p>
            </div>
        `;
        settingsGrid.prepend(voiceCard);

        // Bind recording events
        document.getElementById('startRecordingBtn')?.addEventListener('click', () => this.startVoiceRecording());
        document.getElementById('stopRecordingBtn')?.addEventListener('click', () => this.stopVoiceRecording());
        document.getElementById('playRecordingBtn')?.addEventListener('click', () => this.playVoiceRecording());
        document.getElementById('useClonedVoice')?.addEventListener('change', (e) => {
            this.useClonedVoice = e.target.checked;
            localStorage.setItem('useClonedVoice', e.target.checked);
            this.updateVoiceSettings();
        });
        document.getElementById('autoSpeak')?.addEventListener('change', (e) => {
            localStorage.setItem('autoSpeak', e.target.checked);
        });

        // Load saved preferences
        const savedUseCloned = localStorage.getItem('useClonedVoice') === 'true';
        if (savedUseCloned) {
            document.getElementById('useClonedVoice').checked = true;
            this.useClonedVoice = true;
        }

        // Check if voice sample already exists
        this.checkVoiceSampleStatus();
    }

    async startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                // Create audio blob
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.recordedAudio = audioBlob;
                
                // Show play button
                document.getElementById('playRecordingBtn').style.display = 'inline-block';
                document.getElementById('recordingStatus').style.display = 'none';
                
                // Auto-upload
                this.uploadVoiceSample(audioBlob);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecordingVoice = true;

            // Update UI
            document.getElementById('startRecordingBtn').style.display = 'none';
            document.getElementById('stopRecordingBtn').style.display = 'inline-block';
            document.getElementById('recordingStatus').style.display = 'flex';
            document.getElementById('recordingStatus').innerHTML = `
                <span class="pulse-dot"></span> Recording... Speak clearly for 5-10 seconds
                <span id="recordingTimer">0s</span>
            `;

            // Start timer
            let seconds = 0;
            this.recordingTimer = setInterval(() => {
                seconds++;
                const timerEl = document.getElementById('recordingTimer');
                if (timerEl) timerEl.textContent = `${seconds}s`;
                
                // Auto-stop after 15 seconds
                if (seconds >= 15) {
                    this.stopVoiceRecording();
                }
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showNotification('⚠️ Could not access microphone. Please allow microphone access.');
        }
    }

    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecordingVoice) {
            this.mediaRecorder.stop();
            this.isRecordingVoice = false;
            
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }

            document.getElementById('startRecordingBtn').style.display = 'inline-block';
            document.getElementById('stopRecordingBtn').style.display = 'none';
            document.getElementById('recordingStatus').style.display = 'none';
        }
    }

    async uploadVoiceSample(audioBlob) {
        try {
            const token = localStorage.getItem('jarvis_token');
            if (!token) {
                this.showNotification('⚠️ Please login first to upload voice sample');
                return;
            }

            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result;

                const response = await fetch(`${this.apiBase}/api/voice/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ audioData: base64Audio })
                });

                const data = await response.json();
                if (data.success) {
                    this.voiceSampleUploaded = true;
                    document.getElementById('voiceUploadStatus').innerHTML = `
                        <span style="color: #00ff88;">✅ Voice sample uploaded successfully! Jarvis will now speak like you.</span>
                    `;
                    this.showNotification('🎤 Voice sample uploaded! Jarvis will now speak like you.');
                    
                    // Auto-enable cloned voice
                    document.getElementById('useClonedVoice').checked = true;
                    this.useClonedVoice = true;
                    localStorage.setItem('useClonedVoice', 'true');
                    this.updateVoiceSettings();
                } else {
                    document.getElementById('voiceUploadStatus').innerHTML = `
                        <span style="color: #ff4444;">❌ Failed to upload: ${data.message}</span>
                    `;
                }
            };
        } catch (error) {
            console.error('Upload error:', error);
            document.getElementById('voiceUploadStatus').innerHTML = `
                <span style="color: #ff4444;">❌ Failed to upload voice sample</span>
            `;
        }
    }

    playVoiceRecording() {
        if (this.recordedAudio) {
            const audioUrl = URL.createObjectURL(this.recordedAudio);
            const audio = new Audio(audioUrl);
            audio.play();
        }
    }

    async checkVoiceSampleStatus() {
        // Check if user has a voice sample
        const token = localStorage.getItem('jarvis_token');
        if (!token) return;

        try {
            const response = await fetch(`${this.apiBase}/api/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && data.user.voiceSettings) {
                if (data.user.voiceSettings.voiceType === 'cloned') {
                    this.voiceSampleUploaded = true;
                    document.getElementById('voiceUploadStatus').innerHTML = `
                        <span style="color: #00ff88;">✅ Your voice is already cloned! Jarvis will speak like you.</span>
                    `;
                    document.getElementById('useClonedVoice').checked = true;
                    this.useClonedVoice = true;
                }
            }
        } catch (error) {
            console.error('Error checking voice status:', error);
        }
    }

    async updateVoiceSettings() {
        const token = localStorage.getItem('jarvis_token');
        if (!token) return;

        try {
            const settings = {
                voiceType: this.useClonedVoice ? 'cloned' : 'default',
                speed: parseFloat(document.getElementById('voiceSpeed')?.value || 1),
                pitch: parseFloat(document.getElementById('voicePitch')?.value || 1),
                volume: parseFloat(document.getElementById('voiceVolume')?.value || 1)
            };

            await fetch(`${this.apiBase}/api/voice/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('Error updating voice settings:', error);
        }
    }

    // ============================================================
    // ENHANCED TEXT-TO-SPEECH WITH VOICE CLONING
    // ============================================================

    async speakText(text) {
        if (!this.synth) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        this.synth.cancel();

        // Check if we should use cloned voice
        if (this.useClonedVoice && this.voiceSampleUploaded) {
            try {
                const token = localStorage.getItem('jarvis_token');
                const response = await fetch(`${this.apiBase}/api/voice/speak`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        text: text,
                        voiceType: 'cloned'
                    })
                });

                if (response.headers.get('content-type')?.includes('audio')) {
                    // Audio file received - play it
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    
                    audio.onplay = () => {
                        this.setRobotAnim('talk');
                    };
                    
                    audio.onended = () => {
                        if (this.robotAnim === 'talk') {
                            this.setRobotAnim('idle');
                        }
                    };
                    
                    audio.play();
                    return;
                }

                // If response is JSON with useBrowserTTS flag
                const data = await response.json();
                if (data.useBrowserTTS) {
                    // Fallback to browser TTS
                    this.browserSpeak(text, data.voiceSettings);
                    return;
                }
            } catch (error) {
                console.error('Cloned voice error:', error);
                // Fallback to browser TTS
                this.browserSpeak(text);
                return;
            }
        }

        // Default browser TTS
        this.browserSpeak(text);
    }

    browserSpeak(text, settings = {}) {
        if (!this.synth) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || settings.speed || 1);
        utterance.pitch = parseFloat(document.getElementById('voicePitch')?.value || settings.pitch || 1);
        utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || settings.volume || 1);

        // Try to find a good voice
        const voices = this.synth.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Female')));
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
    // BACKEND HEALTH CHECK
    // ============================================================

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

    // ... (rest of the code remains the same - I'll continue with the full file in the next message)

    // ============================================================
    // CLEANUP
    // ============================================================

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
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        if (this.mediaRecorder && this.isRecordingVoice) {
            this.mediaRecorder.stop();
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
    .voice-cloning-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .voice-cloning-section .voice-info {
        color: var(--text-secondary);
        font-size: 14px;
    }
    .voice-recording-controls {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    .voice-recording-controls .btn-primary,
    .voice-recording-controls .btn-danger {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        border: none;
        cursor: pointer;
        transition: var(--transition);
    }
    .voice-recording-controls .btn-danger {
        background: #ff4444;
        color: white;
    }
    .voice-recording-controls .btn-danger:hover {
        background: #cc0000;
    }
    .recording-status {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: rgba(255, 68, 68, 0.1);
        border-radius: 10px;
        color: #ff4444;
        font-size: 14px;
    }
    .voice-upload-status {
        font-size: 14px;
        padding: 8px 0;
    }
    .voice-settings {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }
    .voice-settings label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: var(--text-secondary);
        cursor: pointer;
    }
    .voice-settings input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: var(--primary);
    }
    .voice-hint {
        font-size: 12px;
        color: var(--text-secondary);
        opacity: 0.7;
        margin-top: 5px;
        font-style: italic;
    }
`;
document.head.appendChild(style);

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.jarvis) {
        window.jarvis.destroy();
    }
});
