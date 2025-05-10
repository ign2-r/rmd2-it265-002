/* ---------- landing/setup ---------- */
const playerCountSel = document.getElementById("playerCount");
const nameInputsDiv = document.getElementById("nameInputs");
const startBtn = document.getElementById("startBtn");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");

/* dynamically show name inputs */
playerCountSel.addEventListener("change", buildNameInputs);
buildNameInputs(); // initial

function buildNameInputs() {
    const n = parseInt(playerCountSel.value, 10);
    nameInputsDiv.innerHTML = "";
    for (let i = 0; i < n; i++) {
        const inp = document.createElement("input");
        inp.placeholder = `Player ${i + 1} name`;
        inp.value = `P${i + 1}`;
        nameInputsDiv.appendChild(inp);
    }
}

/* start game -> gather names & build scoreboard */
startBtn.addEventListener("click", () => {
    const names = Array.from(nameInputsDiv.querySelectorAll("input")).map(i => i.value.trim() || "Player");
    initGame(names);
    setupScreen.style.display = "none";
    gameScreen.style.display = "block";
});

/* ---------- game state ---------- */
let players = [];            // array of player objects
let currentPlayerIdx = 0;    // whose turn

function initGame(names) {
    players = names.map(n => ({
        name: n,
        frames: Array.from({ length: 10 }, () => ({ rolls: [], pinsLeft: 10 })),
        currentFrame: 0,
        rollInFrame: 0,
        done: false
    }));
    buildScoreboard();
    updateActiveHighlight();
    document.getElementById("result").textContent = `${players[0].name}, roll to start!`;
}

/* ---------- build scoreboard DOM ---------- */
const scoreboardDiv = document.getElementById("scoreboard");

function buildScoreboard() {
    scoreboardDiv.innerHTML = "";
    players.forEach((p, idx) => {
        const row = document.createElement("div");
        row.className = "playerRow";
        row.dataset.index = idx;

        /* name label */
        const label = document.createElement("div");
        label.className = "playerLabel";
        label.textContent = p.name;
        row.appendChild(label);

        /* 10 frames */
        for (let f = 1; f <= 10; f++) {
            const box = document.createElement("div");
            box.className = "frame" + (f === 10 ? " tenth" : "");
            box.innerHTML = `<span class="r1"></span><span class="r2"></span>${f === 10 ? '<span class="r3"></span>' : ''}<span class="num">${f}</span>`;
            row.appendChild(box);
        }

        /* running total */
        const total = document.createElement("div");
        total.className = "totalBox";
        total.innerHTML = `<span>Total</span><div class="score">0</div>`;
        row.appendChild(total);

        scoreboardDiv.appendChild(row);
    });
}

/* helper to grab cells quickly */
function getFrameCell(playerIdx, frameIdx, rollSlot) {
    const playerRow = scoreboardDiv.querySelector(`.playerRow[data-index="${playerIdx}"]`);
    return playerRow.children[1 + frameIdx].querySelector(`.r${rollSlot}`);
}
function getTotalCell(playerIdx) {
    const playerRow = scoreboardDiv.querySelector(`.playerRow[data-index="${playerIdx}"]`);
    return playerRow.querySelector(".totalBox .score");
}

/* ---------- roll button ---------- */
const rollBtn = document.getElementById("rollBtn");
rollBtn.addEventListener("click", () => {
    const p = players[currentPlayerIdx];
    if (p.done) { nextPlayer(); return; }
    p.currentFrame < 9 ? handleRegularFrame(p) : handleTenthFrame(p);
    updateRunningTotal(p);
    updateActiveHighlight();
});

/* ---------- frames 1‑9 ---------- */
function handleRegularFrame(p) {
    const f = p.frames[p.currentFrame];
    const raw = Math.floor(Math.random() * 11);
    const pins = Math.min(raw, f.pinsLeft);

    f.rolls.push(pins);
    f.pinsLeft -= pins;

    const mark = (p.rollInFrame === 0 && pins === 10) ? "X" :
        (p.rollInFrame === 1 && f.rolls[0] + pins === 10) ? "/" :
            (pins === 0 ? "-" : pins);

    getFrameCell(players.indexOf(p), p.currentFrame, p.rollInFrame + 1).textContent = mark;
    document.getElementById("result").textContent = `${p.name}: Frame ${p.currentFrame + 1} Roll ${p.rollInFrame + 1} – ${pins}`;

    if (p.rollInFrame === 0 && pins === 10) {           // strike
        advanceFrame(p);
    } else if (p.rollInFrame === 1) {                 // second ball done
        advanceFrame(p);
    } else {
        p.rollInFrame = 1;                           // move to second ball
    }
}

/* ---------- frame 10 ---------- */
function handleTenthFrame(p) {
    const f = p.frames[9];
    const raw = Math.floor(Math.random() * 11);
    const pins = Math.min(raw, f.pinsLeft);

    f.rolls.push(pins);

    let mark;
    if (pins === 10) mark = "X";
    else if (p.rollInFrame === 1 && f.rolls[0] + pins === 10 && f.rolls[0] !== 10) mark = "/";
    else mark = (pins === 0 ? "-" : pins);

    getFrameCell(players.indexOf(p), 9, p.rollInFrame + 1).textContent = mark;

    if (pins === 10 || (p.rollInFrame === 1 && f.rolls[0] + f.rolls[1] === 10))
        f.pinsLeft = 10;
    else
        f.pinsLeft -= pins;

    document.getElementById("result").textContent =
        `${p.name}: Frame 10 Roll ${p.rollInFrame + 1} - ${pins}`;

    p.rollInFrame += 1;

    const bonusAllowed = (f.rolls[0] === 10) || (f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === 10);
    const needed = bonusAllowed ? 3 : 2;
    if (p.rollInFrame >= needed) finishPlayerFrame10(p);
}

/* finish 10th frame, mark player done */
function finishPlayerFrame10(p) {
    p.done = true;
    nextPlayer();
}

/* advance to next frame for the player, then pass turn */
function advanceFrame(p) {
    p.currentFrame += 1;
    p.rollInFrame = 0;
    if (p.currentFrame >= 10) {
        p.done = true;
    }
    nextPlayer();
}

/* ---------- turn rotation ---------- */
function nextPlayer() {
    const activeBefore = currentPlayerIdx;
    const playersLeft = players.filter(pl => !pl.done).length;
    if (playersLeft === 0) {
        document.getElementById("result").textContent += "  •  Game complete!";
        rollBtn.disabled = true;
        updateActiveHighlight();
        return;
    }
    do {
        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    } while (players[currentPlayerIdx].done);

    updateActiveHighlight();
    document.getElementById("result").textContent = `${players[currentPlayerIdx].name}, your turn!`;
}

/* ---------- running totals (per player) ---------- */
function updateRunningTotal(p) {
    const totals = calcTotals(p.frames);
    const latest = totals[totals.length - 1] ?? 0;
    getTotalCell(players.indexOf(p)).textContent = latest;
}

/* pure scoring (same logic we had, just reused) */
function calcTotals(fs) {
    const totals = [];
    let score = 0;
    for (let i = 0; i < 10; i++) {
        const r = fs[i].rolls;
        if (i < 9) {
            if (r[0] === undefined) break;
            if (r[0] === 10) {
                const b = strikeBonus(fs, i); if (b === null) break;
                score += 10 + b;
            }
            else if (r.length >= 2 && r[0] + r[1] === 10) {
                const next = fs[i + 1]?.rolls[0]; if (next === undefined) break;
                score += 10 + next;
            }
            else if (r.length >= 2) {
                score += r[0] + r[1];
            } else break;
        } else {
            if (r.length < 2) break;
            score += r.reduce((s, p) => s + p, 0);
        }
        totals[i] = score;
    }
    return totals;
}
function strikeBonus(fs, idx) {
    const n1 = fs[idx + 1]; if (!n1 || n1.rolls.length === 0) return null;
    if (n1.rolls[0] === 10) {
        if (idx + 1 === 9) { if (n1.rolls.length >= 2) return 10 + n1.rolls[1]; return null; }
        const n2 = fs[idx + 2]; if (!n2 || n2.rolls.length === 0) return null;
        return 10 + n2.rolls[0];
    } else if (n1.rolls.length >= 2) {
        return n1.rolls[0] + n1.rolls[1];
    }
    return null;
}

/* highlight active player's row */
function updateActiveHighlight() {
    scoreboardDiv.querySelectorAll(".playerRow").forEach((row, i) => {
        row.style.outline = (i === currentPlayerIdx && !players[i].done) ? "3px solid #f0ff38" : "none";
    });
}
