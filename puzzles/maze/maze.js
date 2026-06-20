/**
 * maze.js — 迷宫探索谜题（谜题 3）
 *
 * 基于 Einstellung 范式：13×13 网格迷宫，方向键移动从起点到出口。
 * 惯性法：贴墙走（沿蛇形走廊），捷径：穿越墙缺口。
 *
 * 方案C — 多种捷径类型：
 *   Q3: 中心直穿型（单列缺口 → 笔直向下）
 *   Q4: 锯齿对角线型（交错缺口 → Z 字路径）
 *   Q5: 双走廊型（两列缺口 → 二选一）
 *   Q6: 筛子多孔型（多列缺口 → 自由选路）
 */

(function () {
  'use strict';

  // ========== 迷宫定义（13×13，0=路径，1=墙壁）==========
  // 起点 (0,0)，出口 (12,12)
  // 惯性期：蛇形走廊，无捷径（贴墙走 ~84-90 步）
  // 关键/恢复期：墙壁有缺口，不同捷径类型（~16-34 步）

  var MAZES = [
    // ==================== 惯性期 ====================
    // Q1 — 蛇形右转，无捷径（~90 步）
    {
      id: 1, phase: 'inertia',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    },
    // Q2 — 蛇形变体（偏移缺口位置），无捷径（~86 步 vs Q1~90 步）
    {
      id: 2, phase: 'inertia',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    },

    // ==================== 关键期 ====================
    // Q3 — 中心直穿型捷径（每墙 col=6 有缺口，~18 步 vs ~90 步）
    {
      id: 3, phase: 'critical',
      shortcutType: 'centerCorridor',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    },
    // Q4 — 锯齿对角线型捷径（缺口交错 col=3→6→9→6→3→6，~30 步 vs ~90 步）
    {
      id: 4, phase: 'critical',
      shortcutType: 'zigzag',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,0,1,1,1,1,1,1,1,1,0],  // gap col 3
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],  // gap col 6
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,0,1,1,0],  // gap col 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],  // gap col 6
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,0,1,1,1,1,1,1,1,1,0],  // gap col 3
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,0,1,1,1,1,1,1],  // gap col 6
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    },

    // ==================== 恢复期 ====================
    // Q5 — 双走廊型（每墙 col=3 和 col=9 有缺口，二选一，~18 步）
    {
      id: 5, phase: 'recovery',
      shortcutType: 'doubleCorridor',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,0,1,1,1,1,1,0,1,1,0],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,0,1,1,1,1,1,0,1,1,1],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,0,1,1,1,1,1,0,1,1,0],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,0,1,1,1,1,1,0,1,1,1],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,1,0,1,1,1,1,1,0,1,1,0],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,0,1,1,1,1,1,0,1,1,1],  // gaps col 3, 9
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    },
    // Q6 — 筛子多孔型（每墙 col=2,5,8,11 有缺口，自由选路，~16 步）
    {
      id: 6, phase: 'recovery',
      shortcutType: 'sieve',
      grid: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,0,1,1,0,1,1,0,1,1,0,0],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,0,1,1,0,1,1,0,1,1,0,1],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,0,1,1,0,1,1,0,1,1,0,0],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,0,1,1,0,1,1,0,1,1,0,1],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,0,1,1,0,1,1,0,1,1,0,0],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,0,1,1,0,1,1,0,1,1,0,1],  // gaps col 2,5,8,11
        [0,0,0,0,0,0,0,0,0,0,0,0,0]
      ]
    }
  ];

  var ROWS = 13;
  var COLS = 13;
  var CELL_SIZE = 32;       // 单元格像素
  var OFFSET_X = 24;        // 画布左留白
  var OFFSET_Y = 24;        // 画布上留白

  // ========== 状态 ==========
  var currentIndex = 0;
  var stepCount = 0;
  var playerR = 0;
  var playerC = 0;
  var isSolved = false;
  var isGivingUp = false;
  var currentQuestionActions = [];  // [{r0,c0,r1,c1}, ...]
  var questionStartTime = 0;
  var pathHistory = [];             // 当前题走过的所有格子

  // 跳过相关
  var skipTimerId = null;
  var subtleSkipVisible = false;
  var SKIP_TIME_SEC = 30;   // 30秒后可放弃
  var SKIP_STEP_MIN = 20;   // 13×13迷宫步数阈值更高

  // 惯性期结果收集
  var inertiaPhaseResults = [];

  // ========== DOM 引用 ==========
  var canvas, ctx;
  var elQuestionLabel, elQuestionDesc, elStepCount;
  var elGlobalProgress, elProgressBadge;
  var btnUp, btnDown, btnLeft, btnRight;
  var btnReset, btnNext, btnSkip, subtleSkipBtn, skipContainer;
  var elPostSurvey, elSurveyQ2, surveySubmitBtn;

  // ========== 贴墙路径预估 ==========
  // 13×13 蛇形走廊贴墙步数约 84-96，捷径约 16-34
  var WALL_FOLLOW_STEPS = 70;  // 贴墙判定阈值（≥70 步）
  var SHORTCUT_STEPS = 35;     // 捷径判定阈值（≤35 步）

  // ========== 放弃时间门控 ==========
  function startSkipTimer() {
    clearSkipTimer();
    skipTimerId = setTimeout(function () {
      showSubtleSkip();
    }, SKIP_TIME_SEC * 1000);
  }

  function clearSkipTimer() {
    if (skipTimerId) {
      clearTimeout(skipTimerId);
      skipTimerId = null;
    }
  }

  function showSubtleSkip() {
    if (!subtleSkipVisible && !isSolved) {
      subtleSkipVisible = true;
      subtleSkipBtn.style.display = '';
      subtleSkipBtn.disabled = false;
    }
  }

  function checkStepSkip() {
    if (!subtleSkipVisible && !isSolved && stepCount >= SKIP_STEP_MIN) {
      showSubtleSkip();
    }
  }

  // ========== 初始化 ==========
  function init() {
    // 会话检测
    if (typeof EventLogger !== 'undefined') {
      var session = EventLogger.resumeSession();
      if (!session) {
        if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
          EventLogger.initSession('test_user');
        } else {
          alert('请先从首页输入参与者编号再开始测试。');
          window.location.href = '../../index.html';
          return;
        }
      }
    }

    canvas = document.getElementById('mazeCanvas');
    ctx = canvas.getContext('2d');

    elQuestionLabel = document.getElementById('questionLabel');
    elQuestionDesc = document.getElementById('questionDesc');
    elStepCount = document.getElementById('stepCount');
    elGlobalProgress = document.getElementById('globalProgress');
    elProgressBadge = document.getElementById('progressBadge');

    btnUp    = document.getElementById('btnUp');
    btnDown  = document.getElementById('btnDown');
    btnLeft  = document.getElementById('btnLeft');
    btnRight = document.getElementById('btnRight');
    btnReset = document.getElementById('resetBtn');
    btnNext  = document.getElementById('nextBtn');
    btnSkip  = document.getElementById('skipBtn');
    subtleSkipBtn = document.getElementById('subtleSkipBtn');
    skipContainer = document.getElementById('skipContainer');

    elPostSurvey   = document.getElementById('surveyOverlay');
    elSurveyQ2 = document.getElementById('surveyQ2');
    surveySubmitBtn = document.getElementById('surveySubmitBtn');

    setupSurvey();

    // 按钮事件
    btnUp.addEventListener('click',    function () { movePlayer(-1, 0); });
    btnDown.addEventListener('click',  function () { movePlayer(1, 0); });
    btnLeft.addEventListener('click',  function () { movePlayer(0, -1); });
    btnRight.addEventListener('click', function () { movePlayer(0, 1); });
    btnReset.addEventListener('click', resetCurrent);
    btnNext.addEventListener('click',  nextQuestion);
    btnSkip.addEventListener('click',  giveUp);
    subtleSkipBtn.addEventListener('click', giveUp);

    // 键盘事件
    document.addEventListener('keydown', handleKey);

    loadQuestion(0);
  }

  function handleKey(e) {
    if (isSolved || isGivingUp) return;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); movePlayer(-1, 0); break;
      case 'ArrowDown':  case 's': case 'S': e.preventDefault(); movePlayer(1, 0);  break;
      case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); movePlayer(0, -1); break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); movePlayer(0, 1);  break;
    }
  }

  // ========== 题目加载 ==========
  function loadQuestion(index) {
    var q = MAZES[index];
    currentIndex = index;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    currentQuestionActions = [];
    pathHistory = [];
    subtleSkipVisible = false;
    skipContainer.style.display = 'none';
    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;

    questionStartTime = Date.now();
    startSkipTimer();

    // 起始位置
    playerR = 0;
    playerC = 0;
    pathHistory.push({ r: 0, c: 0 });

    elQuestionLabel.textContent = '第 ' + (index + 1) + ' 题 / 共 6 题';
    elQuestionDesc.textContent = '从起点走到出口，尽量用最少的步数';
    elStepCount.textContent = '0';

    updateProgress();

    // 按钮状态
    btnUp.disabled = false;
    btnDown.disabled = false;
    btnLeft.disabled = false;
    btnRight.disabled = false;
    btnReset.disabled = true;
    btnNext.disabled = true;

    drawMaze();

    if (typeof EventLogger !== 'undefined') {
      EventLogger.logPuzzleStart('maze', index + 1);
    }
  }

  function updateProgress() {
    var pct = Math.round((currentIndex / MAZES.length) * 100);
    elGlobalProgress.style.width = pct + '%';
    elProgressBadge.textContent = '谜题 3/4 — 题 ' + (currentIndex + 1) + '/' + MAZES.length;
  }

  // ========== 玩家移动 ==========
  function movePlayer(dr, dc) {
    if (isSolved || isGivingUp) return;

    var nr = playerR + dr;
    var nc = playerC + dc;

    // 边界检查
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;

    // 墙壁检查
    var q = MAZES[currentIndex];
    if (q.grid[nr][nc] === 1) return;

    // 记录移动
    var prevR = playerR;
    var prevC = playerC;
    playerR = nr;
    playerC = nc;
    stepCount++;
    pathHistory.push({ r: nr, c: nc });
    currentQuestionActions.push({ from: [prevR, prevC], to: [nr, nc] });

    elStepCount.textContent = stepCount;
    btnReset.disabled = false;

    // 检查步数阈值（放弃按钮）
    checkStepSkip();

    drawMaze();

    // 到达出口？
    if (playerR === ROWS - 1 && playerC === COLS - 1) {
      onReachedExit();
    }
  }

  // ========== 到达出口 ==========
  function onReachedExit() {
    isSolved = true;
    clearSkipTimer();

    btnUp.disabled = true;
    btnDown.disabled = true;
    btnLeft.disabled = true;
    btnRight.disabled = true;
    btnReset.disabled = true;
    btnNext.disabled = false;
    skipContainer.style.display = 'none';
    subtleSkipBtn.style.display = 'none';

    // 解法分类
    var method = classifySolution();
    var q = MAZES[currentIndex];

    // 惯性期检查
    if (q.phase === 'inertia') {
      inertiaPhaseResults.push(method);
    }

    // 惯性建立判定
    var inertiaBuilt = inertiaPhaseResults.filter(function (m) {
      return m === 'wallFollow';
    }).length >= 2;

    // 记录日志（使用 logSubmit 以匹配数据分析脚本）
    if (typeof EventLogger !== 'undefined') {
      EventLogger.logSubmit('maze', currentIndex + 1, {
        steps: stepCount,
        method: method,
        inertiaBuilt: inertiaBuilt,
        phase: q.phase,
        shortcutType: q.shortcutType || 'none',
        pathLength: pathHistory.length,
        duration: Date.now() - questionStartTime,
        result: 'reached_exit'
      }, true);
    }

    drawMaze();

    // 显示到达提示
    var methodLabel = method === 'shortcut' ? '捷径' : method === 'wallFollow' ? '贴墙' : '混合';
    elQuestionDesc.textContent = '到达出口！共 ' + stepCount + ' 步 (' + methodLabel + ')';
  }

  // ========== 解法分类 ==========
  function classifySolution() {
    if (stepCount <= SHORTCUT_STEPS) return 'shortcut';
    if (stepCount >= WALL_FOLLOW_STEPS) return 'wallFollow';
    return 'mixed';
  }

  // ========== 迷宫绘制 ==========
  function drawMaze() {
    var q = MAZES[currentIndex];
    var w = canvas.width;
    var h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = OFFSET_X + c * CELL_SIZE;
        var y = OFFSET_Y + r * CELL_SIZE;

        if (q.grid[r][c] === 1) {
          // 墙壁
          ctx.fillStyle = '#374151';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else {
          // 路径
          ctx.fillStyle = '#F3F4F6';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          // 细边框
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

          // 已走过的格子
          var visited = pathHistory.some(function (p) {
            return p.r === r && p.c === c;
          });
          if (visited) {
            ctx.fillStyle = 'rgba(99,102,241,0.12)';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // 绘制出口
    var ex = OFFSET_X + (COLS - 1) * CELL_SIZE + CELL_SIZE / 2;
    var ey = OFFSET_Y + (ROWS - 1) * CELL_SIZE + CELL_SIZE / 2;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(ex, ey, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('终', ex, ey);

    // 绘制起点（如果玩家不在起点）
    if (!(playerR === 0 && playerC === 0)) {
      var sx = OFFSET_X + CELL_SIZE / 2;
      var sy = OFFSET_Y + CELL_SIZE / 2;
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('起', sx, sy);
    }

    // 绘制玩家
    var px = OFFSET_X + playerC * CELL_SIZE + CELL_SIZE / 2;
    var py = OFFSET_Y + playerR * CELL_SIZE + CELL_SIZE / 2;

    // 到达出口时绘制光环
    if (isSolved) {
      ctx.fillStyle = 'rgba(34,197,94,0.2)';
      ctx.beginPath();
      ctx.arc(px, py, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家圆点
    ctx.fillStyle = '#6366F1';
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 朝向指示（小三角）
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px - 3, py + 1);
    ctx.lineTo(px + 3, py + 1);
    ctx.closePath();
    ctx.fill();
  }

  // ========== 重走 ==========
  function resetCurrent() {
    if (isSolved || isGivingUp) return;
    playerR = 0;
    playerC = 0;
    stepCount = 0;
    pathHistory = [{ r: 0, c: 0 }];
    currentQuestionActions = [];
    elStepCount.textContent = '0';
    btnReset.disabled = true;
    drawMaze();
  }

  // ========== 下一题 ==========
  function nextQuestion() {
    if (typeof EventLogger !== 'undefined') {
      EventLogger.logPuzzleEnd('maze', currentIndex + 1);
    }

    if (currentIndex < MAZES.length - 1) {
      loadQuestion(currentIndex + 1);
    } else {
      // 全部完成，显示问卷
      checkSurveyReady();
    }
  }

  // ========== 放弃 ==========
  function giveUp() {
    if (isSolved || isGivingUp) return;
    isGivingUp = true;
    clearSkipTimer();

    var q = MAZES[currentIndex];
    var inertiaBuilt = inertiaPhaseResults.filter(function (m) {
      return m === 'wallFollow';
    }).length >= 2;

    if (typeof EventLogger !== 'undefined') {
      EventLogger.logGiveUp('maze', currentIndex + 1, {
        steps: stepCount,
        phase: q.phase,
        shortcutType: q.shortcutType || 'none',
        inertiaBuilt: inertiaBuilt,
        duration: Date.now() - questionStartTime
      });
    }

    // 显示跳过提示，禁用所有操作
    btnUp.disabled = true;
    btnDown.disabled = true;
    btnLeft.disabled = true;
    btnRight.disabled = true;
    btnSkip.disabled = true;
    subtleSkipBtn.disabled = true;
    btnReset.disabled = true;

    var oldDesc = elQuestionDesc.textContent;
    elQuestionDesc.innerHTML = '<span style="color:#EF4444;">已跳过。</span> 即将进入下一题...';
    btnSkip.textContent = '即将进入下一题...';
    btnSkip.className = 'btn btn-warning';

    setTimeout(function () {
      elQuestionDesc.textContent = oldDesc;
      btnSkip.className = 'btn btn-secondary';
      isGivingUp = false;
      nextQuestion();
    }, 2500);
  }

  // ========== 问卷 ==========
  function setupSurvey() {
    var q1Radios = document.querySelectorAll('input[name="q1"]');
    q1Radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (this.value === 'yes') {
          elSurveyQ2.style.display = '';
        } else {
          elSurveyQ2.style.display = 'none';
          var q2radios = document.querySelectorAll('input[name="q2"]');
          q2radios.forEach(function (r) { r.checked = false; });
        }
        checkSurveyReady();
      });
    });

    var q2Radios = document.querySelectorAll('input[name="q2"]');
    q2Radios.forEach(function (radio) {
      radio.addEventListener('change', checkSurveyReady);
    });

    surveySubmitBtn.addEventListener('click', submitSurvey);
  }

  function checkSurveyReady() {
    // 隐藏迷宫区域，显示问卷覆盖层
    var twoCol = document.querySelector('.puzzle-two-col');
    if (twoCol) twoCol.style.display = 'none';
    if (elPostSurvey) elPostSurvey.classList.add('active');

    var q1 = document.querySelector('input[name="q1"]:checked');
    var ready = false;

    if (q1) {
      if (q1.value === 'yes') {
        var q2 = document.querySelector('input[name="q2"]:checked');
        ready = !!q2;
      } else {
        ready = true;
      }
    }

    surveySubmitBtn.disabled = !ready;
  }

  function submitSurvey() {
    var q1Val = document.querySelector('input[name="q1"]:checked');
    var q2Val = document.querySelector('input[name="q2"]:checked');
    var q1 = q1Val ? q1Val.value : '';
    var q2 = q2Val ? parseInt(q2Val.value, 10) : null;

    if (typeof EventLogger !== 'undefined') {
      EventLogger.logEvent('survey_maze', {
        discoveredShortcut: q1,
        firstAwareQuestion: q2
      });
    }

    // 显示提交成功提示（覆盖层内）
    var body = document.querySelector('#surveyOverlay .survey-body');
    if (body) {
      body.innerHTML =
        '<div style="text-align:center; padding:var(--spacing-8) 0;">' +
          '<div style="font-size:48px; margin-bottom:var(--spacing-4);">&#9989;</div>' +
          '<h2 style="margin-bottom:var(--spacing-2);">问卷已提交</h2>' +
          '<p class="text-sm text-muted" style="margin-bottom:var(--spacing-6);">' +
            '数据已记录，即将进入下一个谜题...' +
          '</p>' +
        '</div>';
    }

    setTimeout(function () {
      window.location.href = '../sequence/sequence.html';
    }, 1500);
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
        window.TestDebug.injectToolbar({
          totalQuestions: MAZES.length,
          goToQuestion: loadQuestion
        });
      }
    });
  } else {
    init();
    if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
      window.TestDebug.injectToolbar({
        totalQuestions: MAZES.length,
        goToQuestion: loadQuestion
      });
    }
  }

})();
