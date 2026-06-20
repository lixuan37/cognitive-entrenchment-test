/**
 * event-logger.js — 认知固着度测试 事件追踪模块
 * Cognitive Entrenchment Test — Event Logger
 *
 * 职责：
 *   1. 记录用户在所有谜题中的每一步操作
 *   2. 存储到 localStorage（防止中途刷新丢失）
 *   3. 完成测试后导出为 JSON 文件
 *
 * 事件格式（每条操作一个 JSON 对象）：
 * {
 *   userId: string,
 *   puzzleId: "water_jug" | "anagram" | "maze" | "sequence",
 *   questionId: number,
 *   timestamp: number (Unix ms),
 *   eventType: "action" | "submit" | "reset" | "hint_view" | "idle" | "puzzle_start" | "puzzle_end",
 *   actionData: object | null,
 *   correct: boolean | null,
 *   latency: number (ms since last event)
 * }
 */

(function () {
  'use strict';

  // ========== 内部状态 ==========
  let _session = null;       // 当前会话信息
  let _events = [];           // 所有已记录的事件
  let _lastEventTime = 0;    // 上一个事件的时间戳

  const STORAGE_KEY = 'ce_events';

  // ========== 初始化 ==========

  /**
   * 开始一个新会话
   * @param {string} userId - 参与者编号，如 "participant_01"
   */
  function initSession(userId) {
    _session = {
      userId: userId,
      startedAt: Date.now(),
      completedAt: null
    };
    _events = [];
    _lastEventTime = Date.now();
    _saveToStorage();
  }

  /**
   * 恢复之前的会话（从 localStorage）
   * @returns {object|null} 会话信息，如果没有则返回 null
   */
  function resumeSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      _session = data.session;
      _events = data.events || [];
      _lastEventTime = _events.length > 0
        ? _events[_events.length - 1].timestamp
        : (_session ? _session.startedAt : Date.now());
      return _session;
    } catch (e) {
      console.warn('[EventLogger] 无法恢复会话，数据已损坏', e);
      return null;
    }
  }

  /**
   * 获取当前会话
   */
  function getSession() {
    return _session;
  }

  // ========== 事件记录 ==========

  /**
   * 记录一个事件
   * @param {string} puzzleId - 谜题 ID
   * @param {number} questionId - 题目编号（从 1 开始）
   * @param {string} eventType - 事件类型
   * @param {object|null} actionData - 动作详情（可选）
   * @param {boolean|null} correct - 是否正确（仅 submit 事件使用）
   */
  function logEvent(puzzleId, questionId, eventType, actionData, correct) {
    const now = Date.now();
    const latency = now - _lastEventTime;
    _lastEventTime = now;

    const event = {
      userId: _session ? _session.userId : 'unknown',
      puzzleId: puzzleId,
      questionId: questionId,
      timestamp: now,
      eventType: eventType,
      actionData: actionData || null,
      correct: correct !== undefined ? correct : null,
      latency: latency
    };

    _events.push(event);
    _saveToStorage();
    return event;
  }

  // ---- 便捷方法 ----

  /** 开始一道题 */
  function logPuzzleStart(puzzleId, questionId) {
    return logEvent(puzzleId, questionId, 'puzzle_start', null);
  }

  /** 结束一道题 */
  function logPuzzleEnd(puzzleId, questionId) {
    return logEvent(puzzleId, questionId, 'puzzle_end', null);
  }

  /** 记录一个操作动作 */
  function logAction(puzzleId, questionId, actionType, stateAfter) {
    const actionIndex = _events.filter(function (e) {
      return e.puzzleId === puzzleId && e.questionId === questionId && e.eventType === 'action';
    }).length;

    return logEvent(puzzleId, questionId, 'action', {
      actionIndex: actionIndex,
      actionType: actionType,
      stateAfter: stateAfter
    });
  }

  /** 记录提交 */
  function logSubmit(puzzleId, questionId, answerData, correct) {
    return logEvent(puzzleId, questionId, 'submit', answerData, correct);
  }

  /** 记录重置 */
  function logReset(puzzleId, questionId) {
    return logEvent(puzzleId, questionId, 'reset', null);
  }

  /** 记录查看提示 */
  function logHintView(puzzleId, questionId) {
    return logEvent(puzzleId, questionId, 'hint_view', null);
  }

  /** 记录空闲（长时间无操作） */
  function logIdle(puzzleId, questionId, duration) {
    return logEvent(puzzleId, questionId, 'idle', { duration: duration });
  }

  /** 记录跳过题目 */
  function logSkip(puzzleId, questionId) {
    return logEvent(puzzleId, questionId, 'action', { actionType: 'skip' });
  }

  /** 记录放弃（give_up — 认知固着度的最强证据） */
  function logGiveUp(puzzleId, questionId, meta) {
    return logEvent(puzzleId, questionId, 'give_up', meta || {});
  }

  // ========== 查询 ==========

  /** 获取所有事件 */
  function getAllEvents() {
    return _events.slice();
  }

  /** 获取某个谜题的所有事件 */
  function getPuzzleEvents(puzzleId) {
    return _events.filter(function (e) { return e.puzzleId === puzzleId; });
  }

  /** 获取某道题的所有事件 */
  function getQuestionEvents(puzzleId, questionId) {
    return _events.filter(function (e) {
      return e.puzzleId === puzzleId && e.questionId === questionId;
    });
  }

  /** 获取事件数量 */
  function getEventCount() {
    return _events.length;
  }

  // ========== 导出 ==========

  /**
   * 完成测试，导出 JSON 并清理 localStorage
   */
  function finishSession() {
    if (!_session) return;

    _session.completedAt = Date.now();

    // 移除所有 localStorage 数据
    localStorage.removeItem(STORAGE_KEY);

    // 返回完整数据供下载
    return {
      session: _session,
      events: _events,
      metadata: {
        totalEvents: _events.length,
        puzzlesCompleted: _getUniquePuzzles(),
        duration: _session.completedAt - _session.startedAt
      }
    };
  }

  /**
   * 触发浏览器下载 JSON 文件（不清空会话，用于中间谜题导出）
   * @param {string} filename - 可选文件名前缀
   */
  function downloadJSON(filename) {
    if (!_session) {
      console.error('[EventLogger] 无会话数据');
      return;
    }

    // 只导出当前数据，不清空 localStorage（会话仍继续）
    var data = {
      session: _session,
      events: _events,
      metadata: {
        totalEvents: _events.length,
        puzzlesCompleted: _getUniquePuzzles(),
        duration: Date.now() - _session.startedAt
      }
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (filename || _session.userId) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 完成全部测试，导出 JSON 并清理 localStorage（仅在最后一个谜题调用）
   */
  function downloadJSONAndFinish(filename) {
    if (!_session) {
      console.error('[EventLogger] 无会话数据');
      return;
    }

    _session.completedAt = Date.now();
    localStorage.removeItem(STORAGE_KEY);

    var data = {
      session: _session,
      events: _events,
      metadata: {
        totalEvents: _events.length,
        puzzlesCompleted: _getUniquePuzzles(),
        duration: _session.completedAt - _session.startedAt
      }
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (filename || _session.userId) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出为 JSON 字符串（不下载，供其他模块使用）
   */
  function exportJSON() {
    if (!_session) return '{}';

    var data = {
      session: _session,
      events: _events
    };
    return JSON.stringify(data, null, 2);
  }

  // ========== 内部方法 ==========

  function _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        session: _session,
        events: _events
      }));
    } catch (e) {
      console.warn('[EventLogger] localStorage 写入失败，可能空间不足', e);
    }
  }

  function _getUniquePuzzles() {
    var seen = {};
    _events.forEach(function (e) {
      seen[e.puzzleId] = true;
    });
    return Object.keys(seen);
  }

  // ========== 公开 API ==========
  window.EventLogger = {
    // 会话管理
    initSession: initSession,
    resumeSession: resumeSession,
    getSession: getSession,

    // 事件记录
    logEvent: logEvent,
    logPuzzleStart: logPuzzleStart,
    logPuzzleEnd: logPuzzleEnd,
    logAction: logAction,
    logSubmit: logSubmit,
    logReset: logReset,
    logHintView: logHintView,
    logIdle: logIdle,
    logSkip: logSkip,
    logGiveUp: logGiveUp,

    // 查询
    getAllEvents: getAllEvents,
    getPuzzleEvents: getPuzzleEvents,
    getQuestionEvents: getQuestionEvents,
    getEventCount: getEventCount,

    // 导出
    finishSession: finishSession,
    downloadJSON: downloadJSON,
    downloadJSONAndFinish: downloadJSONAndFinish,
    exportJSON: exportJSON
  };

})();
