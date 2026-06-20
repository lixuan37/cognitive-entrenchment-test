/**
 * anagram.js — 字母转换问题（谜题 2）
 *
 * 基于 Einstellung 范式：通过操作将 3 个字母从起始串变为目标串。
 * 惯性法：逐个增减字母（繁琐），捷径：一键反转或移位。
 */

(function () {
  'use strict';

  // ========== 字母工具函数 ==========
  function letterToNum(ch) {
    return ch.charCodeAt(0) - 65; // A=0, Z=25
  }

  function numToLetter(n) {
    return String.fromCharCode(((n % 26) + 26) % 26 + 65);
  }

  function incLetter(ch) {
    return numToLetter(letterToNum(ch) + 1);
  }

  function decLetter(ch) {
    return numToLetter(letterToNum(ch) - 1);
  }

  function lettersEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  // ========== 题目数据 ==========
  // 6 题，三阶段（惯性/关键/恢复），捷径类型多元（反转 vs 左移）
  var QUESTIONS = [
    // ── 惯性期（仅逐个增减可解，反转/移位无效）──
    { id: 1, start: 'AAA', target: 'BCB', phase: 'inertia',  hint: '（提示：试试逐个调整每个字母）' },
    { id: 2, start: 'BCD', target: 'DEF', phase: 'inertia',  hint: '' },
    // ── 关键期（捷径 vs 惯性同时可行，捷径类型各异）──
    { id: 3, start: 'ABC', target: 'CBA', phase: 'critical', hint: '（提示：可能有更简单的方法）' },
    { id: 4, start: 'DEF', target: 'EFD', phase: 'critical', hint: '（提示：可能有更简单的方法）' },
    // ── 恢复期（验证认知灵活性，捷径类型各异）──
    { id: 5, start: 'CBA', target: 'ABC', phase: 'recovery', hint: '' },
    { id: 6, start: 'EFG', target: 'FGE', phase: 'recovery', hint: '' }
  ];

  // ========== 游戏状态 ==========
  var currentIndex = 0;
  var letters = ['A','A','A'];  // 当前字母 [A, B, C]
  var targetLetters = 'AAA';
  var stepCount = 0;
  var isSolved = false;
  var isGivingUp = false;
  var currentQuestionActions = [];
  var firstGlobalStep = null;      // 首次使用全局变换的步数
  var inertiaPhaseResults = [];
  var inertiaBuilt = false;
  var SKIP_STEP_THRESHOLD = 15;
  var SKIP_TIME_THRESHOLD = 30;
  var questionStartTime = 0;
  var subtleSkipVisible = false;
  var skipTimerId = null;

  // ========== DOM 引用 ==========
  var canvas, ctx;
  var elCurA, elCurB, elCurC;
  var elTargetLetters;
  var elQuestionLabel, elQuestionDesc;
  var elStepCount;
  var elIncDecCol, elGlobalCol;
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

    canvas = document.getElementById('letterCanvas');
    ctx = canvas.getContext('2d');

    elCurA = document.getElementById('curA');
    elCurB = document.getElementById('curB');
    elCurC = document.getElementById('curC');
    elTargetLetters = document.getElementById('targetLetters');
    elQuestionLabel = document.getElementById('questionLabel');
    elQuestionDesc = document.getElementById('questionDesc');
    elStepCount = document.getElementById('stepCount');
    elIncDecCol = document.getElementById('incDecCol');
    elGlobalCol = document.getElementById('globalCol');
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
    btnCheck.addEventListener('click', checkSolution);
    btnNext.addEventListener('click', nextQuestion);
    btnSkip.addEventListener('click', giveUp);
    subtleSkipBtn.addEventListener('click', giveUp);

    loadQuestion(0);
  }

  // ========== 题目加载 ==========
  function loadQuestion(index) {
    var q = QUESTIONS[index];
    currentIndex = index;
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    currentQuestionActions = [];
    firstGlobalStep = null;
    subtleSkipVisible = false;
    skipContainer.style.display = 'none';
    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;

    questionStartTime = Date.now();
    startSkipTimer();

    letters[0] = q.start[0];
    letters[1] = q.start[1];
    letters[2] = q.start[2];
    targetLetters = q.target;

    elQuestionLabel.textContent = '第 ' + (index + 1) + ' 题 / 共 6 题';
    elQuestionDesc.textContent = '目标：将字母串变成「' + q.target + '」' + (q.hint || '');
    elStepCount.textContent = '0';

    elCurA.textContent = letters[0];
    elCurB.textContent = letters[1];
    elCurC.textContent = letters[2];
    elTargetLetters.textContent = q.target;

    updateProgress();
    generateActionButtons();

    btnReset.disabled = true;
    btnCheck.disabled = true;
    btnNext.disabled = true;

    drawLetters();

    EventLogger.logPuzzleStart('anagram', index + 1);
  }

  function updateProgress() {
    var pct = Math.round((currentIndex / QUESTIONS.length) * 100);
    elGlobalProgress.style.width = pct + '%';
    elProgressBadge.textContent = '谜题 2/4 — 题 ' + (currentIndex + 1) + '/' + QUESTIONS.length;
  }

  // ========== 操作按钮生成 ==========
  function generateActionButtons() {
    elIncDecCol.innerHTML = '';
    elGlobalCol.innerHTML = '';

    // 左列：逐个增减（6个按钮）
    var incDecActions = [
      { label: 'A +1', slot: 0, dir: 1,  color: '#6366F1' },
      { label: 'A −1', slot: 0, dir: -1, color: '#6366F1' },
      { label: 'B +1', slot: 1, dir: 1,  color: '#10B981' },
      { label: 'B −1', slot: 1, dir: -1, color: '#10B981' },
      { label: 'C +1', slot: 2, dir: 1,  color: '#F59E0B' },
      { label: 'C −1', slot: 2, dir: -1, color: '#F59E0B' }
    ];

    incDecActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderLeft = '3px solid ' + a.color;
      var icon = a.dir === 1 ? '&#9650;' : '&#9660;';
      btn.innerHTML = '<span class="arrow">' + icon + '</span> <span class="jug-label">' + a.label + '</span>';
      btn.addEventListener('click', function () {
        performIncDec(a.slot, a.dir);
      });
      elIncDecCol.appendChild(btn);
    });

    // 右列：整体变换（3个按钮）
    var globalActions = [
      { label: '反转 ↔', type: 'reverse',     desc: 'ABC → CBA' },
      { label: '左移 ←', type: 'shiftLeft',   desc: 'ABC → BCA' },
      { label: '右移 →', type: 'shiftRight',  desc: 'ABC → CAB' }
    ];

    globalActions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = '<span class="jug-label">' + a.label + '</span> <span class="arrow" style="font-size:10px;color:#A8A29E;">' + a.desc + '</span>';
      btn.addEventListener('click', function () {
        performGlobal(a.type);
      });
      elGlobalCol.appendChild(btn);
    });
  }

  // ========== 操作执行 ==========
  function performIncDec(slot, dir) {
    if (isSolved) return;

    var letter = letters[slot];
    letters[slot] = dir === 1 ? incLetter(letter) : decLetter(letter);

    var slotName = ['A','B','C'][slot];
    var actionType = (dir === 1 ? 'inc_' : 'dec_') + slotName;
    stepCount++;
    currentQuestionActions.push(actionType);

    afterAction(actionType);
  }

  function performGlobal(type) {
    if (isSolved) return;

    if (type === 'reverse') {
      // ABC → CBA
      var tmp = letters[0];
      letters[0] = letters[2];
      letters[2] = tmp;
    } else if (type === 'shiftLeft') {
      // ABC → BCA
      var t = letters[0];
      letters[0] = letters[1];
      letters[1] = letters[2];
      letters[2] = t;
    } else if (type === 'shiftRight') {
      // ABC → CAB
      var t = letters[2];
      letters[2] = letters[1];
      letters[1] = letters[0];
      letters[0] = t;
    }

    var actionType = 'global_' + type;
    stepCount++;
    currentQuestionActions.push(actionType);

    // 首次使用全局变换
    if (firstGlobalStep === null) {
      firstGlobalStep = stepCount;
    }

    afterAction(actionType);
  }

  function afterAction(actionType) {
    elStepCount.textContent = stepCount;
    elCurA.textContent = letters[0];
    elCurB.textContent = letters[1];
    elCurC.textContent = letters[2];
    drawLetters();

    if (stepCount >= SKIP_STEP_THRESHOLD && !isSolved) {
      showSubtleSkip();
      skipContainer.style.display = 'block';
      btnSkip.textContent = '跳过此题（已尝试 ' + stepCount + ' 步）';
    }

    btnCheck.disabled = false;
    btnReset.disabled = false;

    EventLogger.logAction('anagram', currentIndex + 1, actionType, {
      letters: letters.join('')
    });

    checkSolutionSilent();
  }

  function checkSolutionSilent() {
    if (lettersEqual(letters.join(''), targetLetters)) {
      markSolved();
    }
  }

  function checkSolution() {
    if (isSolved) return;

    if (lettersEqual(letters.join(''), targetLetters)) {
      markSolved();
    } else {
      btnCheck.textContent = '不对，再试试';
      btnCheck.className = 'btn btn-warning';
      EventLogger.logSubmit('anagram', currentIndex + 1,
        { current: letters.join(''), target: targetLetters, steps: stepCount },
        false
      );
      setTimeout(function () {
        btnCheck.textContent = '检查答案';
        btnCheck.className = 'btn btn-secondary';
      }, 2000);
    }
  }

  // ========== 解法分类 ==========
  function classifySolutionMethod(actions) {
    if (!actions || actions.length === 0) return 'other';

    var hasGlobal = actions.some(function (a) {
      return a.indexOf('global_') === 0;
    });
    var hasIncDec = actions.some(function (a) {
      return a.indexOf('inc_') === 0 || a.indexOf('dec_') === 0;
    });

    if (hasGlobal && !hasIncDec) return 'global';     // 纯全局（捷径）
    if (hasIncDec && !hasGlobal) return 'incdec';     // 纯增减（惯性）
    return 'other';                                     // 混合
  }

  function updateInertiaStatus(phase, method) {
    if (phase !== 'inertia') return;

    inertiaPhaseResults.push(method);

    var incdecCount = inertiaPhaseResults.filter(function (m) {
      return m === 'incdec';
    }).length;

    inertiaBuilt = (incdecCount >= 2);
  }

  function markSolved() {
    isSolved = true;
    clearSkipTimer();
    subtleSkipBtn.style.display = 'none';

    var btns = document.querySelectorAll('#incDecCol .action-btn, #globalCol .action-btn');
    btns.forEach(function (b) { b.disabled = true; });

    var method = classifySolutionMethod(currentQuestionActions);
    var q = QUESTIONS[currentIndex];
    updateInertiaStatus(q.phase, method);

    var stepDesc = (method === 'global') ? (stepCount + ' 步 — 捷径！') : (stepCount + ' 步');
    btnCheck.textContent = '正确！' + stepDesc;
    btnCheck.className = 'btn btn-success';
    btnCheck.disabled = true;
    btnNext.disabled = false;

    EventLogger.logSubmit('anagram', currentIndex + 1, {
      steps: stepCount,
      method: method,
      inertiaBuilt: inertiaBuilt,
      phase: q.phase,
      shortcutExists: (q.phase === 'critical' || q.phase === 'recovery'),
      firstGlobalStep: firstGlobalStep,
      result: letters.join('')
    }, true);
  }

  // ========== 跳过 ==========
  function giveUp() {
    if (isGivingUp || isSolved) return;
    isGivingUp = true;
    clearSkipTimer();

    var btns = document.querySelectorAll('#incDecCol .action-btn, #globalCol .action-btn');
    btns.forEach(function (b) { b.disabled = true; });
    btnSkip.disabled = true;
    subtleSkipBtn.disabled = true;
    btnCheck.disabled = true;
    btnReset.disabled = true;

    var q = QUESTIONS[currentIndex];
    var shortcutExists = (q.phase === 'critical' || q.phase === 'recovery');
    var partialMethod = classifySolutionMethod(currentQuestionActions);
    if (q.phase === 'inertia') updateInertiaStatus(q.phase, partialMethod);

    EventLogger.logGiveUp('anagram', currentIndex + 1, {
      steps: stepCount,
      phase: q.phase,
      methodTendency: partialMethod,
      inertiaBuilt: inertiaBuilt,
      shortcutExists: shortcutExists,
      firstGlobalStep: firstGlobalStep,
      current: letters.join(''),
      target: targetLetters
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
    letters[0] = q.start[0];
    letters[1] = q.start[1];
    letters[2] = q.start[2];
    stepCount = 0;
    isSolved = false;
    isGivingUp = false;
    currentQuestionActions = [];
    firstGlobalStep = null;
    skipContainer.style.display = 'none';

    elStepCount.textContent = '0';
    btnCheck.textContent = '检查答案';
    btnCheck.className = 'btn btn-secondary';
    btnCheck.disabled = true;
    btnReset.disabled = true;
    btnNext.disabled = true;

    subtleSkipBtn.style.display = 'none';
    subtleSkipBtn.disabled = true;
    subtleSkipVisible = false;
    questionStartTime = Date.now();
    startSkipTimer();

    var btns = document.querySelectorAll('#incDecCol .action-btn, #globalCol .action-btn');
    btns.forEach(function (b) { b.disabled = false; });

    elCurA.textContent = letters[0];
    elCurB.textContent = letters[1];
    elCurC.textContent = letters[2];
    drawLetters();

    EventLogger.logReset('anagram', currentIndex + 1);
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

    EventLogger.logEvent('anagram', 0, 'survey_submit', surveyData);

    elPostSurvey.innerHTML = '<div class="survey-body" style="text-align:center; padding:var(--spacing-6) 0;">'
      + '<h3 style="margin-bottom:var(--spacing-2);">字母转换完成</h3>'
      + '<p class="text-sm text-muted" style="margin-bottom:var(--spacing-4);">数据已记录。</p>'
      + '<p class="text-sm text-muted">进入下一个谜题...</p>'
      + '</div>';

    // 数据保存在 localStorage，最终由完成页统一导出

    // 3 秒后自动跳转下一谜题
    setTimeout(function () {
      window.location.href = '../maze/maze.html';
    }, 3000);
  }

  function nextQuestion() {
    EventLogger.logPuzzleEnd('anagram', currentIndex + 1);

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

  // ========== Canvas 绘制 ==========
  function drawLetters() {
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var colors = ['#6366F1', '#10B981', '#F59E0B'];
    var slotNames = ['A', 'B', 'C'];

    // 目标标签
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 12px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    for (var i = 0; i < 3; i++) {
      var tx = 55 + i * 110;
      ctx.fillText('目标: ' + targetLetters[i], tx, 28);
    }

    // 三个字母块
    for (var i = 0; i < 3; i++) {
      var bx = 25 + i * 110;
      var by = 45;
      var bw = 80;
      var bh = 180;

      // 确定当前字母是否是目标
      var isCorrect = (letters[i] === targetLetters[i]);

      // 背景
      if (isCorrect && stepCount > 0) {
        ctx.fillStyle = '#D1FAE5';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 2;
      }

      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();

      // 大字显示当前字母
      ctx.fillStyle = colors[i];
      ctx.font = 'bold 48px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.fillText(letters[i], bx + bw / 2, by + 70);

      // 分隔线
      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by + 100);
      ctx.lineTo(bx + bw - 8, by + 100);
      ctx.stroke();

      // 位置标签
      ctx.fillStyle = '#A8A29E';
      ctx.font = 'bold 14px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('位置 ' + slotNames[i], bx + bw / 2, by + 125);

      // 正确标记
      if (isCorrect && stepCount > 0) {
        ctx.fillStyle = '#10B981';
        ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillText('已匹配', bx + bw / 2, by + 148);
      }

      // 当前字母值（底部小字）
      ctx.fillStyle = colors[i];
      ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('当前: ' + letters[i], bx + bw / 2, by + 168);
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
