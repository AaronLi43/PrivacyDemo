import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bodyParser from 'body-parser';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Debug environment variables
console.log('🔧 Environment variables loaded:');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 PORT:', process.env.PORT);
console.log('🔧 CORS_ORIGINS:', process.env.CORS_ORIGINS);
console.log('🔧 Process ID:', process.pid);
console.log('🔧 Current working directory:', process.cwd());
console.log('🔧 Node version:', process.version);

// CORS debugging
console.log('🔧 CORS Debug Mode:', process.env.CORS_DEBUG === 'true' ? 'ENABLED' : 'DISABLED');
if (process.env.CORS_DEBUG === 'true') {
    console.log('🔧 CORS Debug: All origins will be allowed for debugging');
}

import {
    WELCOME_TEXT,
    initState, getCurrentQuestion, peekNextQuestion,
    hasPendingFollowup, atFollowupCap, clearPendingFollowup,
    storeAudits, applyHeuristicsFromAudits,
    allowNextIfAuditPass, finalizeIfLastAndPassed,
    shouldAdvance, gotoNextQuestion,
    parseExecutorOutput, enforceAllowedAction,
    composeAssistantMessage, buildOrchestratorDirectives,
    buildAllowedActionsForPrompt,
    isFinalQuestion,
    recordScores
} from './orchestrator.js';



// OpenAI API
import OpenAI from 'openai';

// AWS SDK
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize OpenAI
let openaiClient;
try {
    if (process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI initialized successfully');
    } else {
        console.log('⚠️  OPENAI_API_KEY not found, using fallback responses');
    }
} catch (error) {
    console.log('⚠️  Failed to initialize OpenAI, using fallback responses:', error.message);
}

// Initialize AWS S3 Client
let s3Client;
try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        s3Client = new S3Client({
            region: 'us-east-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        console.log('✅ AWS S3 client initialized successfully');
    } else {
        console.log('⚠️  AWS credentials not found, S3 uploads will be disabled');
    }
} catch (error) {
    console.log('⚠️  Failed to initialize AWS S3 client:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Audit LLM configuration
const ENABLE_AUDIT_LLM = true; // Always enable audit LLM for all modes in the study
console.log(`🔍 Audit LLM: ${ENABLE_AUDIT_LLM ? 'ENABLED' : 'DISABLED'}`);

// Global mode configuration
let currentMode = 'chat';

// Lightweight logger factory to standardize route/request logs
function makeLogger({ route = 'unknown', requestId = '-' } = {}) {
    function prefix() {
        return `[${new Date().toISOString()}][${route}][${requestId}]`;
    }
    return {
        info(message, meta) {
            if (meta !== undefined) {
                console.log('ℹ️', prefix(), message, meta);
            } else {
                console.log('ℹ️', prefix(), message);
            }
        },
        warn(message, meta) {
            if (meta !== undefined) {
                console.warn('⚠️', prefix(), message, meta);
            } else {
                console.warn('⚠️', prefix(), message);
            }
        },
        error(message, meta) {
            if (meta !== undefined) {
                console.error('❌', prefix(), message, meta);
            } else {
                console.error('❌', prefix(), message);
            }
        },
        debug(message, meta) {
            if (meta !== undefined) {
                console.log('🐛', prefix(), message, meta);
            } else {
                console.log('🐛', prefix(), message);
            }
        }
    };
}

// CORS configuration
let corsOrigins = process.env.CORS_ORIGINS ? 
    process.env.CORS_ORIGINS.split(',') : 
    [
        'https://privacy-demo-flame.vercel.app',
        'https://privacy-demo-git-main-privacy-demo-flame.vercel.app',
        'https://privacy-demo-flame-git-main-privacy-demo-flame.vercel.app',
        'https://privacy-demo-flame-git-feature-privacy-demo-flame.vercel.app',
        'https://privacy-demo-flame-git-develop-privacy-demo-flame.vercel.app',
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:3000'
    ];

console.log('🔧 CORS origins configured:', corsOrigins);
console.log('🔧 Environment CORS_ORIGINS:', process.env.CORS_ORIGINS);
console.log('🔧 Request origin will be logged for debugging');

// Ensure corsOrigins is always an array
if (!Array.isArray(corsOrigins)) {
    console.log('⚠️  CORS_ORIGINS is not an array, using default');
    corsOrigins = [
        'https://privacy-demo-flame.vercel.app',
        'https://privacy-demo-git-main-privacy-demo-flame.vercel.app',
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:3000'
    ];
}

// Enhanced CORS middleware with dynamic origin handling
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('🔧 CORS: Request with no origin, allowing');
            return callback(null, true);
        }
        
        // Check if origin is in our allowed list
        if (corsOrigins.includes(origin)) {
            console.log('🔧 CORS: Origin allowed:', origin);
            return callback(null, true);
        }
        
        // Check for Vercel preview deployments (dynamic subdomains)
        if (origin.includes('vercel.app') && origin.includes('privacy-demo')) {
            console.log('🔧 CORS: Vercel preview deployment allowed:', origin);
            return callback(null, true);
        }
        
        // Additional check for the specific Vercel domain mentioned in the error
        if (origin === 'https://privacy-demo-flame.vercel.app') {
            console.log('🔧 CORS: Specific Vercel domain allowed:', origin);
            return callback(null, true);
        }
        
        // Fallback: Allow all Vercel domains for this project
        if (origin.includes('vercel.app') && origin.includes('privacy-demo')) {
            console.log('🔧 CORS: Vercel domain fallback allowed:', origin);
            return callback(null, true);
        }
        
        // CORS Debug Mode: Allow all origins when debugging
        if (process.env.CORS_DEBUG === 'true') {
            console.log('🔧 CORS Debug: Allowing origin in debug mode:', origin);
            return callback(null, true);
        }
        
        console.log('🔧 CORS: Origin blocked:', origin);
        console.log('🔧 CORS: Allowed origins:', corsOrigins);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    optionsSuccessStatus: 200,
    preflightContinue: false
}));

console.log('🔧 CORS middleware applied with origins:', corsOrigins);
console.log('🔧 CORS middleware configuration:', {
    origin: 'Dynamic function-based origin checking',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    optionsSuccessStatus: 200
});

// Handle preflight requests explicitly
app.options('*', cors({
    origin: function (origin, callback) {
        // Allow requests with no origin
        if (!origin) {
            return callback(null, true);
        }
        
        // Check if origin is in our allowed list
        if (corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Check for Vercel preview deployments
        if (origin.includes('vercel.app') && origin.includes('privacy-demo')) {
            return callback(null, true);
        }
        
        // Additional check for the specific Vercel domain
        if (origin === 'https://privacy-demo-flame.vercel.app') {
            return callback(null, true);
        }
        
        // CORS Debug Mode: Allow all origins when debugging
        if (process.env.CORS_DEBUG === 'true') {
            console.log('🔧 CORS Debug: Allowing origin in preflight debug mode:', origin);
            return callback(null, true);
        }
        
        return callback(null, true); // Allow all for preflight
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    optionsSuccessStatus: 200
}));

// Log all requests for debugging
app.use((req, res, next) => {
    console.log(`🔧 Request: ${req.method} ${req.path} from origin: ${req.headers.origin}`);
    console.log(`🔧 CORS Headers:`, {
        origin: req.headers.origin,
        'access-control-request-method': req.headers['access-control-request-method'],
        'access-control-request-headers': req.headers['access-control-request-headers'],
        'user-agent': req.headers['user-agent']
    });
    
    // Set CORS headers for all responses as a fallback
    if (req.headers.origin) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    }
    
    next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Test route to verify CORS is working
app.get('/api/test-cors', (req, res) => {
    console.log('🔧 Test CORS route hit from origin:', req.headers.origin);
    
    // Set CORS headers explicitly for this endpoint
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    
    res.json({ 
        message: 'CORS test successful', 
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
        corsOrigins: corsOrigins,
        serverTime: new Date().toISOString()
    });
});

// CORS debug endpoint
app.get('/api/cors-debug', (req, res) => {
    res.json({
        message: 'CORS Debug Information',
        requestOrigin: req.headers.origin,
        allowedOrigins: corsOrigins,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        serverTime: new Date().toISOString()
    });
});

// Health check route
app.get('/', (req, res) => {
    console.log('🔧 Health check request received');
    res.json({ 
        status: 'OK', 
        message: 'Privacy Demo Backend API is running',
        timestamp: new Date().toISOString(),
        corsOrigins: corsOrigins,
        serverTime: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Session-based conversation management
const sessions = new Map(); // Store conversations by session ID

// Helper function to get or create session
function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            conversationHistory: [],
            currentMode: 'chat',
            uploadedQuestions: [],
            uploadedReturnLog: [],
            activeChatSession: null,
                    globalPiiCounters: {
            ADDRESS: 0,
            IP_ADDRESS: 0,
            URL: 0,
            SSN: 0,
            PHONE_NUMBER: 0,
            EMAIL: 0,
            DRIVERS_LICENSE: 0,
            PASSPORT_NUMBER: 0,
            TAXPAYER_IDENTIFICATION_NUMBER: 0,
            ID_NUMBER: 0,
            NAME: 0,
            USERNAME: 0,
            KEYS: 0,
            GEOLOCATION: 0,
            AFFILIATION: 0,
            DEMOGRAPHIC_ATTRIBUTE: 0,
            TIME: 0,
            HEALTH_INFORMATION: 0,
            FINANCIAL_INFORMATION: 0,
            EDUCATIONAL_RECORD: 0
        },
        detectedEntities: {}, // Track detected entities to ensure consistent placeholders
        uiFlags: { hasWelcomed: false, followupsPerQuestion: {} },
        qEpoch: 0,          // Increment each time we advance
        qStatus: {},        // { [questionTextLower]: 'active' | 'completed' | 'skipped' }
        followupStatus: {}  // { "<questionKey>::<followupId>": "covered" }
        });
    }
    return sessions.get(sessionId);
}

// Helper function to generate session ID
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Legacy global variables (deprecated - use session-based instead)
// These are kept for backward compatibility but should not be used
let globalPiiCounters = {
    ADDRESS: 0,
    IP_ADDRESS: 0,
    URL: 0,
    SSN: 0,
    PHONE_NUMBER: 0,
    EMAIL: 0,
    DRIVERS_LICENSE: 0,
    PASSPORT_NUMBER: 0,
    TAXPAYER_IDENTIFICATION_NUMBER: 0,
    ID_NUMBER: 0,
    NAME: 0,
    USERNAME: 0,
    KEYS: 0,
    GEOLOCATION: 0,
    AFFILIATION: 0,
    DEMOGRAPHIC_ATTRIBUTE: 0,
    TIME: 0,
    HEALTH_INFORMATION: 0,
    FINANCIAL_INFORMATION: 0,
    EDUCATIONAL_RECORD: 0
};

// Background questions (3 questions - no follow-ups needed)
// const backgroundQuestions = [
//     "Tell me about your educational background - what did you study in college or university?",
//     "I'd love to hear about your current work and how you got into it by job interviews?",
//     "What first got you interested in using GenAI tools like ChatGPT or Gemini for job interviews?"
// ];

// Main predefined questions stored on server - unified since all modes use the same questions
const unifiedQuestions = [
    "Tell me about your educational background - what did you study in college or university?",
    "I'd love to hear about your current work and how you got into it by job interviews?",
    "Can you walk me through a specific time when you used AI before and during job interviews?",
    "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
    "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job interviews?",
    "Have you ever used AI for your job interviews in a way that you prefer not to share openly with others—such as your employer, family, friends, or colleagues?"
];

// Maintain backward compatibility by mapping all modes to the same questions
const predefinedQuestions = {
    naive: unifiedQuestions,
    neutral: unifiedQuestions,
    featured: unifiedQuestions
};


// ==== NEW: Follow-ups registry and helpers ==================================
// Follow-ups for each main question - now using unified questions
// Structure: each follow-up includes { id, prompt }; optional keywords for precise coverage checks
const FOLLOWUPS_BY_QUESTION = {
    [unifiedQuestions[0]]: [
            { id: "Q1_F1", prompt: "When did you start your degree and when did you finish?", keywords: [
            "when","start","started","begin","began","enroll","enrolled",
            "from","since","until","between",
            "finish","finished","complete","completed","graduated","graduation",
            "class of","year","semester","quarter","fall","spring","summer","winter",
            "freshman","sophomore","junior","senior","201","202"
        ] },
        { id: "Q1_F2", prompt: "Where is your college or university located?", keywords: [
            "where","location","located","city","town","state","province","country","region",
            "university","college","school","campus","institution",
            "university of","college of","state university","polytechnic","tech university"
        ] },
        { id: "Q1_F3", prompt: "Who was your supervisor back in college?", keywords: [
            "supervisor","advisor","adviser","mentor","thesis advisor","capstone advisor","co-advisor",
            "professor","lecturer","pi","principal investigator","dr","prof","supervised by"
        ] }
    ],
    [unifiedQuestions[1]]: [
        { id: "Q2_F1", prompt: "When did you start your current job and when did you do the interview?", keywords: [
            "when","start","started","join","joined","since","until","between",
            "interview","phone screen","screen","assessment","take-home","onsite","on-site","loop",
            "offer","offer date","start date","hire date","hired","accepted",
            "month","year","week","201","202"
        ] },
        { id: "Q2_F2", prompt: "What is your current job title?", keywords: [
            "title","job title","position","role","level",
            "senior","junior","lead","manager","intern","contractor","staff","principal",
            "swe","engineer","developer","scientist","analyst","designer","researcher",
            "qa","qe","pm","product manager","data scientist","ml engineer"
        ] },
        { id: "Q2_F3", prompt: "What is your current employer or company?", keywords: [
            "employer","company","organization","org","firm","startup",
            "corp","corporation","inc","llc","ltd","co","company name","employed at","work at","at"
        ] }
    ],
    [unifiedQuestions[2]]: [
        { id: "Q3_F1", prompt: "When exactly did you use AI around the interview timeline?", keywords: [
            "when","exactly","interview","timeline","around","before","after","during",
            "date","time","month","year","201","202","preparation","prep","application",
            "offer","assessment","screen","onsite","on-site","loop","process"
        ] },
        { id: "Q3_F2", prompt: "Which AI tools did you use and for what tasks?", keywords: [
            "which","ai","tools","did you use","use","used","what","tasks","purpose",
            "chatgpt","gpt-4","gpt4","gpt-4o","gemini","bard","claude","copilot","github copilot",
            "bing ai","perplexity","notion ai","quillbot","grammarly","prompt","prompts",
            "generate","rewrite","rephrase","summarize","translate","brainstorm","outline",
            "mock interview","practice q&a","script","answer bank","cheatsheet"
        ] },
        { id: "Q3_F3", prompt: "How did you use AI and what difference did it make?", keywords: [
            "how","did you use","use","used","ai","difference","impact","effect","result",
            "help","assist","improve","change","outcome","benefit","advantage","disadvantage",
            "influence","process","performance","success","failure","resulted in"
        ] }
    ],
    [unifiedQuestions[3]]: [        { id: "Q4_F1", prompt: "when did the close call happen?", keywords: [
        "when","incident","close call","almost caught","nearly","time","date","month","year","201","202"
        ] },
        { id: "Q4_F2", prompt: "Which AI tools did you use and for what tasks?", keywords: [
        "chatgpt","gpt-4","gpt4","gpt-4o","gemini","bard","claude","copilot","github copilot",
        "bing ai","perplexity","notion ai","quillbot","grammarly",
        "prompt","prompts","generate","rewrite","rephrase","summarize","translate","brainstorm","outline",
        "star","bullet points","mock interview","practice q&a","script","answer bank","cheatsheet",
        "cover letter","resume","cv","email","thank-you note"
        ] },
        { id: "Q4_F3", prompt: "What trouble did AI get you in?", keywords: [
        "trouble","caught","flagged","plagiarism","cheating","ban","banned","policy","violation",
        "integrity","academic integrity","code of conduct","warning","revoke","rescinded","revoke offer",
        "disqualify","disqualified","penalty","strike","concern","red flag","hr","recruiter",
        "investigation","reported","suspension","blacklist"
        ] }
    ],
    [unifiedQuestions[4]]: [
        { id: "Q5_F1", prompt: "What triggered you to have the idea to cross the line of properly using AI?", keywords: [
            "trigger","reason","because","due to","pressure","deadline","time pressure",
            "hard question","difficult","competition","anxiety","stress","desperate","temptation",
            "incentive","recommendation","friend suggested","saw others","reddit","forum","example",
                      "shortcut","cheat","hack"
        ] },
        { id: "Q5_F2", prompt: "What concerns were in your mind when you had the crossing-line idea?", keywords: [
            "concern","worry","afraid","fear","risk","getting caught","detect","detection",
            "policy","violation","ethics","integrity","honesty","privacy","security",
            "consequence","ban","penalty","expelled","fired","background check","nda","legal","guidelines"
        ] },
        { id: "Q5_F3", prompt: "What additional ethics reflection did you have when you look back on it?", keywords: [
            "ethics","ethical","reflection","in hindsight","looking back","regret","lesson","learned",
            "shouldn't have","boundary","line","values","responsibility","fairness","transparency",
            "accountability","harm","trust","reputation","principle","moral","self-reflection"
        ] }
    ],
    [unifiedQuestions[5]]: [
        { id: "Q6_F1", prompt: "When was the incident of you using AI to hide from someone?", keywords: [
            "when","incident","time","date","month","year","201","202","hide","hidden","keeping secret"
        ] },
        { id: "Q6_F2", prompt: "Who were you hiding from?", keywords: [
            "who","from","employer","manager","boss","hr","recruiter","interviewer",
            "coworker","colleague","team","professor","ta","teacher","advisor","supervisor",
            "client","customer","family","parents","partner","girlfriend","boyfriend","spouse",
            "friend","roommate"
        ] },
        { id: "Q6_F3", prompt: "What AI uses did you try to hide from them?", keywords: [
            "hide","conceal","secret","ai use","used chatgpt","copilot","generate","autocompletion","auto-complete",
            "rewrite","translate","summarize","grammar","proofread","code","solution","answers","essay","report",
            "homework","assignment","take-home","test","automation","voice to text","image generator",
            "dall-e","midjourney","stable diffusion","quillbot","grammarly"
        ] }
    ]
};

function normalizeQuestionKey(s) {
    return (s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[“”"’'`´·(){}\[\].,:;!?\-_/\\]+/g, "")
        .trim();
}

const NORMALIZED_FU_MAP = new Map(
    Object.entries(FOLLOWUPS_BY_QUESTION).map(([k, v]) => [normalizeQuestionKey(k), v])
);
function getFollowupsForQuestion(q) {
    const byKey = NORMALIZED_FU_MAP.get(normalizeQuestionKey(q));
    if (byKey && byKey.length) return byKey;
    // Fallback: perform a minimal similarity search to find the most similar main question, to avoid returning nothing
    const qKey = normalizeQuestionKey(q);
    let best = null, bestScore = -1;
    for (const [k, v] of NORMALIZED_FU_MAP.entries()) {
        // Shared token count / total token count, rough similarity score
        const a = new Set(qKey.split(" "));
        const b = new Set(k.split(" "));
        const inter = [...a].filter(t => b.has(t)).length;
        const union = new Set([...a, ...b]).size;
        const score = union ? inter / union : 0;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    return best || [];
}
function getFollowupKey(q, fid) {
    return `${getQuestionKey(q)}::${fid}`;
}
function markFollowupCovered(session, q, fid) {
    session.followupStatus = session.followupStatus || {};
    session.followupStatus[getFollowupKey(q, fid)] = 'covered';
}
function isFollowupCovered(session, q, fid) {
    return (session.followupStatus && session.followupStatus[getFollowupKey(q, fid)] === 'covered');
}
function nextPendingFollowup(session, q) {
    const list = getFollowupsForQuestion(q);
    for (const f of list) {
        if (!isFollowupCovered(session, q, f.id)) return f;
    }
    return null;
}

const GLOBAL_PREDEFINED = predefinedQuestions; 
// Default main questions used for static mappings and prompts
// Note: Dynamic per-request main questions are still computed later where needed
const mainQuestions = unifiedQuestions;



  function deriveQuestionKeywordsFromFollowups(q) {
    try {
        const list = getFollowupsForQuestion(q);
        if (!Array.isArray(list) || list.length === 0) return [];
        const set = new Set();
        for (const f of list) {
            const kws = Array.isArray(f.keywords) ? f.keywords : [];
            for (const k of kws) {
            if (typeof k === "string" && k.trim()) {
                set.add(k.trim().toLowerCase());
            }
        }
        }
        return Array.from(set);
    } catch {
        return [];
    }
}

// Helper function to check if a question is a background question
// function isBackgroundQuestion(question) {
//     return backgroundQuestions.includes(question);
// }



// Helper function to manage conversation context
function manageConversationContext(sessionId) {
    const session = getSession(sessionId);
    // Keep track of conversation context without resetting
    // This allows for continuous conversation tracking
    const maxMessages = 1000; // Increased limit to allow longer conversations
    
    if (session.conversationHistory.length > maxMessages) {
        console.log('Conversation getting very long, keeping context but trimming history for performance');
        
        // Keep only recent messages in history for reference but maintain chat session
        session.conversationHistory = session.conversationHistory.slice(-100);
    }
}

// Helper function to get the next uncompleted question index
function getNextUncompletedQuestionIndex(sessionId) {
    // This is a simplified implementation for the server
    // In a real implementation, you would track completed questions in the conversation state
    // For now, we'll use a simple approach based on the current conversation step
    
    const session = getSession(sessionId);
    // Get the current step from the conversation history
    const currentStep = session.conversationHistory.length;
    
    // Assuming questions are processed sequentially, the next question index would be the current step
    // This is a basic implementation - in production you'd want more sophisticated tracking
    return currentStep;
}

// Helper function to convert PII category to new placeholder format
function convertToNewPlaceholderFormat(piiCategory) {
    const formatMap = {
        'KEYS': 'Key',
        'GEOLOCATION': 'Geolocation',
        'AFFILIATION': 'Affiliation',
        'DEMOGRAPHIC_ATTRIBUTE': 'Demographic_Attribute',
        'TIME': 'Time',
        'HEALTH_INFORMATION': 'Health_Information',
        'FINANCIAL_INFORMATION': 'Financial_Information',
        'EDUCATIONAL_RECORD': 'Education_Record',
        'NAME': 'Name',
        'EMAIL': 'Email',
        'PHONE_NUMBER': 'Phone_Number',
        'ADDRESS': 'Address',
        'SSN': 'SSN',
        'IP_ADDRESS': 'IP_Address',
        'URL': 'URL',
        'DRIVERS_LICENSE': 'Drivers_License',
        'PASSPORT_NUMBER': 'Passport_Number',
        'TAXPAYER_IDENTIFICATION_NUMBER': 'Taxpayer_Identification_Number',
        'ID_NUMBER': 'ID_Number',
        'USERNAME': 'Username'
    };
    
    return formatMap[piiCategory] || piiCategory;
}

// Helper function to get the next placeholder number for a PII category
function getNextPlaceholderNumber(piiCategory, sessionId) {
    const session = getSession(sessionId);
    if (session.globalPiiCounters.hasOwnProperty(piiCategory)) {
        session.globalPiiCounters[piiCategory]++;
        return session.globalPiiCounters[piiCategory];
    }
    // For unknown categories, use a generic counter
    if (!session.globalPiiCounters['UNKNOWN']) {
        session.globalPiiCounters['UNKNOWN'] = 0;
    }
    session.globalPiiCounters['UNKNOWN']++;
    return session.globalPiiCounters['UNKNOWN'];
}

// Enhanced function to get next question from predefined questions array
function getNextQuestionFromArray(predefinedQuestions, currentIndex = 0) {
    if (!predefinedQuestions || !Array.isArray(predefinedQuestions)) {
        return null;
    }
    
    // If we're at the end of the questions, return null
    if (currentIndex >= predefinedQuestions.length) {
        return null;
    }
    
    // Return the next question
    return predefinedQuestions[currentIndex];
}

// Executor System Prompt
export function buildExecutorSystemPrompt(currentQuestion, allowedActions = [], questionContext = {}) {
    const { mainQuestions = [] } = questionContext;
    const remaining = mainQuestions.filter(q => q !== currentQuestion);
    
    // // Check if current question is a background question
    // const isBackgroundQuestion = backgroundQuestions.includes(currentQuestion);

    
    // Filter allowed actions based on question type
    // let filteredActions = allowedActions;
    // if (isBackgroundQuestion) {
    //   // For background questions, only allow actions that don't involve follow-ups
    //   filteredActions = allowedActions.filter(action => 
    //     action === 'SUMMARIZE_QUESTION' || action === 'NEXT_QUESTION'
    //   );
    // }
    
    // const AA = filteredActions.length ? filteredActions.join(", ") : "SUMMARIZE_QUESTION, NEXT_QUESTION";
    const AA = allowedActions.length ? allowedActions.join(", ") : "ASK_FOLLOWUP, REQUEST_CLARIFY, SUMMARIZE_QUESTION";
    
    return [
        `CURRENT QUESTION: "${currentQuestion || 'N/A'}"`,
        `REMAINING QUESTIONS: [${remaining.map(q => `"${q}"`).join("; ")}]`,
        `ALLOWED_ACTIONS: [${AA}]`,
        ``,
        `You are the Executor. Your job is to elicit a concrete personal story for the CURRENT QUESTION.`,
        `Hard rules:`,
        `- Stay on the CURRENT QUESTION only; do NOT introduce other predefined questions.`,
        `- MAIN QUESTIONS: Be concise and conversational, one focused follow-up at a time; warm, curious, neutral.`,
        `- Aim for: time/place/people/task/action/result + ≥2 depth points (tradeoff/difficulty/failed attempt/reflection).`,
        `- When you believe the bar is met, propose a 2-3 line summary before moving on.`,
        ``,
        `Output JSON only:`,
        `{`,
        `  "action": "ASK_FOLLOWUP" | "SUMMARIZE_QUESTION" | "REQUEST_CLARIFY" | "END",`,
        `  "question_id": "<ID or text>",`,
        `  "utterance": "ONE natural question OR a brief summary",`,
        `  "notes": ["optional extracted facts"]`,
        `}`
        ].join("\n");
  }

// Completion Audit Prompt
async function auditQuestionCompletion(
    userMessage,
    aiResponse,
    currentQuestion,
    conversationHistory,
    isFinalQuestionFlag = false,
    followUpMode = false,
    session
    ) {
    const fuList = getFollowupsForQuestion(currentQuestion);
    const fuPayload = fuList.map(f => ({ id: f.id, prompt: f.prompt, keywords: f.keywords || [] }));
    const sys = `You are the Follow-up Coverage Auditor. Output JSON ONLY.`;
    const user = `
    CURRENT QUESTION: "${currentQuestion}"
    FOLLOWUPS: ${JSON.stringify(fuPayload)}
    RECENT: ${conversationHistory.slice(-10).map(m=>`${m.role}: ${m.content}`).join("\n")}
    USER_LATEST: ${userMessage}
    ASSISTANT_LATEST: ${aiResponse}
    Return: {"question_id": "...","coverage_map":[{"id":"...","covered":true|false,"evidence":""}],"next_followup_id":"..."|null,"next_followup_prompt":"..."|null,"verdict":"ALLOW_NEXT_QUESTION"|"REQUIRE_MORE","confidence":0.0-1.0,"notes":""}
    `;
    const r = await openaiClient.chat.completions.create({ model:"gpt-4o", temperature:0.2, max_tokens:420, messages:[{role:"system",content:sys},{role:"user",content:user}] });
    let raw = r.choices?.[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) raw = raw.replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    let parsed = {}; try { parsed = JSON.parse(raw); } catch {}
    // Synchronize coverage status to the current session
    if (session && Array.isArray(parsed.coverage_map)) {
        for (const it of parsed.coverage_map) {
        if (it?.id && it.covered === true) {
            markFollowupCovered(session, currentQuestion, it.id);
        }
        }
    }
    // Fallback to select the next follow-up
    let nextFU = null;
    if (parsed.verdict !== "ALLOW_NEXT_QUESTION") {
        if (parsed.next_followup_id && parsed.next_followup_prompt) nextFU = { id: parsed.next_followup_id, prompt: parsed.next_followup_prompt };
        else {
            const cand = session ? nextPendingFollowup(session, currentQuestion) : null;
            if (cand) nextFU = { id: cand.id, prompt: cand.prompt };
        }
    }
    return {
        question_id: parsed.question_id || currentQuestion,
        verdict: parsed.verdict === "ALLOW_NEXT_QUESTION" ? "ALLOW_NEXT_QUESTION" : "REQUIRE_MORE",
        scores: null,
        missing: nextFU ? [nextFU.id] : [],
        notes: parsed.notes || "",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        followUpQuestions: nextFU ? [nextFU.prompt] : null,
        coverage_map: Array.isArray(parsed.coverage_map) ? parsed.coverage_map : [],
        next_followup: nextFU || null,
        shouldProceed: parsed.verdict === "ALLOW_NEXT_QUESTION",
        reason: parsed.verdict === "ALLOW_NEXT_QUESTION" ? "all follow-ups covered" : "follow-ups remaining"
    };
}

// (Removed) buildPresenceAuditPrompt — presence audit now constructs its prompt
// with keywords derived from FOLLOWUPS_BY_QUESTION.
function buildPresenceAuditPrompt(currentQuestion, candidateText) {
    const currentKW = deriveQuestionKeywordsFromFollowups(currentQuestion);
    const otherKW = deriveOtherQuestionKeywords(currentQuestion);
    return `
    You are a concise auditor.
    Goal: ensure the next assistant message is exactly ONE question, on-topic for the CURRENT QUESTION.
    Rules:
      - Exactly one interrogative sentence, ending with '?'
      - Must stay aligned to the CURRENT QUESTION and its topical hints (if any)
      - No multi-part questions, no list, no prefaces
    CURRENT QUESTION: "${currentQuestion}"
    TOPICAL HINTS: ${(currentKW && currentKW.length) ? currentKW.join(", ") : "(none)"}
OTHER TOPICS (avoid drifting): ${(otherKW && otherKW.length) ? otherKW.join(", ") : "(none)"}
 CANDIDATE MESSAGE: "${candidateText}"
 Output JSON only:
 {"ok": true|false, "reason": "brief"}
 `;
 }

// API Routes

// Test API Connection
app.get('/api/test_connection', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        conversation_context: {
            has_active_session: false, // Simplified for now
            message_count: 0, // Simplified for now
            current_mode: 'chat'
        }
    });
});

// Get predefined questions API
app.get('/api/predefined_questions/:mode', (req, res) => {
    try {
        const { mode } = req.params;
        
        // Set CORS headers explicitly for this endpoint
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
        
        if (!predefinedQuestions[mode]) {
            return res.status(400).json({ error: 'Invalid mode' });
        }
        
        res.json({
            success: true,
            questions: predefinedQuestions[mode],
            backgroundQuestions: [],
            mainQuestions: predefinedQuestions[mode],
            mode: mode
        });
    } catch (error) {
        console.error('Get predefined questions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Debug API to show conversation context
app.get('/api/debug_context', (req, res) => {
    res.json({
        conversation_history: [], // Simplified for now
        active_chat_session: false, // Simplified for now
        current_mode: 'chat',
        uploaded_questions: [],
        uploaded_return_log: [],
        global_pii_counters: {}
    });
});

// Configuration API
app.get('/api/config', (req, res) => {
    // Set CORS headers explicitly for this endpoint
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    
    res.json({
        audit_llm_enabled: true, // Always enable audit LLM for the study
        openai_available: openaiClient !== null,
        features: {
            audit_llm: true, // Always enable audit LLM for the study
            privacy_detection: currentMode === 'featured',
            question_mode: true
        }
    });
});






                    



// Chat API (full, with rich logs)
app.post('/api/chat', async (req, res) => {
    const t0 = Date.now();
    const requestId = Math.random().toString(36).slice(2,10);
    const log = makeLogger({ route: '/api/chat', requestId });
  
    try {
      const {
        message,
        step = 0,
        questionMode = true,               // New process default to enable question mode
        currentQuestion = null,            // Can be decided by orchestrator
        clientPredefined = [],             // 7 main questions
        isFinalQuestionFlag = false,       // Reserved field (not involved in pass judgment)
        followUpMode = true,               // We default to follow-up mode, requiring "exactly one question"
        sessionId,
        action = null                      // Action parameter for special message handling
      } = req.body || {};
  
      log.info('incoming params', {
        hasMessage: !!message,
        step, questionMode, isFinalQuestionFlag, followUpMode,
        currentQuestionProvided: !!currentQuestion,
        predefinedCount: Array.isArray(clientPredefined) ? clientPredefined.length : 0,
        sessionIdProvided: !!sessionId,
        action: action
      });
  
      if (!message || message.trim() === '') {
        log.warn('empty message');
        return res.status(400).json({ error: 'Message is required and cannot be empty' });
      }

      // Session - moved here to fix initialization order
      const currentSessionId = sessionId || generateSessionId();
      const session = getSession(currentSessionId);

      // Special handling for START_QUESTION_MODE action
      if (message === "__START__" && action === "START_QUESTION_MODE") {
        log.info('handling START_QUESTION_MODE action');
        
        // Get the first question for the current mode
        const state = initState(session, { maxFollowups: { main: 3 } });
        const firstQuestion = getCurrentQuestion(state, unifiedQuestions);
        
        if (firstQuestion) {
          const welcomeMessage = "Welcome! I'm ready to ask you some questions. Let's begin with the first one.";
          const fullMessage = `${welcomeMessage}\n\n${firstQuestion}`;
          
          // Add to conversation history
          session.conversationHistory.push({
            role: 'assistant',
            content: fullMessage,
            timestamp: new Date().toISOString(),
            step
          });
          
          return res.json({
            success: true,
            bot_response: fullMessage,
            conversation_history: session.conversationHistory,
            step,
            question_completed: false,
            pending_followup_exists: false,
            allowed_actions: Array.from(state.allowedActions),
            interview_finished: false,
            session_id: currentSessionId
          });
        }
      }
  
      // Session variables already declared above
      const prevLen = session.conversationHistory.length;
      session.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        step
      });
  
      log.info('session ready', { currentSessionId, prevLen, newLen: session.conversationHistory.length });

      const isFirstAssistantReply = (prevLen === 0);
  
      // Context maintenance
      manageConversationContext(currentSessionId);
  
      // Questions (background + main questions) - use global arrays for consistency
    //   const mainQuestions = (predefinedQuestions && predefinedQuestions.length ? predefinedQuestions : unifiedQuestions);
    const clientMainQs = Array.isArray(clientPredefined) ? clientPredefined : [];
    const mainQuestions = clientMainQs.length
    ? clientMainQs
    : unifiedQuestions;
      // Orchestrator state
      const state = initState(session, { maxFollowups: { main: 3 } });
      const qNow = currentQuestion || getCurrentQuestion(state, mainQuestions);
      const allowedActionsArr = buildAllowedActionsForPrompt(state);
  
      log.info('orchestrator state', {
        phase: state.phase,
        mainIdx: state.mainIdx,
        qNow,
        allowedActions: allowedActionsArr
      });
  
      // Build Executor system prompt
      const executorSystemPrompt = buildExecutorSystemPrompt(qNow, allowedActionsArr, { mainQuestions });
      const messages = [{ role: 'system', content: executorSystemPrompt }];
  
      // Avoid double-inserting last user turn
      const historyExceptLast = session.conversationHistory.slice(0, -1);
      historyExceptLast.forEach(m => messages.push({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content: message });
  
      log.info('prompt stats', {
        sysPromptLen: executorSystemPrompt.length,
        messagesCount: messages.length,
        lastUserPreview: message.slice(0,120)
      });
  
      let aiResponse = '';
      let completionAudit = null;
      let presenceAudit = null;
      let questionCompleted = false;
      let usedRegenerate = false;
      let usedPolish = false;
      let parsedExec = null;
  
      if (openaiClient) {
        try {
            if (isFirstAssistantReply) {

                if (!session.flags) session.flags = {};
                if (!session.flags.welcomeSent) {
                    const welcomePrefix =
                        state?.welcomeText ||
                        "Hi! Thanks for joining—I'll ask a few short questions and some small follow-ups to keep us on track.";
                }

                const firstQ = qNow || getCurrentQuestion(state, mainQuestions);
                if (firstQ) {
                  const { prefix, suffix } = await polishFollowupConnectors({
                    followupPrompt: firstQ,
                           currentQuestion: firstQ,
                    conversationHistory: session.conversationHistory,
                    styleHints: state.styleHints || {}
                  });
                  const core = firstQ.trim().endsWith("?") ? firstQ.trim() : (firstQ.trim() + "?");
                  const left = prefix ? (prefix.trim() + (/[.?!:]$/.test(prefix.trim()) ? " " : " ")) : "";
                  const right = suffix ? (" " + suffix.trim()) : "";
                  const welcome = (typeof WELCOME_TEXT === "string" && WELCOME_TEXT) ? WELCOME_TEXT : "Welcome!";
                  const msg = `${welcome}\n\n${(left + core + right).replace(/\s+\?/, "?")}`;
                  session.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString(), step });
                  return res.json({
                    success: true,
                    bot_response: msg,
                    conversation_history: session.conversationHistory,
                    step,
                    question_completed: false,
                    pending_followup_exists: false,
                    allowed_actions: Array.from(state.allowedActions),
                    interview_finished: false,
                    session_id: currentSessionId
                         });
                }
              }
          // ====== Executor call ======
          const execT0 = Date.now();
          const completion = await openaiClient.chat.completions.create({
            model: "gpt-4.1",
            messages,
            max_tokens: 700,
            temperature: 0.3,
            top_p: 0.3
          });
          aiResponse = (completion.choices?.[0]?.message?.content || '').trim();
          const execDur = Date.now() - execT0;
  
          log.info('executor completed', {
            ms: execDur,
            aiResponsePreview: aiResponse.slice(0,180)
          });
  
          // Parse Executor JSON, and execute action constraints
          parsedExec = parseExecutorOutput(aiResponse);
          if (parsedExec) {
            // Early "no follow-up on completed questions" enforcement (see section B explanation)
            const curKey = getQuestionKey(qNow);
            if (
              parsedExec.action === "ASK_FOLLOWUP" &&
              session.qStatus[curKey] && session.qStatus[curKey] !== 'active'
            ) {
              parsedExec.action = state.allowedActions.has("NEXT_QUESTION")
                ? "NEXT_QUESTION"
                : (state.allowedActions.has("SUMMARIZE_QUESTION") ? "SUMMARIZE_QUESTION" : "REQUEST_CLARIFY");
            }
          
            parsedExec = enforceAllowedAction(state, parsedExec, qNow);
            log.info('executor parsed', parsedExec);
          
            aiResponse = composeAssistantMessage(state, parsedExec, {
                currentQuestion: getCurrentQuestion(state, mainQuestions),
                nextQuestion: peekNextQuestion(state, mainQuestions),
                isFirstAssistantReply,
                styleHints: state.styleHints || {},
                welcomeText: WELCOME_TEXT
            });
          } else {
            log.warn('executor output not JSON; using raw text');
          }
  
          // ====== Completion Audit (PSS) ======
          const compT0 = Date.now();
          const isFinalQuestionValue = isFinalQuestion(state, mainQuestions);
          console.log('isFinalQuestionValue', isFinalQuestionValue);
          


          const completionAudit = await auditQuestionCompletion(
            message,
            aiResponse,
            qNow,
            session.conversationHistory,
            isFinalQuestionValue,
            followUpMode,
            session
          );
          const allFUs = getFollowupsForQuestion(qNow);        
          const coveredIds = new Set(
          (completionAudit?.coverage_map || [])
            .filter(it => it?.covered)
            .map(it => it.id)
          );
          const pending = allFUs.filter(f => !coveredIds.has(f.id));
          
          // log for debugging
          console.log("[coverage]", {
            q: qNow,
            covered: [...coveredIds],
            pending: pending.map(f => f.id),
            verdict: completionAudit?.verdict
          });
          // Strict gate: If there are uncovered follow-ups, only ask the next follow-up and do not proceed to the next main question.
          if (pending.length > 0) {
            let nextFU = null;
            // Use the next_followup suggested by the audit LLM, but it must be in the pending list.
            if (completionAudit?.next_followup) {
              nextFU = pending.find(f => f.id === completionAudit.next_followup) || null;
            }
            // Otherwise, fall back: take the first uncovered follow-up in order.
            if (!nextFU) nextFU = pending[0];
          // Add a slight transition phrase, but do not modify the follow-up content itself.
          const { prefix, suffix } = await polishFollowupConnectors({
            followupPrompt: nextFU.prompt,
            currentQuestion: qNow,
            conversationHistory: session.conversationHistory,
            styleHints: state?.styleHints || {}
          });
          const core = nextFU.prompt.trim().endsWith("?") ? nextFU.prompt.trim() : (nextFU.prompt.trim() + "?");
         const left = prefix ? (prefix.trim() + (/[.?!:]$/.test(prefix.trim()) ? " " : " ")) : "";
          const right = suffix ? (" " + suffix.trim()) : "";
          const aiResponse = `${left}${core}${right}`.replace(/\s+\?/, "?");
          session.conversationHistory.push({ role: "assistant", content: aiResponse, followup_id: nextFU.id });
          return res.json({
            success: true,
            bot_response: aiResponse,
            conversation_history: session.conversationHistory,
            step,
            question_completed: false,
            pending_followup_exists: true,
            allowed_actions: Array.from(state.allowedActions),
            interview_finished: false,
            session_id: currentSessionId
          });
        }
        
        

        //   if (completionAudit?.next_followup?.prompt) {
        //     // >>> POLISH TRIGGER <<< Only add prefix/suffix connectors; do not modify the follow-up content itself.
        //     const { prefix, suffix } = await polishFollowupConnectors({
        //       followupPrompt: completionAudit.next_followup.prompt,
        //       currentQuestion: qNow,
        //       conversationHistory: session.conversationHistory,
        //       styleHints: state.styleHints || {}
        //     });
        //     aiResponse = [prefix, completionAudit.next_followup.prompt, suffix]
        //       .filter(Boolean)
        //       .join(' ')
        //       .replace(/\s+/g, ' ')
        //       .trim();
        //     session.lastPolish = {
        //       followup_id: completionAudit.next_followup.id,
        //       prefix, suffix
        //     };
        //     usedPolish = true;
        //   }
        //   allowNextIfAuditPass(state, completionAudit?.verdict);
        //   finalizeIfLastAndPassed(state, mainQuestions, completionAudit?.verdict);
  
          // ====== Presence Audit ======
          const presT0 = Date.now();
          
          // Skip presence audit for background questions - they don't need follow-up questions
        //   if (isBackgroundQuestion) {
        //     presenceAudit = {
        //       hasQuestion: false,
        //       reason: 'Background question - no follow-up needed',
        //       confidence: 1.0,
        //       shouldRegenerate: false
        //     };
        //     log.info('background question - presence audit skipped');
        //   } else {
        //     presenceAudit = await auditQuestionPresence(
        //       message,
        //       aiResponse,
        //       qNow,
        //       session.conversationHistory,
        //       isFinalQuestionValue,
        //       followUpMode
        //     );
        //   }

        //   presenceAudit = await auditQuestionPresence(
        //     message,
        //     aiResponse,
        //     qNow,
        //     session.conversationHistory,
        //     isFinalQuestionValue,
        //     followUpMode
        //   );

        // const presenceFollowUpMode = (parsedExec && parsedExec.action === "SUMMARIZE_QUESTION") ? false : followUpMode;
        const presenceFollowUpMode = (parsedExec && parsedExec.action === "SUMMARIZE_QUESTION") ? false : followUpMode;
        presenceAudit = await auditQuestionPresence(
                     message,
                     /* draft */ aiResponse,
                     qNow,
                     session.conversationHistory,
                     isFinalQuestionValue,
                     presenceFollowUpMode
                   );

          const presDur = Date.now() - presT0;
  
          log.info('presence audit', {
            ms: presDur,
            hasQuestion: presenceAudit?.hasQuestion,
            shouldRegenerate: presenceAudit?.shouldRegenerate,
            reason: presenceAudit?.reason,
            confidence: presenceAudit?.confidence
          });
  
          // ====== Regenerate if needed (presence) ======
          if (pending.length === 0 && presenceAudit?.shouldRegenerate && presenceAudit.confidence >= 0.7) {
            const regenT0 = Date.now();
            const regenerated = await regenerateResponseWithQuestions(
              message,
              aiResponse,
              qNow,
              session.conversationHistory,
              isFinalQuestionValue,
              followUpMode
            );
            const regenDur = Date.now() - regenT0;
  
            if (regenerated) {
              usedRegenerate = true;
              aiResponse = regenerated;
              log.info('regenerated response used', { ms: regenDur, aiResponsePreview: aiResponse.slice(0,160) });
            } else {
              log.warn('regenerate returned null; keep original');
            }
          }
  
          // ====== Polish chosen follow-up (completion) ======
          // When the completion audit provides a next_followup, only add prefix/suffix connectors; do not modify the follow-up content itself.
          if (completionAudit?.next_followup?.prompt) {
          // >>> POLISH TRIGGER <<< Only add prefix/suffix connectors; do not modify the follow-up content itself.
            const { prefix, suffix } = await polishFollowupConnectors({
              followupPrompt: completionAudit.next_followup.prompt,
              currentQuestion: qNow,
              conversationHistory: session.conversationHistory,
              styleHints: state.styleHints || {}
            });
            const coreQ = completionAudit.next_followup.prompt.trim().endsWith("?")
              ? completionAudit.next_followup.prompt.trim()
              : (completionAudit.next_followup.prompt.trim() + "?");
            const left = prefix ? (prefix.trim() + (/[.?!:]$/.test(prefix.trim()) ? " " : " ")) : "";
            const right = suffix ? (" " + suffix.trim()) : "";
            aiResponse = `${left}${coreQ}${right}`.replace(/\s+\?/, "?");
            session.lastPolish = {
              followup_id: completionAudit.next_followup.id,
              prefix,
              suffix
            };
            usedPolish = true;
          }
  
          // ====== Store audits → Apply heuristics → Permit actions (strict order) ======
          storeAudits(state, { completionAudit, presenceAudit });
          applyHeuristicsFromAudits(state, qNow, { completionAudit, presenceAudit });
          allowNextIfAuditPass(state, completionAudit?.verdict);
          finalizeIfLastAndPassed(state, mainQuestions, completionAudit?.verdict);

        // Adapted to use new advancement logic and composeAssistantMessage for next question transition
        const currentQuestion = qNow;
        const qKey = getQuestionKey(currentQuestion);
        if (shouldAdvance(completionAudit?.verdict, state, currentQuestion)) {
          // Freeze old question
          session.qStatus = session.qStatus || {};
          session.qStatus[qKey] = session.qStatus[qKey] || "completed";

          // Advance to next question
          gotoNextQuestion(state, mainQuestions);

          // Activate new question
          const nextQ = getCurrentQuestion(state, mainQuestions);
          if (nextQ) {
            const { prefix, suffix } = await polishFollowupConnectors({
                followupPrompt: nextQ,
                currentQuestion: nextQ,
                conversationHistory: session.conversationHistory,
                styleHints: state.styleHints || {}
              });
              const core = nextQ.trim().endsWith("?") ? nextQ.trim() : (nextQ.trim() + "?");
              const left = prefix ? (prefix.trim() + (/[.?!:]$/.test(prefix.trim()) ? " " : " ")) : "";
              const right = suffix ? (" " + suffix.trim()) : "";
              aiResponse = (left + core + right).replace(/\s+\?/, "?");
          } else {
            aiResponse = composeAssistantMessage(state, { action: "END" }, { styleHints: state.styleHints || {} });
          }

          // Compose transition + next question message
          aiResponse = composeAssistantMessage(state, { action: "NEXT_QUESTION" }, {
            currentQuestion: null,
            nextQuestion: getCurrentQuestion(state, mainQuestions),
            styleHints: state.styleHints || {},
            isFirstAssistantReply: false,
            welcomeText: WELCOME_TEXT
          });

          questionCompleted = true;

          log.info('main question advanced via audit', {
            phase: state.phase,
            mainIdx: state.mainIdx,
            newAllowed: Array.from(state.allowedActions),
            nextQuestion: getCurrentQuestion(state, mainQuestions)
          });
        } else {
          questionCompleted = false;
          const reachedCap = atFollowupCap(state, qNow);
          log.info('stay on current main question', {
            reachedCap,
            allowed: Array.from(state.allowedActions),
            missing: completionAudit?.missing
          });
        }
  
        } catch (err) {
          log.error('executor/audit pipeline error', { error: err.message, stack: err.stack });
          aiResponse = `I'm sorry—I hit an error. Please try again. (Error: ${err.message})`;
        }
      } else {
        // Fallback (no model)
        aiResponse = questionMode && qNow
          ? `Thanks for sharing that. Next question: ${qNow}`
          : `This is a simulated response to: "${message}".`;
        questionCompleted = !!qNow;
        log.warn('openai client not configured; using fallback');
      }
  
      // Append assistant message
      session.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        step
      });
  
      // Save audits in state (for debugging/UI)
    //   storeAudits(state, { completionAudit, presenceAudit });
  
      log.info('finalize response', {
        questionCompleted,
        usedRegenerate,
        usedPolish,
        responsePreview: aiResponse.slice(0,200)
      });
      if (!aiResponse || /(?:^|\n)\s*$/.test(aiResponse)) {
        aiResponse = "Could you tell me a bit more?";
      }
      if (aiResponse.endsWith('?')) {
        const curKey = getQuestionKey(qNow);
        if (session.qStatus[curKey] !== 'active') {
          const nextQ = getCurrentQuestion(state, mainQuestions);
          if (nextQ) {
            const { prefix, suffix } = await polishFollowupConnectors({
              followupPrompt: nextQ,
              currentQuestion: nextQ,
              conversationHistory: session.conversationHistory,
              styleHints: state.styleHints || {}
            });
            const core = nextQ.trim().endsWith("?") ? nextQ.trim() : (nextQ.trim() + "?");
            const left = prefix ? (prefix.trim() + (/[.?!:]$/.test(prefix.trim()) ? " " : " ")) : "";
            const right = suffix ? (" " + suffix.trim()) : "";
            aiResponse = (left + core + right).replace(/\s+\?/, "?");
          } else {
            aiResponse = composeAssistantMessage(state, { action: "END" }, { styleHints: state.styleHints || {} });
          }
        }
      }

      const t1 = Date.now();
      res.json({
        success: true,
        bot_response: aiResponse,
        conversation_history: session.conversationHistory,
        step,
        privacy_detection: null,
        question_completed: questionCompleted,
        audit_result: completionAudit || null,
        followup_coverage: completionAudit?.coverage_map || [],
        next_followup: completionAudit?.next_followup || null,
        pending_followup_exists: !!completionAudit?.next_followup,
        followup_polish_meta: session?.lastPolish || null, // helper; not a trigger
        follow_up_questions: completionAudit?.followUpQuestions || null,
        question_presence_audit: presenceAudit || null,
        interview_finished: (state.phase === "done" || !getCurrentQuestion(state, mainQuestions)),
        allowed_actions: Array.from(state.allowedActions),
        session_id: currentSessionId,
        timings_ms: { total: t1 - t0 }
      });
  
    } catch (error) {
      const t1 = Date.now();
      log.error('handler fatal', { error: error.message, stack: error.stack, totalMs: t1 - t0 });
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString(),
        timings_ms: { total: t1 - t0 }
      });
    }
  });
  
// Privacy Detection API
app.post('/api/privacy_detection', async (req, res) => {
    try {
        const { user_message } = req.body;
        
        if (!user_message) {
            return res.status(400).json({ error: 'User message is required' });
        }

        // Enhanced AI-based privacy detection with conversation context and fallback to pattern matching
        let privacyResult = await detectPrivacyWithAI(user_message, null);
        
        // If AI detection fails, fall back to pattern matching
        if (!privacyResult || privacyResult.error) {
            console.log('AI privacy detection failed, using pattern matching fallback');
            privacyResult = detectPrivacyWithPatterns(user_message, null);
        }
        
        // For simple patterns (names, emails, phones), prefer pattern-based detection for consistency
        const simplePatterns = [
            /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, // Full Name
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/, // Phone Number
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ // Credit Card
        ];
        
        const hasSimplePattern = simplePatterns.some(pattern => pattern.test(user_message));
        if (hasSimplePattern) {
            console.log('Simple pattern detected, using pattern-based detection for consistency');
            privacyResult = detectPrivacyWithPatterns(user_message, null);
        }
        


        res.json(privacyResult);
    } catch (error) {
        console.error('Privacy detection error:', error);
        // Final fallback to pattern matching
        const fallbackResult = detectPrivacyWithPatterns(req.body.user_message, null);
        res.json(fallbackResult);
    }
});

// Audit LLM for Question Completion Evaluation (PSS-only: structure/specificity/depth)
async function auditQuestionPSS(
    userMessage,
    aiResponse,
    currentQuestion,
    conversationHistory,
    isFinalQuestionFlag = false,   // Keep parameter, no longer dependent on prompt
    followUpMode = false       // Keep parameter, no longer dependent on prompt
  ) {
    if (!openaiClient) {
        console.log('⚠️  Audit LLM not available - skipping follow-up coverage audit');
        return { verdict: 'REQUIRE_MORE', reason: 'Audit LLM not available', shouldProceed: false, confidence: 0.0 };
    }

    try {
        // 取出该主问题的 follow-ups
        const fuList = getFollowupsForQuestion(currentQuestion); 
        const fuPayload = fuList.map(f => ({ id: f.id, prompt: f.prompt, keywords: f.keywords || [] }));

        const auditPrompt = `
        You are the Follow-up Coverage Auditor.
        Goal: For the CURRENT QUESTION, check whether the user's conversation so far ALREADY COVERS each required follow-up.

        CURRENT QUESTION: "${currentQuestion}"
        FOLLOWUPS:
        ${JSON.stringify(fuPayload, null, 2)}

        Rules:
        - "Covered" means the user has clearly provided the key information implied by the follow-up prompt (look for direct answers or equivalent info).
        - Be lenient to paraphrases; focus on substance (time/place/people/tool/result/motivation/etc.).
        - Use ALL recent turns for evidence (not just the last message).
        - If ALL follow-ups are covered => verdict = "ALLOW_NEXT_QUESTION".
        - Otherwise => verdict = "REQUIRE_MORE" and choose exactly ONE next follow-up that remains uncovered (prefer earlier order)

        OUTPUT JSON ONLY (no markdown):
        {
          "question_id": "<text>",
          "coverage_map": [
            { "id": "Qx_Fy", "covered": true|false, "evidence": "1-2 short phrases from the user that justify the decision or empty if false" }
          ],
          "next_followup_id": "Qx_Fy" | null,
          "next_followup_prompt": "string | null",
          "verdict": "ALLOW_NEXT_QUESTION" | "REQUIRE_MORE",
          "confidence": 0.0-1.0,
          "notes": "brief"
        }
        `;

        const recent = conversationHistory.slice(-10);
        const ctx = [
            `Recent conversation:`,
            ...recent.map(m => `${m.role}: ${m.content}`),
            ``,
            `User latest: ${userMessage}`,
            `Assistant latest: ${aiResponse}`
        ].join('\n');
        
        const auditMessages = [
            { role: 'system', content: auditPrompt },
            { role: 'user', content: ctx }
        ];

        const auditCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4.1",
            messages: auditMessages,
            max_tokens: 420,
            temperature: 0.2
        });
        
        let raw = auditCompletion.choices?.[0]?.message?.content?.trim() || "";
        if (raw.startsWith("```")) {
            raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.error('Failed to parse follow-up coverage audit JSON:', e);
            console.log('Raw audit response:', raw);
            return { verdict: 'REQUIRE_MORE', reason: 'Failed to parse audit response', shouldProceed: false, confidence: 0.0 };
        }

        // —— 同步会话中的覆盖状态 —— //
        const session = getSession((conversationHistory[0] && conversationHistory[0].sessionId) || null) || getSession(null);
        if (Array.isArray(parsed.coverage_map)) {
            parsed.coverage_map.forEach(item => {
                if (item && item.id && item.covered === true) {
                    markFollowupCovered(session, currentQuestion, item.id);
                }
            });
        }

        // 如果 LLM 没给 next_followup_*，则由服务器自行挑一个未覆盖的
        let nextFU = null;
        if (parsed.verdict !== 'ALLOW_NEXT_QUESTION') {
            if (parsed.next_followup_id && parsed.next_followup_prompt) {
                nextFU = { id: parsed.next_followup_id, prompt: parsed.next_followup_prompt };
            } else {
                const candidate = nextPendingFollowup(session, currentQuestion);
                if (candidate) nextFU = { id: candidate.id, prompt: candidate.prompt };
            }
        }

        const result = {
            question_id: parsed.question_id || currentQuestion || 'N/A',
            verdict: parsed.verdict === 'ALLOW_NEXT_QUESTION' ? 'ALLOW_NEXT_QUESTION' : 'REQUIRE_MORE',
            scores: null,          // 兼容字段，占位
            missing: nextFU ? [nextFU.id] : [],
            notes: parsed.notes || '',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
            followUpQuestions: nextFU ? [nextFU.prompt] : null,
            coverage_map: Array.isArray(parsed.coverage_map) ? parsed.coverage_map : [],
            next_followup: nextFU || null,
            shouldProceed: parsed.verdict === 'ALLOW_NEXT_QUESTION',
            reason: parsed.notes || (parsed.verdict === 'ALLOW_NEXT_QUESTION' ? 'all follow-ups covered' : 'follow-ups remaining')
        };
        
        console.log(`Audit Result (Follow-up Coverage): ${JSON.stringify(result)}`);
        return result;

        } catch (error) {
            console.error('Follow-up coverage audit error:', error);
            return { verdict: 'REQUIRE_MORE', reason: 'Audit LLM error: ' + error.message, shouldProceed: false, confidence: 0.0 };
        }
  }
  

// Audit LLM for Question Presence Check
async function auditQuestionPresence(
    userMessage,
    aiResponse,
    currentQuestion,
    conversationHistory,
    isFinalQuestionFlag = false, // Keep but not rely on
    followUpMode = false
  ) {
    if (!openaiClient) {
      console.log('⚠️  Audit LLM not available - skipping question presence audit');
      return { hasQuestion: true, reason: 'Audit LLM not available', confidence: 0.0, shouldRegenerate: false };
    }
  
    try {
      // Use centralized keyword configuration
      const currentK = deriveQuestionKeywordsFromFollowups(currentQuestion);
      const otherK = deriveOtherQuestionKeywords(currentQuestion);
  
      const auditPrompt = `
  You are the Question-Form Auditor. Check the latest assistant message for (1) presence/form of questions and (2) topic alignment to the CURRENT QUESTION.
  
  CURRENT QUESTION: "${currentQuestion}"
  CURRENT TOPIC KEYWORDS: [${currentK.join(", ")}]
  OTHER TOPICS KEYWORDS (avoid): [${otherK.join(", ")}]
  
  Return ONLY JSON (no markdown). Use this format:
  {
    "hasQuestion": true|false,
    "reason": "brief",
    "confidence": 0.0-1.0,
    "shouldRegenerate": true|false
  }
  
  Rules:
  - In followUpMode=true the message MUST contain EXACTLY ONE interrogative sentence ending with '?' (no stacked questions).
  - If followUpMode=false:
    * A question is recommended, but NOT required for a short summary/transition message.
    * If the message clearly reads as a summary/transition (e.g., "Here's what I heard...", "To summarize...", "Let's move on when you're ready"), then hasQuestion can be false and shouldRegenerate=false.
  - Topic alignment:
    * The question must stay within CURRENT TOPIC KEYWORDS.
    * If it appears to introduce a different predefined question (matches OTHER TOPICS KEYWORDS more than current), set shouldRegenerate=true (and hasQuestion=true/false as observed).
  - Be strict on "exactly one" in followUpMode: if zero or more than one, shouldRegenerate=true.
  - Keep "reason" short and practical (e.g., "no question in follow-up mode", "two stacked questions", "off-topic toward 'live interview'").
  `;
  
      const auditMessages = [
        { role: 'system', content: auditPrompt },
        { role: 'user', content: `assistant:\n${aiResponse}\n\nuser_latest:\n${userMessage}\n\nrecent:\n${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}` }
      ];
  
      const auditCompletion = await openaiClient.chat.completions.create({
        model: "gpt-4.1",
        messages: auditMessages,
        max_tokens: 220,
        temperature: 0.2
      });
  
      let raw = auditCompletion.choices[0].message.content?.trim() || "";
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      }
  
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse question presence audit JSON:', e);
        console.log('Raw presence audit:', raw);
        // Conservative return: do not force regeneration, avoid infinite loop
        return { hasQuestion: true, reason: 'Failed to parse audit response', confidence: 0.0, shouldRegenerate: false };
      }
  
      // Fallback fields
      if (typeof parsed.hasQuestion !== 'boolean') parsed.hasQuestion = /[\?\uFF1F]/.test(aiResponse);
      if (typeof parsed.confidence !== 'number') parsed.confidence = 0.8;
      if (typeof parsed.shouldRegenerate !== 'boolean') parsed.shouldRegenerate = false;
      if (typeof parsed.reason !== 'string') parsed.reason = '';
  
      console.log(`Question Presence Audit Result: ${JSON.stringify(parsed)}`);
      return parsed;
  
    } catch (error) {
      console.error('Question presence audit error:', error);
      return { hasQuestion: true, reason: 'Audit LLM error: ' + error.message, confidence: 0.0, shouldRegenerate: false };
    }
  }


// Use LLM to generate prefix/suffix connectors, but never alter the core follow-up question itself
// Return { prefix, suffix } two short phrases, which the server will concatenate with the original follow-up
async function polishFollowupConnectors({
      followupPrompt,
    currentQuestion,
    conversationHistory,
    styleHints = {}
}) {
    try {
        if (!openaiClient) {
            return { prefix: "", suffix: "" };
        }
        const recent = conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n");
        const sys = `
        You write tiny connective phrases around a given follow-up QUESTION.
        STRICT RULES:
        - NEVER alter, paraphrase, or reformat the QUESTION. You only supply "prefix" and "suffix".
        - Tone: warm, neutral, concise, interview-like; no emojis; avoid repetition; no markdown.
        - Fit the immediate context smoothly (assume English UI unless input obviously in Chinese).
        - Keep them short: prefix ≤ 120 chars, suffix ≤ 120 chars.
        - If context is sensitive, acknowledge gently (e.g., "Thanks for sharing that.").
        OUTPUT JSON ONLY:
        { "prefix": "...", "suffix": "..." }
        `;
        const user = `
        CURRENT QUESTION: "${currentQuestion || "N/A"}"
        FOLLOW-UP (DO NOT CHANGE): "${followupPrompt}"
        RECENT CONTEXT:
        ${recent || "(empty)"}
        OPTIONAL STYLE HINTS: ${JSON.stringify(styleHints || {})}
        `;
        const resp = await openaiClient.chat.completions.create({
            model: "gpt-4.1-mini",
            temperature: 0.3,
            max_tokens: 180,
            messages: [
                { role: "system", content: sys.trim() },
                { role: "user", content: user.trim() }
            ]
        });
        let raw = resp.choices?.[0]?.message?.content?.trim() || "";
        if (raw.startsWith("```")) {
            raw = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        }
        let parsed = {};
        try { parsed = JSON.parse(raw); } catch {}
        let prefix = (parsed.prefix || "").trim();
        let suffix = (parsed.suffix || "").trim();
        // Safeguard: Prevent the model from inserting the follow-up question itself into the prefix/suffix, which would cause duplication
        const q = (followupPrompt || "").trim();
        if (prefix.includes(q)) prefix = prefix.replace(q, "").trim();
        if (suffix.includes(q)) suffix = suffix.replace(q, "").trim();
        // Length control
        if (prefix.length > 200) prefix = prefix.slice(0, 200).trim();
        if (suffix.length > 200) suffix = suffix.slice(0, 200).trim();
        return { prefix, suffix };
    } catch (e) {
        console.log("polishFollowupConnectors error:", e.message);
        return { prefix: "", suffix: "" };
    }
}
    // ============================================================================
    

// Regenerate response with ONE on-topic question (used when presence audit says shouldRegenerate)
async function regenerateResponseWithQuestions(
    userMessage,
    originalResponse,
    currentQuestion,
    conversationHistory,
    isFinalQuestionFlag,
    followUpMode
  ) {
    if (!openaiClient) {
      console.log('⚠️  OpenAI client not available - skipping response regeneration');
      return null;
    }
  
    try {
      // Use centralized keyword configuration
      const currentK = deriveQuestionKeywordsFromFollowups(currentQuestion);
  
      const regeneratePrompt = `
  You are a rewriting assistant. Produce EXACTLY ONE interrogative sentence that:
  - stays strictly on the CURRENT QUESTION's topic,
  - targets concrete details likely missing (time/people/result, numbers, obstacles, trade-offs, etc.),
  - is natural and concise (<=220 characters),
  - ends with "?" and contains no other question mark,
  - contains no preface or explanation—return the question only.
  
  CURRENT QUESTION: "${currentQuestion}"
  CURRENT TOPIC KEYWORDS (stay within): [${currentK.join(", ")}]
  
  Original user: ${userMessage}
  Original assistant: ${originalResponse}
  
  Return ONLY the single question (no quotes, no markdown).`;
  
      const regenMessages = [
        { role: 'system', content: regeneratePrompt },
        { role: 'user', content: conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n') }
      ];
  
      const regen = await openaiClient.chat.completions.create({
        model: "gpt-4.1",
        messages: regenMessages,
        max_tokens: 120,
        temperature: 0.3,
        top_p: 0.3
      });
  
      let out = regen.choices[0].message.content.trim();
  
      // strip fences if any
      if (out.startsWith('```')) {
        out = out.replace(/^```json?\s*/i,'').replace(/```$/,'').trim();
      }
  
      // Validate: exactly one question mark, length limit, non-empty
      const qmCount = (out.match(/\?/g) || []).length;
      if (!out || qmCount !== 1 || out.length > 220) {
        // Try salvage: take first sentence ending with ?
        const m = out.match(/[^?]*\?/);
        if (m) out = m[0].trim();
      }
  
      const finalQmCount = (out.match(/\?/g) || []).length;
      if (!out || finalQmCount !== 1 || out.length > 220) {
        console.log('Regenerate validation failed; skipping replacement');
        return null;
      }
      return out;
  
    } catch (error) {
      console.error('Response regeneration error:', error);
      return null;
    }
  }
  
  // Polish response using completion audit feedback (when verdict=REQUIRE_MORE)
  async function polishResponseWithAuditFeedback(
    userMessage,
    originalResponse,
    auditResult,          // from completion audit (PSS)
    currentQuestion,
    conversationHistory,
    isFinalQuestionFlag,
    followUpMode
  ) {
    if (!openaiClient) {
      console.log('⚠️  OpenAI client not available - skipping response polishing');
      return null;
    }
  
    try {
      // If already passed, no need to rewrite
      if (auditResult && auditResult.verdict === 'ALLOW_NEXT_QUESTION') return null;
  
      // Prefer to use the next uncovered follow-up suggested by the coverage audit
      const nextFU = auditResult?.next_followup?.prompt
        || (Array.isArray(auditResult?.followUpQuestions) && auditResult.followUpQuestions[0])
        || null;
      const missing = Array.isArray(auditResult?.missing) && auditResult.missing.length ? auditResult.missing[0] : null;
      const suggested = nextFU;
      // Use centralized keyword configuration
      const currentK = deriveQuestionKeywordsFromFollowups(currentQuestion);
  
      const polishPrompt = `
  You rewrite the assistant's next message into EXACTLY ONE targeted question to address the audit's gap.
  
  Constraints:
  - Stay strictly on CURRENT QUESTION.
  - When helpful, stay aligned with these topical hints (do not invent new topics):
    ${currentK && currentK.length ? currentK.join(", ") : "(none)"}
  
  CURRENT QUESTION: "${currentQuestion}"
  CURRENT TOPIC KEYWORDS: [${currentK.join(", ")}]
  
  Original user: ${userMessage}
  Original assistant: ${originalResponse}
  
  AUDIT (compact):
  verdict=${auditResult?.verdict}; missing=${missing}; suggested="${suggested ?? ''}"
  
  Return ONLY the single question.`;
  
      const polishMessages = [
        { role: 'system', content: polishPrompt },
        { role: 'user', content: conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n') }
      ];
  
      const polish = await openaiClient.chat.completions.create({
        model: "gpt-4.1",
        messages: polishMessages,
        max_tokens: 120,
        temperature: 0.3,
        top_p: 0.3
      });
  
      let out = polish.choices[0].message.content.trim();
      if (out.startsWith('```')) {
        out = out.replace(/^```json?\s*/i,'').replace(/```$/,'').trim();
      }
  
      // Validate: exactly one '?', length limit
      const qmCount = (out.match(/\?/g) || []).length;
      if (!out || qmCount !== 1 || out.length > 220) {
        const m = out.match(/[^?]*\?/);
        if (m) out = m[0].trim();
      }
      const finalQmCount = (out.match(/\?/g) || []).length;
      if (!out || finalQmCount !== 1 || out.length > 220) {
        console.log('Polish validation failed; keeping original response');
        return null;
      }
      return out;
  
    } catch (error) {
      console.error('Response polishing error:', error);
      return null;
    }
  }
// AI-based privacy detection function with conversation context
async function detectPrivacyWithAI(userMessage, conversationContext = null) {
    if (!openaiClient) {
        return { error: 'AI model not available' };
    }

    try {
        // Build context-aware prompt - only consider conversation before and after current message
        let contextInfo = '';
        
        if (conversationContext && conversationContext.length > 0) {
            // Find the current message index in the conversation
            const currentMessageIndex = conversationContext.findIndex(msg => msg.content === userMessage);
            
            if (currentMessageIndex !== -1) {
                // Get messages before and after the current message
                const beforeMessages = conversationContext.slice(0, currentMessageIndex);
                const afterMessages = conversationContext.slice(currentMessageIndex + 1);
                
                // Extract user messages from before and after
                const beforeUserMessages = beforeMessages
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .slice(-3); // Last 3 messages before
                
                const afterUserMessages = afterMessages
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .slice(0, 3); // First 3 messages after
                
                if (beforeUserMessages.length > 0 || afterUserMessages.length > 0) {
                    contextInfo = `\n\nCONVERSATION CONTEXT:\n`;
                    if (beforeUserMessages.length > 0) {
                        contextInfo += `Messages before: ${beforeUserMessages.join(' | ')}\n`;
                    }
                    if (afterUserMessages.length > 0) {
                        contextInfo += `Messages after: ${afterUserMessages.join(' | ')}`;
                    }
                }
            }
        }

        // Step 1: Detection LLM - Identify PII and create numbered placeholders
        const detectionPrompt = `You are an expert in cybersecurity and data privacy. You are now
tasked to detect PII from the given text, using the following taxonomy only:

ADDRESS
IP_ADDRESS
URL
SSN
PHONE_NUMBER
EMAIL
DRIVERS_LICENSE
PASSPORT_NUMBER
TAXPAYER_IDENTIFICATION_NUMBER
ID_NUMBER
NAME
USERNAME
KEYS: Passwords, passkeys, API keys, encryption keys, and any
other form of security keys.
GEOLOCATION: Places and locations, such as cities, provinces,
countries, international regions, or named infrastructures
(e.g., bus stops, bridges, etc.).
AFFILIATION: Names of organizations, such as public and private companies, schools, universities, public institutions,
prisons, healthcare institutions, non-governmental organizations, churches, etc. This includes university names like "Carnegie Mellon", "MIT", "Stanford", etc.
DEMOGRAPHIC_ATTRIBUTE: Demographic attributes of a
person, such as native language, descent, heritage, ethnicity,
nationality, religious or political group, birthmarks, ages,
sexual orientation, gender, and sex.
TIME: Description of a specific date, time, or duration.
HEALTH_INFORMATION: Details concerning an individual's
health status, medical conditions, treatment records, and
health insurance information.
FINANCIAL_INFORMATION: Financial details such as bank account numbers, credit card numbers, investment records,
salary information, and other financial statuses or activities.
EDUCATIONAL_RECORD: Educational background details, including academic records, transcripts, degrees, and certifications.

For the given message that a user sends to a chatbot, identify all the personally identifiable information using the above taxonomy only.
Note that the information should be related to a real person not in a public context, but okay if not uniquely identifiable.
Result should be in its minimum possible unit.

IMPORTANT: For each detected PII, assign a numbered placeholder (e.g., NAME1, NAME2, EMAIL1, etc.) that counts across the entire conversation history. The numbering should be sequential across all conversations, not just within a single message. For example, if NAME1 was used in a previous message, the next name should be NAME2.

DUPLICATE ENTITY DETECTION: If you detect the same entity ("Carnegie Mellon") that was mentioned before, use the same placeholder number. For example, if "Carnegie Mellon" was previously assigned AFFILIATION1, use AFFILIATION1 again for the same entity.

CRITICAL CLASSIFICATION RULES:
- "Carnegie Mellon", "MIT", "Stanford", etc. should be classified as AFFILIATION, not NAME
- Academic fields, majors, and subjects are EDUCATIONAL_RECORD
- Only actual person names (like "John Smith", "Sarah Johnson") should be classified as NAME
- Universities and organizations should be classified as AFFILIATION

Use this exact format:
{
  "privacy_issue": true/false,
  "detected_pii": [
    {
      "type": "PII_CATEGORY",
      "original_text": "exact_text_found",
      "placeholder": "CATEGORY1",
      "explanation": "brief_reason"
    }
  ],
  "text_with_placeholders": "original_text_with_PII_replaced_by_placeholders",
  "affected_text": "comma_separated_list_of_all_detected_texts"
}

If no privacy issues found, respond with:
{
  "privacy_issue": false,
  "detected_pii": [],
  "text_with_placeholders": "original_text_unchanged",
  "affected_text": null
}

Current user message: "${userMessage}"${contextInfo}`;

        // Step 1: Detection LLM - Identify PII and create numbered placeholders
        const detectionCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                { role: "system", content: "You are a privacy detection expert. Analyze messages for privacy and security issues considering conversation context and respond with ONLY valid JSON." },
                { role: "user", content: detectionPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
        });
        const detectionResponseText = detectionCompletion.choices[0].message.content;
        
        // Clean the detection response text to extract JSON
        let cleanedDetectionResponse = detectionResponseText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedDetectionResponse.startsWith('```json')) {
            cleanedDetectionResponse = cleanedDetectionResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedDetectionResponse.startsWith('```')) {
            cleanedDetectionResponse = cleanedDetectionResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse detection response
        let detectionData;
        try {
            detectionData = JSON.parse(cleanedDetectionResponse);
        } catch (parseError) {
            console.error('Failed to parse AI detection response:', parseError);
            console.error('Original response:', detectionResponseText);
            console.error('Cleaned response:', cleanedDetectionResponse);
            throw new Error('Invalid JSON response from detection AI');
        }
        
        // If no privacy issues detected, return early
        if (!detectionData.privacy_issue || !detectionData.detected_pii || detectionData.detected_pii.length === 0) {
            return {
                privacy_issue: false,
                type: null,
                suggestion: null,
                explanation: null,
                affected_text: null,
                sensitive_text: null
            };
        }
        
        // Update placeholders with conversation-wide numbering and duplicate detection
        let updatedTextWithPlaceholders = detectionData.text_with_placeholders;
        const updatedDetectedPii = [];
        const session = getSession(null); // Use default session for now
        
        for (const pii of detectionData.detected_pii) {
            // Check if this entity was previously detected in the conversation
            const entityKey = `${pii.original_text.toLowerCase().trim()}_${pii.type}`;
            let existingPlaceholder = null;
            
            // Check if we've seen this entity before in the current session
            if (session.detectedEntities && session.detectedEntities[entityKey]) {
                existingPlaceholder = session.detectedEntities[entityKey];
                console.log(`Reusing placeholder ${existingPlaceholder} for duplicate entity: "${pii.original_text}"`);
            }
            
            let newPlaceholder;
            if (existingPlaceholder) {
                // Use the same placeholder for duplicate entities
                newPlaceholder = existingPlaceholder;
            } else {
                // Generate new placeholder for new entity
                const nextNumber = getNextPlaceholderNumber(pii.type);
                const newFormat = convertToNewPlaceholderFormat(pii.type);
                newPlaceholder = `[${newFormat}${nextNumber}]`;
                
                // Track this new entity
                if (!session.detectedEntities) {
                    session.detectedEntities = {};
                }
                session.detectedEntities[entityKey] = newPlaceholder;
                console.log(`Tracking new entity: "${pii.original_text}" -> ${newPlaceholder}`);
            }
            
            // Update the placeholder in the detected PII
            const updatedPii = {
                ...pii,
                placeholder: newPlaceholder
            };
            updatedDetectedPii.push(updatedPii);
            
            // Replace the placeholder in the text
            const oldPlaceholder = pii.placeholder;
            if (oldPlaceholder && oldPlaceholder !== newPlaceholder) {
                const regex = new RegExp(`\\b${oldPlaceholder}\\b`, 'g');
                updatedTextWithPlaceholders = updatedTextWithPlaceholders.replace(regex, newPlaceholder);
            }
        }
        
        // Update the detection data with conversation-wide numbering
        detectionData.detected_pii = updatedDetectedPii;
        detectionData.text_with_placeholders = updatedTextWithPlaceholders;
        
        // Step 2: Abstraction LLM - Create abstracted text with placeholders
        const abstractionPrompt = `Rewrite the text to abstract the protected information, without changing other parts.

For example:
Input: <Text>I graduated from CMU, and I earn a six-figure salary. Today in the office...</Text><ProtectedInformation>CMU,Today</ProtectedInformation>
Output JSON: {"results": [{"protected": "CMU", "abstracted": "MIT"}, {"protected": "Today", "abstracted": "Yesterday"}]}

Current input:
<Text>${detectionData.text_with_placeholders}</Text>
<ProtectedInformation>${detectionData.affected_text}</ProtectedInformation>

Create abstracted text by replacing the protected information with realistic but fake data (not generic terms). Use "results" as the main key in the JSON object with an array of objects containing "protected" and "abstracted" fields.

For example:
- Names: Replace with fake names like "Brian Johnson", "Sarah Williams"
- Emails: Replace with fake emails like "brian.johnson@example.com"
- Phone numbers: Replace with fake numbers like "(555) 123-4567"
- Addresses: Replace with fake addresses like "123 Oak Street, Springfield, IL 62701"
- Universities: Replace with fake universities like "MIT", "Stanford"
- Companies: Replace with fake companies like "TechCorp", "InnovateInc"

Use this exact format:
{"results": [{"protected": "specific_text", "abstracted": "fake_realistic_data"}, {"protected": "another_text", "abstracted": "another_fake_data"}]}`;

        const abstractionCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                { role: "system", content: "You are a privacy abstraction expert. Create abstracted versions of text with PII replaced by generic terms. Respond with ONLY valid JSON." },
                { role: "user", content: abstractionPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
        });
        const abstractionResponseText = abstractionCompletion.choices[0].message.content;
        
        // Clean the abstraction response text
        let cleanedAbstractionResponse = abstractionResponseText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedAbstractionResponse.startsWith('```json')) {
            cleanedAbstractionResponse = cleanedAbstractionResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedAbstractionResponse.startsWith('```')) {
            cleanedAbstractionResponse = cleanedAbstractionResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse abstraction response
        try {
            const abstractionData = JSON.parse(cleanedAbstractionResponse);
            
            // Handle new results array format
            if (abstractionData.results && Array.isArray(abstractionData.results)) {
                const results = abstractionData.results;
                if (results.length > 0) {
                    // Convert results array to the expected format
                    const protectedTexts = results.map(r => r.protected).join(',');
                    const abstractedTexts = results.map(r => r.abstracted).join(',');
                    
                    // Create before/after suggestion
                    let originalText = detectionData.text_with_placeholders;
                    let abstractedText = originalText;
                    
                    // Replace each protected text with its abstracted version
                    results.forEach(result => {
                        const regex = new RegExp(result.protected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        abstractedText = abstractedText.replace(regex, result.abstracted);
                    });
                    
                    return {
                        privacy_issue: true,
                        type: detectionData.detected_pii[0]?.type || 'PII_DETECTED',
                        suggestion: `Before: "${originalText}"\nAfter: "${abstractedText}"`,
                        explanation: `Protected information abstracted: ${protectedTexts}`,
                        affected_text: protectedTexts,
                        sensitive_text: protectedTexts,
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: abstractedText
                        }
                    };
                } else {
                    // No results found
                    return {
                        privacy_issue: false,
                        type: 'NONE',
                        suggestion: 'No PII detected',
                        explanation: 'No sensitive information found',
                        affected_text: '',
                        sensitive_text: '',
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: detectionData.text_with_placeholders
                        }
                    };
                }
            }
            // Fallback to old format for backward compatibility
            else if (typeof abstractionData.privacy_issue === 'boolean') {
                if (abstractionData.privacy_issue === true) {
                    return {
                        privacy_issue: true,
                        type: abstractionData.type || detectionData.detected_pii[0].type,
                        suggestion: abstractionData.suggestion || null,
                        explanation: abstractionData.explanation || detectionData.detected_pii[0].explanation,
                        affected_text: abstractionData.affected_text || detectionData.affected_text,
                        sensitive_text: abstractionData.sensitive_text || detectionData.affected_text,
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: abstractionData.suggestion ? 
                                abstractionData.suggestion.split('\nAfter: "')[1]?.replace(/"/, '') || detectionData.text_with_placeholders :
                                detectionData.text_with_placeholders
                        }
                    };
                } else {
                    // No privacy issues detected
                    return {
                        privacy_issue: false,
                        type: abstractionData.type || 'NONE',
                        suggestion: abstractionData.suggestion || 'No PII detected',
                        explanation: abstractionData.explanation || 'No sensitive information found',
                        affected_text: abstractionData.affected_text || '',
                        sensitive_text: abstractionData.sensitive_text || '',
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: detectionData.text_with_placeholders
                        }
                    };
                }
            } else {
                throw new Error('Invalid abstraction response format');
            }
        } catch (parseError) {
            console.error('Failed to parse AI abstraction response:', parseError);
            console.error('Original response:', abstractionResponseText);
            console.error('Cleaned response:', cleanedAbstractionResponse);
            throw new Error('Invalid JSON response from abstraction AI');
        }
    } catch (error) {
        console.error('AI privacy detection error:', error);
        return { error: error.message };
    }
}

// Enhanced pattern-based privacy detection with conversation context
function detectPrivacyWithPatterns(userMessage, conversationContext = null) {
    const privacyIssues = [];
    const sensitivePatterns = [
        { 
            pattern: /\b\d{3}-\d{2}-\d{4}\b/, 
            type: 'Social Security Number',
            replacement: 'XXX-XX-XXXX',
            explanation: 'SSN detected'
        },
        { 
            pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 
            type: 'Credit Card Number',
            replacement: '****-****-****-****',
            explanation: 'Credit card number detected'
        },
        { 
            pattern: /\(\d{3}\)\s?\d{3}[-\s]?\d{4}/, 
            type: 'Phone Number',
            replacement: '[Phone Number]',
            explanation: 'Phone number detected'
        },
        { 
            pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, 
            type: 'Email Address',
            replacement: '[Email]',
            explanation: 'Email address detected'
        },
        { 
            pattern: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i, 
            type: 'Full Address',
            replacement: '[Address]',
            explanation: 'Full address detected'
        },
        {
            pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
            type: 'Full Name',
            replacement: '[Name]',
            explanation: 'Full name detected'
        },
        {
            pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
            type: 'Date of Birth',
            replacement: '[Date]',
            explanation: 'Date of birth detected'
        }
    ];

    let hasIssues = false;
    let detectedType = null;
    let suggestion = null;
    let explanation = null;
    let affectedText = userMessage;
    let sensitiveText = null;
    let replacingMessage = userMessage;
    let abstractionMessage = userMessage;

    // Find the first matching pattern and create a complete modified message
    for (const { pattern, type, replacement, explanation: patternExplanation } of sensitivePatterns) {
        if (pattern.test(userMessage)) {
            hasIssues = true;
            detectedType = type;
            explanation = patternExplanation;
            
            // Create complete modified message by replacing the sensitive text
            // For better privacy, try to create more natural replacements
            let modifiedMessage = userMessage;
            
            // Handle specific patterns with conversation-wide numbered placeholders for replacing and fake data for abstraction
            
            if (type === 'Full Address') {
                // Replace full address with conversation-wide numbered placeholder and fake address
                const addressNumber = getNextPlaceholderNumber('ADDRESS', null);
                const addressFormat = convertToNewPlaceholderFormat('ADDRESS');
                replacingMessage = userMessage.replace(pattern, `[${addressFormat}${addressNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '123 Oak Street, Springfield, IL 62701');
            } else if (type === 'Full Name') {
                // Replace full name with conversation-wide numbered placeholder and fake name
                const nameNumber = getNextPlaceholderNumber('NAME', null);
                const nameFormat = convertToNewPlaceholderFormat('NAME');
                replacingMessage = userMessage.replace(pattern, `[${nameFormat}${nameNumber}]`);
                abstractionMessage = userMessage.replace(pattern, 'Brian Johnson');
            } else if (type === 'Phone Number') {
                // Replace phone number with conversation-wide numbered placeholder and fake number
                const phoneNumber = getNextPlaceholderNumber('PHONE_NUMBER', null);
                const phoneFormat = convertToNewPlaceholderFormat('PHONE_NUMBER');
                replacingMessage = userMessage.replace(pattern, `[${phoneFormat}${phoneNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '(555) 123-4567');
            } else if (type === 'Email Address') {
                // Replace email with conversation-wide numbered placeholder and fake email
                const emailNumber = getNextPlaceholderNumber('EMAIL', null);
                const emailFormat = convertToNewPlaceholderFormat('EMAIL');
                replacingMessage = userMessage.replace(pattern, `[${emailFormat}${emailNumber}]`);
                abstractionMessage = userMessage.replace(pattern, 'brian.johnson@example.com');
            } else if (type === 'Social Security Number') {
                const ssnNumber = getNextPlaceholderNumber('SSN', null);
                const ssnFormat = convertToNewPlaceholderFormat('SSN');
                replacingMessage = userMessage.replace(pattern, `[${ssnFormat}${ssnNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '123-45-6789');
            } else if (type === 'Credit Card Number') {
                const creditCardNumber = getNextPlaceholderNumber('FINANCIAL_INFORMATION', null);
                const financialFormat = convertToNewPlaceholderFormat('FINANCIAL_INFORMATION');
                replacingMessage = userMessage.replace(pattern, `[${financialFormat}${creditCardNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '4111-1111-1111-1111');
            } else if (type === 'Date of Birth') {
                const dateNumber = getNextPlaceholderNumber('TIME', null);
                const timeFormat = convertToNewPlaceholderFormat('TIME');
                replacingMessage = userMessage.replace(pattern, `[${timeFormat}${dateNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '01/15/1985');
            } else {
                // Use the default replacement for other patterns
                replacingMessage = userMessage.replace(pattern, replacement);
                abstractionMessage = userMessage.replace(pattern, replacement);
            }
            
            modifiedMessage = replacingMessage; // Keep original behavior for suggestion
            
            suggestion = `Before: "${userMessage}"\nAfter: "${modifiedMessage}"`;
            
            // Extract the matched text
            const match = userMessage.match(pattern);
            if (match) {
                affectedText = match[0];
                sensitiveText = match[0];
            }
            break; // Only handle the first match to avoid multiple replacements
        }
    }

    return {
        privacy_issue: hasIssues,
        type: detectedType,
        suggestion: suggestion,
        explanation: explanation,
        affected_text: affectedText,
        sensitive_text: sensitiveText,
        safer_versions: {
            replacing: hasIssues ? replacingMessage : userMessage,
            abstraction: hasIssues ? abstractionMessage : userMessage
        }
    };
}



// Enhanced conversation-wide privacy analysis
async function analyzeConversationPrivacy(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return { error: 'No conversation history provided' };
    }

    try {
        // Extract all user messages
        const userMessages = conversationHistory
            .filter(msg => msg.role === 'user')
            .map(msg => msg.content);

        if (userMessages.length === 0) {
            return { error: 'No user messages found in conversation' };
        }

        // Analyze each message with conversation context
        const privacyAnalysis = [];
        let totalIssues = 0;

        for (let i = 0; i < userMessages.length; i++) {
            const message = userMessages[i];
            const context = conversationHistory.slice(0, i + 1); // All messages up to current

            try {
                let privacyResult = await detectPrivacyWithAI(message, context);
                if (!privacyResult || privacyResult.error) {
                    privacyResult = detectPrivacyWithPatterns(message, context);
                }

                if (privacyResult.privacy_issue) {
                    totalIssues++;
                }

                privacyAnalysis.push({
                    message_index: i,
                    message: message,
                    privacy_result: privacyResult
                });
            } catch (error) {
                console.error(`Privacy analysis error for message ${i}:`, error);
                privacyAnalysis.push({
                    message_index: i,
                    message: message,
                    privacy_result: { error: error.message }
                });
            }
        }

        // Generate conversation-wide privacy summary
        const summary = {
            total_messages: userMessages.length,
            messages_with_privacy_issues: totalIssues,
            privacy_risk_level: calculateConversationRiskLevel(totalIssues, userMessages.length),
            recommendations: generatePrivacyRecommendations(privacyAnalysis)
        };

        return {
            success: true,
            conversation_analysis: privacyAnalysis,
            summary: summary
        };

    } catch (error) {
        console.error('Conversation privacy analysis error:', error);
        return { error: error.message };
    }
}

// Calculate overall conversation privacy risk level
function calculateConversationRiskLevel(totalIssues, totalMessages) {
    const issuePercentage = (totalIssues / totalMessages) * 100;

    if (issuePercentage > 50) {
        return 'HIGH';
    } else if (issuePercentage > 25) {
        return 'MEDIUM';
    } else if (issuePercentage > 0) {
        return 'LOW';
    } else {
        return 'NONE';
    }
}

// Generate privacy recommendations based on analysis
function generatePrivacyRecommendations(privacyAnalysis) {
    const recommendations = [];
    const issueTypes = new Set();

    privacyAnalysis.forEach(analysis => {
        if (analysis.privacy_result.privacy_issue) {
            if (analysis.privacy_result.type) {
                issueTypes.add(analysis.privacy_result.type);
            }
        }
    });

    if (issueTypes.has('Social Security Number') || issueTypes.has('Credit Card Number')) {
        recommendations.push('CRITICAL: Immediately remove any SSN or credit card information from the conversation');
    }

    if (issueTypes.has('Full Address')) {
        recommendations.push('HIGH: Consider removing or generalizing specific address information');
    }

    if (issueTypes.has('Phone Number') || issueTypes.has('Email Address')) {
        recommendations.push('MEDIUM: Consider removing contact information to prevent unwanted contact');
    }

    if (issueTypes.has('Full Name')) {
        recommendations.push('LOW: Consider using initials or pseudonyms instead of full names');
    }

    if (recommendations.length === 0) {
        recommendations.push('No immediate privacy concerns detected');
    }

    return recommendations;
}

// Analyze Log API with enhanced conversation-wide privacy analysis
app.post('/api/analyze_log', async (req, res) => {
    try {
        const { conversation_log } = req.body;
        
        if (!conversation_log || !Array.isArray(conversation_log)) {
            return res.status(400).json({ error: 'Valid conversation log is required' });
        }

        // Convert conversation log to conversation history format for analysis
        const conversationHistory = conversation_log.map((msg, index) => ({
            role: msg.user ? 'user' : 'assistant',
            content: msg.user || msg.bot || '',
            timestamp: new Date().toISOString(),
            step: index
        }));

        // Use enhanced conversation-wide privacy analysis
        const privacyAnalysis = await analyzeConversationPrivacy(conversationHistory);
        
        if (privacyAnalysis.error) {
            return res.status(500).json({ error: privacyAnalysis.error });
        }

        // Convert back to the expected format for frontend compatibility
        const analyzedLog = conversation_log.map((msg, index) => {
            const privacyResult = privacyAnalysis.conversation_analysis[index];
            return {
                user: msg.user,
                bot: msg.bot,
                privacy: privacyResult && privacyResult.privacy_result.privacy_issue ? privacyResult.privacy_result : null
            };
        });

        res.json({
            success: true,
            analyzed_log: analyzedLog,
            analysis: privacyAnalysis.summary,
            conversation_analysis: privacyAnalysis.conversation_analysis,
            status: 'completed'
        });
    } catch (error) {
        console.error('Log analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Apply Privacy Correction API
app.post('/api/apply_privacy_correction', (req, res) => {
    try {
        const { message_index, original_text, corrected_text, sessionId } = req.body;
        
        if (message_index === undefined || !original_text || !corrected_text) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Get session
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);

        // Update the conversation history with the corrected text
        if (session.conversationHistory[message_index]) {
            session.conversationHistory[message_index].content = corrected_text;
            session.conversationHistory[message_index].corrected = true;
            session.conversationHistory[message_index].original_text = original_text;
        }

        res.json({
            success: true,
            message: 'Correction applied successfully',
            updated_conversation: session.conversationHistory
        });
    } catch (error) {
        console.error('Apply correction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload Questions API
app.post('/api/upload_questions', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const uploadedQuestions = JSON.parse(fileContent);

        // Clean up uploaded file
        fs.removeSync(req.file.path);

        res.json({
            success: true,
            message: 'Questions uploaded successfully',
            questions_count: uploadedQuestions.length
        });
    } catch (error) {
        console.error('Upload questions error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

// Upload Return Log API
app.post('/api/upload_return', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const uploadedReturnLog = JSON.parse(fileContent);

        // Clean up uploaded file
        fs.removeSync(req.file.path);

        res.json({
            success: true,
            message: 'Return log uploaded successfully',
            log_entries: uploadedReturnLog.length
        });
    } catch (error) {
        console.error('Upload return log error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

// Set Mode API
app.post('/api/set_mode', (req, res) => {
    try {
        const { mode } = req.body;
        
        if (!mode) {
            return res.status(400).json({ error: 'Mode is required' });
        }

        currentMode = mode;
        
        res.json({
            success: true,
            message: `Mode set to ${mode}`,
            current_mode: currentMode
        });
    } catch (error) {
        console.error('Set mode error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset API
app.post('/api/reset', (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (sessionId && sessions.has(sessionId)) {
            // Reset specific session
            const session = sessions.get(sessionId);
            session.conversationHistory = [];
            session.uploadedQuestions = [];
            session.uploadedReturnLog = [];
            session.currentMode = 'chat';
            session.activeChatSession = null;
            
            // Reset PII counters for this session
            Object.keys(session.globalPiiCounters).forEach(key => {
                session.globalPiiCounters[key] = 0;
            });
            
            // Reset detected entities tracking
            session.detectedEntities = {};
            
            console.log(`Reset session: ${sessionId}`);
        } else {
            // Reset all sessions (fallback for backward compatibility)
            sessions.clear();
            console.log('Reset all sessions');
        }
        
        res.json({
            success: true,
            message: 'Conversation and data reset successfully',
            session_id: sessionId
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Conversation Privacy Analysis API
app.post('/api/conversation_privacy_analysis', async (req, res) => {
    try {
        const { conversation_history } = req.body;
        
        if (!conversation_history || !Array.isArray(conversation_history)) {
            return res.status(400).json({ error: 'Valid conversation history is required' });
        }

        // Use enhanced conversation-wide privacy analysis
        const privacyAnalysis = await analyzeConversationPrivacy(conversation_history);
        
        if (privacyAnalysis.error) {
            return res.status(500).json({ error: privacyAnalysis.error });
        }

        res.json({
            success: true,
            analysis: privacyAnalysis
        });
    } catch (error) {
        console.error('Conversation privacy analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export API
app.post('/api/export', (req, res) => {
    try {
        const { export_type, data, sessionId } = req.body;
        
        if (!export_type) {
            return res.status(400).json({ error: 'Export type is required' });
        }

        // Get session for conversation export
        let session = null;
        if (export_type === 'conversation') {
            const currentSessionId = sessionId || generateSessionId();
            session = getSession(currentSessionId);
        }

        let exportData = {};
        
        switch (export_type) {
            case 'conversation':
                exportData = {
                    conversation_history: session ? session.conversationHistory : [],
                    export_timestamp: new Date().toISOString()
                };
                break;
            case 'analysis':
                exportData = {
                    analysis: data,
                    export_timestamp: new Date().toISOString()
                };
                break;
            case 'privacy_report':
                exportData = {
                    privacy_issues: data,
                    export_timestamp: new Date().toISOString()
                };
                break;
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }

        res.json({
            success: true,
            data: exportData,
            filename: `${export_type}_${new Date().toISOString().split('T')[0]}.json`
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// S3 Upload API
app.post('/api/upload-to-s3', async (req, res) => {
    try {
        const { exportData, prolificId } = req.body;
        
        if (!exportData) {
            return res.status(400).json({ error: 'Export data is required' });
        }

        if (!s3Client) {
            return res.status(500).json({ error: 'S3 client not configured' });
        }

        // Generate unique filename with prolific ID and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = prolificId ? 
            `${prolificId}_conversation_${timestamp}.json` : 
            `conversation_${timestamp}.json`;

        // Prepare the data for upload
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Extract mode from export data
        const mode = exportData.metadata && exportData.metadata.mode ? exportData.metadata.mode : 'unknown';
        
        // Upload to S3
        const uploadParams = {
            Bucket: 'prolificjson',
            Key: filename,
            Body: jsonData,
            ContentType: 'application/json',
            Metadata: {
                'prolific-id': prolificId || 'unknown',
                'upload-timestamp': new Date().toISOString(),
                'conversation-length': exportData.conversation ? exportData.conversation.length.toString() : '0',
                'mode': mode
            }
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log(`✅ Successfully uploaded ${filename} to S3 (Mode: ${mode})`);

        res.json({
            success: true,
            message: 'File uploaded to S3 successfully',
            filename: filename,
            s3_url: `s3://prolificjson/${filename}`,
            mode: mode
        });

    } catch (error) {
        console.error('S3 upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload to S3',
            details: error.message 
        });
    }
});

// API Health Check
app.get('/', (req, res) => {
    res.json({
        message: 'Privacy Demo Backend API is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        endpoints: {
            chat: '/api/chat',
            privacy_detection: '/api/privacy_detection',
            test_connection: '/api/test_connection',
            set_mode: '/api/set_mode',
            reset: '/api/reset',
            export: '/api/export',
            generate_user_agent_response: '/api/generate_user_agent_response'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Privacy Demo Backend API running on port ${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api/*`);
    console.log(`🔍 Health check: http://localhost:${PORT}/`);
    console.log(`🔧 CORS origins configured:`, corsOrigins);
    console.log(`🔧 Environment CORS_ORIGINS:`, process.env.CORS_ORIGINS);
    console.log(`🌐 Server listening on all interfaces (0.0.0.0)`);
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
});

// User Agent Response Generation API
app.post('/api/generate_user_agent_response', async (req, res) => {
    try {
        const { botMessage, conversationHistory = [], userProfile = null } = req.body;
        
        if (!botMessage || botMessage.trim() === '') {
            return res.status(400).json({ error: 'Bot message is required' });
        }

        if (!openaiClient) {
            return res.status(500).json({ error: 'LLM service not available' });
        }

        // Generate user agent response using LLM
        const userAgentResponse = await generateUserAgentResponse(botMessage, conversationHistory, userProfile);
        
        res.json({
            success: true,
            user_agent_response: userAgentResponse,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User agent response generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate user agent response',
            details: error.message 
        });
    }
});

// Helper function to generate user agent response using LLM
async function generateUserAgentResponse(botMessage, conversationHistory = [], userProfile = null) {
    if (!openaiClient) {
        throw new Error('LLM service not available');
    }

    try {
        // Build context from conversation history
        let conversationContext = '';
        if (conversationHistory && conversationHistory.length > 0) {
            const recentMessages = conversationHistory.slice(-6); // Last 6 messages for context
            conversationContext = `\n\nRecent conversation context:\n${recentMessages.map(msg => 
                `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`
            ).join('\n')}`;
        }

        // Build user profile context
        let profileContext = '';
        if (userProfile) {
            profileContext = `\n\nUser Profile:\n${JSON.stringify(userProfile, null, 2)}`;
        }

        const systemPrompt = `You are a helpful AI assistant that generates realistic, reluctant user responses for a user agent in a conversation about AI and job interviews.

Your task is to generate a natural, personal response to the bot's question that feels authentic and shows realistic human reluctance. The response should:

1. Be initially reluctant and guarded - users don't immediately open up about personal experiences
2. Start with short, vague answers that gradually become more detailed
3. Show realistic hesitation and privacy concerns
4. Be conversational but not overly enthusiastic
5. Include realistic personal details that emerge gradually
6. Reflect common human behavior of being cautious about sharing personal information

IMPORTANT GUIDELINES:
- Generate responses that feel like they come from a real, cautious person
- Start with brief, non-committal answers (1-2 sentences initially)
- Show gradual willingness to share more details as the conversation progresses
- Include realistic hesitation phrases like "I don't know", "Maybe", "I guess", "Sort of"
- Make responses feel natural and human - not robotic or overly formal
- Be consistent with the user's background if mentioned before
- Avoid overly enthusiastic or immediately open responses
- Show realistic privacy concerns and reluctance

RESPONSE PROGRESSION PATTERN:
- First response: Very brief, vague, reluctant (1-2 sentences)
- Second response: Slightly more open, but still guarded (2-3 sentences)
- Third response: More willing to share, but still cautious (3-4 sentences)
- Later responses: Gradually more open and detailed as trust builds

RESPONSE CATEGORIES WITH RELUCTANCE:
- Education: Start vague ("I studied... something technical"), then add details
- Work: Start general ("I work in tech"), then add specific job titles/companies
- AI Experience: Start hesitant ("I've used some AI tools"), then share more
- Interview Preparation: Start guarded ("I prepare like everyone else"), then open up
- AI Concerns: Show realistic worries about privacy and job security
- AI Benefits: Acknowledge benefits but remain somewhat skeptical

${profileContext}

${conversationContext}

Generate a natural, reluctant personal response to this question: "${botMessage}"

Response:`;

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4.1",
            messages: messages,
            max_tokens: 300,
            temperature: 0.8
        });

        const response = completion.choices[0].message.content.trim();
        
        // Validate the response
        if (!response || response.length === 0) {
            throw new Error('Generated response is empty');
        }

        console.log(`User Agent Response Generated: "${response}"`);
        return response;

    } catch (error) {
        console.error('Error generating user agent response:', error);
        throw error;
    }
} 

// (Removed) Static QUESTION_KEYWORDS helpers.
// Use deriveQuestionKeywordsFromFollowups(...) instead.
function deriveOtherQuestionKeywords(currentQuestion) {
    try {
        const map = typeof FOLLOWUPS_BY_QUESTION !== "undefined" ? FOLLOWUPS_BY_QUESTION : {};
        const set = new Set();
        for (const q of Object.keys(map)) {
        if (q === currentQuestion) continue;
        for (const k of deriveQuestionKeywordsFromFollowups(q)) set.add(k);
        }
        return Array.from(set);
    } catch { return []; }
}

function getQuestionKey(q){ return (q||'').trim().toLowerCase(); }
function canAskFollowup(session, qNow, epochAtDecision){
    const key = getQuestionKey(qNow);
    const st = session.qStatus[key] || 'active';
    const sameEpoch = session.qEpoch === epochAtDecision;
    return st === 'active' && sameEpoch;
}
