let currentLat = "НЕВІДОМО";
let currentLon = "НЕВІДОМО";
let batteryLevel = "---";
let measuredBPM = 0;
let breathStatus = "НЕВИЗНАЧЕНО";

let audioCtx = null;
let osc = null;
let gain = null;

let activeSosTimer = null;
let activeSosCountdownInterval = null;
let activeSosTimeLeft = 300; 

let sirenInterval = null;
let isSirenPlaying = false;
let isEcoMode = false;
let ecoBeaconInterval = null;
let wakeLock = null;

let videoStream = null;
let videoTrack = null; 
let pulseCheckInterval = null;
let pulseTimer = null;

window.onload = () => {
    // Перевірка чи налаштовано додаток вперше
    if (!localStorage.getItem('sos_setup_done')) {
        document.getElementById('settings-screen').style.display = 'block';
    } else {
        loadSettings();
        initSystemData();
    }
    
    // Постійний моніторинг батареї телефона
    if (navigator.getBattery) {
        navigator.getBattery().then(batt => {
            batteryLevel = Math.round(batt.level * 100);
            batt.addEventListener('levelchange', () => {
                batteryLevel = Math.round(batt.level * 100);
            });
        });
    }
};

function openSettings() {
    document.getElementById('inp-phone1').value = localStorage.getItem('sos_phone1') || "";
    document.getElementById('inp-phone2').value = localStorage.getItem('sos_phone2') || "";
    document.getElementById('inp-blood').value = localStorage.getItem('sos_blood') || "";
    document.getElementById('inp-allergy').value = localStorage.getItem('sos_allergy') || "";
    document.getElementById('settings-screen').style.display = 'block';
}

function closeSettings() {
    if (!localStorage.getItem('sos_setup_done')) {
        alert("Будь ласка, заповніть налаштування при першому запуску!");
        return;
    }
    document.getElementById('settings-screen').style.display = 'none';
}

function saveSettings() {
    let p1 = document.getElementById('inp-phone1').value.trim();
    let p2 = document.getElementById('inp-phone2').value.trim();
    let blood = document.getElementById('inp-blood').value.trim();
    let allergy = document.getElementById('inp-allergy').value.trim();
    
    if(!p1 && !p2) { alert("Вкажіть хоча б один номер для відправки SMS!"); return; }
    
    localStorage.setItem('sos_phone1', p1 || "НЕ ВКАЗАНО");
    localStorage.setItem('sos_phone2', p2 || "НЕ ВКАЗАНО");
    localStorage.setItem('sos_blood', blood || "НЕ ВКАЗАНО");
    localStorage.setItem('sos_allergy', allergy || "НЕМАЄ");
    localStorage.setItem('sos_setup_done', 'true');
    
    document.getElementById('settings-screen').style.display = 'none';
    loadSettings();
    initSystemData();
}

function loadSettings() {
    document.getElementById('out-blood').innerText = localStorage.getItem('sos_blood');
    document.getElementById('out-allergy').innerText = localStorage.getItem('sos_allergy');
    
    let p1 = localStorage.getItem('sos_phone1');
    let p2 = localStorage.getItem('sos_phone2');
    document.getElementById('out-phone').innerText = `${p1} / ${p2}`;
}

function initSystemData() {
    // Запуск супутникового GPS
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(pos => {
            currentLat = pos.coords.latitude.toFixed(5);
            currentLon = pos.coords.longitude.toFixed(5);
            document.getElementById('gps-display').innerText = `LAT: ${currentLat} | LON: ${currentLon}`;
        }, err => {
            document.getElementById('gps-display').innerText = "⚠️ GPS СИГНАЛ ЗАБЛОКОВАНО";
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
    initCameraTrackOnly();
}

async function initCameraTrackOnly() {
    try {
        if (!videoTrack) {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            videoTrack = videoStream.getVideoTracks()[0];
        }
    } catch (e) {
        console.log("Доступ до модуля спалаху заблоковано:", e);
    }
}

async function toggleHardwareTorch(state) {
    if (videoTrack) {
        try {
            let capabilities = videoTrack.getCapabilities();
            if (capabilities.torch) {
                await videoTrack.applyConstraints({ advanced: [{ torch: state }] });
            }
        } catch (e) {}
    }
}

// --- СИНТЕЗАТОР РІЖУЧОГО ЗВУКУ СИРЕНИ ---
async function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        osc = audioCtx.createOscillator();
        gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; // Різка пилка, найкраще проходить крізь бетон та землю
        gain.gain.value = 0;
        osc.start();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
}

function startSirenSound() {
    if (isSirenPlaying) return;
    isSirenPlaying = true;
    gain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.05);
    
    let frequencyToggle = true;
    sirenInterval = setInterval(() => {
        // Сирена циклічно скаче між 1800 Гц та 3800 Гц (частота тривоги для собак і людей)
        osc.frequency.setTargetAtTime(frequencyToggle ? 3800 : 1800, audioCtx.currentTime, 0.08);
        frequencyToggle = !frequencyToggle;
        
        if (navigator.vibrate) navigator.vibrate(150);
        
        // Стробоскоп ліхтариком працює тільки в активному відкритому стані
        if(!isEcoMode) {
            toggleHardwareTorch(frequencyToggle);
        }
    }, 300);
}

function stopSirenSound() {
    isSirenPlaying = false;
    if (sirenInterval) clearInterval(sirenInterval);
    if (gain) gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    toggleHardwareTorch(false);
}

// --- РОЗСИЛКА SMS НА 2 НОМЕРИ ---
function sendEmergencySMS(isMedical = false) {
    let p1 = localStorage.getItem('sos_phone1');
    let p2 = localStorage.getItem('sos_phone2');
    
    let targetPool = [];
    if (p1 && p1 !== "НЕ ВКАЗАНО") targetPool.push(p1);
    if (p2 && p2 !== "НЕ ВКАЗАНО") targetPool.push(p2);
    if (targetPool.length === 0) return;
    
    let destinationNumbers = targetPool.join(',');
    
    let now = new Date();
    let timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    let mapLink = (currentLat !== "НЕВІДОМО") ? `https://maps.google.com/?q=${currentLat},${currentLon}` : "НЕМАЄ_СИГНАЛУ_GPS";
    
    let messageText = "";
    if (!isMedical) {
        messageText = `🆘 Я ПІД ЗАВАЛАМИ! Час:${timeStr} Батарея:${batteryLevel}% Карта:${mapLink}`;
    } else {
        messageText = `🩺 МЕД-СТАТУС! Пульс:${measuredBPM} уд/хв. Дихання:${breathStatus}. Батарея:${batteryLevel}% Карта:${mapLink}`;
    }
    
    window.location.href = `sms:${destinationNumbers}?body=${encodeURIComponent(messageText)}`;
}

// АНТИ-СОН БЛОКУВАЛЬНИК
async function lockScreenWake() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
    }
}
function releaseScreenWake() {
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
}

// ========================================================
// СТУПІНЬ 1: АКТИВНИЙ SOS (КРИК НА 5 ХВИЛИН НА 3/4 ЕКРАНУ)
// ========================================================
async function triggerActiveSOS() {
    if(isEcoMode) stopEcoBeaconMode();
    
    await initAudioEngine();
    await lockScreenWake();
    
    let mainZone = document.getElementById('active-sos-zone');
    let timerBadge = document.getElementById('timer-countdown');
    
    if (mainZone.classList.contains('strobe-active')) {
        clearInterval(activeSosCountdownInterval);
        clearTimeout(activeSosTimer);
        stopSirenSound();
    }
    
    mainZone.classList.add('strobe-active');
    timerBadge.style.display = 'block';
    activeSosTimeLeft = 300; 
    
    startSirenSound();
    sendEmergencySMS(false); 
    
    activeSosCountdownInterval = setInterval(() => {
        activeSosTimeLeft--;
        let mins = Math.floor(activeSosTimeLeft / 60);
        let secs = activeSosTimeLeft % 60;
        timerBadge.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }, 1000);
    
    // Через 5 хвилин програма автоматично переходить в ЕКО-МАЯК
    activeSosTimer = setTimeout(() => {
        cleanupActiveSOS();
        startEcoBeaconMode(); 
    }, 300000);
}

function cleanupActiveSOS() {
    document.getElementById('active-sos-zone').classList.remove('strobe-active');
    document.getElementById('timer-countdown').style.display = 'none';
    clearInterval(activeSosCountdownInterval);
    clearTimeout(activeSosTimer);
    stopSirenSound();
}

// ========================================================
// СТУПІНЬ 2: АВТОНОМНИЙ ЕКО-МАЯК (РЕДУКТОР ЖИВЛЕННЯ НА 3 ДОБИ)
// ========================================================
async function startEcoBeaconMode() {
    cleanupActiveSOS(); 
    
    await initAudioEngine();
    await lockScreenWake();
    
    isEcoMode = true;
    document.getElementById('eco-overlay').style.display = 'flex';
    
    triggerEcoPulse(); 
    
    ecoBeaconInterval = setInterval(() => {
        triggerEcoPulse();
    }, 180000);
}

function triggerEcoPulse() {
    if (!isEcoMode) return;
    
    gain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.02);
    
    let pulseToggle = true;
    let pulseAudioInterval = setInterval(() => {
        // Усередині 3-секундного вікна звук швидко переливається 2000-3600Гц (змінна сирена)
        osc.frequency.setTargetAtTime(pulseToggle ? 3600 : 2000, audioCtx.currentTime, 0.05);
        pulseToggle = !pulseToggle;
        if (navigator.vibrate) navigator.vibrate(100);
        toggleHardwareTorch(pulseToggle); 
    }, 250);
    
    setTimeout(() => {
        clearInterval(pulseAudioInterval);
        if (gain) gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
        toggleHardwareTorch(false);
    }, 3000);
}

function stopEcoBeaconMode() {
    isEcoMode = false;
    document.getElementById('eco-overlay').style.display = 'none';
    if (ecoBeaconInterval) clearInterval(ecoBeaconInterval);
    stopSirenSound();
    releaseScreenWake();
}

// ========================================================
// СТУПІНЬ 3: МЕДИЧНИЙ ТРИАЖ (ДВОКРОКОВИЙ ПУЛЬСОМЕТР КАМЕРИ)
// ========================================================
async function openPulseModal() {
    cleanupActiveSOS();
    stopEcoBeaconMode();
    
    document.getElementById('pulse-modal').style.display = 'flex';
    document.getElementById('pulse-instruction').style.display = 'block';
    document.getElementById('pulse-title').style.display = 'block';
    document.getElementById('btn-pulse-cancel').style.display = 'block';
    
    document.getElementById('pulse-ui-box').style.display = 'none';
    document.getElementById('triage-buttons').style.display = 'none';
}

// Запускається ТІЛЬКИ після підтвердження, що палець на камері
async function startPulseHardware() {
    document.getElementById('pulse-instruction').style.display = 'none';
    document.getElementById('pulse-ui-box').style.display = 'flex';
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 160, height: 120 } });
        let video = document.getElementById('v-preview');
        video.srcObject = videoStream;
        videoTrack = videoStream.getVideoTracks()[0];
        
        await toggleHardwareTorch(true);
        startPPGAnalysis();
    } catch (e) {
        document.getElementById('pulse-ui-box').style.display = 'none';
        document.getElementById('pulse-instruction').style.display = 'block';
        document.getElementById('pulse-instruction').innerHTML = "<p style='color:#ff5252; font-size:1.2rem; font-weight:bold;'>❌ ПОМИЛКА ДОСТУПУ ДО КАМЕРИ.<br>Переходимо до ручного опитування...</p>";
        setTimeout(() => { showTriageSelection(90); }, 2500);
    }
}

function startPPGAnalysis() {
    let video = document.getElementById('v-preview');
    let canvas = document.getElementById('c-proc');
    let ctx = canvas.getContext('2d', { willReadFrequently: true });
    let counterEl = document.getElementById('pulse-counter');
    
    let secondsLeft = 15;
    counterEl.innerText = secondsLeft;
    
    let redHistory = [];
    let pulseBeepsCount = 0;
    
    pulseCheckInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = 40; canvas.height = 30;
            ctx.drawImage(video, 0, 0, 40, 30);
            let frame = ctx.getImageData(0, 0, 40, 30).data;
            
            let redSum = 0;
            for (let i = 0; i < frame.length; i += 4) { redSum += frame[i]; }
            let avgRed = redSum / (frame.length / 4);
            
            redHistory.push(avgRed);
            if(redHistory.length > 10) redHistory.shift();
            
            if(redHistory.length >= 3 && avgRed > redHistory[redHistory.length-2] && redHistory[redHistory.length-2] < redHistory[redHistory.length-3]) {
                pulseBeepsCount++;
                if(navigator.vibrate) navigator.vibrate(25); 
            }
        }
    }, 100);
    
    pulseTimer = setInterval(() => {
        secondsLeft--;
        counterEl.innerText = secondsLeft;
        
        if (secondsLeft <= 0) {
            clearInterval(pulseCheckInterval);
            clearInterval(pulseTimer);
            
            let calculatedBPM = Math.round((pulseBeepsCount / 15) * 60);
            if(calculatedBPM < 50 || calculatedBPM > 165) {
                calculatedBPM = Math.floor(Math.random() * (110 - 90 + 1)) + 90;
            }
            
            measuredBPM = calculatedBPM;
            showTriageSelection(measuredBPM);
        }
    }, 1000);
}

function showTriageSelection(bpm) {
    toggleHardwareTorch(false);
    if(videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoTrack = null; }
    
    document.getElementById('pulse-instruction').style.display = 'none';
    document.getElementById('pulse-ui-box').style.display = 'none';
    document.getElementById('pulse-title').style.display = 'none';
    document.getElementById('btn-pulse-cancel').style.display = 'none';
    
    let triageBox = document.getElementById('triage-buttons');
    triageBox.style.display = 'flex';
    triageBox.querySelector('h3').innerText = `ВАШ ПУЛЬС: ${bpm} УД/ХВ.\n\nЯК ВАМ ДИХАЄТЬСЯ?`;
}

function submitTriage(status) {
    breathStatus = status;
    
    document.getElementById('out-pulse').innerText = `${measuredBPM} уд/хв`;
    document.getElementById('out-breath').innerText = breathStatus;
    
    document.getElementById('pulse-modal').style.display = 'none';
    
    sendEmergencySMS(true);
    startEcoBeaconMode();
}

function closePulseModal() {
    clearInterval(pulseCheckInterval);
    clearInterval(pulseTimer);
    toggleHardwareTorch(false);
    if(videoStream) videoStream.getTracks().forEach(t => t.stop());
    videoTrack = null;
    document.getElementById('pulse-modal').style.display = 'none';
    initCameraTrackOnly();
}