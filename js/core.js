export let config = null;
export let state = {
    version: "", offsetSecs: 0, customMessage: "¡El tiempo ha terminado! 🎉",
    customUrl: "", imagesEnabled: false, activeGame: 'none', coins: 0,
    ownedBgs: ['default'], activeBg: 'default', signature: ""
};

export let currentChipValue = 1;

export function setChipValue(val) { currentChipValue = val; }

export async function initCore() {
    try {
        const response = await fetch('data/config.json');
        config = await response.json();
        state.customUrl = config.defaultUrl;
    } catch(e) {
        console.error("Config fetch error, ensure you are running on a server (e.g. Github Pages)");
        // Fallback robusto
        config = { version: "v8.4", storageKey: "cuentaAtras_estado", salt: "casino_secure_salt_v8.4", backgrounds: {'default': {name:'Clásico', url:''}} };
    }
}

function generateSignature(coins) {
    return btoa("casino_secure_" + coins + "_" + config.salt);
}

export function checkSignature() {
    if (state.signature && state.signature !== generateSignature(state.coins)) {
        state.coins = 0;
        state.signature = generateSignature(0);
        saveState();
        return false;
    }
    return true;
}

export function modificarMonedas(amount) {
    if (!checkSignature()) return false; 
    if (amount < 0 && state.coins + amount < 0) return false;
    state.coins += amount;
    state.signature = generateSignature(state.coins);
    saveState();
    return true;
}

export function saveState() {
    // Validacion pre-guardado
    if (state.signature && state.signature !== generateSignature(state.coins)) {
        state.coins = 0; state.signature = generateSignature(0);
        console.warn("Anti-cheat interceptó guardado ilegal");
    } else {
        state.signature = generateSignature(state.coins);
    }
    localStorage.setItem(config.storageKey, JSON.stringify(state));
}

export function loadState(onCorruptCallback) {
    const storedData = localStorage.getItem(config.storageKey);
    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);
            if (parsedData.version !== config.version) {
                parsedData.signature = generateSignature(parsedData.coins); 
                if (!parsedData.ownedBgs) parsedData.ownedBgs = ['default'];
                if (!parsedData.activeBg) parsedData.activeBg = 'default';
            } else if (parsedData.signature && parsedData.signature !== generateSignature(parsedData.coins)) {
                parsedData.coins = 0; parsedData.signature = generateSignature(0);
                if (onCorruptCallback) onCorruptCallback();
            }
            state = { ...state, ...parsedData, version: config.version };
        } catch(e) { state.coins = 0; state.signature = generateSignature(0); }
    } else {
        state.signature = generateSignature(state.coins);
    }
    saveState(); 
}
