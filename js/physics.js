import { state, modificarMonedas } from './core.js';
import { showToast, updateCoinDisplay } from './ui.js';

let animationFrame = null;
let flashTimeout = null;
let respawnTimeout = null;
export let imagesAlive = false;

let containerRect = null; 
let activeGameRect = null;
const objImg1 = { el: document.getElementById('img1'), x: 0, y: 0, vx: 0, vy: 0, w: 75, h: 75 };
const objImg2 = { el: document.getElementById('img2'), x: 0, y: 0, vx: 0, vy: 0, w: 75, h: 75 };

function getRandSpeed() { return (Math.random() * 4 + 3) * (Math.random() > 0.5 ? 1 : -1); }

export function updateCollisionCache() { 
    const mc = document.getElementById('mainContainer');
    if (mc) containerRect = mc.getBoundingClientRect();
    const actContainer = state.activeGame === 'roulette' ? document.getElementById('rouletteContainer') : 
                        (state.activeGame === 'blackjack' ? document.getElementById('blackjackContainer') : null);
    activeGameRect = (actContainer && actContainer.style.display !== 'none') ? actContainer.getBoundingClientRect() : null;
}

export function initPhysics() {
    objImg1.el = document.getElementById('img1');
    objImg2.el = document.getElementById('img2');
    const resizeObserver = new ResizeObserver(() => updateCollisionCache());
    document.querySelectorAll('.container').forEach(c => resizeObserver.observe(c));
    window.addEventListener('resize', updateCollisionCache);
}

export function hideImages() { imagesAlive = false; objImg1.el.style.display = 'none'; objImg2.el.style.display = 'none'; clearTimeout(respawnTimeout); }
export function spawnImages() {
    imagesAlive = true; objImg1.el.style.display = 'block'; objImg2.el.style.display = 'block';
    objImg1.x = 0; objImg1.y = 0; objImg2.x = window.innerWidth - 75; objImg2.y = window.innerHeight - 75; 
    objImg1.vx = getRandSpeed(); objImg1.vy = getRandSpeed(); objImg2.vx = getRandSpeed(); objImg2.vy = getRandSpeed();
}

function handleObstacleCollision(img, rect) {
    if (!rect) return; 
    if (img.x < rect.right && img.x + img.w > rect.left && img.y < rect.bottom && img.y + img.h > rect.top) {
        const overlapL = (img.x + img.w) - rect.left; const overlapR = rect.right - img.x;
        const overlapT = (img.y + img.h) - rect.top; const overlapB = rect.bottom - img.y;
        const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);

        if (minOverlap === overlapL) { img.x = rect.left - img.w; img.vx = -Math.abs(img.vx); }
        else if (minOverlap === overlapR) { img.x = rect.right; img.vx = Math.abs(img.vx); }
        else if (minOverlap === overlapT) { img.y = rect.top - img.h; img.vy = -Math.abs(img.vy); }
        else if (minOverlap === overlapB) { img.y = rect.bottom; img.vy = Math.abs(img.vy); }
    }
}

function moveImage(img) {
    img.x += img.vx; img.y += img.vy;
    const rect = img.el.getBoundingClientRect(); img.w = rect.width; img.h = rect.height;
    const maxW = window.innerWidth; const maxH = window.innerHeight;
    
    if (img.x <= 0) { img.x = 0; img.vx = Math.abs(img.vx); }
    if (img.x + img.w >= maxW) { img.x = maxW - img.w; img.vx = -Math.abs(img.vx); }
    if (img.y <= 0) { img.y = 0; img.vy = Math.abs(img.vy); }
    if (img.y + img.h >= maxH) { img.y = maxH - img.h; img.vy = -Math.abs(img.vy); }

    handleObstacleCollision(img, containerRect);
    handleObstacleCollision(img, activeGameRect); 

    img.el.style.left = img.x + 'px'; img.el.style.top = img.y + 'px';
}

export function triggerExplosion() {
    hideImages(); 
    const cX = (Math.max(objImg1.x, objImg2.x) + Math.min(objImg1.x + objImg1.w, objImg2.x + objImg2.w)) / 2;
    const cY = (Math.max(objImg1.y, objImg2.y) + Math.min(objImg1.y + objImg1.h, objImg2.y + objImg2.h)) / 2;

    const exp = document.getElementById('explosion');
    exp.style.left = cX + 'px'; exp.style.top = cY + 'px'; exp.style.display = 'block';
    exp.style.animation = 'none'; exp.offsetHeight; exp.style.animation = 'explodeAnim 0.7s forwards';

    const fb = document.getElementById('flashbang');
    fb.style.display = 'block'; fb.style.animation = 'none'; fb.offsetHeight; fb.style.animation = 'flashAnim 5s forwards';

    if (state.activeGame !== 'none') {
        if (modificarMonedas(1)) {
            showToast("💥 ¡Imágenes chocadas! Has ganado +1 Moneda 🪙");
        }
    }

    flashTimeout = setTimeout(() => { fb.style.display = 'none'; }, 5000);
    respawnTimeout = setTimeout(() => { if (window.isRunning && state.imagesEnabled) spawnImages(); }, 30000); 
}

export function gameLoop() {
    if (!window.isRunning) return;
    if (imagesAlive) {
        moveImage(objImg1); moveImage(objImg2);
        if (objImg1.w > 0 && objImg2.w > 0) {
            if (objImg1.x < objImg2.x + objImg2.w && objImg1.x + objImg1.w > objImg2.x &&
                objImg1.y < objImg2.y + objImg2.h && objImg1.y + objImg1.h > objImg2.y) {
                triggerExplosion();
            }
        }
    }
    animationFrame = requestAnimationFrame(gameLoop);
}

export function cancelAnim() {
    cancelAnimationFrame(animationFrame);
    clearTimeout(flashTimeout); clearTimeout(respawnTimeout);
}
