import { state, config, modificarMonedas, saveState, currentChipValue, setChipValue } from './core.js';
import { spawnImages, hideImages, updateCollisionCache } from './physics.js';

export function showToast(msg, isDanger = false) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    if (isDanger) toast.classList.add('danger'); else toast.classList.remove('danger');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
}

export function updateCoinDisplay() {
    document.querySelectorAll('.coin-display').forEach(el => el.innerText = state.coins);
}

function applyBackground() {
    const bg = config.backgrounds[state.activeBg];
    if (bg && bg.url !== '') {
        document.body.style.background = `url('${bg.url}') no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
    } else {
        document.body.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
    }
}

function updateToggleBtn(btn, isActive) {
    if(isActive) { btn.innerText = `ON`; btn.classList.add('on'); btn.classList.remove('off'); } 
    else { btn.innerText = `OFF`; btn.classList.add('off'); btn.classList.remove('on'); }
}

export function syncUI() {
    document.getElementById('offsetInput').value = state.offsetSecs;
    document.getElementById('customMessageInput').value = state.customMessage;
    document.getElementById('customUrlInput').value = state.customUrl;
    document.getElementById('img1').src = state.customUrl; document.getElementById('img2').src = state.customUrl;

    updateToggleBtn(document.getElementById('toggleImagesBtn'), state.imagesEnabled);
    updateToggleBtn(document.getElementById('toggleRouletteBtn'), state.activeGame === 'roulette');
    updateToggleBtn(document.getElementById('toggleBlackjackBtn'), state.activeGame === 'blackjack');

    document.getElementById('rouletteContainer').style.display = (state.activeGame === 'roulette') ? 'block' : 'none';
    document.getElementById('blackjackContainer').style.display = (state.activeGame === 'blackjack') ? 'block' : 'none';
    
    applyBackground();
    updateCoinDisplay();
    renderStore();
    setTimeout(updateCollisionCache, 50);
}

function renderStore() {
    const grid = document.getElementById('bgStoreGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(config.backgrounds).forEach(key => {
        const bg = config.backgrounds[key];
        const isOwned = state.ownedBgs.includes(key);
        const isEquipped = state.activeBg === key;
        
        let btnHTML = '';
        if (isEquipped) btnHTML = `<button class="c-btn" style="background:#747d8c; width:100%;" disabled>Equipado</button>`;
        else if (isOwned) btnHTML = `<button class="c-btn equip-bg-btn" data-id="${key}" style="background:#3498db; width:100%;">Equipar</button>`;
        else btnHTML = `<button class="c-btn buy-bg-btn" data-id="${key}" style="background:#2ed573; width:100%;">Comprar 100🪙</button>`;

        const previewStyle = bg.url ? `background: url('${bg.url}')` : `background: linear-gradient(135deg, #1e3c72, #2a5298)`;

        grid.innerHTML += `
            <div class="store-item">
                <div class="store-preview" style="${previewStyle}"></div>
                <h3 style="margin: 0 0 10px 0; font-size:1rem;">${bg.name}</h3>
                ${btnHTML}
            </div>
        `;
    });

    document.querySelectorAll('.buy-bg-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        if (modificarMonedas(-100)) {
            state.ownedBgs.push(id); state.activeBg = id;
            saveState(); applyBackground(); renderStore(); updateCoinDisplay();
            showToast(`✨ Fondo '${config.backgrounds[id].name}' adquirido y equipado.`);
        } else { showToast("🪙 Monedas insuficientes.", true); }
    }));

    document.querySelectorAll('.equip-bg-btn').forEach(btn => btn.addEventListener('click', (e) => {
        state.activeBg = e.target.getAttribute('data-id');
        saveState(); applyBackground(); renderStore();
    }));
}

export function initUI() {
    document.querySelectorAll('.s-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            setChipValue(parseInt(this.getAttribute('data-val')));
            document.querySelectorAll('.s-chip').forEach(c => c.classList.remove('active'));
            document.querySelectorAll(`.s-chip[data-val="${currentChipValue}"]`).forEach(c => c.classList.add('active'));
        });
    });

    const storeModal = document.getElementById('storeModal');
    document.querySelectorAll('.casinoStoreBtn').forEach(btn => {
        btn.addEventListener('click', () => { storeModal.style.display = 'flex'; renderStore(); });
    });
    document.getElementById('closeStoreBtn').addEventListener('click', () => storeModal.style.display = 'none');

    const settingsModal = document.getElementById('settingsModal');
    const helpModal = document.getElementById('helpModal');
    document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.style.display = 'flex');
    document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.style.display = 'none');
    document.getElementById('closeHelpBtn').addEventListener('click', () => helpModal.style.display = 'none');
    document.querySelectorAll('.casinoHelpBtn').forEach(btn => btn.addEventListener('click', () => helpModal.style.display = 'flex'));

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active'); document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    document.getElementById('offsetInput').addEventListener('input', (e) => { state.offsetSecs = parseInt(e.target.value) || 0; saveState(); });
    document.getElementById('customMessageInput').addEventListener('input', (e) => { state.customMessage = e.target.value; saveState(); });
    document.getElementById('customUrlInput').addEventListener('input', (e) => {
        state.customUrl = e.target.value.trim() || config.defaultUrl; 
        document.getElementById('img1').src = state.customUrl; document.getElementById('img2').src = state.customUrl; saveState();
    });

    document.getElementById('toggleImagesBtn').addEventListener('click', () => {
        state.imagesEnabled = !state.imagesEnabled; saveState(); syncUI();
        if (state.imagesEnabled && window.isRunning) spawnImages(); else hideImages();
    });

    document.getElementById('toggleRouletteBtn').addEventListener('click', () => {
        state.activeGame = state.activeGame === 'roulette' ? 'none' : 'roulette';
        saveState(); syncUI(); updateCollisionCache();
    });
    document.getElementById('toggleBlackjackBtn').addEventListener('click', () => {
        state.activeGame = state.activeGame === 'blackjack' ? 'none' : 'blackjack';
        saveState(); syncUI(); updateCollisionCache();
    });
}
