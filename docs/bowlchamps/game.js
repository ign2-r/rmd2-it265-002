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
const rackImg = document.getElementById("rackImg");

let frameAdvanced = false;        // set true whenever advanceFrame() runs

const BALL_SRC = {
    reactive: "assets/balls/ball_reactive.png",
    urethane: "assets/balls/ball_urethane.png",
    plastic: "assets/balls/ball_plastic.png"
};
  

/* ---------- Audio ---------- */
const SFX = {
    roll: document.getElementById("sfxRoll"),
    gutter: document.getElementById("sfxGutter"),
    single: document.getElementById("sfxSingle"),
    few: document.getElementById("sfxFew"),
    many: document.getElementById("sfxMany"),
    strike: document.getElementById("sfxStrike"),
    ooh: document.getElementById("sfxOoh"),
    spare: document.getElementById('sfxSpare')
};
function playResultSfx(pins) {
    if (pins === 10) {                    // STRIKE
        SFX.strike.cloneNode().play();     // boom!
        SFX.many.cloneNode().play();     // crowd cheer
        return;
    }

    if (pins === 0) {                     // GUTTER
        SFX.gutter.cloneNode().play();     // ball thunk
        SFX.ooh.cloneNode().play();    // disappointed crowd
        return;
    }

    if (pins === 1) { SFX.single.cloneNode().play(); return; }
    if (pins <= 5) { SFX.few.cloneNode().play(); return; }

    /* 6‑9 pins */
    SFX.many.cloneNode().play();
}
  

/* ====================================================================
   1.  SETUP SCREEN
==================================================================== */

startBtn.addEventListener("click", () => {
    const nameInputs = [...document.querySelectorAll('#nameInputs .playerRowSetup input:not([type="radio"])')];
    const names = nameInputs.map(i => i.value.trim() || 'Player');
    
    initGame(names);
    setupScreen.style.display = "none";
    gameScreen.style.display = "block";
    resetBallPos();          // ensure correct spawn after lane visible
    ballImg.src = BALL_SRC[players[0].ball];
});

/* ====================================================================
   2.  GAME STATE + SCOREBOARD
==================================================================== */
let players = [];
let currentPlayerIdx = 0;

/* initialise players & board */
function initGame(names) {
    const rows = [...document.querySelectorAll('#nameInputs .playerRowSetup')];

    players = rows.map((row, i) => ({
        name: names[i],
        ball: row.querySelector('input[type="radio"]:checked').value,
        frames: Array.from({ length: 10 }, () => ({ rolls: [], pinsLeft: 10 })),
        currentFrame: 0, rollInFrame: 0, done: false
    }));

    buildScoreboard();
    lockNameWidths();
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

function lockNameWidths() {
    const labels = [...document.querySelectorAll('.playerLabel')];
    let max = 0;

    /* measure text width with a hidden span in the same font */
    labels.forEach(l => {
        const probe = document.createElement('span');
        probe.style.font = getComputedStyle(l).font;
        probe.style.visibility = 'hidden'; probe.textContent = l.textContent;
        document.body.appendChild(probe);
        max = Math.max(max, probe.getBoundingClientRect().width);
        probe.remove();
    });

    labels.forEach(l => l.style.width = (max + 20) + 'px');   // + padding
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
/* ----- rack helpers ----- */
function rackFull() { rackImg.src = "assets/pins/fullrack.png"; }
function rackEmpty() { rackImg.src = "assets/pins/emptyrack.png"; }
function rackLeave(hit) {            // hit = pins knocked on 1st ball
    if (hit >= 1 && hit <= 9) rackImg.src = `assets/pins/${hit}.png`;
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
            if(frameAdvanced){              // only right after frame ends
                rackFull();                   // show full rack now
                frameAdvanced = false;        // clear flag
            }
            ballImg.style.display = "block";
            laneWrap.style.pointerEvents = "auto";
        }, 3000);
    }, 2000);
}

function resetBallPos() {
    const x = (laneWrap.offsetWidth - BALL_SIZE) / 2;
    const y = (laneWrap.offsetHeight - BALL_SIZE);
    ballImg.style.left = `${x}px`;
    ballImg.style.top = `${y}px`;
}

/* ====================================================================
   4.  SKILL TABLE (zone + speed → requested pins)
==================================================================== */
function getZone(nx) {
    if (nx < 0.15) return "hardGutter";      // far‑left 15 %
    if (nx < 0.30) return "gutterL";         // soft gutter left
    if (nx < 0.45) return "left";
    if (nx < 0.55) return "middle";
    if (nx < 0.70) return "right";
    if (nx < 0.85) return "gutterR";         // soft gutter right
    return "hardGutter";                     // far‑right 15 %
  }
function pinsFromSkill(zone, speed) {
    /* ranges tuned for feel */
    if (zone === "hardGutter") return 0;   // immediate zero
    const slow = zone === "middle" ? [2, 6] : zone.startsWith("gutter") ? [0, 2] : [1, 4];
    const medium = zone === "middle" ? [5, 9] : zone.startsWith("gutter") ? [0, 4] : [3, 7];
    const fast = zone === "middle" ? [8, 10] : zone.startsWith("gutter") ? [0, 6] : [5, 9];
    const tier = speed < 250 ? slow : speed < 700 ? medium : fast;
    const [min, max] = tier;
    let raw = Math.floor(Math.random() * (max - min + 1)) + min;

    /* apply ball type modifier */
    const ballType = players[currentPlayerIdx].ball;   // "plastic" | "urethane" | "reactive"
    return ballMod(raw, zone, ballType);
}

/* ------------------------------------------------------------------
   Ball behaviour tweaks
   ------------------------------------------------------------------
   plastic  → baseline (no change)
   urethane → +1 pin when you’ve already hit ≥ 2  (a bit more carry)
   reactive → big carry in the scoring zones (+2), but riskier edges (‑1)
------------------------------------------------------------------- */
function ballMod(hit, zone, type) {
    switch (type) {
        case "urethane":
            return hit >= 2 ? Math.min(hit + 1, 10) : hit;

        case "reactive":
            if (zone === "middle" || zone === "left" || zone === "right")
                return Math.min(hit + 2, 10);          // extra power
            if (zone.startsWith("gutter"))
                return Math.max(hit - 1, 0);           // harsher miss
            return hit;

        /* plastic / default */
        default:
            return hit;
    }
}
  

/* ====================================================================
   5.  ROLL PROCESSING (returns actual pins)
==================================================================== */
function firePins(requestPins) {
    const idx = currentPlayerIdx;          // ← remember whose turn this is
    const p = players[idx];

    const hit = p.currentFrame < 9
        ? rollRegular(p, requestPins)
        : rollTenth(p, requestPins);

    updateRunningTotal(p, idx);
    updateActiveHighlight();
    return hit;
}

/* ----- Frames 1-9 (3 s delay, correct open-frame leave) ----- */
function rollRegular(p, request) {
    const f = p.frames[p.currentFrame];
    const hit = Math.min(request, f.pinsLeft);    // pins knocked this ball
    f.rolls.push(hit);
    f.pinsLeft -= hit;

    /* rack overlay for FIRST shot */
    if (p.rollInFrame === 0) {
        if (hit === 10) rackEmpty();                // strike
        else rackLeave(hit);             // show hit count
    }

    /* mark the cell */
    const mark = (p.rollInFrame === 0 && hit === 10) ? "X" :
        (p.rollInFrame === 1 && f.rolls[0] + hit === 10) ? "/" :
            (hit === 0 ? "-" : hit);
    getFrameCell(currentPlayerIdx, p.currentFrame, p.rollInFrame + 1).textContent = mark;
    resultP.textContent = `${p.name}: Frame ${p.currentFrame + 1} Roll ${p.rollInFrame + 1} – ${hit}`;

    /* ---- frame control ---- */
    if (p.rollInFrame === 0 && hit === 10) {
        // STRIKE: leave empty rack for 3 s, then advance
        setTimeout(() => advanceFrame(p), 3000);

    } else if (p.rollInFrame === 1) {
        // SECOND ball finished
        if (f.pinsLeft === 0) {
            // SPARE: show empty rack + play SFX
            rackEmpty();
            if (SFX.spare) SFX.spare.cloneNode().play();
        } else {
            // OPEN FRAME: show how many pins remain
            const totalHit = f.rolls[0] + f.rolls[1];
            rackLeave(totalHit);
        }
        // in both cases, wait 3 s then advance
        setTimeout(() => advanceFrame(p), 3000);

    } else {
        // prepare for second ball
        p.rollInFrame = 1;
    }

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
    frameAdvanced = true;           // mark that we just finished a frame
    p.currentFrame++;
    p.rollInFrame = 0;
    if (p.currentFrame >= 10) p.done = true;
    nextPlayer();
}
  
function nextPlayer() {
    if (!players.some(pl => !pl.done)) {
        resultP.textContent += "  •  Game complete!";
        return;
    }
    do {
        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    } while (players[currentPlayerIdx].done);
    ballImg.src = BALL_SRC[players[currentPlayerIdx].ball];  // switch sprite
    resultP.textContent = `${players[currentPlayerIdx].name}, your turn!`;

    updateActiveHighlight();
}

/* ====================================================================
   6.  SCORING UTILITIES
==================================================================== */
function updateRunningTotal(player, idx) {
    const totals = calcTotals(player.frames);
    getTotalCell(idx).textContent = totals[totals.length - 1] ?? 0;
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
