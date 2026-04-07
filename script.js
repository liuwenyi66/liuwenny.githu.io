// 游戏状态变量
let gameStatus = {
    score: 0,
    combo: 0,
    // time：显示用时间（有限模式=剩余秒；无限模式=已用秒）
    time: 0,
    // elapsedSeconds：用于计算“随时间变难”的进度（永远递增）
    elapsedSeconds: 0,
    highScore: 0,
    isPlaying: false,
    isLuckyTime: false,
    currentBait: 'normal', // 'normal' 或 'premium'
    itemInterval: null,
    itemTimeout: null,
    timerInterval: null,
    luckyTimeInterval: null,
    itemPool: [], // 物品对象池，减少DOM操作
    modeId: 'catfish'
};

// 素材目录（与 index 同级的 ui图标 文件夹内 PNG）
const ASSET_DIR = 'ui图标';

// 物品配置：sprite 为文件名；无素材时用 icon 显示 emoji
const items = {
    'normal': [
        { icon: '🐟', score: 10, probability: 30, sprite: '鱼1.png' },
        { icon: '🐠', score: 20, probability: 15, sprite: '鱼2.png' },
        { icon: '🐡', score: 50, probability: 5, sprite: '鱼3.png' },
        { icon: '🐚', score: 30, probability: 10, sprite: '河蚌.png' },
        { icon: '👢', score: -15, probability: 25, sprite: '破鞋.png' },
        { icon: '🌿', score: -5, probability: 15, sprite: '水草.png' }
    ],
    'premium': [
        { icon: '🐟', score: 10, probability: 20, sprite: '鱼1.png' },
        { icon: '🐠', score: 20, probability: 30, sprite: '鱼2.png' },
        { icon: '🐡', score: 50, probability: 15, sprite: '鱼3.png' },
        { icon: '🐚', score: 30, probability: 20, sprite: '河蚌.png' },
        { icon: '👢', score: -15, probability: 5, sprite: '破鞋.png' },
        { icon: '🌿', score: -5, probability: 10, sprite: '水草.png' }
    ]
};

function applyItemElementContent(itemElement, item) {
    itemElement.innerHTML = '';
    itemElement.dataset.item = JSON.stringify(item);
    if (item.sprite) {
        const img = document.createElement('img');
        img.className = 'item-sprite';
        img.src = `${ASSET_DIR}/${item.sprite}`;
        img.alt = '';
        img.draggable = false;
        itemElement.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.className = 'item-emoji';
        span.textContent = item.icon;
        itemElement.appendChild(span);
    }
}

// ========== 模式（入门 -> 地狱）========== //
const MODES = {
    catfish: {
        name: '小猫摸鱼',
        gameDurationSec: 45,
        spawnStartMs: 950,
        spawnMinMs: 720,
        ttlStartMs: 3200,
        ttlMinMs: 2100,
        negBase: 0.05,
        negRamp: 0.10,
        posMinScale: 0.78,
        posPenalty: 0.55,
        negBoostMax: 0.65
    },
    river: {
        name: '溪边垂钓',
        gameDurationSec: 45,
        spawnStartMs: 820,
        spawnMinMs: 600,
        ttlStartMs: 2800,
        ttlMinMs: 1700,
        negBase: 0.08,
        negRamp: 0.13,
        posMinScale: 0.70,
        posPenalty: 0.65,
        negBoostMax: 0.85
    },
    patient: {
        name: '静候鱼来',
        gameDurationSec: 45,
        spawnStartMs: 720,
        spawnMinMs: 520,
        ttlStartMs: 2500,
        ttlMinMs: 1400,
        negBase: 0.12,
        negRamp: 0.16,
        posMinScale: 0.62,
        posPenalty: 0.75,
        negBoostMax: 1.05
    },
    deep: {
        name: '深水追鱼',
        gameDurationSec: 45,
        spawnStartMs: 650,
        spawnMinMs: 420,
        ttlStartMs: 2200,
        ttlMinMs: 1100,
        negBase: 0.16,
        negRamp: 0.20,
        posMinScale: 0.55,
        posPenalty: 0.90,
        negBoostMax: 1.30
    },
    master: {
        name: '浪里钓猫',
        gameDurationSec: 45,
        spawnStartMs: 580,
        spawnMinMs: 360,
        ttlStartMs: 1900,
        ttlMinMs: 900,
        negBase: 0.22,
        negRamp: 0.24,
        posMinScale: 0.48,
        posPenalty: 1.05,
        negBoostMax: 1.60
    },
    hellwater: {
        name: '惊涛垂钓',
        gameDurationSec: 45,
        spawnStartMs: 520,
        spawnMinMs: 300,
        ttlStartMs: 1600,
        ttlMinMs: 750,
        negBase: 0.28,
        negRamp: 0.28,
        posMinScale: 0.42,
        posPenalty: 1.15,
        negBoostMax: 1.85
    },
    hell: {
        name: '深渊钓魂',
        gameDurationSec: 45,
        spawnStartMs: 470,
        spawnMinMs: 260,
        ttlStartMs: 1450,
        ttlMinMs: 650,
        negBase: 0.34,
        negRamp: 0.33,
        posMinScale: 0.36,
        posPenalty: 1.25,
        negBoostMax: 2.10
    },
    infinite: {
        name: '无限模式',
        // 仍然会随时间变难，同时具备“积分归零结束”
        gameDurationSec: null,
        spawnStartMs: 240,
        spawnMinMs: 90,
        ttlStartMs: 3200,
        ttlMinMs: 1500,
        negBase: 0.40,
        negRamp: 0.36,
        posMinScale: 0.30,
        posPenalty: 1.45,
        negBoostMax: 2.60,
        infiniteStartScore: 90,
        infiniteDrainBase: 8.0,  // 分/秒（起步就每秒掉 8 分）
        infiniteDrainRamp: 0.34, // 分/秒/分钟（更明显线性加速）
        infiniteDrainCurve: 0.10 // 二次加速：分钟^2 上来更凶
    }
};

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function getMode() {
    return MODES[gameStatus.modeId] || MODES.catfish;
}

function getProgressMinutes() {
    return gameStatus.elapsedSeconds / 60;
}

function getModeGameDurationSeconds() {
    const mode = getMode();
    return typeof mode.gameDurationSec === 'number' ? mode.gameDurationSec : null;
}

function getDynamicSpawnIntervalMs() {
    const mode = getMode();
    const p = getProgressMinutes();
    // 随时间变难：生成间隔持续缩短（有下限）
    const t = 1 + p * 0.22; // 通用加速度
    const ms = mode.spawnStartMs / Math.pow(t, 0.95);
    return clamp(ms, mode.spawnMinMs, mode.spawnStartMs);
}

function getDynamicTTLms() {
    const mode = getMode();
    const p = getProgressMinutes();
    const t = 1 + p * 0.22;
    const ms = mode.ttlStartMs / Math.pow(t, 1.05);
    return clamp(ms, mode.ttlMinMs, mode.ttlStartMs);
}

function getDynamicItemWeights() {
    const mode = getMode();
    const p = getProgressMinutes();

    // 负分物品占比随时间上升
    const negMix = clamp(mode.negBase + mode.negRamp * p, 0, 0.95);
    const positiveScale = clamp(1 - mode.posPenalty * negMix, mode.posMinScale, 1);
    const negativeScale = 1 + mode.negBoostMax * negMix;

    return { positiveScale, negativeScale };
}

function getInfiniteDrainPerSecond() {
    if (gameStatus.modeId !== 'infinite') return 0;
    const mode = getMode();
    if (!mode || typeof mode.infiniteDrainBase !== 'number') return 0;
    const p = getProgressMinutes();
    const ramp = mode.infiniteDrainRamp || 0;
    const curve = mode.infiniteDrainCurve || 0;
    // 随时间加速下降：线性 + 二次曲线
    return mode.infiniteDrainBase + ramp * p + curve * p * p;
}

// 预计算物品概率，提升性能
const itemProbabilities = {};
for (const baitType in items) {
    const baitItems = items[baitType];
    const totalProbability = baitItems.reduce((sum, item) => sum + item.probability, 0);
    let cumulativeProbability = 0;
    const probabilityMap = [];
    
    for (const item of baitItems) {
        cumulativeProbability += item.probability;
        probabilityMap.push({ item, cumulativeProbability });
    }
    
    itemProbabilities[baitType] = { totalProbability, probabilityMap };
}

// DOM 元素
const elements = {
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    time: document.getElementById('time'),
    highScore: document.getElementById('high-score'),
    status: document.getElementById('status'),
    itemsContainer: document.getElementById('items-container'),
    messageContainer: document.getElementById('message-container'),
    startBtn: document.getElementById('start-btn'),
    resetBtn: document.getElementById('reset-btn'),
    normalBaitBtn: document.getElementById('normal-bait'),
    premiumBaitBtn: document.getElementById('premium-bait'),
    modeDropdown: document.getElementById('mode-dropdown'),
    modeButton: document.getElementById('mode-button'),
    modeMenu: document.getElementById('mode-menu'),
    modeName: document.getElementById('mode-name')
};

// 初始化游戏
function initGame() {
    // 加载最高分
    loadHighScore();
    
    // 绑定事件
    elements.startBtn.addEventListener('click', startGame);
    elements.resetBtn.addEventListener('click', resetGame);
    if (elements.normalBaitBtn) {
        elements.normalBaitBtn.addEventListener('click', () => setBait('normal'));
    }
    if (elements.premiumBaitBtn) {
        elements.premiumBaitBtn.addEventListener('click', () => setBait('premium'));
    }

    const closeModeMenu = () => {
        if (!elements.modeDropdown) return;
        elements.modeDropdown.classList.remove('open');
        if (elements.modeButton) elements.modeButton.setAttribute('aria-expanded', 'false');
    };

    const setMode = (nextModeId, shouldClose = true) => {
        if (!nextModeId) return;
        if (gameStatus.isPlaying) return; // 进行中不切换，避免难度突然跳变
        gameStatus.modeId = nextModeId;
        const mode = getMode();
        if (elements.modeName) elements.modeName.textContent = mode.name;
        if (elements.modeButton) {
            elements.modeButton.textContent = mode.name;
            elements.modeButton.dataset.mode = nextModeId;
        }
        if (shouldClose) closeModeMenu();
    };

    // 自定义模式下拉（替代原生 select，统一风格）
    if (elements.modeDropdown && elements.modeButton && elements.modeMenu) {
        const options = elements.modeMenu.querySelectorAll('.mode-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                setMode(opt.dataset.mode, true);
            });
        });

        elements.modeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = elements.modeDropdown.classList.contains('open');
            if (isOpen) closeModeMenu();
            else {
                elements.modeDropdown.classList.add('open');
                elements.modeButton.setAttribute('aria-expanded', 'true');
            }
        });

        document.addEventListener('click', () => {
            closeModeMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModeMenu();
        });
    }
    
    // 预创建物品元素，减少DOM操作
    preCreateItems();
    updateTimeDisplay();

    // 同步初始模式（默认：catfish）
    if (elements.modeName) elements.modeName.textContent = getMode().name;
    if (elements.modeButton) {
        elements.modeButton.textContent = getMode().name;
        elements.modeButton.dataset.mode = gameStatus.modeId;
    }
}

// 预创建物品元素
function preCreateItems() {
    // 预创建足够多的物品元素：避免无限模式下“鱼太多但池子太小”。
    const poolSize = 30;
    for (let i = 0; i < poolSize; i++) {
        const itemElement = document.createElement('div');
        itemElement.className = 'item';
        itemElement.style.display = 'none';
        itemElement.addEventListener('click', function() {
            const item = JSON.parse(this.dataset.item);
            catchItem(this, item);
        });
        elements.itemsContainer.appendChild(itemElement);
        gameStatus.itemPool.push(itemElement);
    }
}

// 加载最高分
function loadHighScore() {
    try {
        const savedHighScore = localStorage.getItem('catFishingHighScore');
        if (savedHighScore) {
            gameStatus.highScore = parseInt(savedHighScore);
            elements.highScore.textContent = gameStatus.highScore;
        }
    } catch (error) {
        console.error('Failed to load high score:', error);
    }
}

// 保存最高分
function saveHighScore() {
    try {
        if (gameStatus.score > gameStatus.highScore) {
            // 最高分也只存整数，避免小数保存到 localStorage
            gameStatus.highScore = Math.floor(gameStatus.score);
            elements.highScore.textContent = gameStatus.highScore;
            localStorage.setItem('catFishingHighScore', gameStatus.highScore);
            showMessage('🎉 新纪录！', 'caught');
        }
    } catch (error) {
        console.error('Failed to save high score:', error);
    }
}

// 开始游戏
function startGame() {
    if (gameStatus.isPlaying) return;
    
    gameStatus.isPlaying = true;
    gameStatus.combo = 0;
    gameStatus.elapsedSeconds = 0;
    gameStatus.isLuckyTime = false;

    // 以当前选择模式为准（从自定义下拉获取）
    gameStatus.modeId = (elements.modeButton && elements.modeButton.dataset && elements.modeButton.dataset.mode) ? elements.modeButton.dataset.mode : gameStatus.modeId;
    const mode = getMode();
    if (elements.modeName) elements.modeName.textContent = mode.name;

    // 无限模式：积分归零结束，为了不一开始就结束，起始积分给一个正数
    gameStatus.score = gameStatus.modeId === 'infinite' ? (mode.infiniteStartScore ?? 120) : 0;

    // 有限模式：倒计时到 0 游戏结束；无限模式：不倒计时（time 展示已用秒）
    const durationSec = gameStatus.modeId === 'infinite' ? null : getModeGameDurationSeconds();
    gameStatus.time = gameStatus.modeId === 'infinite' ? 0 : (durationSec ?? 180);
    
    updateUI();
    clearItems();
    
    // 开始无限计时
    startTimer();
    
    // 开始生成物品
    startItemGeneration();
    
    // 开始幸运时刻检测
    startLuckyTimeCheck();
    
    elements.startBtn.textContent = '游戏中...';
    elements.startBtn.disabled = true;
}

// 重置游戏
function resetGame() {
    stopGame();
    // 以当前选择模式为准
    gameStatus.modeId = (elements.modeButton && elements.modeButton.dataset) ? elements.modeButton.dataset.mode : gameStatus.modeId;
    const mode = getMode();
    gameStatus.score = gameStatus.modeId === 'infinite' ? (mode.infiniteStartScore ?? 120) : 0;
    gameStatus.combo = 0;
    gameStatus.elapsedSeconds = 0;
    gameStatus.time = gameStatus.modeId === 'infinite' ? 0 : (getModeGameDurationSeconds() ?? 180);
    gameStatus.isLuckyTime = false;
    if (elements.modeName) elements.modeName.textContent = getMode().name;
    updateUI();
    clearItems();
    clearMessages();
    
    elements.startBtn.textContent = '开始钓鱼';
    elements.startBtn.disabled = false;
}

// 停止游戏
function stopGame() {
    gameStatus.isPlaying = false;
    
    if (gameStatus.timerInterval) {
        clearInterval(gameStatus.timerInterval);
        gameStatus.timerInterval = null;
    }
    
    if (gameStatus.itemInterval) {
        clearInterval(gameStatus.itemInterval);
        gameStatus.itemInterval = null;
    }

    if (gameStatus.itemTimeout) {
        clearTimeout(gameStatus.itemTimeout);
        gameStatus.itemTimeout = null;
    }
    
    if (gameStatus.luckyTimeInterval) {
        clearInterval(gameStatus.luckyTimeInterval);
        gameStatus.luckyTimeInterval = null;
    }
    
    saveHighScore();
}

// 设置鱼饵
function setBait(type) {
    gameStatus.currentBait = type;
    
    // 更新按钮状态
    elements.normalBaitBtn.classList.remove('active');
    elements.premiumBaitBtn.classList.remove('active');
    
    if (type === 'normal') {
        elements.normalBaitBtn.classList.add('active');
    } else {
        elements.premiumBaitBtn.classList.add('active');
    }
    
    // 添加过渡动画
    const activeBtn = type === 'normal' ? elements.normalBaitBtn : elements.premiumBaitBtn;
    activeBtn.style.transform = 'scale(1.1)';
    setTimeout(() => {
        activeBtn.style.transform = 'scale(1)';
    }, 300);
}

// 开始无限计时
function startTimer() {
    gameStatus.timerInterval = setInterval(() => {
        gameStatus.elapsedSeconds += 1;
        
        if (gameStatus.modeId === 'infinite') {
            // 无限模式：显示已用时间（不倒计时）
            gameStatus.time += 1;

            // 随时间消耗积分
            const drain = getInfiniteDrainPerSecond();
            gameStatus.score -= drain;
        } else {
            // 有限模式：倒计时到 0 结束
            gameStatus.time = Math.max(0, gameStatus.time - 1);
        }
        
        updateUI();
        
        // 无限模式：积分归零结束游戏
        if (gameStatus.modeId === 'infinite' && gameStatus.score <= 0) {
            stopGame();
            showMessage('💀 无限模式：积分为0，游戏结束', 'error');
            elements.startBtn.textContent = '开始钓鱼';
            elements.startBtn.disabled = false;
            return;
        }

        // 有限模式：时间到结束游戏
        if (gameStatus.modeId !== 'infinite' && gameStatus.time <= 0) {
            stopGame();
            showMessage('⏰ 时间到！游戏结束', 'error');
            elements.startBtn.textContent = '开始钓鱼';
            elements.startBtn.disabled = false;
        }
    }, 1000);
}

// 无限时间显示（mm:ss）
function updateTimeDisplay() {
    elements.time.textContent = formatDuration(gameStatus.time);
}

// 开始生成物品（动态难度 + 无限时间）
function startItemGeneration() {
    // 先确保没有旧的计时
    if (gameStatus.itemTimeout) {
        clearTimeout(gameStatus.itemTimeout);
        gameStatus.itemTimeout = null;
    }

    const scheduleNext = () => {
        if (!gameStatus.isPlaying) return;
        generateItem();
        const delay = getDynamicSpawnIntervalMs();
        gameStatus.itemTimeout = setTimeout(scheduleNext, delay);
    };

    scheduleNext();
}

// 生成物品
function generateItem() {
    const rolled = getRandomItem();
    if (!rolled) return;
    const item = { ...rolled };
    if (item.score === 50) {
        item.sprite = Math.random() < 0.5 ? '鱼3.png' : '鱼4.png';
    }
    
    // 从对象池获取元素，减少DOM操作
    let itemElement;
    if (gameStatus.itemPool.length > 0) {
        itemElement = gameStatus.itemPool.pop();
        itemElement.style.display = 'block';
    } else {
        // 如果对象池为空，创建新元素
        itemElement = document.createElement('div');
        itemElement.className = 'item';
        itemElement.addEventListener('click', function() {
            const item = JSON.parse(this.dataset.item);
            catchItem(this, item);
        });
        elements.itemsContainer.appendChild(itemElement);
    }
    
    applyItemElementContent(itemElement, item);
    
    // 随机位置
    const containerWidth = elements.itemsContainer.offsetWidth;
    const containerHeight = elements.itemsContainer.offsetHeight;
    const pad = 132;
    const left = Math.random() * Math.max(0, containerWidth - pad);
    const top = Math.random() * Math.max(0, containerHeight - pad);
    
    itemElement.style.left = `${left}px`;
    itemElement.style.top = `${top}px`;
    
    // 随机动画延迟
    itemElement.style.animationDelay = `${Math.random() * 2}s`;
    
    // 根据模式/时间动态：寿命更短 -> 更难抓
    const ttl = getDynamicTTLms();
    setTimeout(() => {
        if (itemElement.parentNode && itemElement.style.display !== 'none') {
            itemElement.style.display = 'none';
            gameStatus.itemPool.push(itemElement);
        }
    }, ttl);
}

// 获取随机物品（优化算法）
function getRandomItem() {
    const baitItems = items[gameStatus.currentBait];
    const { positiveScale, negativeScale } = getDynamicItemWeights();

    let totalWeight = 0;
    const weighted = baitItems.map(item => {
        let w = item.probability;
        if (item.score > 0) w *= positiveScale;
        else if (item.score < 0) w *= negativeScale;
        w = Math.max(0.01, w);

        // 无限模式：小鱼更常出现，大鱼/垃圾相对降低，画面更“鱼多”
        if (gameStatus.modeId === 'infinite') {
            if (item.score === 10) w *= 1.55; // 小红鱼（更常出现）
            if (item.score === 20) w *= 1.35; // 黄金鱼
            if (item.score === 50) w *= 0.58; // 彩虹鱼
            if (item.score < 0) w *= 0.92; // 垃圾更少一点
        }

        totalWeight += w;
        return { item, w };
    });

    const random = Math.random() * totalWeight;
    let cumulative = 0;
    for (const { item, w } of weighted) {
        cumulative += w;
        if (random <= cumulative) return item;
    }

    return baitItems[0]; // 边界情况兜底
}

// 捕捉物品
function catchItem(itemElement, item) {
    if (!gameStatus.isPlaying) return;
    
    // 添加点击特效
    itemElement.style.transform = 'scale(1.3)';
    itemElement.style.filter = 'drop-shadow(0 0 12px rgba(249, 220, 92, 0.95))';
    
    // 移动端震动反馈
    if ('vibrate' in navigator) {
        navigator.vibrate(100);
    }
    
    // 计算分数
    let score = item.score;
    if (gameStatus.isLuckyTime && score > 0) {
        score *= 2;
    }
    
    // 更新分数
    gameStatus.score += score;
    
    // 更新连击
    if (score > 0) {
        gameStatus.combo++;
        if (gameStatus.combo >= 3) {
            // 触发连击特效
            gameStatus.score += 20;
            showMessage('🔥 连击风暴！+20分', 'combo');
        }
        // 连击数≥5时触发额外加分和全屏特效
        if (gameStatus.combo >= 5) {
            gameStatus.score += 50;
            showMessage('🌟 超级连击！+50分', 'combo');
            // 添加全屏特效
            const effect = document.createElement('div');
            effect.className = 'full-screen-effect';
            effect.style.position = 'fixed';
            effect.style.top = 0;
            effect.style.left = 0;
            effect.style.width = '100vw';
            effect.style.height = '100vh';
            effect.style.backgroundColor = 'rgba(249, 220, 92, 0.38)';
            effect.style.zIndex = 9999;
            effect.style.pointerEvents = 'none';
            effect.style.animation = 'full-screen-flash 1s ease-out';
            document.body.appendChild(effect);
            setTimeout(() => {
                document.body.removeChild(effect);
            }, 1000);
        }
    } else {
        // 重置连击
        gameStatus.combo = 0;
    }
    
    // 显示消息
    if (score > 0) {
        showMessage(`🎣 钓到了！+${score}分`, 'caught');
    } else {
        showMessage(`😞 钓到了！${score}分`, 'error');
    }
    
    // 回收物品元素
    setTimeout(() => {
        itemElement.style.display = 'none';
        itemElement.style.transform = 'scale(1)';
        itemElement.style.filter = '';
        gameStatus.itemPool.push(itemElement);
    }, 300);
    
    // 更新UI
    updateUI();

    // 无限模式：积分归零结束
    if (gameStatus.modeId === 'infinite' && gameStatus.score <= 0) {
        stopGame();
        showMessage('💀 无限模式：积分为0，游戏结束', 'error');
        elements.startBtn.textContent = '开始钓鱼';
        elements.startBtn.disabled = false;
    }
}

// 开始幸运时刻检测
function startLuckyTimeCheck() {
    gameStatus.luckyTimeInterval = setInterval(() => {
        if (gameStatus.isPlaying && Math.random() < 0.1) { // 10% 概率触发
            startLuckyTime();
        }
    }, 15000); // 每15秒检测一次
}

// 开始幸运时刻
function startLuckyTime() {
    if (gameStatus.isLuckyTime) return;
    
    gameStatus.isLuckyTime = true;
    elements.status.textContent = '双倍积分时刻！';
    elements.status.classList.add('status-lucky');
    showMessage('✨ 双倍积分时刻！✨', 'lucky');
    
    // 添加背景闪烁动画
    const pond = document.getElementById('pond');
    pond.style.animation = 'lucky-time-flash 0.5s ease-in-out infinite alternate';
    
    // 5秒后结束
    setTimeout(() => {
        gameStatus.isLuckyTime = false;
        elements.status.textContent = '正常';
        elements.status.classList.remove('status-lucky');
        showMessage('🌟 双倍积分时刻结束', 'caught');
        // 停止背景闪烁动画
        pond.style.animation = '';
    }, 5000);
}

// 更新UI
function updateUI() {
    // 无限模式会有小数（积分随时间扣），这里强制只显示整数
    elements.score.textContent = Math.floor(gameStatus.score);
    elements.combo.textContent = gameStatus.combo;
    elements.highScore.textContent = gameStatus.highScore;
    updateTimeDisplay();
}

// 清除物品
function clearItems() {
    // 回收所有物品元素到对象池
    const items = elements.itemsContainer.querySelectorAll('.item');
    items.forEach(item => {
        if (item.style.display !== 'none') {
            item.style.display = 'none';
            gameStatus.itemPool.push(item);
        }
    });
}

// 显示消息
function showMessage(text, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = text;
    
    elements.messageContainer.appendChild(messageElement);
    while (elements.messageContainer.children.length > 2) {
        elements.messageContainer.removeChild(elements.messageContainer.firstChild);
    }

    // 3秒后移除
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 3000);
}

// 清除消息
function clearMessages() {
    elements.messageContainer.innerHTML = '';
}

// 让小猫跨过：pond-ui 与水域交界（取 pond-ui 实际高度）
function syncPondUiHeightVar() {
    const pondStage = document.querySelector('.pond-stage');
    const pondUi = document.querySelector('.pond-ui');
    if (!pondStage || !pondUi) return;
    const h = pondUi.getBoundingClientRect().height;
    pondStage.style.setProperty('--pond-ui-h', `${h}px`);
}

window.addEventListener('resize', () => {
    // 使用 rAF 避免连续 resize 抖动
    window.requestAnimationFrame(syncPondUiHeightVar);
});

// 初始化游戏
initGame();

// 首帧同步（DOM 已在 body 底部加载脚本）
syncPondUiHeightVar();