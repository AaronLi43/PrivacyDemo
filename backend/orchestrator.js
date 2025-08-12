// orchestrator.js
// Lightweight FSM: background → main → done
// Responsibilities: decide current question, allowed actions, follow-up count, whether to advance

export function initState(session, { maxFollowups = { background: 0, main: 3 } } = {}) {
    if (!session.state) {
      session.state = {
        phase: "background",        // "background" | "main" | "done"
        bgIdx: 0,
        mainIdx: 0,
        allowedActions: new Set(["REQUEST_CLARIFY", "SUMMARIZE_QUESTION", "NEXT_QUESTION"]), // Background questions start with NEXT_QUESTION allowed
        perQuestion: {},            // question -> { followups: number, lastScores: null }
        maxFollowups: { ...maxFollowups }, // Ensure we copy the values
        lastAudit: null,
        lastPresence: null
      };
      
      // Initialize allowed actions based on the current question type
      const isBackgroundQuestion = true; // We start in background phase
      resetAllowedForQuestion(session.state, isBackgroundQuestion);
    }
    return session.state;
  }
  
  export function getCurrentQuestion(state, backgroundQuestions, mainQuestions) {
    if (state.phase === "background") return backgroundQuestions[state.bgIdx] || null;
    if (state.phase === "main") return mainQuestions[state.mainIdx] || null;
    return null;
  }
  
  export function isBackgroundPhase(state) {
    return state.phase === "background";
  }
  
  export function isFinalQuestion(state, mainQuestions) {
    return state.phase === "main" && state.mainIdx === mainQuestions.length - 1;
  }
  
  export function atFollowupCap(state, question) {
    const cap = isBackgroundPhase(state) ? state.maxFollowups.background : state.maxFollowups.main;
    const cur = state.perQuestion[question]?.followups || 0;
    return cur >= cap;
  }
  
  export function registerFollowup(state, question) {
    if (!state.perQuestion[question]) state.perQuestion[question] = { followups: 0, lastScores: null };
    state.perQuestion[question].followups += 1;
  }
  
  export function recordScores(state, question, scores) {
    if (!state.perQuestion[question]) state.perQuestion[question] = { followups: 0, lastScores: null };
    state.perQuestion[question].lastScores = scores || null;
  }
  
  export function resetAllowedForQuestion(state, isBackgroundQuestion = false) {
    if (isBackgroundQuestion) {
      // Background questions should not allow follow-ups - only allow moving to next question
      state.allowedActions = new Set(["REQUEST_CLARIFY", "SUMMARIZE_QUESTION", "NEXT_QUESTION"]);
      // Ensure NEXT_QUESTION is always available for background questions
      state.allowedActions.add("NEXT_QUESTION");
    } else {
      // Main questions can have follow-ups
      state.allowedActions = new Set(["ASK_FOLLOWUP", "REQUEST_CLARIFY", "SUMMARIZE_QUESTION"]);
    }
  }
  
  export function buildAllowedActionsForPrompt(state) {
    return Array.from(state.allowedActions);
  }
    
// Audit access: as long as the PSS audit passes, allow NEXT_QUESTION; otherwise remove
  export function allowNextIfAuditPass(state, completionAuditVerdict) {
    if (completionAuditVerdict === "ALLOW_NEXT_QUESTION") {
      state.allowedActions.add("NEXT_QUESTION");
    } else {
      state.allowedActions.delete("NEXT_QUESTION");
    }
  }
  
  // After passing the final question, switch to summary/end actions
  export function finalizeIfLastAndPassed(state, mainQuestions, completionAuditVerdict) {
    if (completionAuditVerdict === "ALLOW_NEXT_QUESTION" && isFinalQuestion(state, mainQuestions)) {
      state.allowedActions = new Set(["SUMMARIZE_QUESTION", "END"]);
    }
  }
  
  // Based on audit, decide whether to advance; we use "audit-first", only advance when ALLOW_NEXT_QUESTION
  export function shouldAdvance(completionAuditVerdict) {
    return completionAuditVerdict === "ALLOW_NEXT_QUESTION";
  }
  
  // Move to the next question; background runs automatically into main questions; main questions run into done
  export function gotoNextQuestion(state, backgroundQuestions, mainQuestions) {
    if (state.phase === "background") {
      state.bgIdx += 1;
      if (state.bgIdx >= backgroundQuestions.length) {
        state.phase = "main";
      }
    } else if (state.phase === "main") {
      state.mainIdx += 1;
      if (state.mainIdx >= mainQuestions.length) {
        state.phase = "done";
      }
    }
    // After entering the next question, reset allowed actions and per-question follow-up count
    const nextQuestion = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
    const isNextBackground = backgroundQuestions.includes(nextQuestion);
    resetAllowedForQuestion(state, isNextBackground);
  }
  
  export function storeAudits(state, { completionAudit, presenceAudit }) {
    state.lastAudit = completionAudit || null;
    state.lastPresence = presenceAudit || null;
  }
  
  // Parse Executor's JSON output (with error tolerance) and perform basic action validation
  export function parseExecutorOutput(text) {
    let t = (text || "").trim();
    if (t.startsWith("```")) t = t.replace(/^```json?\s*/i, "").replace(/```$/i, "").trim();
    try {
      const obj = JSON.parse(t);
      // Only keep the key fields
      return {
        action: obj.action || null,
        question_id: obj.question_id || null,
        utterance: obj.utterance || "",
        notes: Array.isArray(obj.notes) ? obj.notes : []
      };
    } catch {
      return null;
    }
  }
  
  // Check if the current action is allowed; if not, force back to allowed actions
  export function enforceAllowedAction(state, parsed) {
    if (!parsed || !parsed.action) return parsed;
    if (!state.allowedActions.has(parsed.action)) {
      // Deterministic fallback strategy: prefer NEXT_QUESTION for background questions, ASK_FOLLOWUP for main questions
      if (state.allowedActions.has('NEXT_QUESTION')) {
        parsed.action = 'NEXT_QUESTION';
      } else if (state.allowedActions.has('ASK_FOLLOWUP')) {
        parsed.action = 'ASK_FOLLOWUP';
      } else {
        // Fallback to first available action
        parsed.action = Array.from(state.allowedActions)[0] || "SUMMARIZE_QUESTION";
      }
    }
    return parsed;
  }
  