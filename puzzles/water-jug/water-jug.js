/**
 * water-jug.js — 数字水罐问题（谜题 1）
 *
 * 第 1 周产物：Canvas 绘制三个水罐 + 目标刻度线 + 题目数据装载
 * 第 2 周将补充：交互逻辑（倒水操作 + 目标检测 + 题目切换）
 */

(function () {
  'use strict';

  // ========== 题目数据 ==========
  // 6 道题，数值 ≤ 30，B-A-2C 方法需 5-7 步，捷径类型多元（Q3=A-C, Q4=A+C, Q5=A-C, Q6=A+C）
  //
  // targetJug 机制：水量必须精确在该水罐中才算完成
  //   'B': B-A-2C 法 5 步（Fill B, B→A, B→C, Empty C, B→C → target in B）
  //   'A': B-A-2C 法 7 步（同上 + Empty A, B→A → target in A）
  //
 // 阶段设计（基于 B - A - 2C 范式）：
 //   惯性期(题1-2)：只有 B-A-2C 能解（A±C ≠ target），强制建立惯性
 //   关键期(题3-4)：捷径类型各异（Q3=A-C, Q4=A+C），测能否跳出惯性
 //   恢复期(题5-6)：捷径类型各异（Q5=A-C, Q6=A+C），验证认知灵活性
  var QUESTIONS = [
    // ── 惯性期（仅 B-A-2C 可解）──
    { id: 1, A: 11, B: 27, C: 3,  target: 10, targetJug: 'B', phase: 'inertia'  },
    { id: 2, A: 13, B: 28, C: 3,  target: 9,  targetJug: 'A', phase: 'inertia'  },
    // ── 关键期（捷径类型各异：Q3=A-C, Q4=A+C）──
    { id: 3, A: 13, B: 30, C: 4,  target: 9,  targetJug: 'B', phase: 'critical' },
    { id: 4, A: 7,  B: 26, C: 4,  target: 11, targetJug: 'B', phase: 'critical' },
    // ── 恢复期（捷径类型各异：Q5=A-C, Q6=A+C）──
    { id: 5, A: 10, B: 24, C: 4,  target: 6,  targetJug: 'A', phase: 'recovery' },
    { id: 6, A: 8,  B: 28, C: 4,  target: 12, targetJug: 'B', phase: 'recovery' }
  ];

  // ========== 游戏状态 ==========
  var currentIndex = 0;      // 当前题目索引 (0-5)
  var jugA = 0, jugB = 0, jugC = 0;
  var maxA = 0, maxB = 0, maxC = 0;
  var target = 0;
  var targetJug = 'B';       // 水量必须精确在该水罐中
  var stepCount = 0;
  var isSolved = false;
  var isGivingUp = false;          // 是否正在放弃流程中（防止重复点击）
  var usedFillA = false;           // 是否用过 Fill A（粗粒度，保留向后兼容）

  // ---- 解法分类 & 惯性追踪 ----
  var currentQuestionActions = []; // 当前题目的操作序列（字符串数组）
  var firstNonBStep = null;        // 本题中第一次使用非 B 操作时的步数（null=未使用）
  var inertiaPhaseResults = [];    // 惯性期各题解法类型，如 ['bac2c','bac2c','other']
  var inertiaBuilt = false;        // 惯性期 ≥2 题用 bac2c → 认为已建立惯性
  var SKIP_STEP_THRESHOLD = 15;   // 操作步数阈值
  var SKIP_TIME_THRESHOLD = 30;   // 停留时间阈值（秒）—— 脑内思考型
  var questionStartTime = 0;      // 当前题目开始时间戳
  var subtleSkipVisible = false;  // 低调放弃按钮是否已显示
  var skipTimerId = null;         // 时间门控计时器

  // ========== DOM 引用 ==========
  var canvas, ctx;
  var elCapA, elCapB, elCapC;
  var elCurA, elCurB, elCurC;
  var elTargetVol;
  var elQuestionLabel;
  var elQuestionDesc;
  var elStepCount;
  var elActionGrid;
  var elFillEmptyCol, elPourCol;
  var elGlobalProgress;
  var elProgressBadge;
  var btnCheck, btnReset, btnNext, btnSkip, subtleSkipBtn, skipContainer;
  var elPostSurvey, elSurveyQ2, surveySubmitBtn;

  // ========== 放弃按钮门控 ==========
  // 两个独立条件（OR 关系），任一满足即显示：
  //   a) 停留时间 ≥ SKIP_TIME_THRESHOLD 秒（脑内思考型）
  //   b) 操作步数 ≥ SKIP_STEP_THRESHOLD（动手尝试型）
  function showSubtleSkip() {
    if (subtleSkipVisible || isSolved) return;
    subtleSkipVisible = true;
    subtleSkipBtn.style.display = '';
    subtleSkipBtn.disabled = false;
  }

  function startSkipTimer() {
    clearSkipTimer();
    skipTimerId = setTimeout(function () {
      showSubtleSkip();
    }, SKIP_TIME_THRESHOLD * 1000);
  }

  function clearSkipTimer() {
    if (skipTimerId) {
      clearTimeout(skipTimerId);
      skipTimerId = null;
    }
  }

  // ========== 初始化 ==========
  function init() {
    // 恢复会话
    var session = EventLogger.resumeSession();
    if (!session) {
      // 测试模式：自动创建测试会话
      if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
        EventLogger.initSession('test_user');
      } else {
        // 正常模式：回退到入口
        alert('请先从首页输入参与者编号再开始测试。');
        window.location.href = '../../index.html';
        return;
      }
    }

    // 获取 DOM 元素
    canvas = document.getElementById('jugCanvas');
    ctx = canvas.getContext('2d');

    elCapA = document.getElementById('capA');
    elCapB = document.getElementById('capB');
    elCapC = document.getElementById('capC');
    elCurA = document.getElementById('curA');
    elCurB = document.getElementById('curB');
    elCurC = document.getElementById('curC');
    elTargetVol = document.getElementById('targetVol');
    elQuestionLabel = document.getElementById('questionLabel');
    elQuestionDesc = document.getElementById('questionDesc');
    elStepCount = document.getElementById('stepCount');
    elActionGrid = document.getElementById('actionGrid');
    elFillEmptyCol = document.getElementById('fillEmptyCol');
    elPourCol = document.getElementById('pourCol');
    elGlobalProgress = document.getElementById('globalProgress');
    elProgressBadge = document.getElementById('progressBadge');

    btnCheck = document.getElementById('checkBtn');
    btnReset = document.getElementById('resetBtn');
    btnNext = document.getElementById('nextBtn');
    btnSkip = document.getElementById('skipBtn');
    subtleSkipBtn = document.getElementById('subtleSkipBtn');
    skipContainer = document.getElementById('skipContainer');

    // 问卷相关
    elPostSurvey = document.getElementById('postSurvey');
    elSurveyQ2 = document.getElementById('surveyQ2');
    surveySubmitBtn = document.getElementById('surveySubmitBtn');

    // 问卷事件
    setupSurvey();

    // 事件绑定
    btnReset.addEventListener('click', resetCurrent);
    btnCheck.addEventListener('click', checkSolution);
    btnNext.addEventListener('click', nextQuestion);
    btnSkip.addEventListener('click', giveUp);
    subtleSkipBtn.addEventListener('click', giveUp);

    // 加载第一题
    loadQuestion(0);
  }

  // ========== 题目加载 ==========
  function loadQuestion(index) {
    var q = QUESTIONS[index];
    currentIndex = index;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    usedFillA = false;
    currentQuestionActions = [];   // 每题开始时清空操作序列
    firstNonBStep = null;          // 重置捷径觉察延迟
    subtleSkipVisible = false;
    skipContainer.style.display = 'none';
    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;

    // 启动时间门控计时器
    questionStartTime = Date.now();
    startSkipTimer();

    // 设置水罐参数
    maxA = q.A; maxB = q.B; maxC = q.C;
    target = q.target;
    targetJug = q.targetJug || 'B';  // 默认 B
    jugA = 0; jugB = 0; jugC = 0;

    // 更新文字
    elQuestionLabel.textContent = '第 ' + (index + 1) + ' 题 / 共 6 题';
    var tipText = '';
    if (q.phase === 'inertia') {
      tipText = '（提示：试试用 B 罐作为起点）';
    } else if (q.phase === 'critical') {
      tipText = '（提示：可能有更简单的方法）';
    }
    elQuestionDesc.textContent = '目标：在「' + targetJug + '」罐中精确得到 ' + target + ' L 水 ' + tipText;
    elStepCount.textContent = '0';

    elCapA.textContent = maxA;
    elCapB.textContent = maxB;
    elCapC.textContent = maxC;
    elCurA.textContent = jugA;
    elCurB.textContent = jugB;
    elCurC.textContent = jugC;
    elTargetVol.textContent = target;

    // 更新进度
    updateProgress();

    // 生成操作按钮
    generateActionButtons();

    // 更新按钮状态
    btnReset.disabled = true;
    btnCheck.disabled = true;
    btnNext.disabled = true;

    // 绘制 Canvas
    drawJugs();

    // 记录事件
    EventLogger.logPuzzleStart('water_jug', index + 1);
  }

  function updateProgress() {
    var globalPercent = Math.round((currentIndex / QUESTIONS.length) * 100);
    elGlobalProgress.style.width = globalPercent + '%';
    elProgressBadge.textContent = '谜题 1/4 — 题 ' + (currentIndex + 1) + '/' + QUESTIONS.length;
  }

  // ========== 操作按钮生成 ==========
  function generateActionButtons() {
    elFillEmptyCol.innerHTML = '';
    elPourCol.innerHTML = '';

    // 左列：装满 / 倒空
    var fillEmptyActions = [
      { label: '装满 A', jug: 'A', icon: '&#9650;', color: '#6366F1' },
      { label: '倒空 A', jug: 'A', icon: '&#9660;', color: '#6366F1' },
      { label: '装满 B', jug: 'B', icon: '&#9650;', color: '#10B981' },
      { label: '倒空 B', jug: 'B', icon: '&#9660;', color: '#10B981' },
      { label: '装满 C', jug: 'C', icon: '&#9650;', color: '#F59E0B' },
      { label: '倒空 C', jug: 'C', icon: '&#9660;', color: '#F59E0B' }
    ];

    fillEmptyActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderLeft = '3px solid ' + a.color;
      btn.innerHTML = '<span class="arrow">' + a.icon + '</span> <span class="jug-label">' + a.label + '</span>';
      btn.addEventListener('click', function () {
        performAction(a);
      });
      elFillEmptyCol.appendChild(btn);
    });

    // 右列：倒水操作
    var pourActions = [
      { label: 'A → B', from: 'A', to: 'B', icon: '&#8594;' },
      { label: 'A → C', from: 'A', to: 'C', icon: '&#8594;' },
      { label: 'B → A', from: 'B', to: 'A', icon: '&#8594;' },
      { label: 'B → C', from: 'B', to: 'C', icon: '&#8594;' },
      { label: 'C → A', from: 'C', to: 'A', icon: '&#8594;' },
      { label: 'C → B', from: 'C', to: 'B', icon: '&#8594;' }
    ];

    pourActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = '<span class="arrow">' + a.icon + '</span> ' + a.label;
      btn.addEventListener('click', function () {
        performAction(a);
      });
      elPourCol.appendChild(btn);
    });
  }

  // ========== 操作执行 ==========
  function performAction(action) {
    if (isSolved) return;

    var actionType = '';

    if (action.jug) {
      // 装满或倒空
      if (action.label.indexOf('装满') === 0) {
        fillJug(action.jug);
        actionType = 'fill_' + action.jug;
        if (action.jug === 'A') usedFillA = true;  // 标记用了捷径法
      } else {
        emptyJug(action.jug);
        actionType = 'empty_' + action.jug;
      }
    } else if (action.from) {
      // 倒水
      pourJug(action.from, action.to);
      actionType = 'pour_' + action.from + '_to_' + action.to;
    }

    stepCount++;
    currentQuestionActions.push(actionType);  // 记录到本题操作序列

    // 检测首次偏离 B 罐操作（捷径觉察延迟）
    if (firstNonBStep === null) {
      var nonBops = ['fill_A', 'fill_C', 'empty_A', 'empty_C',
                     'pour_A_to_B', 'pour_A_to_C', 'pour_C_to_A', 'pour_C_to_B'];
      if (nonBops.indexOf(actionType) !== -1) {
        firstNonBStep = stepCount;
      }
    }
    elStepCount.textContent = stepCount;
    updateDisplay();

    // 步数达标 → 同时触发低调按钮和明显跳过面板
    if (stepCount >= SKIP_STEP_THRESHOLD && !isSolved) {
      showSubtleSkip();
      skipContainer.style.display = 'block';
      btnSkip.textContent = '跳过此题（已尝试 ' + stepCount + ' 步）';
    }

    // 启用检查和重置按钮
    btnCheck.disabled = false;
    btnReset.disabled = false;

    // 记录事件
    EventLogger.logAction('water_jug', currentIndex + 1, actionType, {
      A: jugA, B: jugB, C: jugC
    });

    // 自动检查是否达成目标
    checkSolutionSilent();
  }

  function fillJug(jug) {
    if (jug === 'A') jugA = maxA;
    else if (jug === 'B') jugB = maxB;
    else if (jug === 'C') jugC = maxC;
  }

  function emptyJug(jug) {
    if (jug === 'A') jugA = 0;
    else if (jug === 'B') jugB = 0;
    else if (jug === 'C') jugC = 0;
  }

  function pourJug(from, to) {
    var fromVal, toVal, toMax;
    if (from === 'A') fromVal = jugA;
    else if (from === 'B') fromVal = jugB;
    else fromVal = jugC;

    if (to === 'A') { toVal = jugA; toMax = maxA; }
    else if (to === 'B') { toVal = jugB; toMax = maxB; }
    else { toVal = jugC; toMax = maxC; }

    var space = toMax - toVal;
    var pour = Math.min(fromVal, space);

    if (from === 'A') jugA -= pour;
    else if (from === 'B') jugB -= pour;
    else jugC -= pour;

    if (to === 'A') jugA += pour;
    else if (to === 'B') jugB += pour;
    else jugC += pour;
  }

  function updateDisplay() {
    elCurA.textContent = jugA;
    elCurB.textContent = jugB;
    elCurC.textContent = jugC;
    drawJugs();
  }

  function checkSolutionSilent() {
    var curInTarget = (targetJug === 'A') ? jugA : (targetJug === 'B') ? jugB : jugC;
    if (curInTarget === target) {
      markSolved();
    }
  }

  function checkSolution() {
    if (isSolved) return;

    var curInTarget = (targetJug === 'A') ? jugA : (targetJug === 'B') ? jugB : jugC;
    if (curInTarget === target) {
      markSolved();
    } else {
      // 判断差在哪
      var otherJugsOk = (jugA === target || jugB === target || jugC === target);
      if (otherJugsOk) {
        btnCheck.textContent = '水量对了但不在「' + targetJug + '」罐中！';
        btnCheck.className = 'btn btn-warning';
      } else {
        btnCheck.textContent = '不对，再试试';
        btnCheck.className = 'btn btn-warning';
      }
      EventLogger.logSubmit('water_jug', currentIndex + 1,
        { A: jugA, B: jugB, C: jugC, targetJug: targetJug, steps: stepCount },
        false
      );
      setTimeout(function () {
        btnCheck.textContent = '检查 ' + targetJug + ' 罐水量';
        btnCheck.className = 'btn btn-secondary';
      }, 2000);
    }
  }

  // ========== 解法类型分类（B 功能） ==========
  //
  // 三种解法类型：
  //   'bac2c'  — 惯性法：先装满B，再倒A和两次C，B中余量为目标
  //             判定条件：操作序列中出现 fill_B 但不出现 fill_A（且未使用 A 作为源头）
  //
  //   'simple' — 捷径法：直接 fill_A → pour_A_to_C（或 fill_C、pour_C_to_A 等仅涉及 A/C 的操作）
  //             判定条件：第一步就是 fill_A，且全程未用 fill_B
  //             （A - C = target 捷径）
  //
  //   'other'  — 混合或无规律（随机试）
  //             判定条件：以上两者均不满足
  //
  function classifySolutionMethod(actions) {
    if (!actions || actions.length === 0) return 'other';

    var usedFillB = actions.indexOf('fill_B') !== -1;
    var usedFillAFlag = actions.indexOf('fill_A') !== -1;

    // 捷径法：用了 fill_A 且整个过程没有 fill_B
    if (usedFillAFlag && !usedFillB) {
      return 'simple';
    }

    // 惯性法：用了 fill_B 且没有 fill_A（全程通过 B 罐操作）
    if (usedFillB && !usedFillAFlag) {
      return 'bac2c';
    }

    // 其他（fill_A 和 fill_B 都用了，或两者都没用）
    return 'other';
  }

  // ========== 惯性建立判断（C 功能） ==========
  //
  // 在每道惯性期题目解决/放弃后更新 inertiaPhaseResults，
  // 当惯性期（phase==='inertia'）结束时，判断是否建立了惯性：
  //   inertiaBuilt = true  →  惯性期 ≥2 题使用 bac2c 解法
  //   inertiaBuilt = false →  游离型参与者（未形成操作惯性），数据单独分组
  //
  function updateInertiaStatus(phase, method) {
    if (phase !== 'inertia') return;

    inertiaPhaseResults.push(method);

    // 惯性期共 2 题（索引 0-1），每次更新后重新计算
    var bac2cCount = inertiaPhaseResults.filter(function (m) {
      return m === 'bac2c';
    }).length;

    inertiaBuilt = (bac2cCount >= 2);
  }

  function markSolved() {
    isSolved = true;
    btnCheck.className = 'btn btn-success';
    btnCheck.disabled = true;
    btnNext.disabled = false;

    // 禁用操作按钮
    var btns = elActionGrid.querySelectorAll('.action-btn');
    btns.forEach(function (b) { b.disabled = true; });

    // 隐藏放弃按钮并清除计时器
    clearSkipTimer();
    subtleSkipBtn.style.display = 'none';

    // 精确解法分类（B 功能）
    var method = classifySolutionMethod(currentQuestionActions);

    // 更新惯性建立状态（C 功能）
    var q = QUESTIONS[currentIndex];
    updateInertiaStatus(q.phase, method);

    // UI 反馈：捷径法给额外提示
    var stepDesc = (method === 'simple') ? (stepCount + ' 步 — 捷径！') : (stepCount + ' 步');
    btnCheck.textContent = '正确！' + stepDesc;

    // 记录解决事件，携带精确解法 + 惯性状态 + 捷径觉察延迟
    EventLogger.logSubmit('water_jug', currentIndex + 1, {
      solvedIn: targetJug,
      steps: stepCount,
      method: method,               // 'bac2c' | 'simple' | 'other'
      inertiaBuilt: inertiaBuilt,   // 当前时刻是否已建立惯性
      phase: q.phase,
      shortcutExists: (q.phase === 'critical' || q.phase === 'recovery'),
      firstNonBStep: firstNonBStep  // 首次偏离 B 操作的步数（null=从未偏离）
    }, true);
  }

  // ========== 跳过 / 放弃机制 ==========
  // 核心设计理念：
  //   1. "放弃"是有价值的数据——说明固着度极高，是 Einstellung 效应的最强证据
  //   2. 但必须给参与者出口，不能无限困住
  //   3. 超过 15 步后出现跳过按钮，参与者可自由选择继续或跳过
  //   4. 跳过时仅提示已跳过，不暴露任何解法或方法名称，保证后续题目数据有效
  function giveUp() {
    if (isGivingUp || isSolved) return;
    isGivingUp = true;
    clearSkipTimer();

    // 1. 禁用操作防止重复点击
    var btns = elActionGrid.querySelectorAll('.action-btn');
    btns.forEach(function (b) { b.disabled = true; });
    btnSkip.disabled = true;
    subtleSkipBtn.disabled = true;
    btnCheck.disabled = true;
    btnReset.disabled = true;

    // 2. 记录放弃事件（关键数据点），携带解法倾向 + 惯性状态
    var q = QUESTIONS[currentIndex];
    var shortcutExists = (q.phase === 'critical' || q.phase === 'recovery');
    var partialMethod = classifySolutionMethod(currentQuestionActions); // 放弃时的解法倾向
    if (q.phase === 'inertia') updateInertiaStatus(q.phase, partialMethod); // 放弃也算一次惯性期记录
    EventLogger.logGiveUp('water_jug', currentIndex + 1, {
      steps: stepCount,
      phase: q.phase,
      methodTendency: partialMethod,   // 放弃前的解法倾向（不算完成，仅倾向）
      inertiaBuilt: inertiaBuilt,
      shortcutExists: shortcutExists,
      firstNonBStep: firstNonBStep,    // 放弃前是否曾偏离 B 操作
      A: jugA, B: jugB, C: jugC
    });

    // 3. 短暂提示后自动跳转
    var oldDesc = elQuestionDesc.textContent;
    elQuestionDesc.innerHTML = '<span style="color:#EF4444;">已跳过。</span> 即将进入下一题...';
    btnSkip.textContent = '即将进入下一题...';
    btnSkip.className = 'btn btn-warning';

    // 4. 自动跳转
    setTimeout(function () {
      elQuestionDesc.textContent = oldDesc;
      btnSkip.className = 'btn btn-secondary';
      isGivingUp = false;
      nextQuestion();
    }, 2500);
  }

  function resetCurrent() {
    jugA = 0; jugB = 0; jugC = 0;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    usedFillA = false;
    currentQuestionActions = [];   // 重置时也清空操作序列
    firstNonBStep = null;          // 重置捷径觉察延迟
    skipContainer.style.display = 'none';

    elStepCount.textContent = '0';
    btnCheck.textContent = '检查 ' + targetJug + ' 罐水量';
    btnCheck.className = 'btn btn-secondary';
    btnCheck.disabled = true;
    btnReset.disabled = true;
    btnNext.disabled = true;

    // 重置时间门控：隐藏放弃按钮，重新计时
    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;
    subtleSkipVisible = false;
    questionStartTime = Date.now();
    startSkipTimer();

    var btns = elActionGrid.querySelectorAll('.action-btn');
    btns.forEach(function (b) { b.disabled = false; });

    updateDisplay();

    EventLogger.logReset('water_jug', currentIndex + 1);
  }

  // ========== 实验后问卷 ==========
  function setupSurvey() {
    // Q1 选择事件
    var q1radios = document.querySelectorAll('input[name="q1"]');
    q1radios.forEach(function (r) {
      r.addEventListener('change', function () {
        // 选了"是"才显示 Q2
        elSurveyQ2.style.display = (this.value === 'yes') ? '' : 'none';
        // 选了"否"或"不确定"时清空 Q2 选择
        if (this.value !== 'yes') {
          document.querySelectorAll('input[name="q2"]').forEach(function (r2) {
            r2.checked = false;
          });
        }
        checkSurveyReady();
      });
    });

    // Q2 选择事件
    var q2radios = document.querySelectorAll('input[name="q2"]');
    q2radios.forEach(function (r) {
      r.addEventListener('change', checkSurveyReady);
    });

    // 提交按钮
    surveySubmitBtn.addEventListener('click', submitSurvey);
  }

  function checkSurveyReady() {
    var q1val = document.querySelector('input[name="q1"]:checked');
    if (!q1val) {
      surveySubmitBtn.disabled = true;
      return;
    }

    if (q1val.value === 'yes') {
      // 需要 Q2 也回答
      var q2val = document.querySelector('input[name="q2"]:checked');
      surveySubmitBtn.disabled = !q2val;
    } else {
      surveySubmitBtn.disabled = false;
    }
  }

  function submitSurvey() {
    var q1val = document.querySelector('input[name="q1"]:checked');
    var q2val = document.querySelector('input[name="q2"]:checked');

    var surveyData = {
      discoveredShortcut: q1val ? q1val.value : null,
      discoveredAtQuestion: q2val ? parseInt(q2val.value, 10) : null,
      inertiaBuilt: inertiaBuilt,
      inertiaPhaseResults: inertiaPhaseResults
    };

    // 记录问卷数据
    if (typeof EventLogger !== 'undefined') {
      EventLogger.logEvent('water_jug', 0, 'survey_submit', surveyData);
    }

    // 隐藏问卷，显示完成提示
    elPostSurvey.innerHTML = '<div class="survey-body" style="text-align:center; padding:var(--spacing-6) 0;">'
      + '<h3 style="margin-bottom:var(--spacing-2);">🎉 测试完成</h3>'
      + '<p class="text-sm text-muted" style="margin-bottom:var(--spacing-4);">感谢你的参与！数据已记录。</p>'
      + '<p class="text-sm text-muted">水罐问题已完成，进入下一个谜题...</p>'
      + '</div>';

    // 数据保存在 localStorage，最终由完成页统一导出

    // 3 秒后自动跳转下一谜题
    setTimeout(function () {
      window.location.href = '../anagram/anagram.html';
    }, 3000);
  }

  function nextQuestion() {
    // 记录本题结束
    EventLogger.logPuzzleEnd('water_jug', currentIndex + 1);

    if (currentIndex + 1 < QUESTIONS.length) {
      loadQuestion(currentIndex + 1);
    } else {
      // 8 题全部完成 → 显示实验后问卷
      var puzzleCard = document.querySelector('.puzzle-two-col');
      if (puzzleCard) puzzleCard.style.display = 'none';
      var headerCard = document.querySelector('.puzzle-header');
      if (headerCard) headerCard.style.display = 'none';
      elPostSurvey.style.display = '';
      elPostSurvey.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ========== Canvas 绘制 ==========
  function drawJugs() {
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 水位颜色
    var colors = {
      A: '#6366F1',
      B: '#10B981',
      C: '#F59E0B'
    };

    // 三个水罐的绘制参数（x 基于 canvas 实际宽度均匀分布）
    var jugW = 58;
    var slots = 3;
    var totalJugW = jugW * slots;
    var gap = (w - totalJugW) / (slots + 1); // 等间距
    var xA = gap;
    var xB = gap * 2 + jugW;
    var xC = gap * 3 + jugW * 2;
    var jugs = [
      { id: 'A', cap: maxA, cur: jugA, x: xA, color: colors.A },
      { id: 'B', cap: maxB, cur: jugB, x: xB, color: colors.B },
      { id: 'C', cap: maxC, cur: jugC, x: xC, color: colors.C }
    ];

    // 目标刻度 (在所有水罐上标注目标线)
    jugs.forEach(function (jug) {
      drawJug(jug, target);
    });

    // 图例（放在右上角，自适应 canvas 宽度）
    var legendX = w - 100;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(legendX, 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78716C';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('目标水位', legendX + 8, 24);
  }

  function drawJug(jug, targetVal) {
    var x = jug.x;
    var bottomY = 298;
    var width = 58;
    var fullHeight = 180;  // 水罐总高度
    var isTarget = (jug.id === targetJug);

    // 计算比例
    var cap = jug.cap || 1;
    var scale = fullHeight / cap;

    // --- 目标罐金色高亮外框 ---
    if (isTarget) {
      ctx.fillStyle = 'rgba(245,158,11,0.08)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      var pad = 6;
      ctx.beginPath();
      ctx.roundRect(x - pad, bottomY - fullHeight - pad, width + pad * 2, fullHeight + pad * 2, 8);
      ctx.fill();
      ctx.stroke();
    }

    // --- 水罐主体 ---
    // 罐体外框
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#D6D3D1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, bottomY - fullHeight);
    ctx.lineTo(x + width, bottomY - fullHeight);
    ctx.lineTo(x + width, bottomY);
    ctx.lineTo(x, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // --- 水位 ---
    var waterHeight = jug.cur * scale;
    if (waterHeight > 0) {
      var waterY = bottomY - waterHeight;

      // 渐变颜色
      var grad = ctx.createLinearGradient(x, waterY, x, bottomY);
      grad.addColorStop(0, jug.color);
      grad.addColorStop(1, adjustAlpha(jug.color, 0.6));

      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, waterY, width - 4, waterHeight);

      // 水面线
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, waterY);
      ctx.lineTo(x + width - 2, waterY);
      ctx.stroke();
    }

    // --- 目标水位线（虚线，仅目标罐） ---
    if (isTarget && targetVal <= cap) {
      var targetY = bottomY - (targetVal * scale);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x - 8, targetY);
      ctx.lineTo(x + width + 8, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 目标值标注
      ctx.fillStyle = '#EF4444';
      ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'right';
      ctx.fillText(targetVal, x - 12, targetY + 4);
      ctx.textAlign = 'start';
    }

    // --- 容量标注 ---
    ctx.fillStyle = '#A8A29E';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('容量 ' + cap + ' L', x + width / 2, bottomY + 20);

    // --- 当前水量 ---
    ctx.fillStyle = jug.color;
    ctx.font = 'bold 13px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText(jug.cur + ' L', x + width / 2, bottomY - fullHeight - 10);

    // --- 字母标签 ---
    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 14px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText(jug.id, x + width / 2, bottomY + 38);

    // --- 目标罐标记 ---
    if (isTarget) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('★ 目标', x + width / 2, bottomY + 54);
    }
  }

  function adjustAlpha(hex, alpha) {
    // 简单的 hex 转 rgba
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      // 注入调试工具栏（测试模式）
      if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
        window.TestDebug.injectToolbar({
          totalQuestions: QUESTIONS.length,
          goToQuestion: loadQuestion
        });
      }
    });
  } else {
    init();
    // 注入调试工具栏（测试模式）
    if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
      window.TestDebug.injectToolbar({
        totalQuestions: QUESTIONS.length,
        goToQuestion: loadQuestion
      });
    }
  }

})();
