export let config = null;
export let state = {
    version: "", offsetSecs: 0, customMessage: "¡El tiempo ha terminado! 🎉",
    customUrl: "", imagesEnabled: false, activeGame: 'none', coins: 0,
    ownedBgs: ['default'], activeBg: 'default', signature: "", challengeSession: null
};

export let currentChipValue = 1;

export function setChipValue(val) { currentChipValue = val; }

function createFallbackConfig() {
    return {
        version: "v8.4",
        storageKey: "cuentaAtras_estado",
        salt: "casino_secure_salt_v8.4",
        defaultUrl: ""
    };
}

export async function initCore() {
    try {
        const response = await fetch('data/config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loadedConfig = await response.json();
        if (
            !loadedConfig ||
            typeof loadedConfig.version !== "string" ||
            typeof loadedConfig.storageKey !== "string" ||
            typeof loadedConfig.salt !== "string"
        ) {
            throw new Error("La estructura de data/config.json no es válida.");
        }
        config = {
            ...loadedConfig,
            defaultUrl: typeof loadedConfig.defaultUrl === "string" ? loadedConfig.defaultUrl : ""
        };
    } catch(e) {
        console.error("No se pudo cargar data/config.json; se utilizará la configuración alternativa.", e);
        config = createFallbackConfig();
    }
    state.customUrl = config.defaultUrl || "";
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
        console.warn("Se detectó un saldo local inconsistente.");
    } else {
        state.signature = generateSignature(state.coins);
    }
    try {
        localStorage.setItem(config.storageKey, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("No se pudo guardar el estado local.", error);
        return false;
    }
}

export function loadState(onCorruptCallback) {
    let storedData;
    try {
        storedData = localStorage.getItem(config.storageKey);
    } catch (error) {
        console.error("No se pudo leer el estado local.", error);
        state = { ...state, version: config.version, customUrl: config.defaultUrl || "" };
        state.signature = generateSignature(state.coins);
        return;
    }

    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);
            if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
                throw new Error("El estado guardado no es un objeto.");
            }

            const sameVersion = parsedData.version === config.version;
            const storedCoins = Number.isSafeInteger(parsedData.coins) && parsedData.coins >= 0
                ? parsedData.coins
                : 0;
            const signatureIsValid = parsedData.signature === generateSignature(storedCoins);

            state = {
                ...state,
                ...parsedData,
                version: config.version,
                coins: storedCoins,
                offsetSecs: Number.isFinite(parsedData.offsetSecs) ? parsedData.offsetSecs : 0,
                customMessage: typeof parsedData.customMessage === "string" ? parsedData.customMessage : "¡El tiempo ha terminado! 🎉",
                customUrl: typeof parsedData.customUrl === "string" ? parsedData.customUrl : (config.defaultUrl || ""),
                imagesEnabled: typeof parsedData.imagesEnabled === "boolean" && parsedData.imagesEnabled,
                activeGame: ["none", "roulette", "blackjack"].includes(parsedData.activeGame) ? parsedData.activeGame : "none",
                ownedBgs: Array.isArray(parsedData.ownedBgs)
                    ? [...new Set(parsedData.ownedBgs.filter(id => typeof id === "string"))]
                    : ["default"],
                activeBg: typeof parsedData.activeBg === "string"
                    ? parsedData.activeBg
                    : "default"
            };

            if (sameVersion && !signatureIsValid) {
                state.coins = 0;
                if (onCorruptCallback) onCorruptCallback();
            }
            state.signature = generateSignature(state.coins);
        } catch(error) {
            console.error("El estado local está dañado; se restablecerá.", error);
            state = {
                version: config.version,
                offsetSecs: 0,
                customMessage: "¡El tiempo ha terminado! 🎉",
                customUrl: config.defaultUrl || "",
                imagesEnabled: false,
                activeGame: "none",
                coins: 0,
                ownedBgs: ["default"],
                activeBg: "default",
                signature: generateSignature(0),
                challengeSession: null
            };
        }
    } else {
        state.signature = generateSignature(state.coins);
    }
    saveState(); 
}
