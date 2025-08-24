// orchestrator.js
// Lightweight FSM: main → done
// Responsibilities: decide current question, allowed actions, follow-up count, whether to advance

export const WELCOME_TEXT =
  "Welcome to the study! We’re excited to learn about how you’ve used AI for job interviews and your thoughts on the ethical considerations involved. Your input will help researchers better understand this important and emerging use of AI in real-world contexts. There are no right or wrong answers; every experience you share will provide valuable insights.\n\nFirst of all, I’d like to learn a bit more about your background before we discuss your specific experiences using AI for job interviews.";

export function initState(session, { maxFollowups = { background: 0, main: 3 } } = {}) {
    if (!session.state) {
      session.state = {
        phase: "main",
        mainIdx: 0,
        allowedActions: new Set(["ASK_FOLLOWUP", "REQUEST_CLARIFY", "SUMMARIZE_QUESTION", "NEXT_QUESTION"]),// Allowed actions for main questions
        perQuestion: {},            // question -> { followups: number, lastScores: null }
        maxFollowups: { main: (maxFollowups?.main ?? 3) },
        lastAudit: null,
        lastPresence: null,
        styleHints: {},
        lastTags: [],               // NEW: latest orchestrator_tags from server (e.g., ["No_able_answer"])
        // Current question's "pending" follow-up (determined by server's next_followup)
        pendingFollowup: null,
        // Recent follow-up coverage (for debugging/visualization only)
        followupCoverage: []
      };
      
      // No need to call resetAllowedForQuestion since we already set the correct actions above
    }
    return session.state;
  }


  const TAG_TO_ACTION = {
    No_able_answer: "NEXT_QUESTION"
    };
    
    function tagsToActions(tags) {
    const out = new Set();
    if (Array.isArray(tags)) {
    for (const t of tags) {
    const act = TAG_TO_ACTION[t];
    if (act) out.add(act);
    }
    }
    return out;
    }

    function shouldAutoAdvanceByTags(state) {
    return tagsToActions(state?.lastTags).has("NEXT_QUESTION");
    }

    function wantsImmediateNext(state, completionAuditVerdict) {
    return completionAuditVerdict === "ALLOW_NEXT_QUESTION" || shouldAutoAdvanceByTags(state);
    }

    function applyTagActionMapping(state) {
    const acts = tagsToActions(state?.lastTags);
    if (acts.has("NEXT_QUESTION")) {
    clearPendingFollowup(state);
    // Allow "next question/summary", consistent with ALLOW_NEXT_QUESTION behavior
    state.allowedActions = new Set(["NEXT_QUESTION", "SUMMARIZE_QUESTION"]);
    
    // Add logging for debugging tag action mapping
    if (state?.lastTags?.includes("No_able_answer")) {
      console.log("🔍 [ORCHESTRATOR] Tag action mapping applied for No_able_answer:", {
        tags: state.lastTags,
        actions: Array.from(acts),
        newAllowedActions: Array.from(state.allowedActions),
        timestamp: new Date().toISOString()
      });
    }
  }
}
  
// Tag helper
export function hasTag(state, tag) {
  return Array.isArray(state?.lastTags) && state.lastTags.includes(tag);
}

  export function getCurrentQuestion(state, mainQuestions) {
    if (state.phase === "main") return mainQuestions[state.mainIdx] || null;
    return null;
  }
  
  
  export function isFinalQuestion(state, mainQuestions) {
    return state.phase === "main" && state.mainIdx === mainQuestions.length - 1;
  }
  
  export function atFollowupCap(state, question) {
    const cap = state.maxFollowups.main;
    const cur = state.perQuestion[question]?.followups || 0;
    return cur >= cap;
  }

  export function hasPendingFollowup(state) {
    return !!(state?.pendingFollowup && state.pendingFollowup.prompt);
  }
  export function clearPendingFollowup(state) {
    state.pendingFollowup = null;
  }
  
  export function registerFollowup(state, question) {
    if (!state.perQuestion[question]) state.perQuestion[question] = { followups: 0, lastScores: null };
    state.perQuestion[question].followups += 1;
  }
  
  export function recordScores(state, question, scores) {
    if (!state.perQuestion[question]) state.perQuestion[question] = { followups: 0, lastScores: null };
    state.perQuestion[question].lastScores = scores || null;
  }
  
  export function resetAllowedForQuestion(state) {
    // Main questions can have follow-ups
    // If there's a pending follow-up (determined by server's next_followup), only allow asking that follow-up
    if (hasPendingFollowup(state)) {
      state.allowedActions = new Set(["ASK_FOLLOWUP"]);
    } else {
      state.allowedActions = new Set(["ASK_FOLLOWUP", "REQUEST_CLARIFY", "SUMMARIZE_QUESTION", "NEXT_QUESTION"]);

    }
  }
  
  export function buildAllowedActionsForPrompt(state) {
     return hasPendingFollowup(state) ? ["ASK_FOLLOWUP"] : Array.from(state.allowedActions);
  }
    
// Audit gating: if completion audit passes, allow asking follow-ups; otherwise disable them
 export function allowNextIfAuditPass(state, completionAuditVerdict) {
    // Use the helper function to determine if we should immediately advance to next question (supports verdict or tag)
    if (wantsImmediateNext(state, completionAuditVerdict)) {
      clearPendingFollowup(state);
      state.allowedActions = new Set(["NEXT_QUESTION", "SUMMARIZE_QUESTION"]);
      return;
    }
    // Audit failed: if there's a pending follow-up, only allow ASK_FOLLOWUP; otherwise allow regular clarification
    if (hasPendingFollowup(state)) {
      state.allowedActions = new Set(["ASK_FOLLOWUP"]);
    } else {
      state.allowedActions = new Set(["ASK_FOLLOWUP", "REQUEST_CLARIFY"]);
    }
  }
  
  // After passing the final question, allow follow-ups first, then end when ready to advance
  export function finalizeIfLastAndPassed(state, mainQuestions, completionAuditVerdict) {
    // Don't immediately restrict actions on final question - allow follow-ups first
    // The interview will end naturally when shouldAdvance is true and there are no more questions
    // This allows the final question to have follow-ups like any other question
  }
  
  // Based on audit, decide whether to advance; we use "audit-first", only advance when ALLOW_NEXT_QUESTION
  export function shouldAdvance(completionAuditVerdict, state, question, session = null, mainQuestions = [], areAllFollowupsCoveredFn = null) {
    // For the final question, require ALL follow-ups to be covered before advancing
    const isFinal = isFinalQuestion(state, mainQuestions);
    if (isFinal && session && areAllFollowupsCoveredFn) {
      // For final question, ignore skip flags and only advance if all follow-ups are covered
      return areAllFollowupsCoveredFn(session, question);
    }
    
    // For non-final questions, use the existing logic
    const pass = wantsImmediateNext(state, completionAuditVerdict);
    const skipped = !!(state?.perQuestion?.[question]?.skip);
    return pass || skipped;
  }
  
  // Move to the next question; main questions run into done
  export function gotoNextQuestion(state, mainQuestions) {
    if (state.phase === "main") {
      state.mainIdx += 1;
      if (state.mainIdx >= mainQuestions.length) {
        state.phase = "done";
      }
    }
    // After entering the next question, reset allowed actions and per-question follow-up count
    clearPendingFollowup(state);
    getCurrentQuestion(state, mainQuestions);
    resetAllowedForQuestion(state);
  }
  
  export function storeAudits(state, { completionAudit, presenceAudit }) {
    state.lastAudit = completionAudit || null;
    state.lastPresence = presenceAudit || null;
    // NEW: Sync follow-up coverage state and next pending follow-up (align with server audit result)
    if (completionAudit?.coverage_map) {
      state.followupCoverage = completionAudit.coverage_map;
    }
    if (completionAudit?.next_followup && completionAudit.next_followup.prompt) {
      state.pendingFollowup = {
        id: completionAudit.next_followup.id,
        prompt: completionAudit.next_followup.prompt
      };
    } else if (completionAudit?.verdict === "ALLOW_NEXT_QUESTION") {
      clearPendingFollowup(state);
    }
  }

// NEW: overload with tags (keep backward compatibility - if caller passes orchestrator_tags, write to lastTags and clear pending)
export function storeAuditsWithTags(state, { completionAudit, presenceAudit, orchestrator_tags } = {}) {
  storeAudits(state, { completionAudit, presenceAudit });
  if (Array.isArray(orchestrator_tags)) {
    state.lastTags = orchestrator_tags;
    
    // Add logging for debugging "No_able_answer" tag
    if (orchestrator_tags.includes("No_able_answer")) {
      console.log("🔍 [ORCHESTRATOR] No_able_answer tag detected:", {
        tags: orchestrator_tags,
        timestamp: new Date().toISOString(),
        sessionState: {
          phase: state.phase,
          mainIdx: state.mainIdx,
          allowedActions: Array.from(state.allowedActions || [])
        }
      });
    }
    
    applyTagActionMapping(state);
  }
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
  export function enforceAllowedAction(state, parsed, currentQuestion) {
    if (!parsed || !parsed.action) return parsed;

    // If the follow-up cap is reached, do not ask follow-ups
     if (!hasPendingFollowup(state) && parsed.action === "ASK_FOLLOWUP" && currentQuestion && atFollowupCap(state, currentQuestion)) {

      parsed.action = state.allowedActions.has("SUMMARIZE_QUESTION")
        ? "SUMMARIZE_QUESTION"
        : (state.allowedActions.has("REQUEST_CLARIFY") ? "REQUEST_CLARIFY" : "NEXT_QUESTION");
    }

    // If the tag mapping points to NEXT_QUESTION, do not allow further follow-ups
    if (!hasPendingFollowup(state) && parsed.action === "ASK_FOLLOWUP" && shouldAutoAdvanceByTags(state)) {


      parsed.action = state.allowedActions.has("SUMMARIZE_QUESTION")
      ? "SUMMARIZE_QUESTION"
      : (state.allowedActions.has("NEXT_QUESTION") ? "NEXT_QUESTION" : "REQUEST_CLARIFY");
    }

    
    if (hasPendingFollowup(state)) {
      parsed.action = "ASK_FOLLOWUP";
    }
    if (!state.allowedActions.has(parsed.action)) {
// Fallback priority: REQUEST_CLARIFY > SUMMARIZE_QUESTION > NEXT_QUESTION
      if (state.allowedActions.has("REQUEST_CLARIFY")) parsed.action = "REQUEST_CLARIFY";
      else if (state.allowedActions.has("SUMMARIZE_QUESTION")) parsed.action = "SUMMARIZE_QUESTION";
      else if (state.allowedActions.has("NEXT_QUESTION")) parsed.action = "NEXT_QUESTION";
      else parsed.action = Array.from(state.allowedActions)[0] || "REQUEST_CLARIFY";
   }
    
    return parsed;
  }
  

  // ---- Compose a single assistant message that always includes the question ----
  const BRIDGES = ["Thanks—that helps.", "Got it, that’s helpful.", "Appreciate the detail.", "That makes sense."];
  function bridge() { return BRIDGES[Math.floor(Math.random() * BRIDGES.length)]; }
  
  function ensureEndsWithQuestion(s) {
    const base = (s || "").trim();
    if (!base) return "?";
    const qIdx = base.indexOf("?");
    if (qIdx >= 0) return base.slice(0, qIdx + 1); // keep up to the first '?'
    return base + "?";
  }
  function stripAllQuestions(s) { return (s || "").replace(/\?/g, "."); }
  function nextQuestionLine(q) {
    if (!q) return "";
    const t = q.trim();
    return t.endsWith("?") ? t : (t + "?");
  }
  
  // styleHints: { prefer_transition, gentle_tone, ask_outcome_only_if_event, skip_if_no_experience, avoid_outcome_for_background_only }
  export function composeAssistantMessage(state, parsed, ctx) {
    const {
      currentQuestion, nextQuestion, styleHints = {}, isFirstAssistantReply = false,
      welcomeText // welcome text
    } = ctx || {};
    // On the first round: send welcome + the first question in ONE message.
    // Be robust to callers that pass only currentQuestion (not nextQuestion).
    if (isFirstAssistantReply && parsed?.action === "NEXT_QUESTION" && welcomeText) {
      const firstQ = nextQuestion || currentQuestion;
      if (firstQ) return `${welcomeText}\n\n${nextQuestionLine(firstQ)}`;
    }

    const addBridge = styleHints.prefer_transition && !hasPendingFollowup(state);
    const pref = addBridge ? (bridge() + " ") : "";
    const action = parsed?.action || "REQUEST_CLARIFY";
    let utter = (parsed?.utterance || "").trim();

    // If there's a pending follow-up, override utterance to ensure "only ask that"
    if (hasPendingFollowup(state)) {
      const fu = state.pendingFollowup?.prompt || "";
      if (fu) {
        utter = fu;
      }
      // Return the original follow-up question without any prefix/suffix,
      // and let the server's polishFollowupConnectors add the connector, ensuring "not changing the follow-up question itself"
      const q = ensureEndsWithQuestion((utter || "").trim());
      return q;
    }

    if (action === "NEXT_QUESTION") {
      return `${pref}Next question:\n${nextQuestionLine(nextQuestion)}`;
    }

    if (action === "SUMMARIZE_QUESTION") {
      // If allowed/about to advance: summary (no question mark) + next question (same message)
      if (state.allowedActions?.has("NEXT_QUESTION") && nextQuestion) {
        const recap = stripAllQuestions(utter || "Quick recap:");
        return `${pref}${recap}\n\nNext question:\n${nextQuestionLine(nextQuestion)}`;
      }
      // Otherwise: convert summary to lightweight clarification question (single question mark)
      return `${pref}${ensureEndsWithQuestion(utter || "Could you clarify a bit more about that")}`;
    }

    if (action === "ASK_FOLLOWUP" || action === "REQUEST_CLARIFY") {
      // If the tag-action mapping points to NEXT_QUESTION, but still falls into ask follow-up/clarify path, do a lightweight transition and enter the next question
      if (!hasPendingFollowup(state) && shouldAutoAdvanceByTags(state) && nextQuestion) {
        // Use a transition + directly enter the next question to avoid digging into non-existent experiences
        return `${pref}Thanks—that’s clear.\n\nNext question:\n${nextQuestionLine(nextQuestion)}`;
      }
      return `${pref}${ensureEndsWithQuestion(utter || "Could you share a specific example")}`;
    }

    if (action === "END") {
      return "Thanks so much—that’s all we need for now.";
    }
    // fallback
    return `${pref}${ensureEndsWithQuestion(utter || "Could you tell me a bit more")}`;
  }

  export function applyHeuristicsFromAudits(state, question, { completionAudit, presenceAudit } = {}, mainQuestions = [], session = null, areAllFollowupsCoveredFn = null) {
    const noExp = !!(presenceAudit?.no_experience || completionAudit?.no_experience || shouldAutoAdvanceByTags(state));


    const backgroundOnly = !!(presenceAudit?.background_only);
    
    if (noExp) {
        // For the final question, don't skip if there are uncovered follow-ups
        const isFinal = isFinalQuestion(state, mainQuestions);
        const shouldSkipFinalQuestion = !isFinal || (areAllFollowupsCoveredFn && areAllFollowupsCoveredFn(session, question));
        
        if (shouldSkipFinalQuestion) {
            // Skip this question: only allow advancing/transitioning to summary
            state.allowedActions = new Set(["NEXT_QUESTION", "SUMMARIZE_QUESTION"]);
            state.perQuestion[question] = { ...(state.perQuestion[question]||{}), skip: true };
            clearPendingFollowup(state);
        }
    }
    state.styleHints = {
        ...state.styleHints,
        prefer_transition: true,
        gentle_tone: true,
        ask_outcome_only_if_event: true,
        skip_if_no_experience: true,
        avoid_outcome_for_background_only: backgroundOnly || false
    };
  }
    
  export function buildOrchestratorDirectives(state) {
    return {
      allowedActions: buildAllowedActionsForPrompt(state),
      styleHints: state.styleHints || {},
      // Pass pending follow-up explicitly to executor prompt constructor (if you use it in server)
      pendingFollowup: hasPendingFollowup(state) ? { ...state.pendingFollowup } : null,
      // pass tags to downstream prompt builders/executors if needed
      tags: Array.isArray(state.lastTags) ? [...state.lastTags] : []
    };
  }

export function peekNextQuestion(state, mainQuestions) {
      const idx = (state.mainIdx ?? 0) + 1;
      return mainQuestions?.[idx] || null;
    }