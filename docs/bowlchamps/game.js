/* =====================================================================
   Bowl Champs – drag‑to‑bowl, speed‑weighted pins, sounds & delays
   ===================================================================== */

/* ---------- DOM Shortcuts ---------- */
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const playerCountSel = document.getElementById("playerCount");
const nameInputsDiv = document.getElementById("nameInputs");
const startBtn = document.getElementById("startBtn");

const scoreboardDiv = document.getElementById("scoreboard");
const resultP = document.getElementById("result");

const laneWrap = document.getElementById("laneWrap");
const ballImg = document.getElementById("ballImg");
const rollBtn = document.getElementById("rollBtn");   // dev shortcut

/* ---------- Audio ---------- */
const SFX = {
    roll: document.getElementById("sfxRoll"),
    gutter: document.getElementById("sfxGutter"),
    single: document.getElementById("sfxSingle"),
    few: document.getElementById("sfxFew"),
    many: document.getElementById("sfxMany")
};
function playResultSfx(pins) {
    if (pins === 0) SFX.gutter.cloneNode().play();
    else if (pins === 1) SFX.single.cloneNode().play();
    else if (pins <= 5) SFX.few.cloneNode().play();
    else SFX.many.cloneNode().play();
}

/* ====================================================================
   1.  SETUP SCREEN
==================================================================== */
playerCountSel.addEventListener("change", buildNameInputs);
buildNameInputs();

function buildNameInputs() {
    const n = +playerCountSel.value;
    nameInputsDiv.innerHTML = "";
    for (let i = 0; i < n; i++) {
        const inp = document.createElement("input");
        inp.placeholder = `Player ${i + 1} name`;
        inp.value = `P${i + 1}`;
        nameInputsDiv.appendChild(inp);
    }
}

startBtn.addEventListener("click", () => {
    const names = [...nameInputsDiv.querySelectorAll("input")]
        .map(i => i.value.trim() || "Player");
    if (names.length < 2) {
        alert("League play needs at least 2 competitors.");
        return;
    }
    initGame(names);
    setupScreen.style.display = "none";
    gameScreen.style.display = "block";
    resetBallPos();          // ensure correct spawn after lane visible
});

/* ====================================================================
   2.  GAME STATE + SCOREBOARD
==================================================================== */
let players = [];
let currentPlayerIdx = 0;

/* initialise players & board */
function initGame(names) {
    players = names.map(name => ({
        name,
        frames: Array.from({ length: 10 }, () => ({ rolls: [], pinsLeft: 10 })),
        currentFrame: 0,
        rollInFrame: 0,
        done: false
    }));
    buildScoreboard();
    updateActiveHighlight();
    resultP.textContent = `${players[0].name}, drag the ball to start!`;
}

/* build scoreboard rows */
function buildScoreboard() {
    scoreboardDiv.innerHTML = "";
    players.forEach((p, idx) => {
        const row = document.createElement("div");
        row.className = "playerRow";
        row.dataset.index = idx;

        const label = document.createElement("div");
        label.className = "playerLabel";
        label.textContent = p.name;
        row.appendChild(label);

        for (let f = 1; f <= 10; f++) {
            const box = document.createElement("div");
            box.className = "frame" + (f === 10 ? " tenth" : "");
            box.innerHTML = `
        <span class="r1"></span><span class="r2"></span>
        ${f === 10 ? '<span class="r3"></span>' : ''}
        <span class="num">${f}</span>`;
            row.appendChild(box);
        }

        const total = document.createElement("div");
        total.className = "totalBox";
        total.innerHTML = `<span>Total</span><div class="score">0</div>`;
        row.appendChild(total);

        scoreboardDiv.appendChild(row);
    });
}

/* helpers */
function getFrameCell(pIdx, fIdx, slot) {
    return scoreboardDiv
        .querySelector(`.playerRow[data-index="${pIdx}"]`)
        .children[1 + fIdx]
        .querySelector(`.r${slot}`);
}
function getTotalCell(pIdx) {
    return scoreboardDiv
        .querySelector(`.playerRow[data-index="${pIdx}"] .totalBox .score`);
}
function updateActiveHighlight() {
    scoreboardDiv.querySelectorAll(".playerRow").forEach((row, i) => {
        row.style.outline =
            (i === currentPlayerIdx && !players[i].done) ? "3px solid #f0ff38" : "none";
    });
}

/* ====================================================================
   3.  DRAG‑TO‑BOWL MECHANIC
==================================================================== */
const BALL_SIZE = 120;
let dragging = false, origX, origY, lastX, lastY, startTime;

ballImg.addEventListener("pointerdown", e => {
    e.preventDefault();
    dragging = true;
    origX = lastX = e.clientX;
    origY = lastY = e.clientY;
    startTime = performance.now();
    ballImg.setPointerCapture(e.pointerId);
    ballImg.classList.add("dragging");
});
ballImg.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const newL = Math.max(0, Math.min(ballImg.offsetLeft + dx, laneWrap.clientWidth - BALL_SIZE));
    const newT = Math.max(0, Math.min(ballImg.offsetTop + dy, laneWrap.clientHeight - BALL_SIZE));
    ballImg.style.left = `${newL}px`;
    ballImg.style.top = `${newT}px`;
    lastX = e.clientX;
    lastY = e.clientY;
});
ballImg.addEventListener("pointerup", finishDrag);
ballImg.addEventListener("pointercancel", finishDrag);

function finishDrag(e) {
    if (!dragging) return;
    dragging = false;
    ballImg.releasePointerCapture(e.pointerId);
    ballImg.classList.remove("dragging");

    /* compute swipe metrics */
    const travel = Math.hypot(e.clientX - origX, e.clientY - origY);
    const dt = (performance.now() - startTime) / 1000;
    const speed = travel / Math.max(dt, 0.01);
    const nx = (ballImg.offsetLeft + BALL_SIZE / 2) / laneWrap.clientWidth;
    const zone = getZone(nx);
    const requestPins = pinsFromSkill(zone, speed);   // desired pins

    /* roll sound + 2s wait */
    ballImg.style.display = "none";
    laneWrap.style.pointerEvents = "none";
    SFX.roll.cloneNode().play();

    setTimeout(() => {
        const actualPins = firePins(requestPins);  // score + return real pins hit
        playResultSfx(actualPins);

        /* 1.5s pause for reading */
        setTimeout(() => {
            resetBallPos();
            ballImg.style.display = "block";
            laneWrap.style.pointerEvents = "auto";
        }, 1500);
    }, 2000);
}

function resetBallPos() {
    const x = (laneWrap.offsetWidth - BALL_SIZE) / 2;
    const y = (laneWrap.offsetHeight - BALL_SIZE);
    ballImg.style.left = `${x}px`;
    ballImg.style.top = `${y}px`;
}

/* dev RNG button */
rollBtn.addEventListener("click", () => {
    const hit = firePins(Math.floor(Math.random() * 11));
    playResultSfx(hit);
});

/* ====================================================================
   4.  SKILL TABLE (zone + speed → requested pins)
==================================================================== */
function getZone(nx) {
    if (nx < 0.2) return "gutterL";
    if (nx < 0.4) return "left";
    if (nx < 0.6) return "middle";
    if (nx < 0.8) return "right";
    return "gutterR";
}
function pinsFromSkill(zone, speed) {
    /* ranges tuned for feel */
    const slow = zone === "middle" ? [2, 6] : zone.startsWith("gutter") ? [0, 2] : [1, 4];
    const medium = zone === "middle" ? [5, 9] : zone.startsWith("gutter") ? [0, 4] : [3, 7];
    const fast = zone === "middle" ? [8, 10] : zone.startsWith("gutter") ? [0, 6] : [5, 9];
    const tier = speed < 250 ? slow : speed < 700 ? medium : fast;
    const [min, max] = tier;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ====================================================================
   5.  ROLL PROCESSING (returns actual pins)
==================================================================== */
function firePins(requestPins) {
    const p = players[currentPlayerIdx];
    if (p.done) { nextPlayer(); return 0; }

    const hit = p.currentFrame < 9
        ? rollRegular(p, requestPins)
        : rollTenth(p, requestPins);

    updateRunningTotal(p);
    updateActiveHighlight();
    return hit;
}

/* ----- Frames 1‑9 ----- */
function rollRegular(p, request) {
    const f = p.frames[p.currentFrame];
    const hit = Math.min(request, f.pinsLeft);
    f.rolls.push(hit);
    f.pinsLeft -= hit;

    const mark = (p.rollInFrame === 0 && hit === 10) ? "X" :
        (p.rollInFrame === 1 && f.rolls[0] + hit === 10) ? "/" :
            (hit === 0 ? "‑" : hit);
    getFrameCell(currentPlayerIdx, p.currentFrame, p.rollInFrame + 1).textContent = mark;
    resultP.textContent = `${p.name}: Frame ${p.currentFrame + 1} Roll ${p.rollInFrame + 1} – ${hit}`;

    if (p.rollInFrame === 0 && hit === 10) advanceFrame(p);      // strike
    else if (p.rollInFrame === 1) advanceFrame(p);      // second roll done
    else p.rollInFrame = 1;

    return hit;
}

/* ----- Frame 10 ----- */
function rollTenth(p, request) {
    const f = p.frames[9];
    const hit = Math.min(request, f.pinsLeft);
    f.rolls.push(hit);

    let mark;
    if (hit === 10) mark = "X";
    else if (p.rollInFrame === 1 && f.rolls[0] + hit === 10 && f.rolls[0] !== 10) mark = "/";
    else mark = hit === 0 ? "‑" : hit;
    getFrameCell(currentPlayerIdx, 9, p.rollInFrame + 1).textContent = mark;

    if (hit === 10 || (p.rollInFrame === 1 && f.rolls[0] + f.rolls[1] === 10))
        f.pinsLeft = 10;
    else f.pinsLeft -= hit;

    resultP.textContent = `${p.name}: Frame 10 Roll ${p.rollInFrame + 1} – ${hit}`;

    p.rollInFrame++;
    const bonus = f.rolls[0] === 10 || (f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === 10);
    if (p.rollInFrame >= (bonus ? 3 : 2)) { p.done = true; nextPlayer(); }

    return hit;
}

/* ----- Frame advance / rotation ----- */
function advanceFrame(p) {
    p.currentFrame++; p.rollInFrame = 0;
    if (p.currentFrame >= 10) p.done = true;
    nextPlayer();
}
function nextPlayer() {
    if (!players.some(pl => !pl.done)) {
        resultP.textContent += "  •  Game complete!";
        rollBtn.disabled = true;
        return;
    }
    do {
        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    } while (players[currentPlayerIdx].done);
    resultP.textContent = `${players[currentPlayerIdx].name}, your turn!`;
}

/* ====================================================================
   6.  SCORING UTILITIES
==================================================================== */
function updateRunningTotal(p) {
    const totals = calcTotals(p.frames);
    getTotalCell(currentPlayerIdx).textContent = totals[totals.length - 1] ?? 0;
}

/* cumulate scores following bowling rules */
function calcTotals(frms) {
    const totals = []; let score = 0;
    for (let i = 0; i < 10; i++) {
        const r = frms[i].rolls;
        if (i < 9) {
            if (r[0] === undefined) break;
            if (r[0] === 10) {
                const b = strikeBonus(frms, i); if (b === null) break;
                score += 10 + b;
            } else if (r.length >= 2 && r[0] + r[1] === 10) {
                const n = frms[i + 1]?.rolls[0]; if (n === undefined) break;
                score += 10 + n;
            } else if (r.length >= 2) {
                score += r[0] + r[1];
            } else break;
        } else {                             // 10th
            if (r.length < 2) break;
            score += r.reduce((s, p) => s + p, 0);
        }
        totals[i] = score;
    }
    return totals;
}
function strikeBonus(frms, idx) {
    const n1 = frms[idx + 1]; if (!n1 || n1.rolls.length === 0) return null;
    if (n1.rolls[0] === 10) {
        if (idx + 1 === 9) {
            if (n1.rolls.length >= 2) return 10 + n1.rolls[1];
            return null;
        }
        const n2 = frms[idx + 2]; if (!n2 || n2.rolls.length === 0) return null;
        return 10 + n2.rolls[0];
    } else if (n1.rolls.length >= 2) {
        return n1.rolls[0] + n1.rolls[1];
    }
    return null;
}
