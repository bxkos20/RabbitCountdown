import { initCore, state, loadState, modificarMonedas } from './core.js';
import { initUI, showToast, syncUI } from './ui.js';
import { initPhysics, gameLoop, spawnImages, hideImages, updateCollisionCache, cancelAnim } from './physics.js';
import { initRoulette, initBlackjack } from './casino.js';
import { initChallenges, recordChallengeEvent } from './challenges.js';
import { initBackgrounds, normalizeBackgroundState } from './backgrounds.js';

window.isRunning = false;
let countdownInterval = null;
let activeTimeMs = 0;
let lastCoinCheckAt = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initCore();
    await initBackgrounds();
    
    // Avisar si el saldo guardado no coincide con su firma local.
    loadState(() => {
        showToast("🚨 Se detectó una modificación no válida del saldo local.", true);
    });
    normalizeBackgroundState();
    await initChallenges();

    initUI();
    initPhysics();
    initRoulette();
    initBlackjack();
    
    syncUI();

    function stopApp() {
        clearInterval(countdownInterval); cancelAnim();
        window.isRunning = false; activeTimeMs = 0; lastCoinCheckAt = null;
        
        const btn = document.getElementById('startBtn');
        btn.innerText = "Iniciar"; btn.classList.remove('stop-btn');
        
        document.getElementById('countdownDisplay').style.display = 'none';
        document.getElementById('countdownDisplay').classList.remove('danger');
        document.getElementById('message').style.display = 'none';
        
        hideImages(); document.getElementById('explosion').style.display = 'none'; document.getElementById('flashbang').style.display = 'none'; 
        document.getElementById('timeInput').value = ''; 
    }

    document.getElementById('startBtn').addEventListener('click', function() {
        if (window.isRunning) { stopApp(); return; }
        if (!document.getElementById('timeInput').value) { alert('Por favor, selecciona una hora.'); return; }

        window.isRunning = true; activeTimeMs = 0; lastCoinCheckAt = Date.now();
        
        this.innerText = "Detener"; this.classList.add('stop-btn');
        document.getElementById('message').style.display = 'none';
        document.getElementById('countdownDisplay').style.display = 'flex';
        document.getElementById('countdownDisplay').classList.remove('danger');
        
        updateCollisionCache(); 

        if (state.imagesEnabled) spawnImages();
        requestAnimationFrame(gameLoop);

        const [inputHours, inputMinutes] = document.getElementById('timeInput').value.split(':');
        let targetDate = new Date(); targetDate.setHours(parseInt(inputHours), parseInt(inputMinutes), 0, 0);
        if (targetDate.getTime() < new Date().getTime()) { targetDate.setDate(targetDate.getDate() + 1); }

        clearInterval(countdownInterval);
        countdownInterval = setInterval(function() {
            const now = Date.now(); const offsetSecs = state.offsetSecs;
            const distance = targetDate.getTime() + (offsetSecs * 1000) - now;

            if (distance <= 0) {
                stopApp(); 
                const customMsg = state.customMessage.trim();
                document.getElementById('message').innerText = customMsg !== "" ? customMsg : "¡El tiempo ha terminado! 🎉";
                document.getElementById('message').style.display = 'block'; return;
            }

            if (lastCoinCheckAt !== null && state.activeGame !== 'none') {
                activeTimeMs += now - lastCoinCheckAt;
                const earnedCoins = Math.floor(activeTimeMs / 60000);
                if (earnedCoins > 0) {
                    activeTimeMs -= earnedCoins * 60000;
                    modificarMonedas(earnedCoins);
                    recordChallengeEvent('active_minute', {
                        activeGame: state.activeGame,
                        imagesEnabled: state.imagesEnabled
                    }, earnedCoins);
                }
            }
            lastCoinCheckAt = now;

            if (distance <= 60000) document.getElementById('countdownDisplay').classList.add('danger');
            else document.getElementById('countdownDisplay').classList.remove('danger');

            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);

            document.getElementById('hours').innerText = h.toString().padStart(2, '0');
            document.getElementById('minutes').innerText = m.toString().padStart(2, '0');
            document.getElementById('seconds').innerText = s.toString().padStart(2, '0');

        }, 1000);
    });
});
