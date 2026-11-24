import { state, saveState } from './core.js';

export let backgrounds = {};

function isValidBackground(background) {
    return background &&
        typeof background.id === 'string' &&
        typeof background.name === 'string' &&
        typeof background.url === 'string' &&
        Number.isSafeInteger(background.price) &&
        background.price >= 0;
}

export async function initBackgrounds() {
    try {
        const response = await fetch('data/backgrounds.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const catalog = await response.json();
        if (!Array.isArray(catalog) ||
            catalog.length === 0 ||
            !catalog.every(isValidBackground) ||
            new Set(catalog.map(background => background.id)).size !== catalog.length ||
            !catalog.some(background => background.id === 'default')) {
            throw new Error('El catálogo debe tener fondos válidos, IDs únicos y un fondo default.');
        }
        backgrounds = Object.fromEntries(catalog.map(background => [background.id, background]));
    } catch (error) {
        console.error('No se pudo cargar data/backgrounds.json; solo estará disponible el fondo predeterminado.', error);
        backgrounds = {
            default: { id: 'default', name: 'Clásico', url: '', price: 0 }
        };
    }
}

export function normalizeBackgroundState() {
    const owned = Array.isArray(state.ownedBgs)
        ? [...new Set(state.ownedBgs.filter(id => Object.prototype.hasOwnProperty.call(backgrounds, id)))]
        : [];
    if (!owned.includes('default')) owned.unshift('default');

    const activeBg = owned.includes(state.activeBg) ? state.activeBg : 'default';
    const changed = owned.length !== state.ownedBgs.length ||
        owned.some((id, index) => id !== state.ownedBgs[index]) ||
        activeBg !== state.activeBg;
    state.ownedBgs = owned;
    state.activeBg = activeBg;
    if (changed) saveState();
}
