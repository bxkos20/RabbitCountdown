import { state, modificarMonedas, checkSignature, currentChipValue } from './core.js';
import { showToast } from './ui.js';
import { updateCollisionCache } from './physics.js';

// --- RULETA ---
export function initRoulette() {
    const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const mainGrid = document.getElementById('mainNumbersGrid');
    let numsHTML = `<div class="r-cell r-zero c-green" data-bet="0">0</div>`;
    for(let i = 1; i <= 36; i++) {
        const col = Math.ceil(i/3) + 1; let row = (i % 3 === 0) ? 1 : ((i % 3 === 2) ? 2 : 3); 
        const colorClass = redNums.includes(i) ? 'c-red' : 'c-black';
        numsHTML += `<div class="r-cell ${colorClass}" data-bet="${i}" style="grid-column:${col}; grid-row:${row}">${i}</div>`;
    }
    mainGrid.innerHTML = numsHTML;

    let currentBets = {}; let isSpinning = false;
    function renderRouletteChips() {
        document.querySelectorAll('.board-chip').forEach(el => el.remove()); 
        for (const [betKey, amount] of Object.entries(currentBets)) {
            if(amount > 0) {
                const cell = document.querySelector(`.r-cell[data-bet="${betKey}"]`);
                if(cell) cell.innerHTML += `<div class="board-chip">${amount >= 1000 ? (amount/1000).toFixed(1)+'k' : amount}</div>`;
            }
        }
    }

    document.querySelectorAll('.r-cell').forEach(cell => {
        cell.addEventListener('click', function() {
            if(isSpinning) return; 
            const betType = this.getAttribute('data-bet');
            if (modificarMonedas(-currentChipValue)) {
                currentBets[betType] = (currentBets[betType] || 0) + currentChipValue; renderRouletteChips();
            } else { showToast("Monedas insuficientes 🪙", true); }
        });
    });

    const spinBtn = document.getElementById('spinBtn'); const clearBetsBtn = document.getElementById('clearBetsBtn');
    clearBetsBtn.addEventListener('click', () => {
        if(isSpinning) return;
        let refunded = 0; for (let amt of Object.values(currentBets)) refunded += amt;
        if (refunded > 0) modificarMonedas(refunded); 
        currentBets = {}; renderRouletteChips();
    });

    spinBtn.addEventListener('click', () => {
        if(isSpinning || !checkSignature()) return; 
        const totalBets = Object.values(currentBets).reduce((a, b) => a + b, 0);
        if(totalBets === 0) { showToast("¡Coloca fichas en el tapete!"); return; }

        isSpinning = true; spinBtn.disabled = true; clearBetsBtn.disabled = true;
        const overlay = document.getElementById('rouletteSpinOverlay');
        const spinNumDisp = document.getElementById('spinNumberDisplay');
        const spinTextDisp = document.getElementById('spinTextDisplay');
        
        overlay.style.display = 'flex'; spinTextDisp.innerText = "Girando..."; spinTextDisp.style.color = "#fbc531";

        let spinInterval = setInterval(() => { spinNumDisp.innerText = Math.floor(Math.random() * 37); }, 50);

        setTimeout(() => {
            clearInterval(spinInterval); const result = Math.floor(Math.random() * 37);
            let resultColor = 'Verde'; if (result !== 0) resultColor = redNums.includes(result) ? 'Rojo' : 'Negro';
            
            spinNumDisp.innerText = result;
            spinNumDisp.style.color = resultColor === 'Rojo' ? '#ff4757' : (resultColor === 'Negro' ? '#747d8c' : '#4cd137');

            let totalWon = 0;
            for (const [betType, amount] of Object.entries(currentBets)) {
                if(!isNaN(betType) && parseInt(betType) === result) totalWon += amount * 36;
                else if(betType === '1st12' && result >= 1 && result <= 12) totalWon += amount * 3;
                else if(betType === '2nd12' && result >= 13 && result <= 24) totalWon += amount * 3;
                else if(betType === '3rd12' && result >= 25 && result <= 36) totalWon += amount * 3;
                else if(betType === 'red' && resultColor === 'Rojo') totalWon += amount * 2;
                else if(betType === 'black' && resultColor === 'Negro') totalWon += amount * 2;
                else if(betType === 'even' && result !== 0 && result % 2 === 0) totalWon += amount * 2;
                else if(betType === 'odd' && result !== 0 && result % 2 !== 0) totalWon += amount * 2;
            }

            if(totalWon > 0) {
                spinTextDisp.innerText = `¡GANASTE ${totalWon} 🪙!`; spinTextDisp.style.color = "#4cd137"; modificarMonedas(totalWon);
            } else { spinTextDisp.innerText = "Perdiste las fichas 💀"; spinTextDisp.style.color = "#ff4757"; }

            currentBets = {}; renderRouletteChips();
            setTimeout(() => {
                overlay.style.display = 'none'; spinNumDisp.style.color = "white"; 
                isSpinning = false; spinBtn.disabled = false; clearBetsBtn.disabled = false;
            }, 2500);
        }, 2000);
    });
}

// --- BLACKJACK ---
export function initBlackjack() {
    let bjDeck = []; let bjHands = []; let bjBets = []; let bjDealerHand = [];
    let bjActiveHandIdx = 0; let bjCurrentBet = 0; let bjState = 'betting'; 

    const uiBjBetArea = document.getElementById('bjBettingPhase'); const uiBjGameArea = document.getElementById('bjGameArea');
    const uiBjBetDisp = document.getElementById('bjCurrentBetDisplay'); const uiBjRes = document.getElementById('bjResult');
    const btnHit = document.getElementById('bjHitBtn'); const btnStand = document.getElementById('bjStandBtn');
    const btnDouble = document.getElementById('bjDoubleBtn'); const btnSplit = document.getElementById('bjSplitBtn');
    const btnNewGame = document.getElementById('bjNewGameBtn');

    function buildBjDeck() {
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']; const suits = ['♠','♥','♣','♦'];
        bjDeck = []; for(let s of suits) { for(let v of values) { bjDeck.push({v, s}); } }
        for (let i = bjDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bjDeck[i], bjDeck[j]] = [bjDeck[j], bjDeck[i]]; }
    }
    function getBjCardVal(c) { if(['J','Q','K'].includes(c.v)) return 10; if(c.v === 'A') return 11; return parseInt(c.v); }
    function getBjScore(hand) {
        let score = 0; let aces = 0; hand.forEach(c => { score += getBjCardVal(c); if(c.v === 'A') aces++; });
        while(score > 21 && aces > 0) { score -= 10; aces--; } return score;
    }
    function renderBjHandCards(hand, elementId, hideSecondCard = false) {
        const el = document.getElementById(elementId); el.innerHTML = '';
        hand.forEach((c, idx) => {
            if(hideSecondCard && idx === 1) { el.innerHTML += `<div class="playing-card card-hidden">?</div>`; } 
            else { const color = (c.s === '♥' || c.s === '♦') ? 'card-red' : ''; el.innerHTML += `<div class="playing-card ${color}">${c.v}<br>${c.s}</div>`; }
        });
    }
    function renderBjState(hideDealerCard) {
        const dealerScoreEl = document.getElementById('bjDealerScoreText');
        if(hideDealerCard) { dealerScoreEl.innerText = "?"; renderBjHandCards(bjDealerHand, 'bjDealerCards', true); } 
        else { dealerScoreEl.innerText = getBjScore(bjDealerHand); renderBjHandCards(bjDealerHand, 'bjDealerCards', false); }
        
        const container = document.getElementById('bjPlayerHandsContainer'); container.innerHTML = '';
        for(let i=0; i<bjHands.length; i++) {
            let score = getBjScore(bjHands[i]); let isActive = (bjState === 'playing' && i === bjActiveHandIdx);
            let borderStyle = isActive ? 'border: 2px solid #2ed573; box-shadow: 0 0 10px #2ed573;' : 'border: 1px solid rgba(255,255,255,0.1); opacity:0.8;';
            let handDiv = document.createElement('div'); handDiv.className = 'bj-hand'; handDiv.style.cssText = borderStyle;
            let title = bjHands.length > 1 ? `Mano ${i+1} (${bjBets[i]}🪙)` : `Tu Mano`;
            handDiv.innerHTML = `<p>${title}: <span style="font-weight:bold;">${score}</span></p><div id="bjPlayerHand${i}" class="bj-cards"></div>`;
            container.appendChild(handDiv); renderBjHandCards(bjHands[i], `bjPlayerHand${i}`, false);
        }
        
        if(bjState === 'playing') {
            btnHit.style.display = 'block'; btnStand.style.display = 'block';
            let canDouble = bjHands[bjActiveHandIdx].length === 2 && state.coins >= bjBets[bjActiveHandIdx] && checkSignature();
            btnDouble.style.display = canDouble ? 'block' : 'none';
            let canSplit = bjHands.length === 1 && bjHands[0].length === 2 && getBjCardVal(bjHands[0][0]) === getBjCardVal(bjHands[0][1]) && state.coins >= bjBets[0] && checkSignature();
            btnSplit.style.display = canSplit ? 'block' : 'none';
        } else { btnHit.style.display = 'none'; btnStand.style.display = 'none'; btnDouble.style.display = 'none'; btnSplit.style.display = 'none'; }
        
        setTimeout(updateCollisionCache, 50); 
    }

    function advanceBjHand() {
        bjActiveHandIdx++;
        if (bjActiveHandIdx >= bjHands.length) {
            if (bjHands.every(h => getBjScore(h) > 21)) finishBjResolution(); else dealerTurn();
        } else { renderBjState(true); }
    }

    function dealerTurn() {
        bjState = 'dealer'; renderBjState(false);
        function dealerAction() {
            if(getBjScore(bjDealerHand) < 17) { bjDealerHand.push(bjDeck.pop()); renderBjState(false); setTimeout(dealerAction, 600);
            } else { finishBjResolution(); }
        }
        setTimeout(dealerAction, 600);
    }

    function finishBjResolution() {
        bjState = 'resolved'; renderBjState(false);
        let dScore = getBjScore(bjDealerHand); let totalWon = 0; let resultMsgs = [];
        for(let i=0; i<bjHands.length; i++) {
            let pScore = getBjScore(bjHands[i]); let bet = bjBets[i]; let msg = bjHands.length > 1 ? `Mano ${i+1}: ` : "";
            if (pScore > 21) { msg += "Te pasaste. 💀"; } 
            else if (dScore > 21) { msg += `Ganaste ${bet*2}🪙!`; totalWon += bet*2; } 
            else if (pScore > dScore) { msg += `Ganaste ${bet*2}🪙!`; totalWon += bet*2; } 
            else if (pScore < dScore) { msg += "Gana el Crupier 💀"; } 
            else { msg += `Empate.`; totalWon += bet; }
            resultMsgs.push(`<span style="color:${(pScore<=21 && (dScore>21 || pScore>dScore)) ? '#4cd137' : (pScore>21 || pScore<dScore ? '#ff4757' : '#fbc531')}">${msg}</span>`);
        }
        if(totalWon > 0) modificarMonedas(totalWon);
        uiBjRes.innerHTML = resultMsgs.join("<br>");
        btnNewGame.style.display = 'block'; bjCurrentBet = 0; uiBjBetDisp.innerText = bjCurrentBet; 
        setTimeout(updateCollisionCache, 50);
    }

    document.getElementById('bjBettingPhase').addEventListener('click', (e) => {
        if(bjState !== 'betting') return;
        if (e.target.classList.contains('s-chip')) {
            if (modificarMonedas(-currentChipValue)) { bjCurrentBet += currentChipValue; uiBjBetDisp.innerText = bjCurrentBet; }
        }
    });

    document.getElementById('bjClearBetBtn').addEventListener('click', () => {
        if(bjState !== 'betting') return;
        if (bjCurrentBet > 0) modificarMonedas(bjCurrentBet); bjCurrentBet = 0; uiBjBetDisp.innerText = bjCurrentBet;
    });

    document.getElementById('bjDealBtn').addEventListener('click', () => {
        if (!checkSignature()) return;
        if (bjCurrentBet === 0) { showToast("Pon alguna ficha primero."); return; }
        bjState = 'playing'; uiBjBetArea.style.display = 'none'; uiBjGameArea.style.display = 'flex';
        uiBjRes.innerHTML = ""; btnNewGame.style.display = 'none';

        buildBjDeck(); bjHands = [ [bjDeck.pop(), bjDeck.pop()] ]; bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
        bjBets = [ bjCurrentBet ]; bjActiveHandIdx = 0; renderBjState(true);

        if(getBjScore(bjHands[0]) === 21) {
            bjState = 'resolved'; renderBjState(false); let win = Math.floor(bjBets[0] * 2.5); modificarMonedas(win);
            uiBjRes.innerHTML = `<span style="color:#4cd137">¡BLACKJACK! Ganaste ${win} 🪙</span>`;
            btnHit.style.display = 'none'; btnStand.style.display = 'none'; btnDouble.style.display = 'none'; btnSplit.style.display = 'none';
            btnNewGame.style.display = 'block'; bjCurrentBet = 0; uiBjBetDisp.innerText = bjCurrentBet;
        }
    });

    btnHit.addEventListener('click', () => {
        if(bjState !== 'playing' || !checkSignature()) return;
        bjHands[bjActiveHandIdx].push(bjDeck.pop()); renderBjState(true);
        if(getBjScore(bjHands[bjActiveHandIdx]) > 21) advanceBjHand();
    });

    btnDouble.addEventListener('click', () => {
        if(bjState !== 'playing') return;
        if(modificarMonedas(-bjBets[bjActiveHandIdx])) {
            bjBets[bjActiveHandIdx] *= 2; bjHands[bjActiveHandIdx].push(bjDeck.pop()); renderBjState(true); advanceBjHand();
        }
    });

    btnSplit.addEventListener('click', () => {
        if(bjState !== 'playing') return;
        if(modificarMonedas(-bjBets[0])) {
            bjBets.push(bjBets[0]); let c1 = bjHands[0][0]; let c2 = bjHands[0][1];
            bjHands = [ [c1, bjDeck.pop()], [c2, bjDeck.pop()] ]; renderBjState(true);
        }
    });

    btnStand.addEventListener('click', () => { if(bjState === 'playing' && checkSignature()) advanceBjHand(); });
    btnNewGame.addEventListener('click', () => { bjState = 'betting'; uiBjBetArea.style.display = 'flex'; uiBjGameArea.style.display = 'none'; setTimeout(updateCollisionCache, 50);});
}
