/**
 * sequence.js — 数字变换问题（谜题 4）
 *
 * 基于 Einstellung 范式：从起始数字出发，通过运算操作达到目标数字。
 * 惯性法：使用基本运算（×2, +1, −1, ÷2）逐步推进。
 * 捷径：使用跳步运算（+10, ×3）一步或两步到位。
 */

(function () {
  'use strict';

  // ========== 题目数据 ==========
  var QUESTIONS = [
    // ── 惯性期（仅基本运算可解，跳步运算无法一步到位）──
    { id: 1, start: 2,  target: 17, phase: 'inertia',  hint: '（提示：试试用 ×2 和 +1）' },
    { id: 2, start: 3,  target: 25, phase: 'inertia',  hint: '' },
    // ── 关键期（捷径 vs 惯性同时可行，捷径类型各异）──
    { id: 3, start: 4,  target: 14, phase: 'critical', hint: '（提示：可能有更简单的方法）' },
    { id: 4, start: 3,  target: 27, phase: 'critical', hint: '（提示：可能有更简单的方法）' },
    // ── 恢复期（验证认知灵活性，捷径类型各异）──
    { id: 5, start: 7,  target: 17, phase: 'recovery', hint: '' },
    { id: 6, start: 2,  target: 18, phase: 'recovery', hint: '' }
  ];

  // ========== 游戏状态 ==========
  var currentIndex = 0;
  var currentNum = 0;
  var targetNum = 0;
  var stepCount = 0;
  var isSolved = false;
  var isGivingUp = false;
  var currentQuestionActions = [];
  var firstJumpStep = null;
  var inertiaPhaseResults = [];
  var inertiaBuilt = false;
  var SKIP_STEP_THRESHOLD = 15;
  var SKIP_TIME_THRESHOLD = 30;
  var questionStartTime = 0;
  var subtleSkipVisible = false;
  var skipTimerId = null;

  // ========== DOM 引用 ==========
  var elCurrentNum, elTargetNum;
  var elStepList;
  var elQuestionLabel, elQuestionDesc;
  var elStepCount;
  var elBasicCol, elJumpCol;
  var elGlobalProgress, elProgressBadge;
  var btnCheck, btnReset, btnNext, btnSkip, subtleSkipBtn, skipContainer;
  var elPostSurvey, elSurveyQ2, surveySubmitBtn;

  // ========== 放弃按钮门控 ==========
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

  // Note: there is no check button — auto-check is always running
  // The check button shows "auto-check" status

  // ========== 初始化 ==========
  function init() {
    var session = EventLogger.resumeSession();
    if (!session) {
      // 测试模式：自动创建测试会话
      if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
        EventLogger.initSession('test_user');
      } else {
        alert('请先从首页输入参与者编号再开始测试。');
        window.location.href = '../../index.html';
        return;
      }
    }

    elCurrentNum = document.getElementById('currentNum');
    elTargetNum = document.getElementById('targetNum');
    elStepList = document.getElementById('stepList');
    elQuestionLabel = document.getElementById('questionLabel');
    elQuestionDesc = document.getElementById('questionDesc');
    elStepCount = document.getElementById('stepCount');
    elBasicCol = document.getElementById('basicCol');
    elJumpCol = document.getElementById('jumpCol');
    elGlobalProgress = document.getElementById('globalProgress');
    elProgressBadge = document.getElementById('progressBadge');

    btnCheck = document.getElementById('checkBtn');
    btnReset = document.getElementById('resetBtn');
    btnNext = document.getElementById('nextBtn');
    btnSkip = document.getElementById('skipBtn');
    subtleSkipBtn = document.getElementById('subtleSkipBtn');
    skipContainer = document.getElementById('skipContainer');

    elPostSurvey = document.getElementById('postSurvey');
    elSurveyQ2 = document.getElementById('surveyQ2');
    surveySubmitBtn = document.getElementById('surveySubmitBtn');

    setupSurvey();

    btnReset.addEventListener('click', resetCurrent);
    btnNext.addEventListener('click', nextQuestion);
    btnSkip.addEventListener('click', giveUp);
    subtleSkipBtn.addEventListener('click', giveUp);

    loadQuestion(0);
  }

  // ========== 题目加载 ==========
  function loadQuestion(index) {
    var q = QUESTIONS[index];
    currentIndex = index;
    currentNum = q.start;
    targetNum = q.target;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    currentQuestionActions = [];
    firstJumpStep = null;
    subtleSkipVisible = false;
    skipContainer.style.display = 'none';
    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;

    questionStartTime = Date.now();
    startSkipTimer();

    elQuestionLabel.textContent = '第 ' + (index + 1) + ' 题 / 共 6 题';
    elQuestionDesc.textContent = '目标：将数字变成 ' + q.target + ' ' + (q.hint || '');
    elStepCount.textContent = '0';
    elCurrentNum.textContent = currentNum;
    elTargetNum.textContent = q.target;
    elStepList.innerHTML = '';

    updateProgress();
    generateActionButtons();

    btnReset.disabled = true;
    btnCheck.className = 'btn btn-secondary';
    btnCheck.disabled = true;
    btnCheck.textContent = '自动检测中...';
    btnNext.disabled = true;

    EventLogger.logPuzzleStart('sequence', index + 1);
  }

  function updateProgress() {
    var pct = Math.round((currentIndex / QUESTIONS.length) * 100);
    elGlobalProgress.style.width = pct + '%';
    elProgressBadge.textContent = '谜题 4/4 — 题 ' + (currentIndex + 1) + '/' + QUESTIONS.length;
  }

  // ========== 操作按钮生成 ==========
  function generateActionButtons() {
    elBasicCol.innerHTML = '';
    elJumpCol.innerHTML = '';

    // 左列：基本运算（逐步调整）
    var basicActions = [
      { label: '×2 (乘以2)',   op: 'mul2',  display: '×2' },
      { label: '+1 (加1)',     op: 'add1',  display: '+1' },
      { label: '−1 (减1)',     op: 'sub1',  display: '−1' },
      { label: '÷2 (除以2)',   op: 'div2',  display: '÷2', check: function(n) { return n % 2 === 0; } }
    ];

    basicActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderLeft = '3px solid #6366F1';
      btn.innerHTML = '<span style="font-weight:600;font-size:14px;">' + a.display + '</span> '
        + '<span class="num-op-desc">' + a.label.substring(a.display.length + 1) + '</span>';
      btn.addEventListener('click', function () {
        performBasic(a);
      });
      elBasicCol.appendChild(btn);
    });

    // 右列：跳步运算（大跨步）
    var jumpActions = [
      { label: '+10 (加10)',    op: 'add10', display: '+10' },
      { label: '×3 (乘以3)',    op: 'mul3',  display: '×3' },
      { label: '−10 (减10)',    op: 'sub10', display: '−10' },
      { label: '÷3 (除以3)',    op: 'div3',  display: '÷3', check: function(n) { return n % 3 === 0; } }
    ];

    jumpActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderLeft = '3px solid #10B981';
      btn.innerHTML = '<span style="font-weight:600;font-size:14px;color:#10B981;">' + a.display + '</span> '
        + '<span class="num-op-desc">' + a.label.substring(a.display.length + 1) + '</span>';
      btn.addEventListener('click', function () {
        performJump(a);
      });
      elJumpCol.appendChild(btn);
    });
  }

  // ========== 操作执行 ==========
  function computeBasic(op) {
    if (op === 'mul2') return currentNum * 2;
    if (op === 'add1') return currentNum + 1;
    if (op === 'sub1') return currentNum - 1;
    if (op === 'div2') return currentNum / 2;
    return currentNum;
  }

  function computeJump(op) {
    if (op === 'add10') return currentNum + 10;
    if (op === 'mul3')  return currentNum * 3;
    if (op === 'sub10') return currentNum - 10;
    if (op === 'div3')  return currentNum / 3;
    return currentNum;
  }

  function performBasic(a) {
    if (isSolved) return;

    if (a.op === 'div2' && currentNum % 2 !== 0) {
      shake(elBasicCol);
      return;
    }

    var prev = currentNum;
    currentNum = computeBasic(a.op);

    if (!Number.isInteger(currentNum)) {
      currentNum = prev;
      return;
    }

    stepCount++;
    currentQuestionActions.push('basic_' + a.op);

    addStepBadge(a.display, false);
    afterAction('basic_' + a.op);
  }

  function performJump(a) {
    if (isSolved) return;

    if (a.op === 'div3' && currentNum % 3 !== 0) {
      shake(elJumpCol);
      return;
    }

    var prev = currentNum;
    currentNum = computeJump(a.op);

    if (!Number.isInteger(currentNum)) {
      currentNum = prev;
      return;
    }

    stepCount++;
    currentQuestionActions.push('jump_' + a.op);

    // 首次使用跳步
    if (firstJumpStep === null) {
      firstJumpStep = stepCount;
    }

    addStepBadge(a.display, true);
    afterAction('jump_' + a.op);
  }

  function addStepBadge(text, isJump) {
    var badge = document.createElement('span');
    badge.className = 'step-badge' + (isJump ? ' jump' : '');
    badge.textContent = text;
    elStepList.appendChild(badge);
    elStepList.scrollLeft = elStepList.scrollWidth;
  }

  function shake(el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.3s ease';
  }

  function afterAction(actionType) {
    elStepCount.textContent = stepCount;
    elCurrentNum.textContent = currentNum;

    if (stepCount >= SKIP_STEP_THRESHOLD && !isSolved) {
      showSubtleSkip();
      skipContainer.style.display = 'block';
      btnSkip.textContent = '跳过此题（已尝试 ' + stepCount + ' 步）';
    }

    btnCheck.disabled = false;
    btnReset.disabled = false;

    EventLogger.logAction('sequence', currentIndex + 1, actionType, {
      value: currentNum
    });

    checkSolutionSilent();
  }

  function checkSolutionSilent() {
    if (currentNum === targetNum) {
      markSolved();
    }
  }

  // Note: the "check" button is just a status indicator — auto-check is always on.
  // This function is bound but will never need to do checking manually.

  // ========== 解法分类 ==========
  function classifySolutionMethod(actions) {
    if (!actions || actions.length === 0) return 'other';

    var hasJump = actions.some(function (a) {
      return a.indexOf('jump_') === 0;
    });
    var hasBasic = actions.some(function (a) {
      return a.indexOf('basic_') === 0;
    });

    if (hasJump && !hasBasic) return 'jump';     // 纯跳步（捷径）
    if (hasBasic && !hasJump) return 'basic';    // 纯逐步（惯性）
    return 'mixed';
  }

  function updateInertiaStatus(phase, method) {
    if (phase !== 'inertia') return;

    inertiaPhaseResults.push(method);

    var basicCount = inertiaPhaseResults.filter(function (m) {
      return m === 'basic';
    }).length;

    inertiaBuilt = (basicCount >= 2);
  }

  function markSolved() {
    isSolved = true;
    clearSkipTimer();
    subtleSkipBtn.style.display = 'none';

    var btns = document.querySelectorAll('#basicCol .action-btn, #jumpCol .action-btn');
    btns.forEach(function (b) { b.disabled = true; });

    var method = classifySolutionMethod(currentQuestionActions);
    var q = QUESTIONS[currentIndex];
    updateInertiaStatus(q.phase, method);

    var stepDesc = (method === 'jump') ? (stepCount + ' 步 — 捷径！') : (stepCount + ' 步');
    btnCheck.textContent = '正确！' + stepDesc;
    btnCheck.className = 'btn btn-success';
    btnNext.disabled = false;

    EventLogger.logSubmit('sequence', currentIndex + 1, {
      steps: stepCount,
      method: method,
      inertiaBuilt: inertiaBuilt,
      phase: q.phase,
      shortcutExists: (q.phase === 'critical' || q.phase === 'recovery'),
      firstJumpStep: firstJumpStep,
      result: currentNum
    }, true);
  }

  // ========== 跳过 ==========
  function giveUp() {
    if (isGivingUp || isSolved) return;
    isGivingUp = true;
    clearSkipTimer();

    var btns = document.querySelectorAll('#basicCol .action-btn, #jumpCol .action-btn');
    btns.forEach(function (b) { b.disabled = true; });
    btnSkip.disabled = true;
    subtleSkipBtn.disabled = true;
    btnCheck.disabled = true;
    btnReset.disabled = true;

    var q = QUESTIONS[currentIndex];
    var shortcutExists = (q.phase === 'critical' || q.phase === 'recovery');
    var partialMethod = classifySolutionMethod(currentQuestionActions);
    if (q.phase === 'inertia') updateInertiaStatus(q.phase, partialMethod);

    EventLogger.logGiveUp('sequence', currentIndex + 1, {
      steps: stepCount,
      phase: q.phase,
      methodTendency: partialMethod,
      inertiaBuilt: inertiaBuilt,
      shortcutExists: shortcutExists,
      firstJumpStep: firstJumpStep,
      current: currentNum,
      target: targetNum
    });

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

  function resetCurrent() {
    var q = QUESTIONS[currentIndex];
    currentNum = q.start;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    currentQuestionActions = [];
    firstJumpStep = null;
    skipContainer.style.display = 'none';

    elStepCount.textContent = '0';
    elCurrentNum.textContent = currentNum;
    elStepList.innerHTML = '';
    btnCheck.textContent = '自动检测中...';
    btnCheck.className = 'btn btn-secondary';
    btnCheck.disabled = true;
    btnReset.disabled = true;
    btnNext.disabled = true;

    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;
    subtleSkipVisible = false;
    questionStartTime = Date.now();
    startSkipTimer();

    var btns = document.querySelectorAll('#basicCol .action-btn, #jumpCol .action-btn');
    btns.forEach(function (b) { b.disabled = false; });

    EventLogger.logReset('sequence', currentIndex + 1);
  }

  // ========== 实验后问卷 ==========
  function setupSurvey() {
    var q1radios = document.querySelectorAll('input[name="q1"]');
    q1radios.forEach(function (r) {
      r.addEventListener('change', function () {
        elSurveyQ2.style.display = (this.value === 'yes') ? '' : 'none';
        if (this.value !== 'yes') {
          document.querySelectorAll('input[name="q2"]').forEach(function (r2) {
            r2.checked = false;
          });
        }
        checkSurveyReady();
      });
    });

    document.querySelectorAll('input[name="q2"]').forEach(function (r) {
      r.addEventListener('change', checkSurveyReady);
    });

    surveySubmitBtn.addEventListener('click', submitSurvey);
  }

  function checkSurveyReady() {
    var q1val = document.querySelector('input[name="q1"]:checked');
    if (!q1val) {
      surveySubmitBtn.disabled = true;
      return;
    }
    if (q1val.value === 'yes') {
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

    EventLogger.logEvent('sequence', 0, 'survey_submit', surveyData);

    elPostSurvey.innerHTML = '<div class="survey-body" style="text-align:center; padding:var(--spacing-6) 0;">'
      + '<h3 style="margin-bottom:var(--spacing-2);">全部测试完成！</h3>'
      + '<p class="text-sm text-muted" style="margin-bottom:var(--spacing-4);">正在为你汇总所有数据...</p>'
      + '</div>';

    // 不再在此处下载数据，全部交给 complete.html 处理
    // 1.5 秒后跳转到完成页
    setTimeout(function () {
      var url = '../../complete.html';
      if (window.TestDebug && window.TestDebug.isEnabled && window.TestDebug.isEnabled()) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'test=1';
      }
      window.location.href = url;
    }, 1500);
  }

  function nextQuestion() {
    EventLogger.logPuzzleEnd('sequence', currentIndex + 1);

    if (currentIndex + 1 < QUESTIONS.length) {
      loadQuestion(currentIndex + 1);
    } else {
      var puzzleCard = document.querySelector('.puzzle-two-col');
      if (puzzleCard) puzzleCard.style.display = 'none';
      var headerCard = document.querySelector('.puzzle-header');
      if (headerCard) headerCard.style.display = 'none';
      elPostSurvey.style.display = '';
      elPostSurvey.scrollIntoView({ behavior: 'smooth' });
    }
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
