import { state, saveState, modificarMonedas } from './core.js';

const ROTATION_MS = 30 * 60 * 1000;

let challenges = [];
let currentChallenge = null;
let rotationTimeout = null;
let displayInterval = null;

function showChallengeToast(message, isDanger = false) {
    window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message, isDanger }
    }));
}

function isValidChallenge(challenge) {
    return challenge &&
        typeof challenge.id === 'string' &&
        typeof challenge.text === 'string' &&
        typeof challenge.event === 'string' &&
        Number.isSafeInteger(challenge.target) &&
        challenge.target > 0 &&
        Number.isSafeInteger(challenge.reward) &&
        challenge.reward >= 0 &&
        (!challenge.when || (typeof challenge.when === 'object' && !Array.isArray(challenge.when)));
}

function shuffledChallengeIds(excludeId) {
    const ids = challenges.map(challenge => challenge.id).filter(id => id !== excludeId);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
}

function drawChallenge(expiresAt, notify = false) {
    const previousId = currentChallenge
        ? currentChallenge.id
        : (state.challengeSession ? state.challengeSession.id : null);
    let bag = state.challengeSession && Array.isArray(state.challengeSession.bag)
        ? state.challengeSession.bag.filter(id =>
            challenges.some(challenge => challenge.id === id) && id !== previousId
        )
        : [];
    bag = [...new Set(bag)];
    if (bag.length === 0) bag = shuffledChallengeIds(previousId);

    const id = bag.pop();
    currentChallenge = challenges.find(challenge => challenge.id === id);
    state.challengeSession = {
        id,
        progress: 0,
        completed: false,
        expiresAt,
        bag
    };
    saveState();
    renderChallenge();
    if (notify) showChallengeToast(`🎯 Nuevo reto: ${currentChallenge.text}`);
}

function renderChallenge() {
    const panel = document.getElementById('sessionChallenge');
    if (!panel) return;

    if (!currentChallenge || !state.challengeSession) {
        panel.innerHTML = '<strong>Retos de sesión</strong><p>No hay ningún reto disponible.</p>';
        return;
    }

    const session = state.challengeSession;
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    const progress = Math.min(session.progress, currentChallenge.target);

    panel.innerHTML = `
        <div class="challenge-heading">
            <strong>🎯 Reto de sesión</strong>
            <span id="challengeTimer">${minutes}:${seconds}</span>
        </div>
        <p id="challengeText"></p>
        <progress id="challengeProgress" max="${currentChallenge.target}" value="${progress}"></progress>
        <div class="challenge-footer">
            <span id="challengeProgressText"></span>
            <span>+${currentChallenge.reward} 🪙</span>
        </div>
        ${session.completed ? '<strong class="challenge-complete">¡Completado!</strong>' : ''}
    `;
    panel.querySelector('#challengeText').textContent = currentChallenge.text;
    panel.querySelector('#challengeProgressText').textContent = `${progress}/${currentChallenge.target}`;
}

function scheduleRotation() {
    clearTimeout(rotationTimeout);
    if (!state.challengeSession) return;

    rotationTimeout = setTimeout(() => {
        const oldExpiry = state.challengeSession.expiresAt;
        const now = Date.now();
        const intervalsElapsed = Math.max(1, Math.floor((now - oldExpiry) / ROTATION_MS) + 1);
        drawChallenge(oldExpiry + intervalsElapsed * ROTATION_MS, true);
        scheduleRotation();
    }, Math.max(0, state.challengeSession.expiresAt - Date.now()));
}

function matchesConditions(conditions, details) {
    if (!conditions) return true;
    return Object.entries(conditions).every(([key, expected]) => {
        const actual = details[key];
        return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    });
}

export async function initChallenges() {
    const panel = document.getElementById('sessionChallenge');
    try {
        const response = await fetch('data/challenges.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loadedChallenges = await response.json();
        if (!Array.isArray(loadedChallenges) ||
            loadedChallenges.length !== 50 ||
            !loadedChallenges.every(isValidChallenge) ||
            new Set(loadedChallenges.map(challenge => challenge.id)).size !== 50) {
            throw new Error('El archivo debe contener exactamente 50 retos válidos y únicos.');
        }
        challenges = loadedChallenges;
    } catch (error) {
        console.error('No se pudieron cargar los retos de sesión.', error);
        if (panel) panel.innerHTML = '<strong>Retos de sesión</strong><p>No se pudieron cargar los retos.</p>';
        return;
    }

    const saved = state.challengeSession;
    const savedChallenge = saved && challenges.find(challenge => challenge.id === saved.id);
    const hasValidSession = savedChallenge &&
        Number.isFinite(saved.expiresAt) &&
        saved.expiresAt > Date.now() &&
        Number.isSafeInteger(saved.progress) &&
        saved.progress >= 0 &&
        typeof saved.completed === 'boolean';

    if (hasValidSession) {
        currentChallenge = savedChallenge;
        state.challengeSession = {
            id: saved.id,
            progress: Math.min(saved.progress, savedChallenge.target),
            completed: saved.completed,
            expiresAt: saved.expiresAt,
            bag: Array.isArray(saved.bag)
                ? [...new Set(saved.bag.filter(id =>
                    challenges.some(challenge => challenge.id === id) && id !== saved.id
                ))]
                : []
        };
        renderChallenge();
    } else {
        const oldExpiry = saved && Number.isFinite(saved.expiresAt) ? saved.expiresAt : Date.now();
        const intervalsElapsed = Math.max(1, Math.floor((Date.now() - oldExpiry) / ROTATION_MS) + 1);
        drawChallenge(oldExpiry + intervalsElapsed * ROTATION_MS);
    }

    scheduleRotation();
    clearInterval(displayInterval);
    displayInterval = setInterval(renderChallenge, 1000);
}

export function recordChallengeEvent(event, details = {}, amount = 1) {
    if (!currentChallenge || !state.challengeSession || state.challengeSession.completed) return;
    if (currentChallenge.event !== event || !matchesConditions(currentChallenge.when, details)) return;
    if (!Number.isSafeInteger(amount) || amount <= 0) return;

    const session = state.challengeSession;
    session.progress = Math.min(currentChallenge.target, session.progress + amount);
    if (session.progress >= currentChallenge.target) {
        session.completed = true;
        if (modificarMonedas(currentChallenge.reward)) {
            document.querySelectorAll('.coin-display').forEach(element => {
                element.innerText = state.coins;
            });
            showChallengeToast(`🏆 Reto completado: +${currentChallenge.reward} monedas.`);
        } else {
            showChallengeToast('Reto completado, pero no se pudo acreditar la recompensa.', true);
        }
    } else {
        saveState();
    }
    renderChallenge();
}
