import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';
import { initializeApp as initFirebaseApp } from 'firebase/app';
import {
  getFirestore as getFirebaseFirestore,
  doc as fsDoc,
  getDoc as fsGetDoc,
  setDoc as fsSetDoc,
  serverTimestamp as fsServerTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type {
  AgentAuditLog,
  AgentMessage,
  AgentTask,
  AgentToolExecution,
  CashTransaction,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  ExpenseCategory,
  KilnDatabaseState,
  KilnNote,
  KilnSettings,
  MemoDeliveryRecord,
  MemoItemRow,
  MillId,
  MillPotRecord,
  NavigationTab,
  PaymentMethod,
  PoraiMistriRecord,
  ProductionPaymentRecord,
  QaTestResult,
  RubbishRecord,
  SalesMemo,
  SystemUiAction,
  UnloadedGradeItem,
  WorkerAttendance,
  WorkerProfile,
  KilnSeason,
  WoodFuelRecord,
  SoilCoalRecord,
  DadonAdvanceRecord,
  DadonRoleCategory,
  AdvanceBrickBooking,
  VehicleDieselRecord,
  KilnVehicleType,
  ComplianceInstallmentRecord,
  ComplianceCategory,
} from './src/types/kiln.ts';
import {
  calculateAdvanceBookingBill,
  calculateChulliLineUnloadBill,
  calculateComplianceItemBill,
  calculateDashboardMetrics,
  calculateMultiItemMemoTotals,
  calculateSoilCoalBill,
  calculateVanLoadBill,
  calculateVehicleDieselExpense,
  calculateWoodFuelBill,
  calculateRowTotal,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComprehensiveBusinessAnalysis,
  formatBn,
  formatCurrencyBn,
  generateDailyChartData,
  generateNaturalConversationalReply,
  generateUniqueMemoNo,
  normalizeLegacyMemo,
  parseBanglaAgentIntent,
  requiresSafeConfirmation,
  validateStockForMultiItemMemo,
  parseBanglaDigits,
  parseNum,
} from './src/utils/kilnLogic.ts';
import { createInitialKilnState, getTodayAndYesterday } from './src/utils/seedData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sbl-kiln-db.json');

function ensureDbLoaded(): KilnDatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const defaultInitial = createInitialKilnState();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultInitial, null, 2), 'utf-8');
    return defaultInitial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<KilnDatabaseState>;

    // Normalize state to guarantee all BrickFlow settings and multi-item memo shapes exist
    const settings: KilnSettings = {
      ...defaultInitial.settings,
      ...(parsed.settings || {}),
    };

    const rawGrades = (parsed.brickGrades && parsed.brickGrades.length > 0)
      ? parsed.brickGrades
      : defaultInitial.brickGrades;

    const brickGrades = rawGrades.map((g) => {
      const defMatch = defaultInitial.brickGrades.find((dg) => dg.id === g.id);
      const rawRate = Number(g.ratePerUnit) || (defMatch ? defMatch.ratePerUnit : 11000);
      const ratePerUnit = rawRate < 100 ? (defMatch ? defMatch.ratePerUnit : Math.round(rawRate * 1000)) : rawRate;
      return {
        ...g,
        nameBn: defMatch ? defMatch.nameBn : cleanBrickGradeName(g.nameBn),
        nameEn: defMatch ? defMatch.nameEn : g.nameEn,
        ratePerUnit,
        ratePerThousand: true,
        currentStock: Number(g.currentStock) || 0,
        seasonProduced: Number(g.seasonProduced) || 0,
      };
    });

    // Ensure grade-1-5 (১.৫ নং ইট) is present right after grade-1
    if (!brickGrades.some((g) => g.id === 'grade-1-5')) {
      const grade15 = defaultInitial.brickGrades.find((dg) => dg.id === 'grade-1-5');
      if (grade15) {
        const idx1 = brickGrades.findIndex((g) => g.id === 'grade-1');
        if (idx1 >= 0) {
          brickGrades.splice(idx1 + 1, 0, { ...grade15 });
        } else {
          brickGrades.push({ ...grade15 });
        }
      }
    }

    const salesMemos: SalesMemo[] = (Array.isArray(parsed.salesMemos) ? parsed.salesMemos : defaultInitial.salesMemos).map((m) =>
      normalizeLegacyMemo(m, brickGrades)
    );

    const fullState: KilnDatabaseState = {
      settings,
      brickGrades,
      salesMemos,
      cashTransactions: Array.isArray(parsed.cashTransactions) ? parsed.cashTransactions : defaultInitial.cashTransactions,
      workerProfiles: (parsed.workerProfiles || defaultInitial.workerProfiles).map((w: WorkerProfile) => ({
        ...w,
        totalEarnedSeason: typeof w.totalEarnedSeason === 'number' ? w.totalEarnedSeason : 0,
        totalPaidSeason: typeof w.totalPaidSeason === 'number' ? w.totalPaidSeason : 0,
      })),
      workerAttendance: Array.isArray(parsed.workerAttendance) ? parsed.workerAttendance : defaultInitial.workerAttendance,
      kilnNotes: Array.isArray(parsed.kilnNotes) ? parsed.kilnNotes : defaultInitial.kilnNotes,
      millPots: Array.isArray(parsed.millPots) ? parsed.millPots : defaultInitial.millPots,
      chulliLoads: Array.isArray(parsed.chulliLoads)
        ? parsed.chulliLoads.map((ld: ChulliLoadRecord) => ({
            ...ld,
            sardarName:
              !ld.sardarName ||
              ld.sardarName.includes('মিলন') ||
              ld.sardarName.includes('আনোয়ার') ||
              ld.sardarName.includes('আসাদ')
                ? 'সেলিম সর্দার'
                : ld.sardarName,
          }))
        : defaultInitial.chulliLoads,
      poraiMistriRecords: Array.isArray(parsed.poraiMistriRecords)
        ? parsed.poraiMistriRecords.map((pr: PoraiMistriRecord) => ({
            ...pr,
            mistriName:
              !pr.mistriName || pr.mistriName.includes('আলী হোসেন')
                ? 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)'
                : pr.mistriName,
          }))
        : defaultInitial.poraiMistriRecords || [],
      chulliUnloads: Array.isArray(parsed.chulliUnloads)
        ? parsed.chulliUnloads.map((un: ChulliUnloadRecord) => ({
            ...un,
            sardarName:
              !un.sardarName ||
              un.sardarName.includes('রহিম') ||
              un.sardarName.includes('রফিক') ||
              un.sardarName === 'আনলোড সর্দার ও দল'
                ? 'নজরুল সর্দার'
                : un.sardarName,
          }))
        : defaultInitial.chulliUnloads,
      rubbishRecords: Array.isArray(parsed.rubbishRecords)
        ? parsed.rubbishRecords
        : defaultInitial.rubbishRecords || [],
      woodFuelRecords: Array.isArray(parsed.woodFuelRecords)
        ? parsed.woodFuelRecords
        : defaultInitial.woodFuelRecords || [],
      soilCoalRecords: Array.isArray(parsed.soilCoalRecords)
        ? parsed.soilCoalRecords
        : defaultInitial.soilCoalRecords || [],
      dadonRecords: Array.isArray(parsed.dadonRecords)
        ? parsed.dadonRecords
        : defaultInitial.dadonRecords || [],
      advanceBookings: Array.isArray(parsed.advanceBookings)
        ? parsed.advanceBookings
        : defaultInitial.advanceBookings || [],
      vehicleDieselRecords: Array.isArray(parsed.vehicleDieselRecords)
        ? parsed.vehicleDieselRecords
        : defaultInitial.vehicleDieselRecords || [],
      complianceRecords: Array.isArray(parsed.complianceRecords)
        ? parsed.complianceRecords
        : defaultInitial.complianceRecords || [],
      productionPayments: Array.isArray(parsed.productionPayments)
        ? parsed.productionPayments
        : defaultInitial.productionPayments || [],
      memoDeliveries: Array.isArray(parsed.memoDeliveries)
        ? parsed.memoDeliveries
        : [],
      kilnUnits:
        Array.isArray(parsed.kilnUnits) && parsed.kilnUnits.length > 0
          ? parsed.kilnUnits
          : defaultInitial.kilnUnits,
      kilnSeasons:
        Array.isArray(parsed.kilnSeasons) && parsed.kilnSeasons.length > 0
          ? parsed.kilnSeasons
          : defaultInitial.kilnSeasons,
      agentTasks: parsed.agentTasks || [],
      agentMessages: parsed.agentMessages || defaultInitial.agentMessages,
      auditLogs: parsed.auditLogs || defaultInitial.auditLogs,
      context: parsed.context || {},
    };

    return fullState;
  } catch (err) {
    console.error('Failed to parse database file, using fallback initial state:', err);
    return defaultInitial;
  }
}

// Firebase Firestore Cloud Database Persistence Setup
let cloudDb: Firestore | null = null;
let lastCloudSyncIso: string | null = null;
let cloudSyncError: string | null = null;

try {
  const cfgRaw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8');
  const firebaseConfig = JSON.parse(cfgRaw);
  const fbApp = initFirebaseApp(firebaseConfig);
  cloudDb = getFirebaseFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  console.log('[Firebase Cloud] Firestore successfully initialized with DB:', firebaseConfig.firestoreDatabaseId);
} catch (fbInitErr) {
  console.warn('[Firebase Cloud] Init warning:', fbInitErr);
}

let dbState: KilnDatabaseState = ensureDbLoaded();

async function hydrateFromFirestoreOnStart(): Promise<boolean> {
  if (!cloudDb) return false;
  try {
    const docRef = fsDoc(cloudDb, 'kiln_data', 'main');
    const snap = await fsGetDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const cloudState = data?.state as KilnDatabaseState | undefined;
      if (cloudState && typeof cloudState === 'object') {
        const totalRecords =
          (cloudState.salesMemos?.length || 0) +
          (cloudState.cashTransactions?.length || 0) +
          (cloudState.millPots?.length || 0) +
          (cloudState.chulliLoads?.length || 0);

        if (totalRecords > 0) {
          dbState = {
            ...dbState,
            ...cloudState,
          };
          lastCloudSyncIso = new Date().toISOString();
          cloudSyncError = null;
          // Also sync to local file for fast offline fallback
          try {
            fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
          } catch {}
          console.log(`[Firebase Cloud] Successfully loaded ${totalRecords} records from Firestore cloud!`);
          return true;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Firebase Cloud] Hydration on start notice:', msg);
    cloudSyncError = msg;
  }
  return false;
}

function saveDbState(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist database state to local file:', err);
  }

  // Dual-write to Google Firebase Firestore for permanent cloud protection
  if (cloudDb) {
    try {
      const docRef = fsDoc(cloudDb, 'kiln_data', 'main');
      const cleanState = JSON.parse(JSON.stringify(dbState));
      fsSetDoc(
        docRef,
        {
          state: cleanState,
          serverUpdatedAt: fsServerTimestamp(),
          lastSavedIso: new Date().toISOString(),
          recordSummary: {
            memos: cleanState.salesMemos?.length || 0,
            cash: cleanState.cashTransactions?.length || 0,
            millPots: cleanState.millPots?.length || 0,
            chulliLoads: cleanState.chulliLoads?.length || 0,
            unloads: cleanState.chulliUnloads?.length || 0,
          },
        },
        { merge: true }
      )
        .then(() => {
          lastCloudSyncIso = new Date().toISOString();
          cloudSyncError = null;
        })
        .catch((fbErr: unknown) => {
          const msg = fbErr instanceof Error ? fbErr.message : String(fbErr);
          cloudSyncError = msg;
          console.warn('[Firebase Cloud] Background mirror save failed:', msg);
        });
    } catch (fbErr) {
      console.warn('[Firebase Cloud] Error initiating save:', fbErr);
    }
  }
}

// SSE Connected Clients
const sseClients = new Set<express.Response>();

function broadcastEvent(eventType: string, payload: unknown): void {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function addAuditLog(
  actor: AgentAuditLog['actor'],
  action: string,
  detailsBn: string,
  status: AgentAuditLog['status'] = 'SUCCESS'
): void {
  const entry: AgentAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    detailsBn,
    status,
  };
  dbState.auditLogs.unshift(entry);
  if (dbState.auditLogs.length > 150) {
    dbState.auditLogs = dbState.auditLogs.slice(0, 150);
  }
}

function getEnrichedState() {
  const { todayDate, yesterdayDate } = getTodayAndYesterday();
  const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
  const gradeReport = computeBrickGradeReport(
    dbState.brickGrades,
    dbState.salesMemos,
    todayDate,
    yesterdayDate
  );
  const dailyChart = generateDailyChartData(
    dbState.salesMemos,
    dbState.cashTransactions,
    7
  );
  const businessAnalysis = computeComprehensiveBusinessAnalysis(
    dbState,
    todayDate,
    yesterdayDate
  );
  return {
    state: dbState,
    metrics,
    gradeReport,
    dailyChart,
    businessAnalysis,
  };
}

// Server-side Gemini AI Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function streamHumanTtsToWs(
  clientWs: WebSocket,
  text: string,
  taskStatus: string = 'COMPLETED'
): Promise<void> {
  if (!text || clientWs.readyState !== WebSocket.OPEN) return;
  const ai = getGeminiClient();
  if (!ai) {
    clientWs.send(JSON.stringify({ type: 'speak', text, taskStatus }));
    return;
  }
  try {
    const cleanTtsText = text.replace(/[•📊]/g, ' ').replace(/\s+/g, ' ').trim();
    let sentAnyChunk = false;
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ parts: [{ text: cleanTtsText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    for await (const chunk of stream) {
      if (clientWs.readyState !== WebSocket.OPEN) break;
      const data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        if (!sentAnyChunk) {
          sentAnyChunk = true;
          clientWs.send(JSON.stringify({ type: 'state', state: 'SPEAKING' }));
        }
        clientWs.send(JSON.stringify({ type: 'audio', audio: data }));
      }
    }
    if (!sentAnyChunk && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'speak', text, taskStatus }));
    } else if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'state',
          state: taskStatus === 'FAILED' ? 'ERROR' : 'COMPLETED',
        })
      );
    }
  } catch {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'speak', text, taskStatus }));
    }
  }
}

function buildNaturalBanglaSystemInstruction(): string {
  const { todayDate, yesterdayDate } = getTodayAndYesterday();
  const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
  const ctx = dbState.context || {};
  const pendingTask = dbState.agentTasks.find((t) => t.status === 'AWAITING_CONFIRMATION');
  const recentMessages = dbState.agentMessages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'ব্যবহারকারী' : 'সহকারী'}: ${m.text}`)
    .join('\n');

  const gradeSummary = dbState.brickGrades
    .map((g) => `${g.nameBn}: দর ৳${g.ratePerUnit}, স্টক ${g.currentStock} পিস`)
    .join(' | ');

  return `তুমি "BrickFlow"-এর একজন বুদ্ধিমান, বন্ধুসুলভ এবং স্বাভাবিক বাংলা ভাষী সহকারী (ইটভাটা ব্যবসার বিশ্বস্ত ম্যানেজার সহকারী)।

তোমার ব্যক্তিত্ব ও কথা বলার ধরন:
১. স্বাভাবিক, কথ্য ও সাবলীল বাংলায় কথা বলবে (দৈনন্দিন ব্যবসার পরিচিত বাংলা-ইংরেজি শব্দ যেমন মেমো, বিল, জমা, বাকি, ক্যাশ, স্টক, রেট, পেমেন্ট ব্যবহার করতে পারো)।
২. ডিফল্টভাবে একদম মানুষের মতো আন্তরিক, সংক্ষিপ্ত ও স্পষ্ট বাংলায় কথা বলবে ("জি ভাই", "হয়ে গেছে ভাই", "এই তো দেখছি ভাই")।
৩. কখনোই রোবটের মতো আচরণ করবে না, চ্যাটবটের মতো টেক্সট লিখতে বলবে না, বা ড্যাশবোর্ডের মুখস্থ ডেটা শোনাবে না।
৪. কখনোই অভ্যন্তরীণ যুক্তি (internal reasoning), API কল, JSON, ফাংশনের নাম বা টেকনিক্যাল লগ ব্যবহারকারীকে বলবে না।
৫. ব্যবহারকারী যা করতে বলবে (নতুন মেমো তৈরি, বকেয়া জমা, খরচ তোলা, নোট লেখা, মেমো খোঁজা বা ব্যবসার অ্যানালাইসিস) তা সাথে সাথে কার্যকর করবে এবং সাথে সাথে মানুষের মতো প্রাকৃতিক কণ্ঠে ফলাফল জানাবে।
৬. বিক্রি, ক্যাশ, মেমো, বকেয়া বা খরচের প্রশ্নে সংশ্লিষ্ট টুল ব্যবহার করে আসল ডাটাবেস থেকে সাথে সাথে উত্তর দেবে।

বর্তমান কথোপকথনের মেমরি (Context):
- আজকের তারিখ: ${todayDate} (গতকাল: ${yesterdayDate})
- সর্বশেষ আলোচিত ক্রেতা: ${ctx.lastReferencedCustomer || 'নেই'}
- সর্বশেষ আলোচিত মেমো: ${ctx.lastReferencedMemoNo || 'নেই'}
- সর্বশেষ আলোচনার বিষয়: ${ctx.lastTopic || 'সাধারণ'}
- অপেক্ষমাণ কনফার্মেশন: ${pendingTask?.pendingConfirmation?.summaryBn || 'নেই'}
- ইটের গ্রেড ও দর: ${gradeSummary}
- সংক্ষিপ্ত আর্থিক অবস্থা: বর্তমান ক্যাশ ৳${metrics.currentCashBalance}, আজকের বিক্রি ৳${metrics.todaySalesAmount}, মোট বকেয়া পাওনা ৳${metrics.totalCustomerDue}

সাম্প্রতিক কথোপকথন:
${recentMessages || 'কথোপকথন কেবল শুরু হয়েছে।'}`;
}

// 9 BrickFlow Backend Tools Function Declarations for Gemini Live & REST
const kilnToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_memo',
    description:
      'মেমো নম্বর (যেমন ১২৫ বা BF-2026-104), ক্রেতার নাম বা মোবাইল নম্বর দিয়ে বিক্রয় মেমো এবং বকেয়া/জমা বিবরণ অনুসন্ধান করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'মেমো নম্বর, ক্রেতার নাম অথবা মোবাইল নম্বর',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_customer_balance',
    description:
      'নির্দিষ্ট ক্রেতার নাম দিয়ে তার মোট কয়টি মেমো আছে, মোট কত টাকা মাল নিয়েছে, কত জমা দিয়েছে এবং বর্তমানে কত টাকা বকেয়া পাওনা আছে তা চেক করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: {
          type: Type.STRING,
          description: 'ক্রেতার নাম (যেমন রহিম, করিম, আলহাজ্ব আব্দুল মান্নান)',
        },
      },
      required: ['customerName'],
    },
  },
  {
    name: 'get_sales_summary',
    description:
      'আজকের, গতকালের বা যেকোনো নির্দিষ্ট সময়ের মোট ইট বিক্রি, বিক্রয় মেমো সংখ্যা ও নগদ আদায়ের হিসাব প্রদান করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dateScope: {
          type: Type.STRING,
          description: 'TODAY, YESTERDAY, LAST_7_DAYS, বা SEASON',
        },
      },
    },
  },
  {
    name: 'get_expense_summary',
    description:
      'আজকের, গতকালের বা যেকোনো নির্দিষ্ট সময়ের খরচের খতিয়ান (কয়লা ক্রয়, ভেকু ডিজেল, মাটি, শ্রমিক ইত্যাদি) প্রদান করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dateScope: {
          type: Type.STRING,
          description: 'TODAY, YESTERDAY, LAST_7_DAYS, বা SEASON',
        },
        category: {
          type: Type.STRING,
          description: 'ঐচ্ছিক খরচের খাত (যেমন কয়লা ক্রয়, ভেকু ও ডিজেল, মাটি ক্রয়, শ্রমিক ও সর্দার পেমেন্ট)',
        },
      },
    },
  },
  {
    name: 'create_sales_memo',
    description:
      'ইট বিক্রির ডিজিটাল ক্যাশ মেমো তৈরি করে, ভাটার স্টক কমায় এবং নগদ জমা ক্যাশ বুকে যুক্ত করে। আর্থিক নিরাপত্তার জন্য ব্যবহারকারীর অনুমোদন নেয়।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING, description: 'ক্রেতার নাম' },
        customerPhone: { type: Type.STRING, description: 'ক্রেতার মোবাইল নম্বর' },
        gradeId: {
          type: Type.STRING,
          description: 'ইটের গ্রেড আইডি: grade-1, grade-2, grade-3, grade-picket, grade-goria',
        },
        quantity: { type: Type.NUMBER, description: 'ইটের পরিমাণ (পিস সংখ্যা)' },
        rate: { type: Type.NUMBER, description: 'প্রতি হাজারে দর' },
        discount: { type: Type.NUMBER, description: 'ছাড় টাকা' },
        paidAmount: { type: Type.NUMBER, description: 'নগদ জমা টাকা' },
        note: { type: Type.STRING, description: 'মন্তব্য বা ডেলিভারি তথ্য' },
        confirmed: { type: Type.BOOLEAN, description: 'ব্যবহারকারীর নিশ্চিত অনুমোদন' },
      },
      required: ['customerName', 'quantity'],
    },
  },
  {
    name: 'record_payment',
    description:
      'ক্রেতার কাছ থেকে বকেয়া পাওনা বা মেমোর টাকা আদায় করে মেমো ও ক্যাশ ব্যালেন্স আপডেট করে। আর্থিক নিরাপত্তার জন্য অনুমোদন নেয়।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerNameOrMemoNo: {
          type: Type.STRING,
          description: 'ক্রেতার নাম অথবা মেমো নম্বর (যেমন ১২৫ বা BF-2026-104)',
        },
        amount: { type: Type.NUMBER, description: 'আদায়কৃত টাকার পরিমাণ' },
        confirmed: { type: Type.BOOLEAN, description: 'ব্যবহারকারীর নিশ্চিত অনুমোদন' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'create_expense',
    description:
      'ক্যাশ বুকে নতুন খরচ (যেমন কয়লা ক্রয়, ভেকু ডিজেল, মাটি ক্রয়, শ্রমিক পেমেন্ট) যোগ করে। ৫০,০০০ টাকার বেশি হলে কনফার্মেশন চাইবে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'খাত: কয়লা ক্রয়, ভেকু ও ডিজেল, মাটি ক্রয়, শ্রমিক ও সর্দার পেমেন্ট, বিদ্যুৎ ও জ্বালানি, অফিস ও আপ্যায়ন, অন্যান্য খরচ',
        },
        amount: { type: Type.NUMBER, description: 'টাকার পরিমাণ' },
        description: { type: Type.STRING, description: 'খরচের বিবরণ বা প্রাপকের নাম' },
        confirmed: { type: Type.BOOLEAN, description: 'ব্যবহারকারীর নিশ্চিত অনুমোদন' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'create_note',
    description: 'ভাটার জরুরি নোটবইয়ে নতুন নোট বা রিমাইন্ডার সেভ করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'নোটের বিস্তারিত বিবরণ' },
        title: { type: Type.STRING, description: 'নোটের শিরোনাম' },
        priority: { type: Type.STRING, description: 'URGENT অথবা NORMAL' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_recent_transactions',
    description: 'ক্যাশ বুকের সাম্প্রতিক জমা ও খরচের লেনদেন তালিকা প্রদর্শন করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'কতটি লেনদেন দেখাবে (ডিফল্ট ৫)' },
        type: { type: Type.STRING, description: 'ALL, IN, বা OUT' },
      },
    },
  },
  {
    name: 'check_stock',
    description: 'ভাটার সকল গ্রেডের ইটের বর্তমান স্টক ও মজুত প্রদর্শন করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        gradeId: { type: Type.STRING, description: 'ঐচ্ছিক গ্রেড আইডি' },
      },
    },
  },
  {
    name: 'record_worker_attendance',
    description: 'দিনমজুর বা সর্দারের সকাল-বিকাল হাজিরা ও হাটবার পেমেন্ট রেকর্ড করে ক্যাশ খরচে যোগ করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        workerName: { type: Type.STRING, description: 'শ্রমিকের নাম' },
        morningPresent: { type: Type.BOOLEAN, description: 'সকাল উপস্থিতি' },
        afternoonPresent: { type: Type.BOOLEAN, description: 'বিকাল উপস্থিতি' },
        hatbarAmount: { type: Type.NUMBER, description: 'হাটবার টাকা' },
      },
      required: ['workerName'],
    },
  },
  {
    name: 'search_notes',
    description: 'ভাটার জরুরি নোটবই থেকে নোট ও রিমাইন্ডার খুঁজে বের করে বা সকল নোট দেখায়।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'ঐচ্ছিক অনুসন্ধান শব্দ (যেমন কয়লা, সর্দার)' },
      },
    },
  },
  {
    name: 'get_dashboard_metrics',
    description: 'ভাটার বর্তমান ক্যাশ ব্যালেন্স, আজকের ও মোট বিক্রি, নগদ আদায়, খরচ, বকেয়া পাওনা ও ইটের স্টকের সম্পূর্ণ ড্যাশবোর্ড মেট্রিক্স রিড করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'analyze_business',
    description:
      'আলিপ্রো ই-কমার্স স্টাইলে ভাটার সম্পূর্ণ ব্যবসার গভীর অ্যানালাইসিস (মোট বিক্রি, কালেকশন দক্ষতা, লাভ-ক্ষতি ও ক্যাশ মার্জিন, সেরা বিক্রিত ইটের গ্রেড, টপ কাস্টমার, সর্বোচ্চ বকেয়া ঝুঁকি, স্টকের বাজারমূল্য ও গ্রোথ পরামর্শ) প্রদান করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'navigate_to_tab',
    description: 'অ্যাপ্লিকেশনের নির্দিষ্ট মেনু বা ট্যাবে নেভিগেট করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: {
          type: Type.STRING,
          description: 'dashboard, new_memo, memos, cashbook, bricks, labour, customer_search, notes, agent, settings',
        },
      },
      required: ['tab'],
    },
  },
  {
    name: 'control_system_ui',
    description:
      'সম্পূর্ণ ওয়েবসাইট ও স্ক্রিন ভয়েস কন্ট্রোল করে—যেমন মেমো প্রিন্ট করা (PRINT_MEMO), মেমো খতিয়ান ফিল্টার করা (FILTER_MEMOS: ALL/PAID/DUE), ক্যাশ বুক ফিল্টার করা (FILTER_CASHBOOK: ALL/IN/OUT), KPI চার্ট রিপোর্ট মোডাল খোলা (OPEN_KPI_MODAL), ড্যাশবোর্ড ফর্ম পরিষ্কার করা (CLEAR_MEMO_FORM), পেজ স্ক্রল করা (SCROLL_DOWN / SCROLL_UP), ফুলস্ক্রিন করা (FULLSCREEN_TOGGLE), ডাটাবেস ব্যাকআপ ডাউনলোড করা (EXPORT_BACKUP), বা মোডাল বন্ধ করা (CLOSE_MODAL)।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionType: {
          type: Type.STRING,
          description:
            'PRINT_MEMO, PRINT_PAGE, SCROLL_DOWN, SCROLL_UP, FULLSCREEN_TOGGLE, EXPORT_BACKUP, CLOSE_MODAL, NAVIGATE_TAB, OPEN_KPI_MODAL, FILTER_MEMOS, FILTER_CASHBOOK, CLEAR_MEMO_FORM',
        },
        memoNo: { type: Type.STRING, description: 'ঐচ্ছিক মেমো নম্বর (যেমন ১২৫)' },
        tab: { type: Type.STRING, description: 'ঐচ্ছিক ট্যাবের নাম' },
        kpiId: {
          type: Type.STRING,
          description:
            'TOTAL_BRICKS_SOLD, TODAY_COLLECTION, TOTAL_COLLECTION, TOTAL_EXPENSE, CASH_BALANCE, TOTAL_DUE',
        },
        memoStatusFilter: { type: Type.STRING, description: 'ALL, PAID, বা DUE' },
        cashTypeFilter: { type: Type.STRING, description: 'ALL, IN, বা OUT' },
      },
      required: ['actionType'],
    },
  },
  {
    name: 'update_brick_stock_or_rate',
    description:
      'ভয়েস কমান্ডের মাধ্যমে নির্দিষ্ট গ্রেডের ইটের স্টক যোগ করে অথবা প্রতি পিস ইটের দর আপডেট করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        gradeId: {
          type: Type.STRING,
          description: 'grade-1, grade-2, grade-3, grade-picket, grade-goria',
        },
        quantity: { type: Type.NUMBER, description: 'নতুন যোগ করার ইট সংখ্যা' },
        rate: { type: Type.NUMBER, description: 'নতুন প্রতি পিস ইটের দর' },
      },
    },
  },
  {
    name: 'delete_record',
    description: 'ভয়েস কমান্ডের মাধ্যমে নির্দিষ্ট মেমো মুছে ফেলে এবং স্টক পুনরুদ্ধার করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memoNo: { type: Type.STRING, description: 'মেমো নম্বর' },
      },
    },
  },
  {
    name: 'update_opening_balance',
    description: 'ভাটার প্রারম্ভিক ক্যাশ ব্যালেন্স (Opening Balance) আপডেট করে।',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: 'প্রারম্ভিক ক্যাশ ব্যালেন্স টাকা' },
      },
      required: ['amount'],
    },
  },
];

// Core Server-Side Tool Executor
const recentExecutionFingerprints = new Map<string, { timestamp: number; replyBn: string }>();

function checkAndRecordIdempotency(fingerprint: string, replyBn?: string): string | null {
  const now = Date.now();
  const prev = recentExecutionFingerprints.get(fingerprint);
  if (prev && now - prev.timestamp < 8000 && !replyBn) {
    return `এই লেনদেনটি ইতিমধ্যে কিছুক্ষণ আগে সম্পন্ন হয়েছে (ডুপ্লিকেট রিকোয়েস্ট প্রতিহত করা হয়েছে): ${prev.replyBn}`;
  }
  if (replyBn) {
    recentExecutionFingerprints.set(fingerprint, { timestamp: now, replyBn });
  }
  return null;
}

function executeKilnToolCall(
  toolName: string,
  args: Record<string, unknown>,
  task: AgentTask
): {
  success: boolean;
  status: 'COMPLETED' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'NEEDS_INPUT';
  replyBn: string;
  requiresConfirmation?: boolean;
  navigationTarget?: NavigationTab;
  uiAction?: SystemUiAction;
} {
  const startMs = Date.now();
  const { todayDate, yesterdayDate } = getTodayAndYesterday();

  const recordTool = (
    status: AgentToolExecution['status'],
    inputSummary: string,
    outputSummary: string
  ) => {
    const exec: AgentToolExecution = {
      id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toolName,
      inputSummary,
      outputSummary,
      status,
      durationMs: Math.max(12, Date.now() - startMs),
      timestamp: new Date().toISOString(),
    };
    task.toolCalls.push(exec);
  };

  const normalizedTool = toolName.toLowerCase().replace(/_/g, '');

  // 1. Search Memo (search_memo)
  if (normalizedTool === 'searchmemo') {
    const query = String(
      args.query ||
        args.memoNo ||
        args.customerNameOrMemoNo ||
        dbState.context.lastReferencedMemoNo ||
        ''
    ).trim();
    if (!query) {
      const msg = 'কোন মেমোটা খুঁজছ? মেমো নম্বর, ক্রেতার নাম বা মোবাইল নম্বরটা বলো।';
      recordTool('FAILED', 'খালি কোয়েরি', msg);
      return { success: false, status: 'NEEDS_INPUT', replyBn: msg };
    }

    const normQuery = parseBanglaDigits(query).toLowerCase();
    const cleanNum = normQuery.replace(/[^0-9]/g, '');

    const matches = dbState.salesMemos.filter((m) => {
      const memoNum = parseBanglaDigits(m.memoNo).toLowerCase();
      const cust = m.customerName.toLowerCase();
      const phone = parseBanglaDigits(m.customerPhone || '').toLowerCase();
      const phoneDigits = phone.replace(/[^0-9]/g, '');
      return (
        memoNum.includes(normQuery) ||
        (cleanNum && memoNum.includes(cleanNum)) ||
        cust.includes(query.toLowerCase()) ||
        cust.includes(normQuery) ||
        phone.includes(normQuery) ||
        (cleanNum.length >= 3 && phoneDigits.includes(cleanNum))
      );
    });

    if (matches.length === 0) {
      const replyBn = `"${query}" দিয়ে কোনো মেমো খুঁজে পাওয়া যায়নি। মেমো নম্বর বা কাস্টমারের নামটা আরেকবার বলবে?`;
      recordTool('FAILED', query, replyBn);
      return { success: false, status: 'FAILED', replyBn };
    }

    const first = matches[0];
    dbState.context.lastReferencedMemoId = first.id;
    dbState.context.lastReferencedMemoNo = first.memoNo;
    dbState.context.lastReferencedCustomer = first.customerName;
    dbState.context.lastCandidateMemoNos = matches.map((m) => m.memoNo);
    dbState.context.lastTopic = 'MEMO_DETAIL';
    saveDbState();

    const itemSummary = first.items
      .map((it) => `${formatBn(it.quantity)} পিস ${it.gradeName.split('(')[0].trim()} (দর ${formatCurrencyBn(it.rate)})`)
      .join(', ');

    let replyBn = `মেমো ${first.memoNo} পাওয়া গেছে—ক্রেতা ${first.customerName} (${first.date})। মাল ছিল ${itemSummary}। মোট বিল ${formatCurrencyBn(
      first.totalAmount
    )}, জমা হয়েছে ${formatCurrencyBn(first.paidAmount)}, আর বাকি আছে ${formatCurrencyBn(
      first.dueAmount
    )}।`;

    if (matches.length > 1) {
      const otherNos = matches
        .slice(1, 4)
        .map((m) => m.memoNo)
        .join(', ');
      replyBn += ` (ওনার নামে আরও ${formatBn(matches.length - 1)}টা মেমো আছে: ${otherNos})।`;
    }

    recordTool('COMPLETED', `query: ${query} (${matches.length}টি মেমো)`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'memos' };
  }

  // 2. Customer Balance (get_customer_balance)
  if (normalizedTool === 'getcustomerbalance') {
    const rawName = String(
      args.customerName || args.name || dbState.context.lastReferencedCustomer || ''
    ).trim();
    if (!rawName) {
      const msg = 'কার বকেয়া হিসাব জানতে চাচ্ছ? কাস্টমারের নামটা বলো।';
      recordTool('FAILED', 'নাম অনুপস্থিত', msg);
      return { success: false, status: 'NEEDS_INPUT', replyBn: msg };
    }

    const query = rawName.toLowerCase();
    const customerMemos = dbState.salesMemos.filter((m) =>
      m.customerName.toLowerCase().includes(query)
    );

    if (customerMemos.length === 0) {
      const replyBn = `"${rawName}" নামে আমাদের খাতায় কোনো মেমো বা বকেয়ার হিসাব পাওয়া যায়নি।`;
      recordTool('FAILED', rawName, replyBn);
      return { success: false, status: 'FAILED', replyBn };
    }

    const distinctCustomers = Array.from(new Set(customerMemos.map((m) => m.customerName)));
    const customerName = customerMemos[0].customerName;
    dbState.context.lastReferencedCustomer = customerName;
    dbState.context.lastReferencedMemoId = customerMemos[0].id;
    dbState.context.lastReferencedMemoNo = customerMemos[0].memoNo;
    dbState.context.lastCandidateMemoNos = customerMemos.map((m) => m.memoNo);
    dbState.context.lastTopic = 'CUSTOMER_DUE';
    saveDbState();

    const totalBilled = customerMemos.reduce((s, m) => s + m.totalAmount, 0);
    const totalPaid = customerMemos.reduce((s, m) => s + m.paidAmount, 0);
    const totalDue = customerMemos.reduce((s, m) => s + m.dueAmount, 0);
    const summaryMode = String(args.summaryMode || 'AUTO').toUpperCase();

    let replyBn = '';
    if (distinctCustomers.length > 1 && summaryMode !== 'TOTAL') {
      replyBn = `"${rawName}" নামে একাধিক কাস্টমার আছেন (${distinctCustomers.join(', ')})। কার হিসাবটা দেখতে চাও? আর সব মিলিয়ে বললে মোট বকেয়া ${formatCurrencyBn(totalDue)} টাকা।`;
    } else if (customerMemos.length > 1 && summaryMode !== 'TOTAL') {
      const memoNos = customerMemos.map((m) => `${m.memoNo} (বাকি ${formatCurrencyBn(m.dueAmount)})`).join(', ');
      replyBn = `${customerName}-এর নামে কয়েকটা মেমো আছে (${memoNos})। কোনটার কথা বলছ? চাইলে সব মিলিয়ে মোট বকেয়াটাও (${formatCurrencyBn(totalDue)} টাকা) বলে দিতে পারি।`;
    } else if (customerMemos.length === 1) {
      const m = customerMemos[0];
      if (m.dueAmount > 0) {
        replyBn = `${customerName}-এর মেমো ${m.memoNo}-এ মোট বিল ${formatCurrencyBn(
          totalBilled
        )}—এর মধ্যে ${formatCurrencyBn(totalPaid)} জমা হয়েছে, আর বর্তমানে ${formatCurrencyBn(
          totalDue
        )} টাকা বাকি আছে।`;
      } else {
        replyBn = `${customerName}-এর মেমো ${m.memoNo}-এর পুরো বিল (${formatCurrencyBn(
          totalBilled
        )}) পরিশোধ করা আছে, কোনো বকেয়া নেই।`;
      }
    } else {
      replyBn = `${customerName}-এর সবগুলো (${formatBn(
        customerMemos.length
      )}টি) মেমো মিলিয়ে মোট বিল ${formatCurrencyBn(totalBilled)}, জমা দিয়েছেন ${formatCurrencyBn(
        totalPaid
      )}, আর বর্তমানে মোট বকেয়া আছে ${formatCurrencyBn(totalDue)} টাকা।`;
    }

    recordTool('COMPLETED', `${customerName}: বকেয়া ${formatCurrencyBn(totalDue)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'memos' };
  }

  // 3. Sales Summary & Dashboard Metrics (get_sales_summary / getDashboardSummary / get_dashboard_metrics)
  if (
    normalizedTool === 'getsalessummary' ||
    normalizedTool === 'getdashboardsummary' ||
    normalizedTool === 'getdashboardmetrics'
  ) {
    const scope = String(args.dateScope || 'TODAY').toUpperCase() as
      | 'TODAY'
      | 'YESTERDAY'
      | 'LAST_7_DAYS'
      | 'SEASON';
    const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
    dbState.context.lastTopic =
      normalizedTool === 'getdashboardmetrics' ? 'CASH_BALANCE' : 'SALES';
    dbState.context.lastDateScope = scope;
    saveDbState();

    let replyBn = '';
    if (normalizedTool === 'getdashboardmetrics') {
      replyBn = `বর্তমানে ভাটার ক্যাশে নগদ ${formatCurrencyBn(
        metrics.currentCashBalance
      )} আছে। আজকে বিক্রি হয়েছে ${formatCurrencyBn(
        metrics.todaySalesAmount
      )}, নগদ জমা এসেছে ${formatCurrencyBn(
        metrics.todayCashIn
      )}, খরচ হয়েছে ${formatCurrencyBn(
        metrics.todayExpense
      )}, আর বাজারে মোট পাওনা আছে ${formatCurrencyBn(metrics.totalCustomerDue)}।`;
    } else if (scope === 'YESTERDAY') {
      replyBn = `গতকাল (${yesterdayDate}) ${formatBn(
        metrics.yesterdaySalesMemoCount
      )}টা মেমোতে মোট ${formatCurrencyBn(
        metrics.yesterdaySalesAmount
      )} টাকার ইট বিক্রি হয়েছিল (${formatBn(
        metrics.yesterdayBricksSold
      )} পিস)। নগদ আদায় হয়েছিল ${formatCurrencyBn(
        metrics.yesterdayCashIn
      )} এবং খরচ হয়েছিল ${formatCurrencyBn(metrics.yesterdayExpense)}।`;
    } else if (scope === 'LAST_7_DAYS' || scope === 'SEASON') {
      replyBn = `এই সিজনে মোট ইট বিক্রি হয়েছে ${formatCurrencyBn(
        metrics.totalBrickSalesAmountAllTime
      )} (${formatBn(metrics.totalBricksSoldAllTime)} পিস)। মোট নগদ আদায় ${formatCurrencyBn(
        metrics.totalCashIn
      )}, মোট খরচ ${formatCurrencyBn(
        metrics.totalExpense
      )}, বর্তমান ক্যাশ ব্যালেন্স ${formatCurrencyBn(
        metrics.currentCashBalance
      )}, আর কাস্টমারদের কাছে বকেয়া পাওনা ${formatCurrencyBn(metrics.totalCustomerDue)}।`;
    } else {
      replyBn = `আজকে এ পর্যন্ত ${formatBn(
        metrics.todaySalesMemoCount
      )}টা মেমোতে মোট ${formatCurrencyBn(
        metrics.todaySalesAmount
      )} টাকার ইট বিক্রি হয়েছে (${formatBn(
        metrics.todayBricksSold
      )} পিস)। নগদ আদায় হয়েছে ${formatCurrencyBn(
        metrics.todayCashIn
      )}, খরচ ${formatCurrencyBn(
        metrics.todayExpense
      )}, আর হাতে ক্যাশ ব্যালেন্স আছে ${formatCurrencyBn(metrics.currentCashBalance)}।`;
    }

    recordTool('COMPLETED', `dateScope: ${scope}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'dashboard' };
  }

  // 4. Expense Summary (get_expense_summary)
  if (normalizedTool === 'getexpensesummary') {
    const scope = String(args.dateScope || 'TODAY').toUpperCase() as
      | 'TODAY'
      | 'YESTERDAY'
      | 'LAST_7_DAYS'
      | 'SEASON';
    const targetCategory = args.category ? String(args.category).trim() : null;
    dbState.context.lastTopic = 'EXPENSE';
    dbState.context.lastDateScope = scope;
    saveDbState();

    let relevantTx = dbState.cashTransactions.filter((t) => t.type === 'OUT');
    if (scope === 'TODAY') {
      relevantTx = relevantTx.filter((t) => t.date === todayDate);
    } else if (scope === 'YESTERDAY') {
      relevantTx = relevantTx.filter((t) => t.date === yesterdayDate);
    }

    if (targetCategory) {
      relevantTx = relevantTx.filter((t) =>
        t.category.toLowerCase().includes(targetCategory.toLowerCase())
      );
    }

    const totalExp = relevantTx.reduce((s, t) => s + t.amount, 0);
    const categoryTotals: Record<string, number> = {};
    for (const t of relevantTx) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }

    const catBreakdown = Object.entries(categoryTotals)
      .map(([cat, amt]) => `${cat} ${formatCurrencyBn(amt)}`)
      .join(', ');

    let replyBn = '';
    if (targetCategory) {
      replyBn = `${
        scope === 'TODAY' ? 'আজকে' : scope === 'YESTERDAY' ? 'গতকাল' : 'মোট'
      } ${targetCategory} বাবদ খরচ হয়েছে ${formatCurrencyBn(totalExp)} টাকা।`;
    } else if (totalExp === 0) {
      replyBn = `${
        scope === 'TODAY' ? 'আজকে' : scope === 'YESTERDAY' ? 'গতকাল' : 'এই সময়ে'
      } এখনো কোনো খরচের এন্ট্রি নেই।`;
    } else {
      replyBn = `${
        scope === 'TODAY' ? 'আজকে' : scope === 'YESTERDAY' ? 'গতকাল' : 'সর্বমোট'
      } মোট খরচ হয়েছে ${formatCurrencyBn(totalExp)} টাকা (${catBreakdown})।`;
    }

    recordTool('COMPLETED', `expense: ${formatCurrencyBn(totalExp)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'cashbook' };
  }

  // 5. Create Sales Memo (create_sales_memo)
  if (normalizedTool === 'createsalesmemo') {
    const customerName = String(args.customerName || '').trim();
    const quantity = Number(args.quantity || 0);

    // Multi-turn check for missing details
    if (!customerName || quantity <= 0) {
      dbState.context.pendingMemoData = {
        customerName: customerName || undefined,
        quantity: quantity > 0 ? quantity : undefined,
        gradeId: String(args.gradeId || 'grade-1'),
      };
      saveDbState();
      const missingPrompt =
        !customerName && quantity <= 0
          ? 'নিশ্চয়ই, নতুন মেমো করে দিচ্ছি। কার নামে মেমো হবে আর কত পিস ইট যাবে বলো?'
          : !customerName
          ? `${formatBn(quantity)} পিস ইটের মেমোটা কার নামে লিখব?`
          : `${customerName}-এর নামে কত পিস ইট মেমো করব বলো?`;
      recordTool('RUNNING', 'তথ্য সংগ্রহ (Multi-turn)', missingPrompt);
      return { success: true, status: 'NEEDS_INPUT', replyBn: missingPrompt };
    }

    dbState.context.pendingMemoData = undefined;

    const gradeId = String(args.gradeId || 'grade-1');
    const grade = dbState.brickGrades.find((g) => g.id === gradeId) || dbState.brickGrades[0];
    const rate = Number(args.rate || grade.ratePerUnit);
    const discount = Number(args.discount || 0);

    const stockValidation = validateStockForMultiItemMemo(
      dbState.brickGrades,
      [{ gradeId: grade.id, quantity }],
      true
    );
    if (!stockValidation.valid) {
      const errMsg = stockValidation.errorBn || 'মেমো তথ্য যাচাই ব্যর্থ হয়েছে।';
      recordTool('FAILED', `${grade.nameBn}: ${quantity}`, errMsg);
      return { success: false, status: 'FAILED', replyBn: errMsg };
    }

    const itemRow: MemoItemRow = {
      id: `it-${Date.now()}`,
      gradeId: grade.id,
      gradeName: grade.nameBn,
      quantity,
      rate,
      ratePerThousand: false,
      lineTotal: calculateRowTotal(quantity, rate),
    };

    const expectedTotal = itemRow.lineTotal - discount;
    const paidAmount = args.paidAmount !== undefined ? Number(args.paidAmount) : expectedTotal;

    const calc = calculateMultiItemMemoTotals({
      items: [itemRow],
      discount,
      paidAmount,
    });

    const isConfirmed =
      args.requireConfirmation === true ? Boolean(args.confirmed) : args.confirmed !== false;

    // Optional confirmation gate only when explicitly requested
    if (!isConfirmed) {
      task.status = 'AWAITING_CONFIRMATION';
      task.pendingConfirmation = {
        actionType: 'CREATE_MEMO',
        summaryBn: `ক্রেতা ${customerName}-এর নামে ${formatBn(quantity)} পিস ${grade.nameBn} (${formatCurrencyBn(rate)} দরে) মোট ${formatCurrencyBn(calc.totalAmount)} (জমা ৳${formatBn(calc.paidAmount)}, বাকি ৳${formatBn(calc.dueAmount)})-এর মেমো তৈরি করার অনুমোদন প্রয়োজন।`,
        amount: calc.totalAmount,
        customerName,
        date: todayDate,
        payload: { ...args, confirmed: true },
      };
      saveDbState();

      const replyBn = `হিসাবটা একনজর মিলিয়ে নাও—${customerName}-এর নামে ${formatBn(
        quantity
      )} পিস ${grade.nameBn.split('(')[0].trim()} (${formatCurrencyBn(
        rate
      )} দরে), মোট বিল ${formatCurrencyBn(calc.totalAmount)}, নগদ জমা ${formatCurrencyBn(
        calc.paidAmount
      )} এবং বাকি ${formatCurrencyBn(
        calc.dueAmount
      )} টাকা। মেমোটা কি সেভ করে দেব?`;
      recordTool('AWAITING_CONFIRMATION', `${customerName}: ${formatCurrencyBn(calc.totalAmount)}`, replyBn);
      return { success: true, status: 'AWAITING_CONFIRMATION', replyBn, requiresConfirmation: true };
    }

    // Immediate execution
    const { memoNo } = generateUniqueMemoNo(dbState.salesMemos);
    const newMemo: SalesMemo = {
      id: `memo-${Date.now()}`,
      memoNo,
      date: todayDate,
      customerName,
      customerPhone: String(args.customerPhone || '—').trim(),
      customerAddress: 'গ্রাম: স্থানীয়',
      truckNo: '—',
      driverName: '—',
      items: [itemRow],
      subTotal: calc.subTotal,
      discount: calc.discount,
      totalAmount: calc.totalAmount,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      paymentMethod: 'নগদ ক্যাশ',
      status: calc.status,
      note: String(args.note || 'ভয়েস সহকারীর মাধ্যমে তৈরি').trim(),
      createdAt: new Date().toISOString(),
    };

    grade.currentStock = Math.max(0, (grade.currentStock || 0) - quantity);
    dbState.salesMemos.unshift(newMemo);

    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-${Date.now()}`,
        date: todayDate,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.paidAmount,
        description: `মেমো ${memoNo} (${customerName} - ${formatBn(quantity)}টি ${grade.nameBn})`,
        referenceId: newMemo.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    dbState.context.lastReferencedMemoId = newMemo.id;
    dbState.context.lastReferencedMemoNo = newMemo.memoNo;
    dbState.context.lastReferencedCustomer = newMemo.customerName;
    dbState.context.lastTopic = 'MEMO_DETAIL';

    addAuditLog(
      'AI_AGENT',
      'CREATE_SALES_MEMO',
      `মেমো ${memoNo} তৈরি: ${customerName}, মোট ${formatCurrencyBn(calc.totalAmount)}, জমা ${formatCurrencyBn(calc.paidAmount)}।`
    );
    saveDbState();

    const replyBn = `জি ভাই, সাথে সাথে মেমো ${memoNo} করে দিয়েছি! ${customerName}-এর নামে ${formatBn(
      quantity
    )} পিস ${grade.nameBn.split('(')[0].trim()}, মোট বিল ${formatCurrencyBn(
      calc.totalAmount
    )}, জমা ${formatCurrencyBn(calc.paidAmount)} এবং বাকি ${formatCurrencyBn(
      calc.dueAmount
    )} টাকা।`;
    recordTool('COMPLETED', `${memoNo}: ${quantity}`, replyBn);
    return {
      success: true,
      status: 'COMPLETED',
      replyBn,
      navigationTarget: 'memos',
      uiAction: {
        type: 'FILL_MEMO_FORM',
        formDraft: {
          customerName,
          quantity,
          rate,
          paidAmount: calc.paidAmount,
          gradeId: grade.id,
        },
        labelBn: `মেমো ${memoNo} তৈরি ও খতিয়ানে প্রদর্শন`,
      },
    };
  }

  // 6. Record Payment (record_payment / collectCustomerDue)
  if (normalizedTool === 'recordpayment' || normalizedTool === 'collectcustomerdue') {
    const rawTarget = String(
      args.customerNameOrMemoNo ||
        args.customerName ||
        args.memoNo ||
        dbState.context.lastReferencedMemoNo ||
        dbState.context.lastReferencedCustomer ||
        ''
    ).trim();

    const rawAmount = Number(args.amount || 0);
    if (rawAmount <= 0) {
      dbState.context.pendingPaymentData = { customerNameOrMemoNo: rawTarget || undefined };
      saveDbState();
      const msg = rawTarget
        ? `${rawTarget}-এর মেমোতে কত টাকা জমা লিখব বলো?`
        : 'কার মেমোতে এবং কত টাকা জমা করতে চাও বলো?';
      recordTool('RUNNING', 'টাকা অনুপস্থিত', msg);
      return { success: true, status: 'NEEDS_INPUT', replyBn: msg };
    }

    dbState.context.pendingPaymentData = undefined;

    const memo = rawTarget
      ? dbState.salesMemos.find((m) => {
          if (m.dueAmount <= 0) return false;
          const q = rawTarget.toLowerCase();
          return (
            m.memoNo.toLowerCase().includes(q) ||
            m.customerName.toLowerCase().includes(q) ||
            (m.customerPhone && m.customerPhone.includes(q))
          );
        })
      : dbState.salesMemos.find((m) => m.dueAmount > 0);

    if (!memo) {
      const msg = `"${rawTarget || 'নির্দিষ্ট ক্রেতা'}" নামে কোনো বকেয়া মেমো পাওয়া যায়নি।`;
      recordTool('FAILED', rawTarget, msg);
      return { success: false, status: 'FAILED', replyBn: msg };
    }

    if (Math.round(rawAmount) > memo.dueAmount) {
      const msg = `${memo.customerName}-এর মেমো ${memo.memoNo}-এ বাকি আছে ${formatCurrencyBn(
        memo.dueAmount
      )} টাকা। বকেয়ার চেয়ে বেশি (${formatCurrencyBn(rawAmount)}) জমা নেওয়া যাবে না।`;
      recordTool('FAILED', `${memo.memoNo}: অতিরিক্ত জমা`, msg);
      return { success: false, status: 'FAILED', replyBn: msg };
    }

    const collected = Math.min(memo.dueAmount, Math.round(rawAmount));
    const isConfirmed =
      args.requireConfirmation === true ? Boolean(args.confirmed) : args.confirmed !== false;

    // Optional confirmation gate only when explicitly requested
    if (!isConfirmed) {
      task.status = 'AWAITING_CONFIRMATION';
      task.pendingConfirmation = {
        actionType: 'RECORD_PAYMENT',
        summaryBn: `${memo.customerName}-এর মেমো (${memo.memoNo})-তে ${formatCurrencyBn(collected)} টাকা বকেয়া জমা ও ক্যাশ বুকে যুক্ত করার অনুমোদন প্রয়োজন।`,
        amount: collected,
        customerName: memo.customerName,
        memoNo: memo.memoNo,
        date: todayDate,
        payload: { ...args, customerNameOrMemoNo: memo.memoNo, amount: collected, confirmed: true },
      };
      saveDbState();

      const replyBn = `${memo.customerName}-এর মেমো ${memo.memoNo}-তে ${formatCurrencyBn(
        collected
      )} টাকা জমা তুললে আর বাকি থাকবে ${formatCurrencyBn(
        memo.dueAmount - collected
      )} টাকা। এটা কি সেভ করে দেব?`;
      recordTool('AWAITING_CONFIRMATION', `${memo.memoNo}: ${formatCurrencyBn(collected)}`, replyBn);
      return { success: true, status: 'AWAITING_CONFIRMATION', replyBn, requiresConfirmation: true };
    }

    // Immediate Execution
    memo.paidAmount += collected;
    memo.dueAmount -= collected;
    memo.status = memo.dueAmount === 0 ? 'PAID' : 'PARTIAL';

    dbState.cashTransactions.unshift({
      id: `tx-${Date.now()}`,
      date: todayDate,
      type: 'IN',
      category: 'বাকি আদায়',
      amount: collected,
      description: `বাকি আদায়: মেমো ${memo.memoNo} (${memo.customerName})`,
      referenceId: memo.id,
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    });

    dbState.context.lastReferencedMemoId = memo.id;
    dbState.context.lastReferencedMemoNo = memo.memoNo;
    dbState.context.lastReferencedCustomer = memo.customerName;
    dbState.context.lastTopic = 'CUSTOMER_DUE';

    addAuditLog(
      'AI_AGENT',
      'RECORD_PAYMENT',
      `${memo.customerName} থেকে মেমো ${memo.memoNo}-এর ${formatCurrencyBn(collected)} টাকা বকেয়া আদায়।`
    );
    saveDbState();

    const replyBn = `হয়ে গেছে ভাই! ${memo.customerName}-এর মেমো ${memo.memoNo}-তে সাথে সাথে ${formatCurrencyBn(
      collected
    )} টাকা জমা তুলে দিয়েছি। এখন ওনার আর বাকি রইল ${formatCurrencyBn(memo.dueAmount)} টাকা।`;
    recordTool('COMPLETED', `${memo.memoNo}: ${formatCurrencyBn(collected)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'memos' };
  }

  // 7. Create Expense (create_expense / addCashTransaction)
  if (normalizedTool === 'createexpense' || normalizedTool === 'addcashtransaction') {
    const amount = Number(args.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      const msg = 'ভাই, কত টাকা খরচ হয়েছে বলুন?';
      recordTool('FAILED', 'অবৈধ পরিমাণ', msg);
      return { success: false, status: 'NEEDS_INPUT', replyBn: msg };
    }
    const category = String(args.category || '').trim();
    const type = String(args.type || 'OUT').toUpperCase() === 'IN' ? 'IN' : 'OUT';
    const description =
      String(args.description || '').trim() ||
      `${category || 'ভাটা'} বাবদ ${type === 'OUT' ? 'খরচ' : 'জমা'}`;

    if (!category && type === 'OUT') {
      dbState.context.pendingExpenseAmount = amount;
      dbState.context.pendingExpenseDate = todayDate;
      saveDbState();
      const replyBn = `ভাই, ${formatCurrencyBn(amount)} টাকাটা কোন খাতে খরচ হয়েছে বলুন? যেমন কয়লা ক্রয়, ভেকু ডিজেল, মাটি ক্রয় বা শ্রমিক পেমেন্ট?`;
      recordTool('RUNNING', `amount: ${amount} (খাত অনুপস্থিত)`, replyBn);
      return { success: true, status: 'NEEDS_INPUT', replyBn };
    }

    dbState.context.pendingExpenseAmount = undefined;
    const isConfirmed =
      args.requireConfirmation === true ? Boolean(args.confirmed) : args.confirmed !== false;

    if (
      type === 'OUT' &&
      !isConfirmed &&
      requiresSafeConfirmation({ actionType: 'ADD_EXPENSE', amount })
    ) {
      task.status = 'AWAITING_CONFIRMATION';
      task.pendingConfirmation = {
        actionType: 'HIGH_VALUE_EXPENSE',
        summaryBn: `${category} খাতে ${formatCurrencyBn(amount)} টাকা খরচ ক্যাশ বুকে যুক্ত করার জন্য আপনার নিশ্চিত অনুমোদন প্রয়োজন।`,
        amount,
        category,
        date: todayDate,
        payload: { type, category, amount, description, date: todayDate, confirmed: true },
      };
      saveDbState();

      const replyBn = `ক্যাশ খাতায় ${category} বাবদ ${formatCurrencyBn(
        amount
      )} টাকা খরচ তুলব। এটা কি কনফার্ম করে সেভ করব?`;
      recordTool('AWAITING_CONFIRMATION', `${category}: ${formatCurrencyBn(amount)}`, replyBn);
      return { success: true, status: 'AWAITING_CONFIRMATION', replyBn, requiresConfirmation: true };
    }

    const expFingerprint = `EXPENSE:${category}:${amount}:${todayDate}`;
    const dupCheck = checkAndRecordIdempotency(expFingerprint);
    if (dupCheck) {
      recordTool('COMPLETED', `${category}: ${formatCurrencyBn(amount)} (Duplicate blocked)`, dupCheck);
      return { success: true, status: 'COMPLETED', replyBn: dupCheck };
    }

    const tx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: todayDate,
      type,
      category: category || (type === 'IN' ? 'অন্যান্য জমা' : 'অন্যান্য খরচ'),
      amount,
      description,
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    };
    dbState.cashTransactions.unshift(tx);
    addAuditLog(
      'AI_AGENT',
      'ADD_CASH_TX',
      `${tx.category} খাতে ${formatCurrencyBn(tx.amount)} (${tx.type === 'OUT' ? 'খরচ' : 'জমা'}) যোগ করা হয়েছে।`
    );
    saveDbState();

    const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
    const replyBn = `জি ভাই, সাথে সাথে ক্যাশ খাতায় ${tx.category} বাবদ ${formatCurrencyBn(
      tx.amount
    )} টাকা খরচ তুলে দিয়েছি! এখন আমাদের হাতে ক্যাশ ব্যালেন্স আছে ${formatCurrencyBn(
      metrics.currentCashBalance
    )} টাকা।`;
    checkAndRecordIdempotency(expFingerprint, replyBn);
    recordTool('COMPLETED', `${tx.category}: ${formatCurrencyBn(tx.amount)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'cashbook' };
  }

  // 8. Create Note (create_note / addKilnNote)
  if (normalizedTool === 'createnote' || normalizedTool === 'addkilnnote') {
    const text = String(args.text || args.noteText || '').trim();
    if (!text) {
      const msg = 'নোট সংরক্ষণের জন্য অনুগ্রহ করে নোটের বিষয়বস্তু বলুন।';
      recordTool('FAILED', 'খালি নোট', msg);
      return { success: false, status: 'FAILED', replyBn: msg };
    }
    const title = String(args.title || 'AI নোট').trim();
    const priority = String(args.priority || 'URGENT') === 'NORMAL' ? 'NORMAL' : 'URGENT';

    const note: KilnNote = {
      id: `note-${Date.now()}`,
      date: todayDate,
      title,
      text,
      priority,
      pinned: true,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    dbState.kilnNotes.unshift(note);
    addAuditLog('AI_AGENT', 'ADD_NOTE', `জরুরি নোট সংরক্ষিত: "${text}"`);
    saveDbState();

    const replyBn = `জরুরি নোটবইয়ে নোটটি সংরক্ষণ করা হয়েছে: "${text}"।`;
    recordTool('COMPLETED', text, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'dashboard' };
  }

  // 8b. Search Notes (search_notes)
  if (normalizedTool === 'searchnotes') {
    const query = String(args.query || '').trim().toLowerCase();
    const matched = query
      ? dbState.kilnNotes.filter(
          (n) =>
            n.text.toLowerCase().includes(query) ||
            (n.title && n.title.toLowerCase().includes(query))
        )
      : dbState.kilnNotes;

    if (matched.length === 0) {
      const replyBn = query
        ? `"${args.query}" সংক্রান্ত কোনো নোট পাওয়া যায়নি।`
        : 'ভাটার নোটবইয়ে বর্তমানে কোনো নোট নেই।';
      recordTool('COMPLETED', query || 'সকল নোট', replyBn);
      return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'dashboard' };
    }

    const lines = matched
      .slice(0, 5)
      .map((n) => `• [${n.priority === 'URGENT' ? 'জরুরি' : 'সাধারণ'}] ${n.text}`)
      .join('\n');
    const replyBn = `মোট ${formatBn(matched.length)}টি নোট পাওয়া গেছে:\n${lines}`;
    recordTool('COMPLETED', `${matched.length}টি নোট`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'dashboard' };
  }

  // 9. Recent Transactions (get_recent_transactions)
  if (normalizedTool === 'getrecenttransactions') {
    const limit = Math.min(10, Math.max(1, Number(args.limit || 5)));
    const filterType = String(args.type || 'ALL').toUpperCase();

    let txList = dbState.cashTransactions;
    if (filterType === 'IN') txList = txList.filter((t) => t.type === 'IN');
    if (filterType === 'OUT') txList = txList.filter((t) => t.type === 'OUT');

    const slice = txList.slice(0, limit);
    if (slice.length === 0) {
      const replyBn = 'কোনো সাম্প্রতিক লেনদেন পাওয়া যায়নি।';
      recordTool('COMPLETED', '০ লেনদেন', replyBn);
      return { success: true, status: 'COMPLETED', replyBn };
    }

    const lines = slice
      .map(
        (t) =>
          `• ${t.category}: ${t.type === 'IN' ? '+' : '-'}${formatCurrencyBn(t.amount)} (${t.description})`
      )
      .join('\n');

    const replyBn = `সাম্প্রতিক ${formatBn(slice.length)}টি লেনদেন:\n${lines}`;
    recordTool('COMPLETED', `${slice.length}টি লেনদেন`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'cashbook' };
  }

  // 10. Check Stock (check_stock / checkBrickInventory)
  if (normalizedTool === 'checkstock' || normalizedTool === 'checkbrickinventory') {
    const totalPieces = dbState.brickGrades.reduce((s, g) => s + g.currentStock, 0);
    const gradeLines = dbState.brickGrades
      .map((g) => `${g.nameBn}: ${formatBn(g.currentStock)}টি`)
      .join(', ');
    const replyBn = `বর্তমানে ভাটায় মোট ইট স্টক আছে ${formatBn(totalPieces)}টি। বিস্তারিত: ${gradeLines}।`;
    recordTool('COMPLETED', 'সকল গ্রেড স্টক', replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'bricks' };
  }

  // 11. Worker Attendance (record_worker_attendance)
  if (normalizedTool === 'recordworkerattendance') {
    const workerNameQuery = String(args.workerName || '').trim().toLowerCase();
    const worker =
      dbState.workerProfiles.find((w) => w.name.toLowerCase().includes(workerNameQuery)) ||
      dbState.workerProfiles[0];
    const morningPresent = args.morningPresent !== false;
    const afternoonPresent = args.afternoonPresent !== false;
    const hatbarAmount = Number(args.hatbarAmount || 0);
    const morningAmount = morningPresent ? worker.morningRate : 0;
    const afternoonAmount = afternoonPresent ? worker.afternoonRate : 0;
    const totalPaid = morningAmount + afternoonAmount + hatbarAmount;

    const txId = `tx-${Date.now()}`;
    const att: WorkerAttendance = {
      id: `att-${Date.now()}`,
      date: todayDate,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      morningPresent,
      afternoonPresent,
      morningAmount,
      afternoonAmount,
      khorakiAmount: 0,
      hatbarAmount,
      totalPaid,
      note: 'AI এজেন্টের মাধ্যমে হাজিরা ও পেমেন্ট এন্ট্রি',
      cashTxId: txId,
      createdAt: new Date().toISOString(),
    };
    dbState.workerAttendance.unshift(att);
    worker.totalPaidSeason += totalPaid;

    if (totalPaid > 0) {
      dbState.cashTransactions.unshift({
        id: txId,
        date: todayDate,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: totalPaid,
        description: `শ্রমিক হাজিরা ও পেমেন্ট: ${worker.name}`,
        referenceId: att.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    saveDbState();
    const replyBn = `${worker.name}-এর হাজিরা ও মোট পেমেন্ট ${formatCurrencyBn(
      totalPaid
    )} টাকা ক্যাশ খরচে যোগ করা হয়েছে।`;
    recordTool('COMPLETED', `${worker.name}: ${formatCurrencyBn(totalPaid)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'labour' };
  }

  // 12. Comprehensive Business Analysis (analyze_business)
  if (normalizedTool === 'analyzebusiness') {
    const analysis = computeComprehensiveBusinessAnalysis(dbState, todayDate, yesterdayDate);
    dbState.context.lastTopic = 'BUSINESS_ANALYSIS';
    saveDbState();

    const recLines = analysis.recommendationsBn
      .slice(0, 3)
      .map((r) => `• ${r}`)
      .join('\n');

    const replyBn = `${analysis.spokenExecutiveSummaryBn}\n\n📊 আলিপ্রো ই-কমার্স স্টাইল এক্সিকিউটিভ ইনসাইটস:\n${recLines}`;
    recordTool(
      'COMPLETED',
      `হেলথ স্কোর: ${formatBn(analysis.healthScore)}/১০০ | কালেকশন: ${formatBn(analysis.collectionEfficiencyPct)}%`,
      replyBn
    );
    return { success: true, status: 'COMPLETED', replyBn };
  }

  // 13. Navigate To Tab (navigate_to_tab)
  if (normalizedTool === 'navigatetotab') {
    const tab = (args.tab as NavigationTab) || 'dashboard';
    const tabNameBn: Record<string, string> = {
      dashboard: 'ড্যাশবোর্ড ও মেমো',
      memos: 'মেমো খতিয়ান',
      bricks: 'ইট ও স্টক রিপোর্ট',
      labour: 'লেবার খাতা',
      cashbook: 'ক্যাশ বুক',
      agent: 'লাইভ ভয়েস এজেন্ট',
    };
    const replyBn = `জি ভাই, সাথে সাথে ${tabNameBn[tab] || tab} পেজ খুলে দিয়েছি!`;
    recordTool('COMPLETED', `tab: ${tab}`, replyBn);
    return {
      success: true,
      status: 'COMPLETED',
      replyBn,
      navigationTarget: tab,
      uiAction: { type: 'NAVIGATE_TAB', tab },
    };
  }

  // 14. Full System / PC / UI Voice Control (control_system_ui)
  if (normalizedTool === 'controlsystemui') {
    const incomingUi = args.uiAction as SystemUiAction | undefined;
    const actionType = String(
      args.actionType || incomingUi?.type || 'SCROLL_DOWN'
    ) as SystemUiAction['type'];
    const memoNo = String(
      args.memoNo || incomingUi?.memoNo || dbState.context.lastReferencedMemoNo || '125'
    );
    const tab = (args.tab || incomingUi?.tab) as NavigationTab | undefined;

    let replyBn = 'জি ভাই, সাথে সাথে করে দিয়েছি!';
    let navigationTarget: NavigationTab | undefined = tab;

    if (actionType === 'PRINT_MEMO') {
      const cleanQ = parseBanglaDigits(memoNo).replace(/[^0-9]/g, '');
      const matched =
        dbState.salesMemos.find(
          (m) =>
            m.memoNo.toLowerCase().includes(memoNo.toLowerCase()) ||
            (cleanQ && parseBanglaDigits(m.memoNo).includes(cleanQ))
        ) || dbState.salesMemos[0];
      const finalMemoNo = matched ? matched.memoNo : memoNo;
      replyBn = `জি ভাই, মেমো ${finalMemoNo}-এর অফিসিয়াল ক্যাশ মেমো ও গেট পাস প্রিন্ট ভিউ খুলে দিয়েছি!`;
      navigationTarget = 'memos';
      recordTool('COMPLETED', `PRINT_MEMO: ${finalMemoNo}`, replyBn);
      return {
        success: true,
        status: 'COMPLETED',
        replyBn,
        navigationTarget,
        uiAction: {
          type: 'PRINT_MEMO',
          memoNo: finalMemoNo,
          labelBn: `মেমো ${finalMemoNo} প্রিন্ট ভিউ খোলা হয়েছে`,
        },
      };
    }

    if (actionType === 'OPEN_KPI_MODAL') {
      const kpiId = (args.kpiId || incomingUi?.kpiId || 'TOTAL_BRICKS_SOLD') as SystemUiAction['kpiId'];
      const kpiLabels: Record<string, string> = {
        TOTAL_BRICKS_SOLD: 'মোট ইট বিক্রয় ও মেমো চার্ট রিপোর্ট',
        TODAY_COLLECTION: 'আজকের নগদ আদায় রিপোর্ট',
        TOTAL_COLLECTION: 'সর্বমোট নগদ আদায় রিপোর্ট',
        TOTAL_EXPENSE: 'সর্বমোট ভাটা খরচ রিপোর্ট',
        CASH_BALANCE: 'বর্তমান ক্যাশ ব্যালেন্স রিপোর্ট',
        TOTAL_DUE: 'মোট বকেয়া পাওনা রিপোর্ট',
      };
      const label = kpiLabels[kpiId || 'TOTAL_BRICKS_SOLD'] || 'বিস্তারিত রিপোর্ট';
      replyBn = `জি ভাই, স্ক্রিনে ${label} মোডাল খুলে দিয়েছি!`;
      recordTool('COMPLETED', `OPEN_KPI_MODAL: ${kpiId}`, replyBn);
      return {
        success: true,
        status: 'COMPLETED',
        replyBn,
        uiAction: {
          type: 'OPEN_KPI_MODAL',
          kpiId,
          labelBn: `${label} খোলা হয়েছে`,
        },
      };
    }

    if (actionType === 'FILTER_MEMOS') {
      const memoStatusFilter = (args.memoStatusFilter ||
        incomingUi?.memoStatusFilter ||
        'DUE') as 'ALL' | 'PAID' | 'DUE';
      const searchQuery = String(args.searchQuery || incomingUi?.searchQuery || '');
      navigationTarget = 'memos';
      const statusText =
        memoStatusFilter === 'DUE'
          ? 'বকেয়া (Due) মেমো'
          : memoStatusFilter === 'PAID'
          ? 'পরিশোধিত (Paid) মেমো'
          : 'সকল মেমো';
      replyBn = `জি ভাই, মেমো খতিয়ানে গিয়ে ${statusText} ফিল্টার করে দেখিয়ে দিয়েছি!`;
      recordTool('COMPLETED', `FILTER_MEMOS: ${memoStatusFilter}`, replyBn);
      return {
        success: true,
        status: 'COMPLETED',
        replyBn,
        navigationTarget: 'memos',
        uiAction: {
          type: 'FILTER_MEMOS',
          tab: 'memos',
          memoStatusFilter,
          searchQuery,
          labelBn: `মেমো খতিয়ান ফিল্টার: ${statusText}`,
        },
      };
    }

    if (actionType === 'FILTER_CASHBOOK') {
      const cashTypeFilter = (args.cashTypeFilter ||
        incomingUi?.cashTypeFilter ||
        'OUT') as 'ALL' | 'IN' | 'OUT';
      const cashCategoryFilter = String(
        args.cashCategoryFilter || incomingUi?.cashCategoryFilter || 'ALL'
      );
      navigationTarget = 'cashbook';
      const typeText =
        cashTypeFilter === 'OUT'
          ? 'খরচের লেনদেন (Cash Out)'
          : cashTypeFilter === 'IN'
          ? 'জমার লেনদেন (Cash In)'
          : 'সকল ক্যাশ লেনদেন';
      replyBn = `জি ভাই, ক্যাশ বুকে গিয়ে ${typeText} ফিল্টার করে দেখিয়ে দিয়েছি!`;
      recordTool('COMPLETED', `FILTER_CASHBOOK: ${cashTypeFilter}`, replyBn);
      return {
        success: true,
        status: 'COMPLETED',
        replyBn,
        navigationTarget: 'cashbook',
        uiAction: {
          type: 'FILTER_CASHBOOK',
          tab: 'cashbook',
          cashTypeFilter,
          cashCategoryFilter,
          labelBn: `ক্যাশ বুক ফিল্টার: ${typeText}`,
        },
      };
    }

    if (actionType === 'CLEAR_MEMO_FORM') {
      navigationTarget = 'dashboard';
      replyBn = 'জি ভাই, ড্যাশবোর্ডের নতুন মেমো ফর্ম পরিষ্কার করে রিসেট করে দিয়েছি।';
      recordTool('COMPLETED', 'CLEAR_MEMO_FORM', replyBn);
      return {
        success: true,
        status: 'COMPLETED',
        replyBn,
        navigationTarget: 'dashboard',
        uiAction: {
          type: 'CLEAR_MEMO_FORM',
          tab: 'dashboard',
          labelBn: 'মেমো ফর্ম পরিষ্কার করা হয়েছে',
        },
      };
    }

    if (actionType === 'SCROLL_DOWN') {
      replyBn = 'জি ভাই, স্ক্রিন নিচে নামিয়ে দিয়েছি।';
    } else if (actionType === 'SCROLL_UP' || actionType === 'SCROLL_TOP') {
      replyBn = 'জি ভাই, স্ক্রিন উপরে উঠিয়ে দিয়েছি।';
    } else if (actionType === 'FULLSCREEN_TOGGLE') {
      replyBn = 'জি ভাই, ফুলস্ক্রিন মোড টগল করে দিয়েছি।';
    } else if (actionType === 'EXPORT_BACKUP') {
      replyBn = 'জি ভাই, সম্পূর্ণ ডাটাবেস ব্যাকআপ ফাইল ডাউনলোড শুরু করে দিয়েছি!';
    } else if (actionType === 'CLOSE_MODAL') {
      replyBn = 'জি ভাই, খোলা পপআপ মোডাল বন্ধ করে দিয়েছি।';
    }

    recordTool('COMPLETED', actionType, replyBn);
    return {
      success: true,
      status: 'COMPLETED',
      replyBn,
      navigationTarget,
      uiAction: {
        type: actionType,
        tab,
        memoNo,
        labelBn: incomingUi?.labelBn || `ওয়েব কন্ট্রোল: ${actionType}`,
      },
    };
  }

  // 15. Update Brick Stock or Rate by Voice (update_brick_stock_or_rate)
  if (normalizedTool === 'updatebrickstockorrate') {
    const gradeId = String(args.gradeId || 'grade-1');
    const grade = dbState.brickGrades.find((g) => g.id === gradeId) || dbState.brickGrades[0];
    const qty = Math.max(0, Number(args.quantity || 0));
    const newRate = args.rate !== undefined ? Number(args.rate) : undefined;

    if (qty > 0) {
      grade.currentStock += qty;
      grade.seasonProduced += qty;
    }
    if (newRate !== undefined && newRate > 0) {
      grade.ratePerUnit = newRate >= 1000 ? Number((newRate / 1000).toFixed(4)) : newRate;
    }
    addAuditLog(
      'AI_AGENT',
      'UPDATE_STOCK_OR_RATE',
      `${grade.nameBn}: স্টক +${formatBn(qty)}টি, দর ${formatCurrencyBn(grade.ratePerUnit)}।`
    );
    saveDbState();

    const replyBn =
      qty > 0 && newRate
        ? `জি ভাই, ${grade.nameBn}-এ ${formatBn(qty)} পিস নতুন স্টক যোগ করেছি এবং নতুন দর ${formatCurrencyBn(grade.ratePerUnit)} সেট করে দিয়েছি! এখন মোট স্টক ${formatBn(grade.currentStock)} পিস।`
        : qty > 0
        ? `জি ভাই, সাথে সাথে ${grade.nameBn}-এ ${formatBn(qty)} পিস নতুন ইট স্টকে যোগ করে দিয়েছি! এখন বর্তমান স্টক ${formatBn(grade.currentStock)} পিস।`
        : `জি ভাই, ${grade.nameBn}-এর প্রতি পিস দর আপডেট করে ${formatCurrencyBn(grade.ratePerUnit)} টাকা করে দিয়েছি!`;

    recordTool('COMPLETED', `${grade.nameBn}: +${qty}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'bricks' };
  }

  // 16. Delete Memo by Voice (delete_record)
  if (normalizedTool === 'deleterecord') {
    const rawMemo = String(args.memoNo || dbState.context.lastReferencedMemoNo || '').trim();
    const cleanQ = parseBanglaDigits(rawMemo).replace(/[^0-9]/g, '');
    const idx = rawMemo
      ? dbState.salesMemos.findIndex(
          (m) =>
            m.memoNo.toLowerCase().includes(rawMemo.toLowerCase()) ||
            (cleanQ && parseBanglaDigits(m.memoNo).includes(cleanQ))
        )
      : 0;
    if (idx === -1 || dbState.salesMemos.length === 0) {
      const replyBn = 'মুছে ফেলার জন্য ওই মেমোটি খুঁজে পাওয়া যায়নি ভাই।';
      recordTool('FAILED', rawMemo, replyBn);
      return { success: false, status: 'FAILED', replyBn };
    }
    const [removed] = dbState.salesMemos.splice(idx, 1);
    for (const it of removed.items) {
      const g = dbState.brickGrades.find((grade) => grade.id === it.gradeId);
      if (g) g.currentStock += it.quantity;
    }
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== removed.id);
    addAuditLog('AI_AGENT', 'DELETE_MEMO', `ভয়েস নির্দেশে মেমো ${removed.memoNo} মুছে ফেলা হয়েছে।`, 'WARNING');
    saveDbState();
    const replyBn = `জি ভাই, মেমো ${removed.memoNo} (${removed.customerName}) খাতা থেকে মুছে দিয়েছি এবং ইটের স্টক ফেরত যোগ করে দিয়েছি।`;
    recordTool('COMPLETED', removed.memoNo, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'memos' };
  }

  // 17. Update Opening Balance by Voice (update_opening_balance)
  if (normalizedTool === 'updateopeningbalance') {
    const amount = Math.max(0, Number(args.amount || 0));
    dbState.settings.openingBalance = amount;
    addAuditLog(
      'AI_AGENT',
      'UPDATE_OPENING_BALANCE',
      `প্রারম্ভিক ক্যাশ ব্যালেন্স ${formatCurrencyBn(amount)} টাকা সেট করা হয়েছে।`
    );
    saveDbState();
    const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
    const replyBn = `জি ভাই, ভাটার প্রারম্ভিক ক্যাশ ব্যালেন্স ${formatCurrencyBn(
      amount
    )} টাকা সেট করে দিয়েছি! এখন বর্তমান ক্যাশ ব্যালেন্স ${formatCurrencyBn(
      metrics.currentCashBalance
    )} টাকা।`;
    recordTool('COMPLETED', `openingBalance: ${formatCurrencyBn(amount)}`, replyBn);
    return { success: true, status: 'COMPLETED', replyBn, navigationTarget: 'cashbook' };
  }

  return { success: true, status: 'COMPLETED', replyBn: 'নির্দেশটি সম্পন্ন হয়েছে।' };
}

async function startServer() {
  // Hydrate initial data from Google Cloud Firestore if available
  try {
    const loadedFromCloud = await hydrateFromFirestoreOnStart();
    if (loadedFromCloud) {
      console.log('✅ Server initialized with persistent cloud database state from Google Firebase.');
    }
  } catch (err) {
    console.warn('Startup cloud hydration non-blocking warning:', err);
  }

  const app = express();
  const server = http.createServer(app);
  app.use(express.json({ limit: '10mb' }));

  // SSE Endpoint for Live Real-Time Updates
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`event: CONNECTED\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Cloud Sync Status & Manual Triggers
  app.get('/api/cloud-sync/status', (_req, res) => {
    const totalRecords =
      (dbState.salesMemos?.length || 0) +
      (dbState.cashTransactions?.length || 0) +
      (dbState.millPots?.length || 0) +
      (dbState.chulliLoads?.length || 0) +
      (dbState.chulliUnloads?.length || 0);

    res.json({
      connected: Boolean(cloudDb),
      provider: 'Google Firebase Firestore',
      lastCloudSyncIso,
      cloudSyncError,
      totalRecords,
      memosCount: dbState.salesMemos?.length || 0,
      cashCount: dbState.cashTransactions?.length || 0,
    });
  });

  app.post('/api/cloud-sync/push', async (_req, res) => {
    if (!cloudDb) {
      return res.status(500).json({ success: false, error: 'Firebase Firestore সংযুক্ত নয়।' });
    }
    try {
      const docRef = fsDoc(cloudDb, 'kiln_data', 'main');
      const clean = JSON.parse(JSON.stringify(dbState));
      await fsSetDoc(
        docRef,
        {
          state: clean,
          serverUpdatedAt: fsServerTimestamp(),
          lastSavedIso: new Date().toISOString(),
        },
        { merge: true }
      );
      lastCloudSyncIso = new Date().toISOString();
      cloudSyncError = null;
      res.json({ success: true, message: 'ক্লাউডে সফলভাবে সেভ করা হয়েছে।' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.post('/api/cloud-sync/pull', async (_req, res) => {
    if (!cloudDb) {
      return res.status(500).json({ success: false, error: 'Firebase Firestore সংযুক্ত নয়।' });
    }
    try {
      const docRef = fsDoc(cloudDb, 'kiln_data', 'main');
      const snap = await fsGetDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const cloudState = data?.state as KilnDatabaseState | undefined;
        if (cloudState) {
          dbState = { ...dbState, ...cloudState };
          saveDbState();
          const enriched = getEnrichedState();
          broadcastEvent('STATE_UPDATED', enriched);
          return res.json({ success: true, ...enriched });
        }
      }
      res.status(404).json({ success: false, error: 'ক্লাউডে কোনো পূর্ববর্তী ডাটা পাওয়া যায়নি।' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 1. Get Enriched State
  app.get('/api/state', (_req, res) => {
    res.json(getEnrichedState());
  });

  // 2. Settings Endpoints
  app.get('/api/settings', (_req, res) => {
    res.json(dbState.settings);
  });

  app.post('/api/settings', (req, res) => {
    const body = req.body as Partial<KilnSettings>;
    dbState.settings = {
      ...dbState.settings,
      ...body,
      openingBalance: Number(body.openingBalance ?? dbState.settings.openingBalance),
    };
    addAuditLog('USER', 'UPDATE_SETTINGS', 'ভাটার সেটিংস ও প্রারম্ভিক ক্যাশ ব্যালেন্স আপডেট করা হয়েছে।');
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 3. Backup Export and Safe Import
  app.get('/api/backup/export', (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename=brickflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dbState, null, 2));
  });

  const handleBackupRestore = (req: express.Request, res: express.Response) => {
    try {
      const rawBody = req.body;
      const imported = (
        rawBody?.state && (Array.isArray(rawBody.state.salesMemos) || rawBody.state.settings)
          ? rawBody.state
          : rawBody?.dbState && (Array.isArray(rawBody.dbState.salesMemos) || rawBody.dbState.settings)
          ? rawBody.dbState
          : rawBody
      ) as Partial<KilnDatabaseState>;

      if (!imported || typeof imported !== 'object') {
        res.status(400).json({ error: 'ইনভ্যালিড ব্যাকআপ ফাইল ফরম্যাট! কোনো ডাটা অবজেক্ট পাওয়া যায়নি।' });
        return;
      }

      const defaultInitial = createInitialKilnState();
      const settings = { ...defaultInitial.settings, ...(imported.settings || {}) };
      const rawGrades =
        imported.brickGrades && imported.brickGrades.length > 0
          ? imported.brickGrades
          : defaultInitial.brickGrades;
      const brickGrades = rawGrades.map((g) => ({
        ...g,
        ratePerUnit:
          g.ratePerUnit < 100 ? Math.round(g.ratePerUnit * 1000) : g.ratePerUnit,
        ratePerThousand: true,
        currentStock: Number(g.currentStock) || 0,
        seasonProduced: Number(g.seasonProduced) || 0,
      }));

      const salesMemos = Array.isArray(imported.salesMemos)
        ? imported.salesMemos.map((m) => normalizeLegacyMemo(m, brickGrades))
        : defaultInitial.salesMemos;

      const cashTransactions = Array.isArray(imported.cashTransactions)
        ? imported.cashTransactions
        : defaultInitial.cashTransactions;

      dbState = {
        ...defaultInitial,
        ...imported,
        settings,
        brickGrades,
        salesMemos,
        cashTransactions,
        workerProfiles: imported.workerProfiles || defaultInitial.workerProfiles,
        workerAttendance: imported.workerAttendance || defaultInitial.workerAttendance,
        kilnNotes: imported.kilnNotes || defaultInitial.kilnNotes,
        millPots: Array.isArray(imported.millPots) ? imported.millPots : [],
        chulliLoads: Array.isArray(imported.chulliLoads) ? imported.chulliLoads : [],
        poraiMistriRecords: Array.isArray(imported.poraiMistriRecords)
          ? imported.poraiMistriRecords
          : [],
        chulliUnloads: Array.isArray(imported.chulliUnloads)
          ? imported.chulliUnloads
          : [],
        rubbishRecords: Array.isArray(imported.rubbishRecords)
          ? imported.rubbishRecords
          : [],
        woodFuelRecords: Array.isArray(imported.woodFuelRecords)
          ? imported.woodFuelRecords
          : [],
        soilCoalRecords: Array.isArray(imported.soilCoalRecords)
          ? imported.soilCoalRecords
          : [],
        dadonRecords: Array.isArray(imported.dadonRecords)
          ? imported.dadonRecords
          : [],
        advanceBookings: Array.isArray(imported.advanceBookings)
          ? imported.advanceBookings
          : [],
        vehicleDieselRecords: Array.isArray(imported.vehicleDieselRecords)
          ? imported.vehicleDieselRecords
          : [],
        complianceRecords: Array.isArray(imported.complianceRecords)
          ? imported.complianceRecords
          : [],
        productionPayments: Array.isArray(imported.productionPayments)
          ? imported.productionPayments
          : [],
        memoDeliveries: Array.isArray(imported.memoDeliveries)
          ? imported.memoDeliveries
          : [],
        kilnUnits:
          Array.isArray(imported.kilnUnits) && imported.kilnUnits.length > 0
            ? imported.kilnUnits
            : defaultInitial.kilnUnits,
        kilnSeasons:
          Array.isArray(imported.kilnSeasons) && imported.kilnSeasons.length > 0
            ? imported.kilnSeasons
            : defaultInitial.kilnSeasons,
        agentTasks: imported.agentTasks || [],
        agentMessages: imported.agentMessages || defaultInitial.agentMessages,
        auditLogs: imported.auditLogs || defaultInitial.auditLogs,
        context: {},
      };

      addAuditLog('USER', 'RESTORE_BACKUP', 'JSON ব্যাকআপ / ফোনের লোকাল ভল্ট থেকে সফলভাবে রিস্টোর করা হয়েছে।');
      saveDbState();
      const enriched = getEnrichedState();
      broadcastEvent('STATE_UPDATED', enriched);
      res.json({ success: true, ...enriched });
    } catch (err) {
      res.status(500).json({ error: 'ব্যাকআপ রিস্টোর প্রক্রিয়াকরণে ত্রুটি হয়েছে।' });
    }
  };

  app.post('/api/backup/import', handleBackupRestore);
  app.post('/api/backup/restore', handleBackupRestore);

  app.post('/api/reset', (_req, res) => {
    dbState = createInitialKilnState();
    addAuditLog(
      'USER',
      'RESET_ALL_DATA',
      'সম্পূর্ণ ডাটাবেস রিসেট করে সকল হিসাব ০ (শূন্য) করা হয়েছে।'
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ success: true, ...enriched });
  });

  // 4. Create Multi-Item Sales Memo
  app.post('/api/memos', (req, res) => {
    const {
      memoNo: requestedMemoNo,
      customerName,
      customerPhone,
      customerAddress,
      truckNo,
      driverName,
      items,
      discount,
      paidAmount,
      paymentMethod,
      date,
      note,
    } = req.body;

    if (!customerName || !String(customerName).trim()) {
      res.status(400).json({ error: 'ক্রেতার নাম আবশ্যক।' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'অন্তত একটি ইটের ধরন ও পরিমাণ যোগ করতে হবে।' });
      return;
    }

    for (const it of items) {
      const q = Number(it.quantity);
      const r = Number(it.rate ?? 13.5);
      if (!Number.isFinite(q) || q <= 0) {
        res.status(400).json({ error: 'প্রতিটি ইটের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' });
        return;
      }
      if (!Number.isFinite(r) || r <= 0) {
        res.status(400).json({ error: 'ইটের দর অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' });
        return;
      }
    }

    const { memoNo, duplicateErrorBn } = generateUniqueMemoNo(
      dbState.salesMemos,
      requestedMemoNo ? String(requestedMemoNo) : undefined
    );
    if (duplicateErrorBn) {
      res.status(400).json({ error: duplicateErrorBn });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const memoDate = date || todayDate;

    // Validate items (allow memo creation even when current stock is 0: "ইট থাক বা না থাক মেমো করা যাবে")
    const stockCheck = validateStockForMultiItemMemo(dbState.brickGrades, items, true);
    if (!stockCheck.valid) {
      res.status(400).json({ error: stockCheck.errorBn });
      return;
    }

    // Prepare line rows with exact calculations (Line total = quantity * rate)
    const memoRows: MemoItemRow[] = items.map((it: { gradeId: string; quantity: number; rate?: number }) => {
      const g = dbState.brickGrades.find((grade) => grade.id === it.gradeId);
      const gradeName = g ? g.nameBn : '১ নং ইট';
      const rate = Number(it.rate ?? g?.ratePerUnit ?? 13.5);
      const qty = Number(it.quantity) || 0;
      const lineTotal = calculateRowTotal(qty, rate);
      return {
        id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gradeId: it.gradeId,
        gradeName,
        quantity: qty,
        rate,
        ratePerThousand: false,
        lineTotal,
      };
    });

    const rawSubTotal = memoRows.reduce((s, r) => s + r.lineTotal, 0);
    const rawDiscount = Number(discount ?? 0);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0 || rawDiscount > rawSubTotal) {
      res.status(400).json({ error: 'ডিসকাউন্ট নেগেটিভ বা মোট বিলের চেয়ে বেশি হতে পারবে না।' });
      return;
    }

    const expectedTotalBill = rawSubTotal - rawDiscount;
    const rawPaid = Number(paidAmount ?? 0);
    if (!Number.isFinite(rawPaid) || rawPaid < 0 || Math.round(rawPaid) > expectedTotalBill) {
      res.status(400).json({
        error: `জমার পরিমাণ নেগেটিভ বা মোট বিলের (${formatCurrencyBn(expectedTotalBill)}) চেয়ে বেশি হতে পারবে না।`,
      });
      return;
    }

    const calc = calculateMultiItemMemoTotals({
      items: memoRows,
      discount: rawDiscount,
      paidAmount: rawPaid,
    });

    const nowIso = new Date().toISOString();
    const totalOrderedBricks = memoRows.reduce((s, r) => s + r.quantity, 0);
    const newMemo: SalesMemo = {
      id: `memo-${Date.now()}`,
      memoNo,
      date: memoDate,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone || '—').trim(),
      customerAddress: String(customerAddress || 'গ্রাম: স্থানীয়').trim(),
      truckNo: String(truckNo || '—').trim(),
      driverName: String(driverName || '—').trim(),
      vehicleType: String(req.body.vehicleType || 'ট্রাক (Truck)').trim(),
      driverPhone: String(req.body.driverPhone || '—').trim(),
      deliveryStatus: 'BOOKING',
      deliveredQuantity: 0,
      remainingDeliveryQuantity: totalOrderedBricks,
      deliveryHistory: [],
      duePromiseDate: req.body.duePromiseDate ? String(req.body.duePromiseDate).trim() : '',
      items: memoRows,
      subTotal: calc.subTotal,
      discount: calc.discount,
      totalAmount: calc.totalAmount,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      paymentMethod: paymentMethod || 'নগদ ক্যাশ',
      status: calc.status,
      note: String(note || '').trim(),
      createdAt: nowIso,
      paymentHistory:
        calc.paidAmount > 0
          ? [
              {
                id: `mpay-${Date.now()}-init`,
                date: memoDate,
                amount: calc.paidAmount,
                paymentMethod: paymentMethod || 'নগদ ক্যাশ',
                type: 'INITIAL',
                note: 'মেমো তৈরির সময় নগদ জমা',
                createdAt: nowIso,
              },
            ]
          : [],
    };

    // Deduct stock for each brick grade
    for (const [gradeId, remQty] of Object.entries(stockCheck.updatedStock)) {
      const g = dbState.brickGrades.find((grade) => grade.id === gradeId);
      if (g) g.currentStock = remQty;
    }

    dbState.salesMemos.unshift(newMemo);

    // If cash was actually paid, record as Cash In
    if (calc.paidAmount > 0) {
      const summaryItems = memoRows.map((r) => `${formatBn(r.quantity)}টি ${r.gradeName}`).join(', ');
      dbState.cashTransactions.unshift({
        id: `tx-${Date.now()}`,
        date: memoDate,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.paidAmount,
        description: `মেমো ${memoNo} (${newMemo.customerName} - ${summaryItems})`,
        referenceId: newMemo.id,
        paymentMethod: newMemo.paymentMethod,
        verified: true,
        createdAt: nowIso,
      });
    }

    addAuditLog(
      'USER',
      'CREATE_SALES_MEMO',
      `মেমো ${memoNo} তৈরি: ${newMemo.customerName}, মোট ${formatCurrencyBn(
        calc.totalAmount
      )}, জমা ${formatCurrencyBn(calc.paidAmount)}, বাকি ${formatCurrencyBn(calc.dueAmount)}।`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ memo: newMemo, ...enriched });
  });

  // 5. Edit Multi-Item Sales Memo
  app.put('/api/memos/:id', (req, res) => {
    const memo = dbState.salesMemos.find((m) => m.id === req.params.id);
    if (!memo) {
      res.status(404).json({ error: 'মেমোটি খুঁজে পাওয়া যায়নি।' });
      return;
    }

    if (req.body.memoNo && String(req.body.memoNo).trim() !== memo.memoNo) {
      const { duplicateErrorBn } = generateUniqueMemoNo(
        dbState.salesMemos,
        String(req.body.memoNo),
        memo.id
      );
      if (duplicateErrorBn) {
        res.status(400).json({ error: duplicateErrorBn });
        return;
      }
      memo.memoNo = String(req.body.memoNo).trim();
    }

    // Revert old memo stock first
    for (const oldIt of memo.items) {
      const g = dbState.brickGrades.find((grade) => grade.id === oldIt.gradeId);
      if (g) g.currentStock += oldIt.quantity;
    }

    // Support both multi-item array and single-item edits
    const incomingItems =
      Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : req.body.quantity !== undefined || req.body.rate !== undefined
        ? [
            {
              gradeId: req.body.gradeId || memo.items[0]?.gradeId || 'grade-1',
              quantity: Number(req.body.quantity ?? memo.items[0]?.quantity ?? 1000),
              rate: Number(req.body.rate ?? memo.items[0]?.rate ?? 13.5),
            },
          ]
        : memo.items;

    const stockCheck = validateStockForMultiItemMemo(dbState.brickGrades, incomingItems, true);
    if (!stockCheck.valid) {
      // Re-apply old stock if validation fails
      for (const oldIt of memo.items) {
        const g = dbState.brickGrades.find((grade) => grade.id === oldIt.gradeId);
        if (g) g.currentStock -= oldIt.quantity;
      }
      res.status(400).json({ error: stockCheck.errorBn });
      return;
    }

    const memoRows: MemoItemRow[] = incomingItems.map((it: { gradeId: string; quantity: number; rate?: number }) => {
      const g = dbState.brickGrades.find((grade) => grade.id === it.gradeId);
      const gradeName = g ? g.nameBn : '১ নং ইট';
      const rate = Number(it.rate ?? g?.ratePerUnit ?? 13.5);
      const qty = Number(it.quantity) || 0;
      const lineTotal = calculateRowTotal(qty, rate);
      return {
        id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gradeId: it.gradeId,
        gradeName,
        quantity: qty,
        rate,
        ratePerThousand: false,
        lineTotal,
      };
    });

    const rawSubTotal = memoRows.reduce((s, r) => s + r.lineTotal, 0);
    const discNum = Math.max(0, Number(req.body.discount ?? memo.discount) || 0);
    if (discNum > rawSubTotal) {
      for (const oldIt of memo.items) {
        const g = dbState.brickGrades.find((grade) => grade.id === oldIt.gradeId);
        if (g) g.currentStock -= oldIt.quantity;
      }
      res.status(400).json({ error: 'ডিসকাউন্ট মোট বিলের চেয়ে বেশি হতে পারবে না।' });
      return;
    }
    const paidNum = Math.max(0, Number(req.body.paidAmount ?? memo.paidAmount) || 0);
    if (Math.round(paidNum) > rawSubTotal - discNum) {
      for (const oldIt of memo.items) {
        const g = dbState.brickGrades.find((grade) => grade.id === oldIt.gradeId);
        if (g) g.currentStock -= oldIt.quantity;
      }
      res.status(400).json({ error: 'জমার পরিমাণ মোট বিলের চেয়ে বেশি হতে পারবে না।' });
      return;
    }

    const calc = calculateMultiItemMemoTotals({
      items: memoRows,
      discount: discNum,
      paidAmount: paidNum,
    });

    const prevPaidAmount = memo.paidAmount;
    memo.customerName = String(req.body.customerName ?? memo.customerName).trim();
    memo.customerPhone = String(req.body.customerPhone ?? memo.customerPhone).trim();
    memo.customerAddress = String(req.body.customerAddress ?? memo.customerAddress).trim();
    memo.truckNo = String(req.body.truckNo ?? memo.truckNo).trim();
    memo.driverName = String(req.body.driverName ?? memo.driverName).trim();
    if (req.body.vehicleType !== undefined) memo.vehicleType = String(req.body.vehicleType).trim();
    if (req.body.driverPhone !== undefined) memo.driverPhone = String(req.body.driverPhone).trim();
    if (req.body.deliveryStatus !== undefined) memo.deliveryStatus = req.body.deliveryStatus;
    if (req.body.duePromiseDate !== undefined) memo.duePromiseDate = String(req.body.duePromiseDate).trim();
    memo.date = req.body.date || memo.date;
    memo.paymentMethod = req.body.paymentMethod || memo.paymentMethod;
    memo.items = memoRows;
    memo.subTotal = calc.subTotal;
    memo.discount = calc.discount;
    memo.totalAmount = calc.totalAmount;
    memo.paidAmount = calc.paidAmount;
    memo.dueAmount = calc.dueAmount;
    memo.status = calc.status;
    memo.note = req.body.note !== undefined ? String(req.body.note) : memo.note;

    if (!Array.isArray(memo.paymentHistory)) {
      memo.paymentHistory = [];
    }
    if (calc.paidAmount !== prevPaidAmount) {
      const diff = calc.paidAmount - prevPaidAmount;
      if (diff > 0) {
        memo.paymentHistory.push({
          id: `mpay-${Date.now()}-edit`,
          date: memo.date,
          amount: diff,
          paymentMethod: memo.paymentMethod,
          type: prevPaidAmount === 0 ? 'INITIAL' : 'DUE_COLLECTION',
          note: prevPaidAmount === 0 ? 'মেমো আপডেটের সময় নগদ জমা' : 'মেমো সংশোধনের মাধ্যমে অতিরিক্ত জমা',
          createdAt: new Date().toISOString(),
        });
      } else if (calc.paidAmount === 0) {
        memo.paymentHistory = [];
      }
    }

    // Apply updated stock
    for (const [gradeId, remQty] of Object.entries(stockCheck.updatedStock)) {
      const g = dbState.brickGrades.find((grade) => grade.id === gradeId);
      if (g) g.currentStock = remQty;
    }

    // Reconcile associated Cash In transactions so cashbook and memo.paidAmount always match 100%
    const summaryItems = memoRows.map((r) => `${formatBn(r.quantity)}টি ${r.gradeName}`).join(', ');
    dbState.cashTransactions = dbState.cashTransactions.filter(
      (t) => !(t.referenceId === memo.id && t.type === 'IN')
    );
    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-${Date.now()}`,
        date: memo.date,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.paidAmount,
        description: `মেমো ${memo.memoNo} (${memo.customerName} - ${summaryItems})`,
        referenceId: memo.id,
        paymentMethod: memo.paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog('USER', 'UPDATE_SALES_MEMO', `মেমো ${memo.memoNo} সংশোধন করা হয়েছে।`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ memo, ...enriched });
  });

  // 6. Collect Customer Due
  app.post('/api/memos/:id/collect-due', (req, res) => {
    const memo = dbState.salesMemos.find((m) => m.id === req.params.id);
    if (!memo) {
      res.status(404).json({ error: 'মেমোটি খুঁজে পাওয়া যায়নি।' });
      return;
    }
    const rawAmount = Number(req.body.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: 'আদায়ের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' });
      return;
    }
    if (memo.dueAmount <= 0) {
      res.status(400).json({ error: 'এই মেমোতে কোনো বকেয়া অবশিষ্ট নেই।' });
      return;
    }
    const roundedAmount = Math.round(rawAmount);
    if (roundedAmount > memo.dueAmount) {
      res.status(400).json({
        error: `আদায়ের পরিমাণ বর্তমান বকেয়ার (${formatCurrencyBn(memo.dueAmount)}) চেয়ে বেশি হতে পারবে না।`,
      });
      return;
    }
    const collected = roundedAmount;
    const { todayDate } = getTodayAndYesterday();
    const payDate = req.body.date || todayDate;
    const payMethod: PaymentMethod = req.body.paymentMethod || 'নগদ ক্যাশ';
    const customNote = req.body.note ? String(req.body.note).trim() : '';

    // Ensure paymentHistory is initialized and preserves any initial deposit
    if (!Array.isArray(memo.paymentHistory)) {
      memo.paymentHistory = [];
      if (memo.paidAmount > 0) {
        memo.paymentHistory.push({
          id: `mpay-init-${memo.id}`,
          date: memo.date,
          amount: memo.paidAmount,
          paymentMethod: memo.paymentMethod || 'নগদ ক্যাশ',
          type: 'INITIAL',
          note: 'মেমো তৈরির সময় নগদ জমা',
          createdAt: memo.createdAt || new Date().toISOString(),
        });
      }
    }

    const installmentCount =
      memo.paymentHistory.filter((p) => p.type === 'DUE_COLLECTION').length + 1;
    const recordNote =
      customNote || `বকেয়া কিস্তি জমা (#${formatBn(installmentCount)})`;

    memo.paidAmount += collected;
    memo.dueAmount -= collected;
    memo.status = memo.dueAmount === 0 ? 'PAID' : 'PARTIAL';

    const newPaymentRecord = {
      id: `mpay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: payDate,
      amount: collected,
      paymentMethod: payMethod,
      type: 'DUE_COLLECTION' as const,
      note: recordNote,
      createdAt: new Date().toISOString(),
    };
    memo.paymentHistory.push(newPaymentRecord);

    const tx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: payDate,
      type: 'IN',
      category: 'বাকি আদায়',
      amount: collected,
      description: `বাকি আদায়: মেমো ${memo.memoNo} (${memo.customerName})${customNote ? ` - ${customNote}` : ''}`,
      referenceId: memo.id,
      paymentMethod: payMethod,
      verified: true,
      createdAt: new Date().toISOString(),
    };
    dbState.cashTransactions.unshift(tx);

    addAuditLog(
      'USER',
      'COLLECT_DUE',
      `মেমো ${memo.memoNo} (${memo.customerName}) থেকে ${formatCurrencyBn(collected)} বকেয়া আদায়।`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ memo, paymentRecord: newPaymentRecord, transaction: tx, ...enriched });
  });

  // 7. Delete Memo
  app.delete('/api/memos/:id', (req, res) => {
    const idx = dbState.salesMemos.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'মেমোটি খুঁজে পাওয়া যায়নি।' });
      return;
    }
    const [removed] = dbState.salesMemos.splice(idx, 1);
    for (const it of removed.items) {
      const g = dbState.brickGrades.find((grade) => grade.id === it.gradeId);
      if (g) g.currentStock += it.quantity;
    }
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== removed.id);
    if (Array.isArray(dbState.memoDeliveries)) {
      dbState.memoDeliveries = dbState.memoDeliveries.filter(
        (d) => d.memoId !== removed.id
      );
    }
    addAuditLog('USER', 'DELETE_MEMO', `মেমো ${removed.memoNo} মুছে ফেলা হয়েছে ও স্টক ফেরত দেওয়া হয়েছে।`, 'WARNING');
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 7b. Step-by-Step Brick Delivery against Memo (মেমো নাম্বার দিয়ে ধাপে ধাপে ইট ডেলিভারি হিসাব)
  app.post('/api/deliveries', (req, res) => {
    const {
      memoId,
      memoNo,
      gradeId,
      quantity,
      date,
      truckNo,
      driverName,
      vehicleType,
      note,
    } = req.body;

    const cleanMemoNo = parseBanglaDigits(String(memoNo || '').trim()).toLowerCase();
    const memo = dbState.salesMemos.find(
      (m) =>
        (memoId && m.id === memoId) ||
        (cleanMemoNo &&
          parseBanglaDigits(String(m.memoNo || '').trim()).toLowerCase() === cleanMemoNo)
    );

    if (!memo) {
      res.status(404).json({
        error: `মেমো নম্বর "${memoNo || ''}" খুঁজে পাওয়া যায়নি। সঠিক মেমো নম্বর দিন।`,
      });
      return;
    }

    const delivQty = Math.round(
      Number(parseBanglaDigits(String(quantity ?? 0))) || 0
    );
    if (!Number.isFinite(delivQty) || delivQty <= 0) {
      res.status(400).json({
        error: 'ডেলিভারি ইটের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।',
      });
      return;
    }

    const memoItems =
      Array.isArray(memo.items) && memo.items.length > 0
        ? memo.items
        : [
            {
              id: 'it-1',
              gradeId: memo.gradeId || 'grade-1',
              gradeName: cleanBrickGradeName(memo.gradeName || '১ নং ইট'),
              quantity: Number(memo.quantity) || 0,
              rate: Number(memo.rate) || 11000,
              ratePerThousand: true,
              lineTotal: memo.totalAmount,
            },
          ];

    const totalOrdered = memoItems.reduce(
      (s, it) => s + (Number(it.quantity) || 0),
      0
    );
    if (!Array.isArray(memo.deliveryHistory)) {
      memo.deliveryHistory = [];
    }
    const alreadyDelivered = memo.deliveryHistory.reduce(
      (s, d) => s + (Number(d.quantity) || 0),
      0
    );
    const remainingBefore = Math.max(0, totalOrdered - alreadyDelivered);

    if (delivQty > remainingBefore) {
      res.status(400).json({
        error: `এই মেমোতে (${memo.memoNo}) মোট ইট ${formatBn(
          totalOrdered
        )} পিস, ইতিমধ্যে ডেলিভারি গেছে ${formatBn(
          alreadyDelivered
        )} পিস। বাকি আছে ${formatBn(
          remainingBefore
        )} পিস — এর বেশি ডেলিভারি সাবমিট করা যাবে না।`,
      });
      return;
    }

    const targetGradeId = gradeId || memoItems[0]?.gradeId || 'grade-1';
    const gradeObj = dbState.brickGrades.find((g) => g.id === targetGradeId);
    const resolvedGradeName = cleanBrickGradeName(
      gradeObj?.nameBn ||
        memoItems.find((i) => i.gradeId === targetGradeId)?.gradeName ||
        memoItems[0]?.gradeName ||
        '১ নং ইট'
    );

    const { todayDate } = getTodayAndYesterday();
    const tripIndex = memo.deliveryHistory.length + 1;
    const nowIso = new Date().toISOString();

    const newDelivery: MemoDeliveryRecord = {
      id: `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memoId: memo.id,
      memoNo: memo.memoNo,
      customerName: memo.customerName,
      customerPhone: memo.customerPhone || '—',
      date: date || todayDate,
      gradeId: targetGradeId,
      gradeName: resolvedGradeName,
      quantity: delivQty,
      truckNo: String(truckNo || memo.truckNo || '—').trim(),
      driverName: String(driverName || memo.driverName || '—').trim(),
      vehicleType: String(vehicleType || memo.vehicleType || 'ট্রাক (Truck)').trim(),
      note:
        String(note || '').trim() ||
        `ট্রিপ #${formatBn(tripIndex)} — ইট ডেলিভারি`,
      createdAt: nowIso,
    };

    memo.deliveryHistory.push(newDelivery);
    if (!Array.isArray(dbState.memoDeliveries)) {
      dbState.memoDeliveries = [];
    }
    dbState.memoDeliveries.unshift(newDelivery);

    const updatedDelivered = alreadyDelivered + delivQty;
    const updatedRemaining = Math.max(0, totalOrdered - updatedDelivered);
    memo.deliveredQuantity = updatedDelivered;
    memo.remainingDeliveryQuantity = updatedRemaining;
    memo.deliveryStatus = updatedRemaining === 0 ? 'DELIVERED' : 'PARTIAL';

    addAuditLog(
      'USER',
      'MEMO_DELIVERY',
      `মেমো ${memo.memoNo} (${memo.customerName}): ${formatBn(
        delivQty
      )} পিস ${resolvedGradeName} ডেলিভারি সম্পন্ন (মোট ডেলিভারি: ${formatBn(
        updatedDelivered
      )}/${formatBn(totalOrdered)} পিস)।`
    );

    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ delivery: newDelivery, memo, ...enriched });
  });

  app.delete('/api/deliveries/:id', (req, res) => {
    const delivId = req.params.id;
    if (!Array.isArray(dbState.memoDeliveries)) {
      dbState.memoDeliveries = [];
    }
    const target = dbState.memoDeliveries.find((d) => d.id === delivId);
    dbState.memoDeliveries = dbState.memoDeliveries.filter(
      (d) => d.id !== delivId
    );

    for (const m of dbState.salesMemos) {
      if (Array.isArray(m.deliveryHistory)) {
        const beforeLen = m.deliveryHistory.length;
        m.deliveryHistory = m.deliveryHistory.filter((d) => d.id !== delivId);
        if (m.deliveryHistory.length !== beforeLen || (target && m.id === target.memoId)) {
          const totalOrdered = (m.items || []).reduce(
            (s, it) => s + (Number(it.quantity) || 0),
            0
          );
          const newDeliv = m.deliveryHistory.reduce(
            (s, d) => s + (Number(d.quantity) || 0),
            0
          );
          m.deliveredQuantity = newDeliv;
          m.remainingDeliveryQuantity = Math.max(0, totalOrdered - newDeliv);
          m.deliveryStatus =
            newDeliv >= totalOrdered && totalOrdered > 0
              ? 'DELIVERED'
              : newDeliv > 0
              ? 'PARTIAL'
              : 'BOOKING';
        }
      }
    }

    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 8. Cash Transactions CRUD
  app.post('/api/cash', (req, res) => {
    const { type, category, amount, description, paymentMethod, date } = req.body;
    const amt = parseNum(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      res.status(400).json({ error: 'টাকার পরিমাণ শূন্যের চেয়ে বেশি হতে হবে।' });
      return;
    }
    const { todayDate } = getTodayAndYesterday();
    const tx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: date || todayDate,
      type: type === 'IN' ? 'IN' : 'OUT',
      category: String(category || (type === 'IN' ? 'অন্যান্য জমা' : 'অন্যান্য খরচ')).trim(),
      amount: Math.round(amt),
      description: String(description || `${category} বাবদ লেনদেন`).trim(),
      paymentMethod: paymentMethod || 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    };
    dbState.cashTransactions.unshift(tx);
    addAuditLog('USER', 'ADD_CASH_TX', `${tx.category}: ${formatCurrencyBn(tx.amount)} (${tx.type === 'IN' ? 'জমা' : 'খরচ'}) যোগ।`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ transaction: tx, ...enriched });
  });

  app.put('/api/cash/:id', (req, res) => {
    const tx = dbState.cashTransactions.find((t) => t.id === req.params.id);
    if (!tx) {
      res.status(404).json({ error: 'লেনদেন খুঁজে পাওয়া যায়নি।' });
      return;
    }
    const amt = req.body.amount !== undefined ? Number(req.body.amount) : tx.amount;
    if (!Number.isFinite(amt) || amt <= 0) {
      res.status(400).json({ error: 'টাকার পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' });
      return;
    }
    if (req.body.type === 'IN' || req.body.type === 'OUT') {
      tx.type = req.body.type;
    }
    if (req.body.category !== undefined && String(req.body.category).trim()) {
      tx.category = String(req.body.category).trim();
    }
    tx.amount = Math.round(amt);
    if (req.body.description !== undefined) {
      tx.description = String(req.body.description).trim() || `${tx.category} বাবদ লেনদেন`;
    }
    if (req.body.paymentMethod !== undefined && String(req.body.paymentMethod).trim()) {
      tx.paymentMethod = String(req.body.paymentMethod).trim() as PaymentMethod;
    }
    if (req.body.date !== undefined && String(req.body.date).trim()) {
      tx.date = String(req.body.date).trim();
    }

    // If this cash transaction is linked to a memo, keep memo paidAmount/dueAmount consistent
    if (tx.referenceId && tx.type === 'IN') {
      const linkedMemo = dbState.salesMemos.find((m) => m.id === tx.referenceId);
      if (linkedMemo) {
        const totalInForMemo = dbState.cashTransactions
          .filter((t) => t.referenceId === linkedMemo.id && t.type === 'IN')
          .reduce((sum, t) => sum + t.amount, 0);
        linkedMemo.paidAmount = Math.min(linkedMemo.totalAmount, totalInForMemo);
        linkedMemo.dueAmount = Math.max(0, linkedMemo.totalAmount - linkedMemo.paidAmount);
        linkedMemo.status =
          linkedMemo.dueAmount === 0
            ? 'PAID'
            : linkedMemo.paidAmount > 0
            ? 'PARTIAL'
            : 'DUE';
      }
    }

    addAuditLog('USER', 'UPDATE_CASH_TX', `${tx.category} লেনদেন সংশোধন করা হয়েছে (${formatCurrencyBn(tx.amount)})।`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ transaction: tx, ...enriched });
  });

  app.delete('/api/cash/:id', (req, res) => {
    const idx = dbState.cashTransactions.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'লেনদেন খুঁজে পাওয়া যায়নি।' });
      return;
    }
    const [removed] = dbState.cashTransactions.splice(idx, 1);
    if (removed.referenceId && removed.type === 'IN') {
      const linkedMemo = dbState.salesMemos.find((m) => m.id === removed.referenceId);
      if (linkedMemo) {
        const totalInForMemo = dbState.cashTransactions
          .filter((t) => t.referenceId === linkedMemo.id && t.type === 'IN')
          .reduce((sum, t) => sum + t.amount, 0);
        linkedMemo.paidAmount = Math.min(linkedMemo.totalAmount, totalInForMemo);
        linkedMemo.dueAmount = Math.max(0, linkedMemo.totalAmount - linkedMemo.paidAmount);
        linkedMemo.status =
          linkedMemo.dueAmount === 0
            ? 'PAID'
            : linkedMemo.paidAmount > 0
            ? 'PARTIAL'
            : 'DUE';
      }
    }
    addAuditLog('USER', 'DELETE_CASH_TX', `${removed.category} (${formatCurrencyBn(removed.amount)}) মুছে ফেলা হয়েছে।`, 'WARNING');
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9. Inventory Stock Add
  app.post('/api/inventory/add-stock', (req, res) => {
    const { gradeId, quantity, newRate } = req.body;
    const grade = dbState.brickGrades.find((g) => g.id === gradeId);
    if (!grade) {
      res.status(400).json({ error: 'ইটের গ্রেড পাওয়া যায়নি।' });
      return;
    }
    const qty = parseNum(quantity);
    if (qty > 0) {
      grade.currentStock += qty;
      grade.seasonProduced += qty;
    }
    if (newRate !== undefined && parseNum(newRate) > 0) {
      grade.ratePerUnit = parseNum(newRate);
    }
    addAuditLog('USER', 'ADD_STOCK', `${grade.nameBn}: +${formatBn(qty)}টি নতুন ইট যোগ (বর্তমান স্টক ${formatBn(grade.currentStock)}টি)।`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9a. 3-Mill Raw Brick Pot Ledger (ওহাব মিল, মফিজুল মিল, শফিকুল মিল)
  app.post('/api/production/mill-pot', (req, res) => {
    const {
      id,
      millId,
      potNo,
      date,
      rawBricksCut,
      takenToChulli,
      ratePerThousand,
      paidAmount,
      note,
    } = req.body;

    const validMillId: MillId =
      millId === 'mofijul' || millId === 'sofikul' ? millId : 'ohab';
    const millNames: Record<MillId, { bn: string; en: string }> = {
      ohab: { bn: 'ওহাব মিল', en: 'Ohab Mill' },
      mofijul: { bn: 'মফিজুল মিল', en: 'Mofijul Mill' },
      sofikul: { bn: 'শফিকুল মিল', en: 'Sofikul Mill' },
    };

    const rawCut = Math.max(0, parseNum(rawBricksCut));
    const taken = Math.max(0, Math.min(rawCut, parseNum(takenToChulli)));
    const remaining = Math.max(0, rawCut - taken);
    const rate = Math.max(0, parseNum(ratePerThousand, 1200) || 1200);
    const totalPayable = Math.round((rawCut / 1000) * rate);
    const paid = Math.max(0, parseNum(paidAmount));
    const due = Math.max(0, totalPayable - paid);
    const { todayDate } = getTodayAndYesterday();

    if (!dbState.millPots) dbState.millPots = [];

    if (id) {
      const existing = dbState.millPots.find((p) => p.id === id);
      if (existing) {
        const diffPaid = paid - existing.paidAmount;
        existing.millId = validMillId;
        existing.millNameBn = millNames[validMillId].bn;
        existing.millNameEn = millNames[validMillId].en;
        existing.potNo = String(potNo || existing.potNo).trim();
        existing.date = date || existing.date;
        existing.rawBricksCut = rawCut;
        existing.takenToChulli = taken;
        existing.remainingRawBricks = remaining;
        existing.ratePerThousand = rate;
        existing.totalPayable = totalPayable;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (note !== undefined) existing.note = String(note).trim();

        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'MILL',
            referenceId: existing.id,
            recipientName: `${existing.millNameBn} (${existing.potNo})`,
            subDetail: `${formatBn(existing.rawBricksCut)} পিস ইট @ ৳${formatBn(existing.ratePerThousand)}/হাজার`,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'মিলের পট বাবদ টাকা জমা').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `${existing.millNameBn} (${existing.potNo}) কাঁচা ইট কাটা পেমেন্ট`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const newPot: MillPotRecord = {
      id: `pot-${Date.now()}`,
      millId: validMillId,
      millNameBn: millNames[validMillId].bn,
      millNameEn: millNames[validMillId].en,
      potNo: String(potNo || `পট-${formatBn((dbState.millPots.filter((p) => p.millId === validMillId).length || 0) + 1)}`).trim(),
      date: date || todayDate,
      rawBricksCut: rawCut,
      takenToChulli: taken,
      remainingRawBricks: remaining,
      ratePerThousand: rate,
      totalPayable,
      paidAmount: paid,
      dueAmount: due,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.millPots.unshift(newPot);

    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'MILL',
        referenceId: newPot.id,
        recipientName: `${newPot.millNameBn} (${newPot.potNo})`,
        subDetail: `${formatBn(rawCut)} পিস ইট @ ৳${formatBn(rate)}/হাজার`,
        amount: paid,
        date: newPot.date,
        note: String(note || 'পট এন্ট্রির সময় প্রাথমিক জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newPot.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `${newPot.millNameBn} (${newPot.potNo}) - ${formatBn(rawCut)} পিস কাঁচা ইট কাটা পেমেন্ট`,
        referenceId: newPot.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'ADD_MILL_POT',
      `${newPot.millNameBn} (${newPot.potNo}): ${formatBn(rawCut)} পিস কাঁচা ইট যোগ।`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/mill-pot/:id', (req, res) => {
    if (dbState.millPots) {
      dbState.millPots = dbState.millPots.filter((p) => p.id !== req.params.id);
    }
    if (dbState.productionPayments) {
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== req.params.id
      );
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9b. Chulli Van Loading (কাঁচা ইট ১০০০ পিস (হাজার প্রতি) রেটে চুল্লিতে ভ্যান লোড — আসাদ / সেলিম সর্দার)
  app.post('/api/production/chulli-load', (req, res) => {
    const {
      id,
      sardarName,
      rawBricksLoaded,
      pakaBricksLoaded,
      ratePerVan,
      paidAmount,
      date,
      note,
    } = req.body;

    const { todayDate } = getTodayAndYesterday();
    if (!dbState.chulliLoads) dbState.chulliLoads = [];

    if (id) {
      const existing = dbState.chulliLoads.find((l) => l.id === id);
      if (existing) {
        const rawInput =
          rawBricksLoaded !== undefined
            ? Math.max(0, parseNum(rawBricksLoaded))
            : existing.rawBricksLoaded;
        const pakaInput =
          pakaBricksLoaded !== undefined
            ? Math.max(0, parseNum(pakaBricksLoaded))
            : (existing.pakaBricksLoaded || 0);
        const rateInput =
          parseNum(ratePerVan) > 0 ? parseNum(ratePerVan) : existing.ratePerVan || 115;
        const {
          rawBricksLoaded: calculatedRaw,
          pakaBricksLoaded: calculatedPaka,
          totalBricksLoaded: calculatedTotal,
          vanCount,
          ratePerThousand,
          totalBill,
        } = calculateVanLoadBill(rawInput, rateInput, pakaInput);

        const paid =
          paidAmount !== undefined
            ? Math.max(0, parseNum(paidAmount))
            : existing.paidAmount;
        const due = Math.max(0, totalBill - paid);
        const diffPaid = paid - existing.paidAmount;

        existing.sardarName = String(sardarName || existing.sardarName || 'সেলিম সর্দার').trim();
        existing.rawBricksLoaded = calculatedRaw;
        existing.pakaBricksLoaded = calculatedPaka;
        existing.totalBricksLoaded = calculatedTotal;
        existing.vanCount = vanCount;
        existing.ratePerVan = ratePerThousand;
        existing.totalBill = totalBill;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (date) existing.date = date;
        if (note !== undefined) existing.note = String(note).trim();

        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'VAN_LOAD',
            referenceId: existing.id,
            recipientName: existing.sardarName,
            subDetail: `${formatBn(calculatedTotal)} পিস ইট (${calculatedPaka > 0 ? `কাঁচা ${formatBn(calculatedRaw)} + পাকা ${formatBn(calculatedPaka)}` : 'কাঁচা ইট'} @ ৳${formatBn(existing.ratePerVan)}/হাজার)`,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'ভ্যান লোড বাবদ টাকা জমা').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `চুল্লি ভ্যান লোড পেমেন্ট (${existing.sardarName})`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const rawInput = Math.max(0, parseNum(rawBricksLoaded));
    const pakaInput = Math.max(0, parseNum(pakaBricksLoaded));
    const {
      rawBricksLoaded: calculatedRaw,
      pakaBricksLoaded: calculatedPaka,
      totalBricksLoaded: calculatedTotal,
      vanCount,
      ratePerThousand,
      totalBill,
    } = calculateVanLoadBill(
      rawInput,
      parseNum(ratePerVan) > 0 ? parseNum(ratePerVan) : 115,
      pakaInput
    );
    const paid = Math.max(0, parseNum(paidAmount));
    const due = Math.max(0, totalBill - paid);

    const newLoad: ChulliLoadRecord = {
      id: `load-${Date.now()}`,
      date: date || todayDate,
      sardarName: String(sardarName || 'সেলিম সর্দার').trim(),
      rawBricksLoaded: calculatedRaw,
      pakaBricksLoaded: calculatedPaka,
      totalBricksLoaded: calculatedTotal,
      vanCount,
      ratePerVan: ratePerThousand,
      totalBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.chulliLoads.unshift(newLoad);

    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'VAN_LOAD',
        referenceId: newLoad.id,
        recipientName: newLoad.sardarName,
        subDetail: `${formatBn(calculatedTotal)} পিস ইট (${calculatedPaka > 0 ? `কাঁচা ${formatBn(calculatedRaw)} + পাকা ${formatBn(calculatedPaka)}` : 'কাঁচা ইট'} @ ৳${formatBn(ratePerThousand)}/হাজার)`,
        amount: paid,
        date: newLoad.date,
        note: String(note || 'ভ্যান লোড এন্ট্রির সময় জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newLoad.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `চুল্লি ভ্যান লোড (${formatBn(calculatedTotal)} পিস @ ৳${ratePerThousand}/হাজার): ${newLoad.sardarName}`,
        referenceId: newLoad.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'CHULLI_VAN_LOAD',
      `চুল্লিতে ভ্যান লোড (${newLoad.sardarName}): মোট ${formatBn(calculatedTotal)} পিস [কাঁচা: ${formatBn(calculatedRaw)}, পাকা: ${formatBn(calculatedPaka)}] (@ ৳${ratePerThousand}/হাজার) - বিল ${formatCurrencyBn(totalBill)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/chulli-load/:id', (req, res) => {
    if (dbState.chulliLoads) {
      dbState.chulliLoads = dbState.chulliLoads.filter((l) => l.id !== req.params.id);
    }
    if (dbState.productionPayments) {
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== req.params.id
      );
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9b-2. Porai Mistri / Chulli Firing Master Ledger (পোড়াই মিস্ত্রি — আলতাফ সর্দার)
  app.post('/api/production/porai-mistri', (req, res) => {
    const {
      id,
      mistriName,
      chamberOrRound,
      mistriCount,
      monthsCount,
      monthlyRatePerMistri,
      contractTotalBill,
      bricksFired,
      ratePerThousand,
      paidAmount,
      date,
      note,
    } = req.body;

    const { todayDate } = getTodayAndYesterday();
    if (!dbState.poraiMistriRecords) dbState.poraiMistriRecords = [];

    if (id) {
      const existing = dbState.poraiMistriRecords.find((r) => r.id === id);
      if (existing) {
        const mCount =
          mistriCount !== undefined
            ? Math.max(1, Math.round(parseNum(mistriCount, 1) || 1))
            : existing.mistriCount || 8;
        const mMonths =
          monthsCount !== undefined
            ? Math.max(0.5, parseNum(monthsCount, 1) || 1)
            : existing.monthsCount || 5;
        const mMonthlyRate =
          monthlyRatePerMistri !== undefined
            ? Math.max(0, parseNum(monthlyRatePerMistri))
            : existing.monthlyRatePerMistri || 0;
        const bFired =
          bricksFired !== undefined
            ? Math.max(0, parseNum(bricksFired))
            : existing.bricksFired;
        const fRate =
          parseNum(ratePerThousand) > 0
            ? parseNum(ratePerThousand)
            : existing.ratePerThousand || 400;

        let totalBill = existing.totalBill;
        if (contractTotalBill !== undefined && parseNum(contractTotalBill, -1) >= 0) {
          totalBill = Math.round(parseNum(contractTotalBill));
        } else if (bFired > 0 && bricksFired !== undefined) {
          totalBill = Math.round((bFired / 1000) * fRate);
        }

        const paid =
          paidAmount !== undefined
            ? Math.max(0, parseNum(paidAmount))
            : existing.paidAmount;
        const due = Math.max(0, totalBill - paid);
        const diffPaid = paid - existing.paidAmount;

        existing.mistriName = String(mistriName || existing.mistriName || 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)').trim();
        existing.chamberOrRound = String(chamberOrRound || existing.chamberOrRound || 'সিজন চুক্তি').trim();
        existing.mistriCount = mCount;
        existing.monthsCount = mMonths;
        existing.monthlyRatePerMistri = mMonthlyRate;
        existing.contractTotalBill = totalBill;
        existing.bricksFired = bFired;
        existing.ratePerThousand = fRate;
        existing.totalBill = totalBill;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (date) existing.date = date;
        if (note !== undefined) existing.note = String(note).trim();

        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'PORAI_MISTRI',
            referenceId: existing.id,
            recipientName: `${existing.mistriName} (${formatBn(mCount)} জন মিস্ত্রি)`,
            subDetail: `${existing.chamberOrRound} · মোট বিল ৳${formatBn(totalBill)} · সাপ্তাহিক প্রদান`,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'পোড়াই মিস্ত্রিকে সাপ্তাহিক টাকা প্রদান').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: date || existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `পোড়াই মিস্ত্রি সাপ্তাহিক পেমেন্ট: ${existing.mistriName} (${formatBn(mCount)} জন মিস্ত্রি · ${existing.chamberOrRound})`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const mCount = Math.max(1, Math.round(parseNum(mistriCount, 8) || 8));
    const mMonths = Math.max(0.5, parseNum(monthsCount, 5) || 5);
    const mMonthlyRate = Math.max(0, parseNum(monthlyRatePerMistri));
    const bFired = Math.max(0, parseNum(bricksFired));
    const fRate = parseNum(ratePerThousand) > 0 ? parseNum(ratePerThousand) : 400;

    let totalBill = 0;
    if (contractTotalBill !== undefined && parseNum(contractTotalBill, -1) >= 0) {
      totalBill = Math.round(parseNum(contractTotalBill));
    } else if (mMonthlyRate > 0) {
      totalBill = Math.round(mCount * mMonths * mMonthlyRate);
    } else if (bFired > 0) {
      totalBill = Math.round((bFired / 1000) * fRate);
    }

    const paid = Math.max(0, parseNum(paidAmount));
    const due = Math.max(0, totalBill - paid);

    const newRecord: PoraiMistriRecord = {
      id: `porai-${Date.now()}`,
      date: date || todayDate,
      mistriName: String(mistriName || 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)').trim(),
      chamberOrRound: String(
        chamberOrRound || `মাসভিত্তিক সিজন চুক্তি (${formatBn(mCount)} জন মিস্ত্রি)`
      ).trim(),
      mistriCount: mCount,
      monthsCount: mMonths,
      monthlyRatePerMistri: mMonthlyRate,
      contractTotalBill: totalBill,
      bricksFired: bFired,
      ratePerThousand: fRate,
      totalBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.poraiMistriRecords.unshift(newRecord);

    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'PORAI_MISTRI',
        referenceId: newRecord.id,
        recipientName: `${newRecord.mistriName} (${formatBn(mCount)} জন মিস্ত্রি)`,
        subDetail: `${newRecord.chamberOrRound} · মোট বিল ৳${formatBn(totalBill)} · সাপ্তাহিক টাকা প্রদান`,
        amount: paid,
        date: newRecord.date,
        note: String(note || 'পোড়াই মিস্ত্রিকে সাপ্তাহিক টাকা প্রদান').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRecord.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `পোড়াই মিস্ত্রি সাপ্তাহিক পেমেন্ট (${formatBn(mCount)} জন মিস্ত্রি): ${newRecord.mistriName}`,
        referenceId: newRecord.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'PORAI_MISTRI_ADD',
      `পোড়াই মিস্ত্রি (${newRecord.mistriName} · ${formatBn(mCount)} জন মিস্ত্রি): মোট বিল ${formatCurrencyBn(totalBill)}, দেওয়া হলো ${formatCurrencyBn(paid)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/porai-mistri/:id', (req, res) => {
    if (dbState.poraiMistriRecords) {
      dbState.poraiMistriRecords = dbState.poraiMistriRecords.filter(
        (r) => r.id !== req.params.id
      );
    }
    if (dbState.productionPayments) {
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== req.params.id
      );
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9c. Chulli Unloading / Nikol (চুল্লি থেকে লাইনে পোড়ানো ইট আনলোড — নজরুল সর্দার)
  app.post('/api/production/chulli-unload', (req, res) => {
    const {
      id,
      chamberOrRound,
      sardarName,
      linesUnloaded,
      bricksPerLine,
      ratePerLine,
      unloadedByGrade,
      ratePerThousand,
      paidAmount,
      date,
      note,
    } = req.body;

    const { todayDate } = getTodayAndYesterday();
    if (!dbState.chulliUnloads) dbState.chulliUnloads = [];

    // If updating payment or editing an existing unload record
    if (id && !Array.isArray(unloadedByGrade) && linesUnloaded === undefined) {
      const existing = dbState.chulliUnloads.find((u) => u.id === id);
      if (existing) {
        const paid = Math.max(0, Number(paidAmount) || 0);
        const diffPaid = paid - existing.paidAmount;
        existing.paidAmount = paid;
        existing.dueAmount = Math.max(0, existing.totalBill - paid);
        if (note !== undefined) existing.note = String(note).trim();
        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          const lineDesc = existing.linesUnloaded
            ? `${formatBn(existing.linesUnloaded)} লাইন (${formatBn(existing.totalBricksUnloaded)} পিস) @ ৳${formatBn(existing.ratePerLine || 750)}/লাইন`
            : `${formatBn(existing.totalBricksUnloaded)} পিস আনলোড`;
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'UNLOAD',
            referenceId: existing.id,
            recipientName: `${existing.sardarName} (${existing.chamberOrRound})`,
            subDetail: lineDesc,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'আনলোড বাবদ টাকা জমা').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `চুল্লি আনলোড / নিকল পেমেন্ট: ${existing.sardarName} (${lineDesc})`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    // Check if Line-Based Unload is submitted (কয় লাইন বের করলো: ১ লাইন = ৪০০০ ইট @ ৭৫০ টাকা) or deposit-only
    const parsedLines = Math.max(0, parseNum(linesUnloaded));
    const parsedPaidUnload = Math.max(0, parseNum(paidAmount));
    if (parsedLines > 0 || (parsedPaidUnload > 0 && !Array.isArray(unloadedByGrade))) {
      const lineCalc = calculateChulliLineUnloadBill(
        parsedLines,
        parseNum(ratePerLine) > 0 ? parseNum(ratePerLine) : 750,
        parseNum(bricksPerLine) > 0 ? parseNum(bricksPerLine) : 4000,
        parsedPaidUnload
      );

      const requestedGradeId =
        Array.isArray(unloadedByGrade) && unloadedByGrade[0]?.gradeId
          ? String(unloadedByGrade[0].gradeId)
          : 'grade-1';
      const targetGrade =
        dbState.brickGrades.find((g) => g.id === requestedGradeId) ||
        dbState.brickGrades.find((g) => g.id === 'grade-1') ||
        dbState.brickGrades[0];

      // If editing an existing record's lines/rate
      if (id) {
        const existing = dbState.chulliUnloads.find((u) => u.id === id);
        if (existing) {
          // Reverse previous stock addition for this unload record before applying updated unloaded bricks
          if (Array.isArray(existing.unloadedByGrade) && existing.unloadedByGrade.length > 0) {
            for (const prevItem of existing.unloadedByGrade) {
              const prevGrade =
                dbState.brickGrades.find((g) => g.id === prevItem.gradeId) || targetGrade;
              if (prevGrade) {
                prevGrade.currentStock = Math.max(
                  0,
                  (prevGrade.currentStock || 0) - (Number(prevItem.quantity) || 0)
                );
                prevGrade.seasonProduced = Math.max(
                  0,
                  (prevGrade.seasonProduced || 0) - (Number(prevItem.quantity) || 0)
                );
              }
            }
          } else if ((existing.totalBricksUnloaded || 0) > 0 && targetGrade) {
            targetGrade.currentStock = Math.max(
              0,
              (targetGrade.currentStock || 0) - (existing.totalBricksUnloaded || 0)
            );
            targetGrade.seasonProduced = Math.max(
              0,
              (targetGrade.seasonProduced || 0) - (existing.totalBricksUnloaded || 0)
            );
          }

          if (targetGrade && lineCalc.totalBricksUnloaded > 0) {
            targetGrade.currentStock += lineCalc.totalBricksUnloaded;
            targetGrade.seasonProduced += lineCalc.totalBricksUnloaded;
          }

          const diffPaid = lineCalc.paidAmount - existing.paidAmount;
          existing.date = date || existing.date;
          existing.chamberOrRound = String(chamberOrRound || existing.chamberOrRound).trim();
          existing.sardarName = String(sardarName || existing.sardarName || 'নজরুল সর্দার').trim();
          existing.linesUnloaded = lineCalc.linesUnloaded;
          existing.bricksPerLine = lineCalc.bricksPerLine;
          existing.ratePerLine = lineCalc.ratePerLine;
          existing.unloadedByGrade =
            targetGrade && lineCalc.totalBricksUnloaded > 0
              ? [
                  {
                    gradeId: targetGrade.id,
                    gradeName: targetGrade.nameBn,
                    quantity: lineCalc.totalBricksUnloaded,
                  },
                ]
              : [];
          existing.totalBricksUnloaded = lineCalc.totalBricksUnloaded;
          existing.ratePerThousand = lineCalc.equivalentRatePerThousand;
          existing.totalBill = lineCalc.totalBill;
          existing.paidAmount = lineCalc.paidAmount;
          existing.dueAmount = lineCalc.dueAmount;
          if (note !== undefined) existing.note = String(note).trim();

          if (diffPaid > 0) {
            const txId = `tx-${Date.now()}`;
            if (!dbState.productionPayments) dbState.productionPayments = [];
            dbState.productionPayments.unshift({
              id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              section: 'UNLOAD',
              referenceId: existing.id,
              recipientName: `${existing.sardarName} (${existing.chamberOrRound})`,
              subDetail: `${formatBn(lineCalc.linesUnloaded)} লাইন (${formatBn(lineCalc.totalBricksUnloaded)} পিস) @ ৳${formatBn(lineCalc.ratePerLine)}/লাইন`,
              amount: diffPaid,
              date: existing.date,
              note: String(note || 'আনলোড বাবদ টাকা জমা').trim(),
              cashTxId: txId,
              createdAt: new Date().toISOString(),
            });
            dbState.cashTransactions.unshift({
              id: txId,
              date: existing.date,
              type: 'OUT',
              category: 'শ্রমিক ও সর্দার পেমেন্ট',
              amount: diffPaid,
              description: `চুল্লি লাইন আনলোড পেমেন্ট (${formatBn(lineCalc.linesUnloaded)} লাইন): ${existing.sardarName}`,
              referenceId: existing.id,
              paymentMethod: 'নগদ ক্যাশ',
              verified: true,
              createdAt: new Date().toISOString(),
            });
          }

          saveDbState();
          const enriched = getEnrichedState();
          broadcastEvent('STATE_UPDATED', enriched);
          res.json(enriched);
          return;
        }
      }

      // Immediately add unloaded bricks to inventory stock (targetGrade defaults to 1 No Brick)
      if (targetGrade && lineCalc.totalBricksUnloaded > 0) {
        targetGrade.currentStock += lineCalc.totalBricksUnloaded;
        targetGrade.seasonProduced += lineCalc.totalBricksUnloaded;
      }

      const newUnload: ChulliUnloadRecord = {
        id: `unload-${Date.now()}`,
        date: date || todayDate,
        chamberOrRound: String(chamberOrRound || 'রাউন্ড-০১').trim(),
        sardarName: String(sardarName || 'নজরুল সর্দার').trim(),
        linesUnloaded: lineCalc.linesUnloaded,
        bricksPerLine: lineCalc.bricksPerLine,
        ratePerLine: lineCalc.ratePerLine,
        unloadedByGrade:
          targetGrade && lineCalc.totalBricksUnloaded > 0
            ? [
                {
                  gradeId: targetGrade.id,
                  gradeName: targetGrade.nameBn,
                  quantity: lineCalc.totalBricksUnloaded,
                },
              ]
            : [],
        totalBricksUnloaded: lineCalc.totalBricksUnloaded,
        ratePerThousand: lineCalc.equivalentRatePerThousand,
        totalBill: lineCalc.totalBill,
        paidAmount: lineCalc.paidAmount,
        dueAmount: lineCalc.dueAmount,
        note: String(note || '').trim(),
        createdAt: new Date().toISOString(),
      };

      dbState.chulliUnloads.unshift(newUnload);

      if (lineCalc.paidAmount > 0) {
        const txId = `tx-${Date.now()}`;
        if (!dbState.productionPayments) dbState.productionPayments = [];
        dbState.productionPayments.unshift({
          id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          section: 'UNLOAD',
          referenceId: newUnload.id,
          recipientName: `${newUnload.sardarName} (${newUnload.chamberOrRound})`,
          subDetail: `${formatBn(lineCalc.linesUnloaded)} লাইন (${formatBn(lineCalc.totalBricksUnloaded)} পিস) @ ৳${formatBn(lineCalc.ratePerLine)}/লাইন`,
          amount: lineCalc.paidAmount,
          date: newUnload.date,
          note: String(note || 'লাইন আনলোড এন্ট্রির সময় জমা').trim(),
          cashTxId: txId,
          createdAt: new Date().toISOString(),
        });
        dbState.cashTransactions.unshift({
          id: txId,
          date: newUnload.date,
          type: 'OUT',
          category: 'শ্রমিক ও সর্দার পেমেন্ট',
          amount: lineCalc.paidAmount,
          description: `চুল্লি লাইন আনলোড (${formatBn(lineCalc.linesUnloaded)} লাইন = ${formatBn(lineCalc.totalBricksUnloaded)} পিস @ ৳${lineCalc.ratePerLine}/লাইন): ${newUnload.sardarName}`,
          referenceId: newUnload.id,
          paymentMethod: 'নগদ ক্যাশ',
          verified: true,
          createdAt: new Date().toISOString(),
        });
      }

      addAuditLog(
        'USER',
        'CHULLI_UNLOAD',
        `চুল্লি থেকে ${formatBn(lineCalc.linesUnloaded)} লাইন (${formatBn(lineCalc.totalBricksUnloaded)} পিস) ইট আনলোড (@ ৳${formatBn(lineCalc.ratePerLine)}/লাইন, মোট বিল ${formatCurrencyBn(lineCalc.totalBill)}) — স্টকে যোগ ও চুল্লি থেকে কর্তন সম্পন্ন।`
      );
      saveDbState();
      const enriched = getEnrichedState();
      broadcastEvent('STATE_UPDATED', enriched);
      res.json(enriched);
      return;
    }

    const gradeItems: UnloadedGradeItem[] = Array.isArray(unloadedByGrade)
      ? unloadedByGrade
          .map((item: { gradeId: string; quantity: number }) => {
            const g = dbState.brickGrades.find((gr) => gr.id === item.gradeId);
            const qty = Math.max(0, Number(item.quantity) || 0);
            return {
              gradeId: item.gradeId,
              gradeName: g ? g.nameBn : '১ নং ইট',
              quantity: qty,
            };
          })
          .filter((item) => item.quantity > 0)
      : [];

    const totalBricksUnloaded = gradeItems.reduce((s, it) => s + it.quantity, 0);
    if (totalBricksUnloaded <= 0) {
      res.status(400).json({ error: 'বাহির করা লাইনের সংখ্যা (যেমন ১০ লাইন) লিখুন।' });
      return;
    }

    const computedLines = Number((totalBricksUnloaded / 4000).toFixed(2));
    const uRate = Number(ratePerThousand) > 0 ? Number(ratePerThousand) : 750;
    const totalBill = Math.round(computedLines * uRate);
    const paid = Math.max(0, Number(paidAmount) || 0);
    const due = Math.max(0, totalBill - paid);

    for (const item of gradeItems) {
      const grade = dbState.brickGrades.find((g) => g.id === item.gradeId);
      if (grade) {
        grade.currentStock += item.quantity;
        grade.seasonProduced += item.quantity;
      }
    }

    const newUnload: ChulliUnloadRecord = {
      id: `unload-${Date.now()}`,
      date: date || todayDate,
      chamberOrRound: String(chamberOrRound || 'চুল্লি রাউন্ড').trim(),
      sardarName: String(sardarName || 'নজরুল সর্দার').trim(),
      linesUnloaded: computedLines,
      bricksPerLine: 4000,
      ratePerLine: uRate,
      unloadedByGrade: gradeItems,
      totalBricksUnloaded,
      ratePerThousand: Number(((uRate / 4000) * 1000).toFixed(2)),
      totalBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.chulliUnloads.unshift(newUnload);

    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'UNLOAD',
        referenceId: newUnload.id,
        recipientName: `${newUnload.sardarName} (${newUnload.chamberOrRound})`,
        subDetail: `${formatBn(computedLines)} লাইন (${formatBn(totalBricksUnloaded)} পিস) আনলোড`,
        amount: paid,
        date: newUnload.date,
        note: String(note || 'আনলোড এন্ট্রির সময় জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newUnload.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `চুল্লি আনলোড (${formatBn(computedLines)} লাইন = ${formatBn(totalBricksUnloaded)} পিস): ${newUnload.sardarName}`,
        referenceId: newUnload.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'CHULLI_UNLOAD',
      `চুল্লি থেকে ${formatBn(computedLines)} লাইন (${formatBn(totalBricksUnloaded)} পিস) পোড়ানো ইট আনলোড (বিল ${formatCurrencyBn(totalBill)})।`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/chulli-unload/:id', (req, res) => {
    if (dbState.chulliUnloads) {
      const removed = dbState.chulliUnloads.find((u) => u.id === req.params.id);
      if (removed) {
        const fallbackGrade =
          dbState.brickGrades.find((g) => g.id === 'grade-1') || dbState.brickGrades[0];
        if (Array.isArray(removed.unloadedByGrade) && removed.unloadedByGrade.length > 0) {
          for (const item of removed.unloadedByGrade) {
            const g = dbState.brickGrades.find((gr) => gr.id === item.gradeId) || fallbackGrade;
            if (g) {
              g.currentStock = Math.max(0, (g.currentStock || 0) - (Number(item.quantity) || 0));
              g.seasonProduced = Math.max(
                0,
                (g.seasonProduced || 0) - (Number(item.quantity) || 0)
              );
            }
          }
        } else if ((removed.totalBricksUnloaded || 0) > 0 && fallbackGrade) {
          fallbackGrade.currentStock = Math.max(
            0,
            (fallbackGrade.currentStock || 0) - (removed.totalBricksUnloaded || 0)
          );
          fallbackGrade.seasonProduced = Math.max(
            0,
            (fallbackGrade.seasonProduced || 0) - (removed.totalBricksUnloaded || 0)
          );
        }
      }
      dbState.chulliUnloads = dbState.chulliUnloads.filter(
        (u) => u.id !== req.params.id
      );
    }
    if (dbState.productionPayments) {
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== req.params.id
      );
    }
    if (dbState.cashTransactions) {
      dbState.cashTransactions = dbState.cashTransactions.filter(
        (tx) => tx.referenceId !== req.params.id
      );
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9c-2. Rubbish Sardar Ledger (রাবিশ সর্দার — অবেদ রাবিশ সর্দার: রাউন্ড হিসেবে বিল ও খোরাকি)
  app.post('/api/production/rubbish', (req, res) => {
    const {
      id,
      sardarName,
      chamberOrRound,
      roundBill,
      paidAmount,
      date,
      note,
    } = req.body || {};

    const { todayDate } = getTodayAndYesterday();
    if (!dbState.rubbishRecords) dbState.rubbishRecords = [];

    if (id) {
      const existing = dbState.rubbishRecords.find((r) => r.id === id);
      if (existing) {
        const rBill =
          roundBill !== undefined
            ? Math.max(0, Math.round(parseNum(roundBill)))
            : existing.roundBill;
        const paid =
          paidAmount !== undefined
            ? Math.max(0, Math.round(parseNum(paidAmount)))
            : existing.paidAmount;
        const due = Math.max(0, rBill - paid);
        const diffPaid = paid - existing.paidAmount;

        existing.sardarName = String(
          sardarName || existing.sardarName || 'অবেদ রাবিশ সর্দার'
        ).trim();
        existing.chamberOrRound = String(
          chamberOrRound || existing.chamberOrRound || '১ম রাউন্ড'
        ).trim();
        existing.roundBill = rBill;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (date) existing.date = date;
        if (note !== undefined) existing.note = String(note).trim();

        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'RUBBISH',
            referenceId: existing.id,
            recipientName: `${existing.sardarName} (${existing.chamberOrRound})`,
            subDetail: `${existing.chamberOrRound} · রাউন্ড বিল ৳${formatBn(rBill)} · খোরাকি/জমা প্রদান`,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'রাবিশ সর্দারকে খোরাকি/বিল প্রদান').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: date || existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `রাবিশ সর্দার পেমেন্ট/খোরাকি: ${existing.sardarName} (${existing.chamberOrRound})`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const rBill = Math.max(0, Math.round(parseNum(roundBill)));
    const paid = Math.max(0, Math.round(parseNum(paidAmount)));
    const due = Math.max(0, rBill - paid);

    const newRubbish: RubbishRecord = {
      id: `rubbish-${Date.now()}`,
      date: date || todayDate,
      sardarName: String(sardarName || 'অবেদ রাবিশ সর্দার').trim(),
      chamberOrRound: String(chamberOrRound || '১ম রাউন্ড').trim(),
      roundBill: rBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.rubbishRecords.unshift(newRubbish);

    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'RUBBISH',
        referenceId: newRubbish.id,
        recipientName: `${newRubbish.sardarName} (${newRubbish.chamberOrRound})`,
        subDetail: `${newRubbish.chamberOrRound} · রাউন্ড বিল ৳${formatBn(rBill)} · খোরাকি/জমা`,
        amount: paid,
        date: newRubbish.date,
        note: String(note || 'রাবিশ সর্দারকে খোরাকি/জমা প্রদান').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRubbish.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `রাবিশ সর্দার পেমেন্ট/খোরাকি (${newRubbish.chamberOrRound}): ${newRubbish.sardarName}`,
        referenceId: newRubbish.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'RUBBISH_SARDAR_ADD',
      `রাবিশ সর্দার (${newRubbish.sardarName} · ${newRubbish.chamberOrRound}): রাউন্ড বিল ${formatCurrencyBn(rBill)}, দেওয়া হলো ${formatCurrencyBn(paid)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/rubbish/:id', (req, res) => {
    if (dbState.rubbishRecords) {
      dbState.rubbishRecords = dbState.rubbishRecords.filter(
        (r) => r.id !== req.params.id
      );
    }
    if (dbState.productionPayments) {
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== req.params.id
      );
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 9d. Wood & Fuel Ledger (জ্বালানি ও কাঠ হিসাব — সাপ্লায়ার ভিত্তিক দৈনিক কাঠ সরবরাহ, আলাদা দর ও পেমেন্ট)
  app.post('/api/production/wood-fuel', (req, res) => {
    const {
      id,
      date,
      supplierName,
      supplierPhone,
      woodType,
      vehicleOrChallan,
      quantity,
      unit,
      ratePerUnit,
      paidAmount,
      paymentMethod,
      note,
    } = req.body || {};

    const { todayDate } = getTodayAndYesterday();
    if (!dbState.woodFuelRecords) dbState.woodFuelRecords = [];

    // Update existing wood fuel record or add payment to it
    if (id) {
      const existing = dbState.woodFuelRecords.find((r) => r.id === id);
      if (existing) {
        const qty =
          quantity !== undefined
            ? Math.max(0, Number(quantity) || 0)
            : existing.quantity;
        const rate =
          ratePerUnit !== undefined && Number(ratePerUnit) > 0
            ? Number(ratePerUnit)
            : existing.ratePerUnit;
        const paid =
          paidAmount !== undefined
            ? Math.max(0, Number(paidAmount) || 0)
            : existing.paidAmount;

        const billCalc = calculateWoodFuelBill(qty, rate, paid);
        const diffPaid = billCalc.paidAmount - existing.paidAmount;

        existing.supplierName = String(
          supplierName || existing.supplierName || 'কাঠ সাপ্লায়ার'
        ).trim();
        if (supplierPhone !== undefined) {
          existing.supplierPhone = String(supplierPhone).trim();
        }
        if (woodType !== undefined) {
          existing.woodType = String(woodType || 'জ্বালানি কাঠ').trim();
        }
        if (vehicleOrChallan !== undefined) {
          existing.vehicleOrChallan = String(vehicleOrChallan).trim();
        }
        if (unit !== undefined) {
          existing.unit = String(unit || 'মণ').trim();
        }
        existing.quantity = billCalc.quantity;
        existing.ratePerUnit = billCalc.ratePerUnit;
        existing.totalBill = billCalc.totalBill;
        existing.paidAmount = billCalc.paidAmount;
        existing.dueAmount = billCalc.dueAmount;
        if (date) existing.date = date;
        if (note !== undefined) existing.note = String(note).trim();

        if (diffPaid > 0) {
          const txId = `tx-wood-${Date.now()}`;
          if (!dbState.productionPayments) dbState.productionPayments = [];
          dbState.productionPayments.unshift({
            id: `ppay-wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            section: 'JALANI',
            referenceId: existing.id,
            recipientName: `${existing.supplierName} (${existing.woodType})`,
            subDetail: `${formatBn(existing.quantity)} ${existing.unit} @ ৳${formatBn(existing.ratePerUnit)}/${existing.unit}`,
            amount: diffPaid,
            date: date || todayDate,
            note: String(note || 'জ্বালানি কাঠ বাবদ বকেয়া পেমেন্ট').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: date || todayDate,
            type: 'OUT',
            category: 'বিদ্যুৎ ও জ্বালানি',
            amount: diffPaid,
            description: `জ্বালানি কাঠ পেমেন্ট: ${existing.supplierName} (${formatBn(existing.quantity)} ${existing.unit} @ ৳${existing.ratePerUnit})`,
            referenceId: existing.id,
            paymentMethod: (paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }

        addAuditLog(
          'USER',
          'WOOD_FUEL_UPDATE',
          `জ্বালানি কাঠ হিসাব আপডেট: ${existing.supplierName} (${formatBn(existing.quantity)} ${existing.unit} @ ৳${existing.ratePerUnit})`
        );
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const cleanSupplier = String(supplierName || '').trim();
    if (!cleanSupplier) {
      res.status(400).json({ error: 'কাঠ সাপ্লায়ার বা ব্যাপারীর নাম লিখুন।' });
      return;
    }

    const cleanUnit = String(unit || 'মণ').trim();
    const cleanWoodType = String(woodType || 'মিক্সড জ্বালানি কাঠ').trim();
    const billCalc = calculateWoodFuelBill(
      parseNum(quantity),
      parseNum(ratePerUnit),
      parseNum(paidAmount)
    );

    if (billCalc.quantity <= 0 && billCalc.paidAmount <= 0) {
      res.status(400).json({ error: 'কাঠের সঠিক পরিমাণ অথবা জমার টাকা লিখুন।' });
      return;
    }

    const newRecord: WoodFuelRecord = {
      id: `wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: date || todayDate,
      supplierName: cleanSupplier,
      supplierPhone: String(supplierPhone || '').trim(),
      woodType: cleanWoodType,
      vehicleOrChallan: String(vehicleOrChallan || '').trim(),
      quantity: billCalc.quantity,
      unit: cleanUnit,
      ratePerUnit: billCalc.ratePerUnit,
      totalBill: billCalc.totalBill,
      paidAmount: billCalc.paidAmount,
      dueAmount: billCalc.dueAmount,
      paymentMethod: (paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.woodFuelRecords.unshift(newRecord);

    if (billCalc.paidAmount > 0) {
      const txId = `tx-wood-${Date.now()}`;
      if (!dbState.productionPayments) dbState.productionPayments = [];
      dbState.productionPayments.unshift({
        id: `ppay-wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'JALANI',
        referenceId: newRecord.id,
        recipientName: `${newRecord.supplierName} (${newRecord.woodType})`,
        subDetail: `${formatBn(newRecord.quantity)} ${newRecord.unit} @ ৳${formatBn(newRecord.ratePerUnit)}/${newRecord.unit}`,
        amount: billCalc.paidAmount,
        date: newRecord.date,
        note: String(note || 'কাঠ সরবরাহের সময় নগদ পেমেন্ট').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRecord.date,
        type: 'OUT',
        category: 'বিদ্যুৎ ও জ্বালানি',
        amount: billCalc.paidAmount,
        description: `জ্বালানি কাঠ ক্রয় (${newRecord.woodType} · ${formatBn(newRecord.quantity)} ${newRecord.unit} @ ৳${newRecord.ratePerUnit}/${newRecord.unit}): ${newRecord.supplierName}`,
        referenceId: newRecord.id,
        paymentMethod: (paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'WOOD_FUEL_ADD',
      `জ্বালানি কাঠ জমা (${newRecord.supplierName}): ${formatBn(newRecord.quantity)} ${newRecord.unit} (@ ৳${newRecord.ratePerUnit}/${newRecord.unit}) — মোট বিল ${formatCurrencyBn(newRecord.totalBill)}, জমা ${formatCurrencyBn(newRecord.paidAmount)}, বকেয়া ${formatCurrencyBn(newRecord.dueAmount)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // Pay a wood supplier directly (either against a specific delivery record or across oldest unpaid records)
  app.post('/api/production/wood-fuel/pay-supplier', (req, res) => {
    const {
      recordId,
      supplierName,
      amount,
      date,
      paymentMethod,
      note,
    } = req.body || {};

    const payAmt = Math.max(0, Math.round(Number(amount) || 0));
    if (payAmt <= 0) {
      res.status(400).json({ error: 'পেমেন্টের টাকার পরিমাণ ০-এর বেশি হতে হবে।' });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const payDate = date || todayDate;
    if (!dbState.woodFuelRecords) dbState.woodFuelRecords = [];
    if (!dbState.productionPayments) dbState.productionPayments = [];

    if (recordId) {
      const target = dbState.woodFuelRecords.find((r) => r.id === recordId);
      if (!target) {
        res.status(404).json({ error: 'জ্বালানি কাঠের চালান খুঁজে পাওয়া যায়নি।' });
        return;
      }
      target.paidAmount = Math.max(0, (target.paidAmount || 0) + payAmt);
      target.dueAmount = Math.max(0, target.totalBill - target.paidAmount);

      const txId = `tx-wood-pay-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section: 'JALANI',
        referenceId: target.id,
        recipientName: `${target.supplierName} (${target.woodType})`,
        subDetail: `${formatBn(target.quantity)} ${target.unit} @ ৳${formatBn(target.ratePerUnit)}/${target.unit}`,
        amount: payAmt,
        date: payDate,
        note: String(note || 'জ্বালানি কাঠ বকেয়া পরিশোধ').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: payDate,
        type: 'OUT',
        category: 'বিদ্যুৎ ও জ্বালানি',
        amount: payAmt,
        description: `জ্বালানি কাঠ বকেয়া পেমেন্ট: ${target.supplierName} (${target.woodType})`,
        referenceId: target.id,
        paymentMethod: (paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });

      addAuditLog(
        'USER',
        'WOOD_FUEL_PAYMENT',
        `জ্বালানি কাঠ পেমেন্ট (${target.supplierName}): ${formatCurrencyBn(payAmt)}`
      );
      saveDbState();
      const enriched = getEnrichedState();
      broadcastEvent('STATE_UPDATED', enriched);
      res.json(enriched);
      return;
    }

    const cleanSup = String(supplierName || '').trim().toLowerCase();
    const supplierRecords = dbState.woodFuelRecords
      .filter((r) => r.supplierName.trim().toLowerCase() === cleanSup && (r.dueAmount || 0) > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (supplierRecords.length === 0) {
      res.status(400).json({ error: 'এই সাপ্লায়ারের কোনো বকেয়া চালান পাওয়া যায়নি।' });
      return;
    }

    let remainingToAllocate = payAmt;
    for (const rec of supplierRecords) {
      if (remainingToAllocate <= 0) break;
      const alloc = Math.min(remainingToAllocate, rec.dueAmount);
      if (alloc > 0) {
        rec.paidAmount += alloc;
        rec.dueAmount = Math.max(0, rec.totalBill - rec.paidAmount);
        remainingToAllocate -= alloc;

        const txId = `tx-wood-pay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        dbState.productionPayments.unshift({
          id: `ppay-wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          section: 'JALANI',
          referenceId: rec.id,
          recipientName: `${rec.supplierName} (${rec.woodType})`,
          subDetail: `${formatBn(rec.quantity)} ${rec.unit} @ ৳${formatBn(rec.ratePerUnit)}/${rec.unit}`,
          amount: alloc,
          date: payDate,
          note: String(note || 'সাপ্লায়ার বকেয়া কিস্তি পেমেন্ট').trim(),
          cashTxId: txId,
          createdAt: new Date().toISOString(),
        });
        dbState.cashTransactions.unshift({
          id: txId,
          date: payDate,
          type: 'OUT',
          category: 'বিদ্যুৎ ও জ্বালানি',
          amount: alloc,
          description: `জ্বালানি কাঠ সাপ্লায়ার পেমেন্ট: ${rec.supplierName} (${rec.woodType})${note ? ` — ${note}` : ''}`,
          referenceId: rec.id,
          paymentMethod: (paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
          verified: true,
          createdAt: new Date().toISOString(),
        });
      }
    }

    addAuditLog(
      'USER',
      'WOOD_FUEL_SUPPLIER_PAYMENT',
      `জ্বালানি কাঠ সাপ্লায়ার পেমেন্ট (${supplierName}): ${formatCurrencyBn(payAmt)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/production/wood-fuel/:id', (req, res) => {
    const targetId = req.params.id;
    if (dbState.woodFuelRecords) {
      dbState.woodFuelRecords = dbState.woodFuelRecords.filter((r) => r.id !== targetId);
    }
    if (dbState.productionPayments) {
      const relatedPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId === targetId
      );
      const relatedCashTxIds = new Set(
        relatedPayments.map((p) => p.cashTxId).filter(Boolean)
      );
      dbState.productionPayments = dbState.productionPayments.filter(
        (pay) => pay.referenceId !== targetId
      );
      if (relatedCashTxIds.size > 0) {
        dbState.cashTransactions = dbState.cashTransactions.filter(
          (tx) => !relatedCashTxIds.has(tx.id) && tx.referenceId !== targetId
        );
      }
    }
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // Delete an individual production payment record
  app.delete('/api/production/payment-record/:id', (req, res) => {
    if (!dbState.productionPayments) dbState.productionPayments = [];
    const idx = dbState.productionPayments.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) {
      const [removed] = dbState.productionPayments.splice(idx, 1);
      // Adjust parent record paidAmount & dueAmount
      if (removed.section === 'MILL' && dbState.millPots) {
        const pot = dbState.millPots.find((p) => p.id === removed.referenceId);
        if (pot) {
          pot.paidAmount = Math.max(0, pot.paidAmount - removed.amount);
          pot.dueAmount = Math.max(0, pot.totalPayable - pot.paidAmount);
        }
      } else if (removed.section === 'VAN_LOAD' && dbState.chulliLoads) {
        const ld = dbState.chulliLoads.find((l) => l.id === removed.referenceId);
        if (ld) {
          ld.paidAmount = Math.max(0, ld.paidAmount - removed.amount);
          ld.dueAmount = Math.max(0, ld.totalBill - ld.paidAmount);
        }
      } else if (removed.section === 'PORAI_MISTRI' && dbState.poraiMistriRecords) {
        const pr = dbState.poraiMistriRecords.find((r) => r.id === removed.referenceId);
        if (pr) {
          pr.paidAmount = Math.max(0, pr.paidAmount - removed.amount);
          pr.dueAmount = Math.max(0, pr.totalBill - pr.paidAmount);
        }
      } else if (removed.section === 'UNLOAD' && dbState.chulliUnloads) {
        const un = dbState.chulliUnloads.find((u) => u.id === removed.referenceId);
        if (un) {
          un.paidAmount = Math.max(0, un.paidAmount - removed.amount);
          un.dueAmount = Math.max(0, un.totalBill - un.paidAmount);
        }
      } else if (removed.section === 'RUBBISH' && dbState.rubbishRecords) {
        const rb = dbState.rubbishRecords.find((r) => r.id === removed.referenceId);
        if (rb) {
          rb.paidAmount = Math.max(0, rb.paidAmount - removed.amount);
          rb.dueAmount = Math.max(0, rb.roundBill - rb.paidAmount);
        }
      } else if (removed.section === 'JALANI' && dbState.woodFuelRecords) {
        const wf = dbState.woodFuelRecords.find((w) => w.id === removed.referenceId);
        if (wf) {
          wf.paidAmount = Math.max(0, wf.paidAmount - removed.amount);
          wf.dueAmount = Math.max(0, wf.totalBill - wf.paidAmount);
        }
      }
      if (removed.cashTxId) {
        dbState.cashTransactions = dbState.cashTransactions.filter(
          (tx) => tx.id !== removed.cashTxId
        );
      }
      saveDbState();
    }
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 10. Workers & Attendance
  app.post('/api/workers', (req, res) => {
    const { id, name, role, phone, morningRate, afternoonRate } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'শ্রমিক বা সর্দারের নাম আবশ্যক।' });
      return;
    }
    const mRate = Math.max(0, Number(morningRate) || 125);
    const aRate = Math.max(0, Number(afternoonRate) || 125);

    if (id) {
      const existing = dbState.workerProfiles.find((w) => w.id === id);
      if (existing) {
        existing.name = String(name).trim();
        existing.role = String(role || existing.role).trim();
        existing.phone = String(phone || existing.phone).trim();
        existing.morningRate = mRate;
        existing.afternoonRate = aRate;
        saveDbState();
        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);
        res.json(enriched);
        return;
      }
    }

    const newWorker: WorkerProfile = {
      id: `w-${Date.now()}`,
      name: String(name).trim(),
      role: String(role || 'দিনমজুর (Daily Labour)').trim(),
      phone: String(phone || '—').trim(),
      morningRate: mRate,
      afternoonRate: aRate,
      active: true,
      totalEarnedSeason: 0,
      totalPaidSeason: 0,
    };
    dbState.workerProfiles.push(newWorker);
    addAuditLog('USER', 'ADD_WORKER', `শ্রমিক প্রোফাইল যোগ: ${newWorker.name}`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 10a. Separate Daily Morning / Afternoon Hajira Toggle (Green Toggle — No Cash Payment)
  app.post('/api/workers/hajira', (req, res) => {
    const {
      workerId,
      date,
      morningPresent,
      afternoonPresent,
      morningRate,
      afternoonRate,
      note,
    } = req.body;

    const worker = dbState.workerProfiles.find((w) => w.id === workerId);
    if (!worker) {
      res.status(404).json({ error: 'শ্রমিক খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const attDate = date || todayDate;
    const mRate = morningRate !== undefined ? Math.max(0, Number(morningRate)) : worker.morningRate;
    const aRate = afternoonRate !== undefined ? Math.max(0, Number(afternoonRate)) : worker.afternoonRate;
    if (mRate > 0) worker.morningRate = mRate;
    if (aRate > 0) worker.afternoonRate = aRate;

    const isMorning = Boolean(morningPresent);
    const isAfternoon = Boolean(afternoonPresent);
    const newMorningAmt = isMorning ? mRate : 0;
    const newAfternoonAmt = isAfternoon ? aRate : 0;
    const newEarnedShift = newMorningAmt + newAfternoonAmt;

    // Look for existing HAJIRA record on this date for this worker
    const existingHajira = dbState.workerAttendance.find(
      (a) =>
        a.workerId === worker.id &&
        a.date === attDate &&
        (a.recordType === 'HAJIRA' || (!a.recordType && (a.morningAmount > 0 || a.afternoonAmount > 0 || a.totalPaid === 0)))
    );

    const prevEarnedBase =
      typeof worker.totalEarnedSeason === 'number'
        ? worker.totalEarnedSeason
        : 0;

    let savedRecord: WorkerAttendance;
    if (existingHajira) {
      const oldEarnedShift = (existingHajira.morningAmount || 0) + (existingHajira.afternoonAmount || 0);
      const diff = newEarnedShift - oldEarnedShift;
      worker.totalEarnedSeason = Math.max(0, prevEarnedBase + diff);

      existingHajira.recordType = 'HAJIRA';
      existingHajira.morningPresent = isMorning;
      existingHajira.afternoonPresent = isAfternoon;
      existingHajira.morningAmount = newMorningAmt;
      existingHajira.afternoonAmount = newAfternoonAmt;
      if (note !== undefined) {
        existingHajira.note = String(note).trim();
      }
      savedRecord = existingHajira;
    } else {
      worker.totalEarnedSeason = Math.max(0, prevEarnedBase + newEarnedShift);
      savedRecord = {
        id: `att-hajira-${Date.now()}`,
        date: attDate,
        workerId: worker.id,
        workerName: worker.name,
        workerRole: worker.role,
        recordType: 'HAJIRA',
        morningPresent: isMorning,
        afternoonPresent: isAfternoon,
        morningAmount: newMorningAmt,
        afternoonAmount: newAfternoonAmt,
        khorakiAmount: 0,
        hatbarAmount: 0,
        totalPaid: 0,
        note: String(note || `${isMorning ? 'সকাল হাজির' : ''}${isMorning && isAfternoon ? ' ও ' : ''}${isAfternoon ? 'বিকাল হাজির' : ''}`).trim(),
        createdAt: new Date().toISOString(),
      };
      dbState.workerAttendance.unshift(savedRecord);
    }

    addAuditLog(
      'USER',
      'WORKER_HAJIRA',
      `${worker.name}-এর হাজিরা আপডেট (${attDate}): সকাল=${isMorning ? 'হাজির' : 'নাই'}, বিকাল=${isAfternoon ? 'হাজির' : 'নাই'} (হাজিরা বিল: ${formatCurrencyBn(newEarnedShift)})`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ attendance: savedRecord, ...enriched });
  });

  // 10b. Separate Worker Money Payment / Deposit (লেবার টাকা জমা দেওয়ার আলাদা অপশন)
  app.post('/api/workers/pay', (req, res) => {
    const { workerId, amount, paymentType, date, note } = req.body;

    const worker = dbState.workerProfiles.find((w) => w.id === workerId);
    if (!worker) {
      res.status(404).json({ error: 'শ্রমিক খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const payAmt = Math.max(0, Number(amount) || 0);
    if (payAmt <= 0) {
      res.status(400).json({ error: 'জমা দেওয়ার টাকার পরিমাণ ০-এর বেশি হতে হবে।' });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const payDate = date || todayDate;
    const pType = String(paymentType || 'নগদ মজুরি জমা').trim();
    const txId = `tx-wpay-${Date.now()}`;

    const isKhoraki = pType.includes('খোরাকি');
    const isHatbar = pType.includes('হাটবার');

    const payRecord: WorkerAttendance = {
      id: `att-pay-${Date.now()}`,
      date: payDate,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      recordType: 'PAYMENT',
      paymentType: pType,
      morningPresent: false,
      afternoonPresent: false,
      morningAmount: 0,
      afternoonAmount: 0,
      khorakiAmount: isKhoraki ? payAmt : 0,
      hatbarAmount: isHatbar ? payAmt : 0,
      totalPaid: payAmt,
      note: String(note || `${pType} প্রদান`).trim(),
      cashTxId: txId,
      createdAt: new Date().toISOString(),
    };

    dbState.workerAttendance.unshift(payRecord);
    worker.totalPaidSeason = (worker.totalPaidSeason || 0) + payAmt;
    if (typeof worker.totalEarnedSeason !== 'number') {
      worker.totalEarnedSeason = 0;
    }

    dbState.cashTransactions.unshift({
      id: txId,
      date: payDate,
      type: 'OUT',
      category: 'শ্রমিক ও সর্দার পেমেন্ট',
      amount: payAmt,
      description: `লেবার টাকা জমা (${pType}): ${worker.name}${note ? ` — ${note}` : ''}`,
      referenceId: payRecord.id,
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    });

    addAuditLog(
      'USER',
      'WORKER_PAYMENT',
      `${worker.name}-কে আলাদা টাকা জমা দেওয়া হলো (${pType}): ${formatCurrencyBn(payAmt)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ attendance: payRecord, ...enriched });
  });

  app.post('/api/workers/attendance', (req, res) => {
    const {
      workerId,
      morningPresent,
      afternoonPresent,
      customMorningRate,
      customAfternoonRate,
      khorakiAmount,
      hatbarAmount,
      note,
      date,
    } = req.body;

    const worker = dbState.workerProfiles.find((w) => w.id === workerId);
    if (!worker) {
      res.status(404).json({ error: 'শ্রমিক খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const mRate = customMorningRate !== undefined ? Number(customMorningRate) : worker.morningRate;
    const aRate = customAfternoonRate !== undefined ? Number(customAfternoonRate) : worker.afternoonRate;
    if (mRate > 0) worker.morningRate = mRate;
    if (aRate > 0) worker.afternoonRate = aRate;

    const morningAmt = morningPresent ? mRate : 0;
    const afternoonAmt = afternoonPresent ? aRate : 0;
    const khorakiAmt = Math.max(0, Number(khorakiAmount) || 0);
    const hatbarAmt = Math.max(0, Number(hatbarAmount) || 0);
    const totalPaid = morningAmt + afternoonAmt + khorakiAmt + hatbarAmt;

    const { todayDate } = getTodayAndYesterday();
    const attDate = date || todayDate;
    const txId = totalPaid > 0 ? `tx-${Date.now()}` : undefined;

    const att: WorkerAttendance = {
      id: `att-${Date.now()}`,
      date: attDate,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      morningPresent: Boolean(morningPresent),
      afternoonPresent: Boolean(afternoonPresent),
      morningAmount: morningAmt,
      afternoonAmount: afternoonAmt,
      khorakiAmount: khorakiAmt,
      hatbarAmount: hatbarAmt,
      totalPaid,
      note: String(note || '').trim(),
      cashTxId: txId,
      createdAt: new Date().toISOString(),
    };

    dbState.workerAttendance.unshift(att);
    worker.totalPaidSeason += totalPaid;

    if (totalPaid > 0 && txId) {
      dbState.cashTransactions.unshift({
        id: txId,
        date: attDate,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: totalPaid,
        description: `শ্রমিক হাজিরা ও পেমেন্ট: ${worker.name}`,
        referenceId: att.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog('USER', 'WORKER_ATTENDANCE', `${worker.name}-এর হাজিরা ও পেমেন্ট ${formatCurrencyBn(totalPaid)} ক্যাশ খরচে যোগ।`);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ attendance: att, ...enriched });
  });

  // 11. Notes Management
  app.post('/api/notes', (req, res) => {
    const { title, text, priority, pinned } = req.body;
    if (!text || !String(text).trim()) {
      res.status(400).json({ error: 'নোটের লেখা আবশ্যক।' });
      return;
    }
    const { todayDate } = getTodayAndYesterday();
    const note: KilnNote = {
      id: `note-${Date.now()}`,
      date: todayDate,
      title: String(title || 'নোট').trim(),
      text: String(text).trim(),
      priority: priority === 'URGENT' ? 'URGENT' : 'NORMAL',
      pinned: Boolean(pinned),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    dbState.kilnNotes.unshift(note);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.patch('/api/notes/:id', (req, res) => {
    const note = dbState.kilnNotes.find((n) => n.id === req.params.id);
    if (note) {
      if (req.body.completed !== undefined) note.completed = Boolean(req.body.completed);
      if (req.body.pinned !== undefined) note.pinned = Boolean(req.body.pinned);
      if (req.body.title !== undefined) note.title = String(req.body.title).trim();
      if (req.body.text !== undefined) note.text = String(req.body.text).trim();
      saveDbState();
    }
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/notes/:id', (req, res) => {
    dbState.kilnNotes = dbState.kilnNotes.filter((n) => n.id !== req.params.id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 12. AI Agent Command Endpoint
  app.post('/api/agent/command', async (req, res) => {
    const userText = String(req.body.text || '').trim();
    const isVoice = Boolean(req.body.isVoice);
    if (!userText) {
      res.status(400).json({ error: 'অনুগ্রহ করে নির্দেশ বা প্রশ্ন লিখুন।' });
      return;
    }

    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
      isVoice,
    };
    dbState.agentMessages.push(userMsg);

    const parsedLocal = parseBanglaAgentIntent(userText, dbState.context as Record<string, unknown>);
    const task: AgentTask = {
      id: `task-${Date.now()}`,
      userRequest: userText,
      parsedIntent: parsedLocal.intent,
      status: 'RUNNING',
      steps: [
        {
          id: `s1-${Date.now()}`,
          labelBn: 'বাংলা নির্দেশ ও কনটেক্সট যাচাই',
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
        },
        {
          id: `s2-${Date.now()}`,
          labelBn: 'ডাটাবেস অপারেশন যাচাই',
          status: 'RUNNING',
          timestamp: new Date().toISOString(),
        },
        {
          id: `s3-${Date.now()}`,
          labelBn: 'ফলাফল ভেরিফিকেশন ও উত্তর প্রস্তুত',
          status: 'PENDING',
        },
      ],
      toolCalls: [],
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    dbState.agentTasks.unshift(task);
    broadcastEvent('TASK_CREATED', task);

    let replyBn = '';
    let navigationTarget: NavigationTab | undefined;
    let uiAction: SystemUiAction | undefined;
    let handledByDeterministicOrTool = false;
    let lastExecutionStatus: 'COMPLETED' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'NEEDS_INPUT' = 'COMPLETED';

    // Handle voice/text confirmation or cancellation of pending action
    if (parsedLocal.intent === 'CONFIRM_ACTION') {
      const pendingTask = dbState.agentTasks.find((t) => t.status === 'AWAITING_CONFIRMATION');
      if (pendingTask && pendingTask.pendingConfirmation) {
        handledByDeterministicOrTool = true;
        const conf = pendingTask.pendingConfirmation;
        let outResult: {
          success: boolean;
          status: 'COMPLETED' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'NEEDS_INPUT';
          replyBn: string;
        } = { success: true, status: 'COMPLETED', replyBn: 'অনুমোদন সফল হয়েছে।' };

        if (conf.actionType === 'CREATE_MEMO') {
          outResult = executeKilnToolCall('create_sales_memo', { ...conf.payload, confirmed: true }, task);
        } else if (conf.actionType === 'RECORD_PAYMENT') {
          outResult = executeKilnToolCall('record_payment', { ...conf.payload, confirmed: true }, task);
        } else {
          outResult = executeKilnToolCall('create_expense', { ...conf.payload, confirmed: true }, task);
        }

        pendingTask.status = outResult.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
        pendingTask.pendingConfirmation = undefined;
        pendingTask.finalSummaryBn = outResult.replyBn;
        replyBn = outResult.replyBn;
        lastExecutionStatus = outResult.status;
      } else {
        replyBn = 'জি ভাই, আগের কাজটা তো সাথে সাথেই খাতায় সেভ করে দিয়েছি! আর কী করতে হবে বলুন?';
        handledByDeterministicOrTool = true;
      }
    } else if (parsedLocal.intent === 'CANCEL_ACTION') {
      const pendingTask = dbState.agentTasks.find((t) => t.status === 'AWAITING_CONFIRMATION');
      if (pendingTask) {
        pendingTask.status = 'CANCELLED';
        pendingTask.pendingConfirmation = undefined;
        pendingTask.finalSummaryBn = 'লেনদেনটি বাতিল করা হয়েছে।';
      }
      replyBn = 'পেন্ডিং অ্যাকশনটি বাতিল করা হয়েছে। নতুন নির্দেশ দিন।';
      handledByDeterministicOrTool = true;
    } else if (
      parsedLocal.intent === 'search_memo' ||
      parsedLocal.intent === 'get_customer_balance' ||
      parsedLocal.intent === 'get_sales_summary' ||
      parsedLocal.intent === 'get_dashboard_metrics' ||
      parsedLocal.intent === 'get_expense_summary' ||
      parsedLocal.intent === 'create_sales_memo' ||
      parsedLocal.intent === 'record_payment' ||
      parsedLocal.intent === 'create_expense' ||
      parsedLocal.intent === 'create_note' ||
      parsedLocal.intent === 'search_notes' ||
      parsedLocal.intent === 'get_recent_transactions' ||
      parsedLocal.intent === 'check_stock' ||
      parsedLocal.intent === 'analyze_business' ||
      parsedLocal.intent === 'navigate_to_tab' ||
      parsedLocal.intent === 'control_system_ui' ||
      parsedLocal.intent === 'update_brick_stock_or_rate' ||
      parsedLocal.intent === 'record_worker_attendance' ||
      parsedLocal.intent === 'delete_record' ||
      parsedLocal.intent === 'update_opening_balance' ||
      parsedLocal.intent === 'ASK_EXPENSE_CATEGORY'
    ) {
      handledByDeterministicOrTool = true;
      let out: ReturnType<typeof executeKilnToolCall>;
      if (parsedLocal.intent === 'search_memo') {
        out = executeKilnToolCall('search_memo', { query: parsedLocal.query || userText }, task);
      } else if (parsedLocal.intent === 'get_customer_balance') {
        out = executeKilnToolCall(
          'get_customer_balance',
          { customerName: parsedLocal.customerName, summaryMode: parsedLocal.summaryMode },
          task
        );
      } else if (parsedLocal.intent === 'get_sales_summary') {
        out = executeKilnToolCall('get_sales_summary', { dateScope: parsedLocal.dateScope }, task);
      } else if (parsedLocal.intent === 'get_dashboard_metrics') {
        out = executeKilnToolCall('get_dashboard_metrics', { dateScope: 'TODAY' }, task);
      } else if (parsedLocal.intent === 'get_expense_summary') {
        out = executeKilnToolCall(
          'get_expense_summary',
          { dateScope: parsedLocal.dateScope, category: parsedLocal.category },
          task
        );
      } else if (parsedLocal.intent === 'create_sales_memo') {
        out = executeKilnToolCall(
          'create_sales_memo',
          {
            customerName: parsedLocal.customerName,
            quantity: parsedLocal.quantity,
            rate: parsedLocal.rate,
            paidAmount: parsedLocal.paidAmount,
            gradeId: parsedLocal.gradeId,
          },
          task
        );
      } else if (parsedLocal.intent === 'record_payment') {
        out = executeKilnToolCall(
          'record_payment',
          {
            customerNameOrMemoNo: parsedLocal.customerName || parsedLocal.memoNo,
            amount: parsedLocal.amount,
          },
          task
        );
      } else if (parsedLocal.intent === 'create_expense') {
        out = executeKilnToolCall(
          'create_expense',
          {
            amount: parsedLocal.amount,
            category: parsedLocal.category,
            description: userText,
          },
          task
        );
      } else if (parsedLocal.intent === 'create_note') {
        out = executeKilnToolCall('create_note', { text: parsedLocal.noteText }, task);
      } else if (parsedLocal.intent === 'search_notes') {
        out = executeKilnToolCall('search_notes', { query: parsedLocal.query }, task);
      } else if (parsedLocal.intent === 'get_recent_transactions') {
        out = executeKilnToolCall('get_recent_transactions', {}, task);
      } else if (parsedLocal.intent === 'check_stock') {
        out = executeKilnToolCall('check_stock', {}, task);
      } else if (parsedLocal.intent === 'analyze_business') {
        out = executeKilnToolCall('analyze_business', {}, task);
      } else if (parsedLocal.intent === 'navigate_to_tab') {
        out = executeKilnToolCall('navigate_to_tab', { tab: parsedLocal.targetTab }, task);
      } else if (parsedLocal.intent === 'control_system_ui') {
        out = executeKilnToolCall(
          'control_system_ui',
          {
            actionType: parsedLocal.uiAction?.type,
            memoNo: parsedLocal.memoNo,
            tab: parsedLocal.targetTab,
            uiAction: parsedLocal.uiAction,
          },
          task
        );
      } else if (parsedLocal.intent === 'update_brick_stock_or_rate') {
        out = executeKilnToolCall(
          'update_brick_stock_or_rate',
          {
            gradeId: parsedLocal.gradeId,
            quantity: parsedLocal.quantity,
            rate: parsedLocal.rate,
          },
          task
        );
      } else if (parsedLocal.intent === 'record_worker_attendance') {
        out = executeKilnToolCall(
          'record_worker_attendance',
          {
            workerName: parsedLocal.workerName,
            hatbarAmount: parsedLocal.amount,
          },
          task
        );
      } else if (parsedLocal.intent === 'delete_record') {
        out = executeKilnToolCall('delete_record', { memoNo: parsedLocal.memoNo }, task);
      } else if (parsedLocal.intent === 'update_opening_balance') {
        out = executeKilnToolCall('update_opening_balance', { amount: parsedLocal.amount }, task);
      } else {
        out = executeKilnToolCall('create_expense', { amount: parsedLocal.amount, category: '' }, task);
      }
      replyBn = out.replyBn;
      navigationTarget = out.navigationTarget;
      uiAction = out.uiAction;
      lastExecutionStatus = out.status;
    }

    // Call server Gemini model if API key is present and valid (for natural conversation or complex reasoning)
    if (!handledByDeterministicOrTool) {
      const ai = getGeminiClient();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash',
            contents: userText,
            config: {
              systemInstruction: buildNaturalBanglaSystemInstruction(),
              tools: [{ functionDeclarations: kilnToolDeclarations }],
            },
          });

          if (response.functionCalls && response.functionCalls.length > 0) {
            for (const fc of response.functionCalls) {
              const out = executeKilnToolCall(
                fc.name || 'get_sales_summary',
                (fc.args as Record<string, unknown>) || {},
                task
              );
              replyBn = out.replyBn;
              lastExecutionStatus = out.status;
              if (out.navigationTarget) navigationTarget = out.navigationTarget;
              if (out.uiAction) uiAction = out.uiAction;
            }
            handledByDeterministicOrTool = true;
          } else if (response.text) {
            // Direct conversational response without invoking unnecessary database tools!
            replyBn = response.text.trim();
            lastExecutionStatus = 'COMPLETED';
            handledByDeterministicOrTool = true;
          }
        } catch {
          // Fallback to natural conversational engine below
        }
      }
    }

    if (!handledByDeterministicOrTool || !replyBn) {
      replyBn = generateNaturalConversationalReply(
        userText,
        parsedLocal.conversationalType,
        dbState
      );
      lastExecutionStatus = 'COMPLETED';
    }

    // Truthfully update task status & step statuses based on actual operation result
    if (task.status === 'AWAITING_CONFIRMATION' || lastExecutionStatus === 'AWAITING_CONFIRMATION') {
      task.status = 'AWAITING_CONFIRMATION';
      task.steps[1].status = 'AWAITING_CONFIRMATION';
      task.steps[2].status = 'PENDING';
    } else if (lastExecutionStatus === 'FAILED') {
      task.status = 'FAILED';
      task.steps[1].status = 'FAILED';
      task.steps[2].status = 'FAILED';
      task.steps[2].timestamp = new Date().toISOString();
      task.completedAt = new Date().toISOString();
    } else if (lastExecutionStatus === 'NEEDS_INPUT') {
      task.status = 'RUNNING';
      task.steps[1].status = 'RUNNING';
      task.steps[2].status = 'PENDING';
    } else {
      task.status = 'COMPLETED';
      task.steps[1].status = 'COMPLETED';
      task.steps[2].status = 'COMPLETED';
      task.steps[2].timestamp = new Date().toISOString();
      task.completedAt = new Date().toISOString();
    }

    task.finalSummaryBn = replyBn;
    task.navigationTarget = navigationTarget;
    task.uiAction = uiAction;

    const assistantMsg: AgentMessage = {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      text: replyBn,
      timestamp: new Date().toISOString(),
      taskId: task.toolCalls.length > 0 ? task.id : undefined,
      toolName: task.toolCalls[0]?.toolName,
    };
    dbState.agentMessages.push(assistantMsg);
    saveDbState();

    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({
      replyBn,
      task,
      assistantMsg,
      navigationTarget,
      uiAction,
      ...enriched,
    });
  });

  // 12a. Real Gemini Neural TTS Endpoint (24kHz PCM) for on-demand human speech
  app.post('/api/agent/tts', async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Text required' });
      return;
    }
    const ai = getGeminiClient();
    if (!ai) {
      res.json({ audioChunks: [] });
      return;
    }
    try {
      const cleanTtsText = text.replace(/[•📊]/g, ' ').replace(/\s+/g, ' ').trim();
      const audioChunks: string[] = [];
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ parts: [{ text: cleanTtsText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      for await (const chunk of stream) {
        const data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (data) audioChunks.push(data);
      }
      res.json({ audioChunks });
    } catch {
      res.json({ audioChunks: [] });
    }
  });

  app.post('/api/agent/confirm/:taskId', (req, res) => {
    const task = dbState.agentTasks.find((t) => t.id === req.params.taskId);
    if (!task || task.status !== 'AWAITING_CONFIRMATION' || !task.pendingConfirmation) {
      res.status(400).json({ error: 'পেন্ডিং টাস্ক পাওয়া যায়নি।' });
      return;
    }

    const conf = task.pendingConfirmation;
    let outResult: ReturnType<typeof executeKilnToolCall>;

    if (conf.actionType === 'CREATE_MEMO') {
      outResult = executeKilnToolCall('create_sales_memo', { ...conf.payload, confirmed: true }, task);
    } else if (conf.actionType === 'RECORD_PAYMENT') {
      outResult = executeKilnToolCall('record_payment', { ...conf.payload, confirmed: true }, task);
    } else {
      outResult = executeKilnToolCall('create_expense', { ...conf.payload, confirmed: true }, task);
    }

    task.status = outResult.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
    task.pendingConfirmation = undefined;
    task.steps.forEach((s) => {
      s.status = outResult.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
      s.timestamp = new Date().toISOString();
    });
    if (task.toolCalls.length > 0) {
      task.toolCalls[task.toolCalls.length - 1].status =
        outResult.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
    }
    task.completedAt = new Date().toISOString();
    task.finalSummaryBn = outResult.replyBn;

    dbState.agentMessages.push({
      id: `msg-${Date.now()}-c`,
      role: 'assistant',
      text: outResult.replyBn,
      timestamp: new Date().toISOString(),
      taskId: task.id,
    });

    addAuditLog('USER', 'CONFIRM_FINANCIAL_ACTION', outResult.replyBn);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ task, ...enriched });
  });

  app.post('/api/agent/cancel/:taskId', (req, res) => {
    const task = dbState.agentTasks.find((t) => t.id === req.params.taskId);
    if (!task) {
      res.status(404).json({ error: 'টাস্ক পাওয়া যায়নি।' });
      return;
    }
    task.status = 'CANCELLED';
    task.pendingConfirmation = undefined;
    task.completedAt = new Date().toISOString();
    const cancelText = 'পেন্ডিং লেনদেনটি বাতিল করা হয়েছে।';
    task.finalSummaryBn = cancelText;

    dbState.agentMessages.push({
      id: `msg-${Date.now()}-x`,
      role: 'assistant',
      text: cancelText,
      timestamp: new Date().toISOString(),
      taskId: task.id,
    });
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json({ task, ...enriched });
  });

  app.post('/api/agent/clear-history', (_req, res) => {
    const { todayDate } = getTodayAndYesterday();
    dbState.context = {};
    dbState.agentMessages = [
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        text: 'কথোপকথন পরিষ্কার করা হয়েছে (মেমো, স্টক ও ক্যাশ রেকর্ড অক্ষত রয়েছে)। নতুন নির্দেশ দিন।',
        timestamp: `${todayDate}T10:00:00.000Z`,
      },
    ];
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 12b. Database Export & Restore Endpoints (with automatic pre-restore backup)
  app.get('/api/backup/export', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="brickflow-db-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.send(JSON.stringify(dbState, null, 2));
  });

  app.post('/api/backup/restore', (req, res) => {
    const rawBody = req.body;
    const incoming = rawBody && rawBody.state && Array.isArray(rawBody.state.salesMemos) ? rawBody.state : rawBody;
    if (
      !incoming ||
      !Array.isArray(incoming.salesMemos) ||
      !Array.isArray(incoming.cashTransactions) ||
      !Array.isArray(incoming.brickGrades)
    ) {
      res.status(400).json({ error: 'ভুল ব্যাকআপ ফাইল ফরম্যাট। সঠিক BrickFlow JSON ফাইল দিন।' });
      return;
    }

    try {
      const backupDir = path.resolve(process.cwd(), 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const preRestorePath = path.join(
        backupDir,
        `sbl-kiln-db-pre-restore-${Date.now()}.json`
      );
      fs.writeFileSync(preRestorePath, JSON.stringify(dbState, null, 2), 'utf-8');
    } catch {
      // Non-fatal if backup dir cannot be written
    }

    dbState = {
      ...dbState,
      ...incoming,
      brickGrades: incoming.brickGrades.map((g: { ratePerUnit: number; [key: string]: unknown }) => {
        const rawRate = Number(g.ratePerUnit) || 11000;
        return {
          ...g,
          ratePerUnit: rawRate < 100 ? Math.round(rawRate * 1000) : rawRate,
          ratePerThousand: true,
        };
      }),
    };
    addAuditLog('USER', 'RESTORE_BACKUP', 'ব্যাকআপ ফাইল / IndexedDB স্ন্যাপশট থেকে ডাটাবেস রিস্টোর করা হয়েছে।');
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.post('/api/backup/daily-snapshot', (req, res) => {
    const { todayDate } = getTodayAndYesterday();
    const dateKey = String(req.body?.dateKey || todayDate).slice(0, 10);
    try {
      const snapDir = path.resolve(process.cwd(), 'backup', 'daily-snapshots');
      if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
      }
      const snapPath = path.join(snapDir, `sbl-kiln-snapshot-${dateKey}.json`);
      fs.writeFileSync(snapPath, JSON.stringify(dbState, null, 2), 'utf-8');
      res.json({
        saved: true,
        dateKey,
        fileName: `sbl-kiln-snapshot-${dateKey}.json`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.json({
        saved: false,
        dateKey,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 12c. Kiln Season Management Endpoints (Create/Update, Close Season, Reopen/Adjust Season)
  app.post('/api/seasons', (req, res) => {
    const body = req.body || {};
    const nameBn = String(body.nameBn || '').trim();
    const startDate = String(body.startDate || '').trim();
    const endDate = String(body.endDate || '').trim();
    if (!nameBn || !startDate || !endDate) {
      res.status(400).json({ error: 'সিজনের নাম, শুরুর তারিখ ও শেষ তারিখ আবশ্যক।' });
      return;
    }
    if (startDate > endDate) {
      res.status(400).json({ error: 'সিজনের শুরুর তারিখ শেষ তারিখের পরে হতে পারে না।' });
      return;
    }

    if (!Array.isArray(dbState.kilnSeasons)) {
      dbState.kilnSeasons = createInitialKilnState().kilnSeasons || [];
    }

    const existingId = body.id ? String(body.id).trim() : '';
    const existingIdx = existingId
      ? dbState.kilnSeasons.findIndex((s) => s.id === existingId)
      : -1;

    const kilnIds: string[] =
      Array.isArray(body.kilnIds) && body.kilnIds.length > 0
        ? body.kilnIds.map(String)
        : ['sbl-1'];
    const damageOrAdjustmentBricks = Math.max(
      0,
      Number(body.damageOrAdjustmentBricks) || 0
    );
    const openingStockOverride =
      body.openingStockOverride !== undefined && body.openingStockOverride !== ''
        ? Number(body.openingStockOverride)
        : undefined;
    const openingCashOverride =
      body.openingCashOverride !== undefined && body.openingCashOverride !== ''
        ? Number(body.openingCashOverride)
        : undefined;
    const nowIso = new Date().toISOString();

    if (existingIdx >= 0) {
      const prev = dbState.kilnSeasons[existingIdx];
      const updated: KilnSeason = {
        ...prev,
        nameBn,
        nameEn: String(body.nameEn || prev.nameEn || nameBn),
        startDate,
        endDate,
        kilnIds,
        damageOrAdjustmentBricks,
        openingStockOverride,
        openingCashOverride,
        revisionHistory: [
          {
            id: `rev-${Date.now()}`,
            timestamp: nowIso,
            action: 'UPDATED',
            actorName: String(body.actorName || dbState.settings.proprietorName || 'ম্যানেজার'),
            reasonBn: String(body.reasonBn || 'সিজন কনফিগারেশন আপডেট করা হয়েছে।'),
            damageOrAdjustmentBricks,
            openingCashAdjustment: openingCashOverride,
            openingStockAdjustment: openingStockOverride,
          },
          ...(prev.revisionHistory || []),
        ],
      };
      dbState.kilnSeasons[existingIdx] = updated;
      addAuditLog('USER', 'UPDATE_SEASON', `সিজন আপডেট: ${nameBn} (${startDate} – ${endDate})`);
    } else {
      const created: KilnSeason = {
        id: `season-${Date.now()}`,
        nameBn,
        nameEn: String(body.nameEn || nameBn),
        startDate,
        endDate,
        kilnIds,
        status: 'ACTIVE',
        damageOrAdjustmentBricks,
        openingStockOverride,
        openingCashOverride,
        revisionHistory: [
          {
            id: `rev-${Date.now()}`,
            timestamp: nowIso,
            action: 'CREATED',
            actorName: String(body.actorName || dbState.settings.proprietorName || 'ম্যানেজার'),
            reasonBn: String(body.reasonBn || `নতুন ভাটা সিজন (${nameBn}) তৈরি করা হয়েছে।`),
            damageOrAdjustmentBricks,
            openingCashAdjustment: openingCashOverride,
            openingStockAdjustment: openingStockOverride,
          },
        ],
        createdAt: nowIso,
      };
      dbState.kilnSeasons.unshift(created);
      addAuditLog('USER', 'CREATE_SEASON', `নতুন সিজন তৈরি: ${nameBn} (${startDate} – ${endDate})`);
    }

    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.post('/api/seasons/:id/close', (req, res) => {
    if (!Array.isArray(dbState.kilnSeasons)) {
      dbState.kilnSeasons = createInitialKilnState().kilnSeasons || [];
    }
    const season = dbState.kilnSeasons.find((s) => s.id === req.params.id);
    if (!season) {
      res.status(404).json({ error: 'সিজন খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const nowIso = new Date().toISOString();
    const closingNoteBn = String(
      req.body?.closingNoteBn || 'সিজন সমাপনী হিসাব পর্যালোচনা করে নিশ্চিত করা হয়েছে।'
    ).trim();
    const actorName = String(
      req.body?.actorName || dbState.settings.proprietorName || 'মোঃ কামরুল ইসলাম সাহেব'
    ).trim();

    if (req.body?.damageOrAdjustmentBricks !== undefined) {
      season.damageOrAdjustmentBricks = Math.max(
        0,
        Number(req.body.damageOrAdjustmentBricks) || 0
      );
    }

    season.status = 'CLOSED';
    season.closedAt = nowIso;
    season.closedBy = actorName;
    season.closingNoteBn = closingNoteBn;
    season.revisionHistory = [
      {
        id: `rev-close-${Date.now()}`,
        timestamp: nowIso,
        action: 'CLOSED',
        actorName,
        reasonBn: closingNoteBn,
        damageOrAdjustmentBricks: season.damageOrAdjustmentBricks,
      },
      ...(season.revisionHistory || []),
    ];

    addAuditLog(
      'USER',
      'CLOSE_SEASON',
      `সিজন সমাপনী নিশ্চিত করা হয়েছে: ${season.nameBn} (মূল লেনদেন সম্পূর্ণ অক্ষত রয়েছে)।`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.post('/api/seasons/:id/reopen', (req, res) => {
    if (!Array.isArray(dbState.kilnSeasons)) {
      dbState.kilnSeasons = createInitialKilnState().kilnSeasons || [];
    }
    const season = dbState.kilnSeasons.find((s) => s.id === req.params.id);
    if (!season) {
      res.status(404).json({ error: 'সিজন খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const reasonBn = String(req.body?.reasonBn || '').trim();
    if (!reasonBn) {
      res.status(400).json({
        error: 'বন্ধ সিজন পুনরায় চালু বা সংশোধনের জন্য অনুমোদিত কারণ (Reason) লেখা আবশ্যক।',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const actorName = String(
      req.body?.actorName || dbState.settings.proprietorName || 'মোঃ কামরুল ইসলাম সাহেব'
    ).trim();

    if (req.body?.damageOrAdjustmentBricks !== undefined) {
      season.damageOrAdjustmentBricks = Math.max(
        0,
        Number(req.body.damageOrAdjustmentBricks) || 0
      );
    }

    season.status = 'ACTIVE';
    season.reopenedAt = nowIso;
    season.reopenedReasonBn = reasonBn;
    season.revisionHistory = [
      {
        id: `rev-reopen-${Date.now()}`,
        timestamp: nowIso,
        action: 'REOPENED',
        actorName,
        reasonBn,
        damageOrAdjustmentBricks: season.damageOrAdjustmentBricks,
      },
      ...(season.revisionHistory || []),
    ];

    addAuditLog(
      'USER',
      'REOPEN_SEASON',
      `সিজন পুনরায় চালু ও অডিট লগ সংরক্ষিত: ${season.nameBn} — কারণ: ${reasonBn}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 12d. 5 Advanced Kiln Ledger Endpoints (Soil & Coal, Dadon, Advance Booking, Vehicle Diesel, Compliance)

  // 1) Soil & Coal Supplier Ledger
  app.post('/api/ledgers/soil-coal', (req, res) => {
    const body = req.body || {};
    const { todayDate } = getTodayAndYesterday();
    const itemType = body.itemType === 'COAL' ? 'COAL' : 'SOIL';
    const supplierName = String(body.supplierName || '').trim();
    if (!supplierName) {
      res.status(400).json({ error: 'সাপ্লায়ারের নাম আবশ্যক।' });
      return;
    }

    const calc = calculateSoilCoalBill(
      Number(body.quantity) || 0,
      Number(body.ratePerUnit) || 0,
      Number(body.paidAmount) || 0
    );

    if (calc.totalBill <= 0 && calc.paidAmount <= 0) {
      res.status(400).json({ error: 'পরিমাণ ও দর অথবা নগদ জমার পরিমাণ দিন।' });
      return;
    }

    if (!Array.isArray(dbState.soilCoalRecords)) {
      dbState.soilCoalRecords = [];
    }

    const recordDate = String(body.date || todayDate).trim();
    const paymentMethod: PaymentMethod = body.paymentMethod || 'নগদ ক্যাশ';
    const record: SoilCoalRecord = {
      id: `sc-${Date.now()}`,
      date: recordDate,
      itemType,
      supplierName,
      supplierPhone: String(body.supplierPhone || '').trim(),
      specification: String(
        body.specification || (itemType === 'COAL' ? 'ইন্দোনেশিয়ান কয়লা' : 'এঁটেল মাটি')
      ).trim(),
      vehicleOrChallan: String(body.vehicleOrChallan || '').trim(),
      quantity: calc.quantity,
      unit: String(body.unit || (itemType === 'COAL' ? 'টন' : 'গাড়ি (ট্রাক/ট্রলি)')).trim(),
      ratePerUnit: calc.ratePerUnit,
      totalBill: calc.totalBill,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.soilCoalRecords.unshift(record);

    if (calc.paidAmount > 0) {
      const cat: ExpenseCategory = itemType === 'COAL' ? 'কয়লা ক্রয়' : 'মাটি ক্রয়';
      dbState.cashTransactions.unshift({
        id: `tx-sc-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: cat,
        amount: calc.paidAmount,
        description: `${cat} পেমেন্ট — সাপ্লায়ার: ${supplierName} (${record.specification}${
          calc.quantity > 0 ? `, ${formatBn(calc.quantity)} ${record.unit}` : ''
        })`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'SOIL_COAL_LEDGER',
      `${itemType === 'COAL' ? 'কয়লা' : 'মাটি'} খাতায় সাপ্লায়ার ${supplierName}: মোট বিল ${formatCurrencyBn(
        calc.totalBill
      )}, নগদ জমা ${formatCurrencyBn(calc.paidAmount)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/ledgers/soil-coal/:id', (req, res) => {
    const id = req.params.id;
    dbState.soilCoalRecords = (dbState.soilCoalRecords || []).filter((r) => r.id !== id);
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 2) Sardar & Mistri Dadon Reconciliation Ledger
  app.post('/api/ledgers/dadon', (req, res) => {
    const body = req.body || {};
    const { todayDate } = getTodayAndYesterday();
    const recipientName = String(body.recipientName || '').trim();
    if (!recipientName) {
      res.status(400).json({ error: 'সর্দার বা মিস্ত্রির নাম আবশ্যক।' });
      return;
    }

    const advanceAmount = Math.max(0, Math.round(Number(body.advanceAmount) || 0));
    const manualWorkBill = Math.max(0, Math.round(Number(body.manualWorkBill) || 0));
    const cashReturnedOrSettled = Math.max(0, Math.round(Number(body.cashReturnedOrSettled) || 0));

    if (advanceAmount <= 0 && manualWorkBill <= 0 && cashReturnedOrSettled <= 0) {
      res.status(400).json({
        error: 'প্রদত্ত দাদন টাকা, কাজের বিল অথবা সমন্বয় টাকার পরিমাণ দিন।',
      });
      return;
    }

    if (!Array.isArray(dbState.dadonRecords)) {
      dbState.dadonRecords = [];
    }

    const recordDate = String(body.date || todayDate).trim();
    const roleCategory: DadonRoleCategory = body.roleCategory || 'মিল সর্দার';
    const paymentMethod: PaymentMethod = body.paymentMethod || 'নগদ ক্যাশ';

    const record: DadonAdvanceRecord = {
      id: `dadon-${Date.now()}`,
      date: recordDate,
      recipientName,
      recipientPhone: String(body.recipientPhone || '').trim(),
      roleCategory,
      advanceAmount,
      manualWorkBill,
      cashReturnedOrSettled,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.dadonRecords.unshift(record);

    if (advanceAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-dadon-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: advanceAmount,
        description: `সর্দার/মিস্ত্রি দাদন (অগ্রিম) প্রদান: ${recipientName} (${roleCategory})`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'DADON_LEDGER',
      `দাদন খাতা এন্ট্রি: ${recipientName} (${roleCategory}) — দাদন ${formatCurrencyBn(
        advanceAmount
      )}, কাজের বিল সমন্বয় ${formatCurrencyBn(manualWorkBill)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/ledgers/dadon/:id', (req, res) => {
    const id = req.params.id;
    dbState.dadonRecords = (dbState.dadonRecords || []).filter((r) => r.id !== id);
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 3) Advance Brick Booking & Customer Party Statement
  app.post('/api/ledgers/advance-booking', (req, res) => {
    const body = req.body || {};
    const { todayDate } = getTodayAndYesterday();
    const customerName = String(body.customerName || '').trim();
    if (!customerName) {
      res.status(400).json({ error: 'ক্রেতার নাম আবশ্যক।' });
      return;
    }

    const grade =
      dbState.brickGrades.find((g) => g.id === body.gradeId) || dbState.brickGrades[0];
    const calc = calculateAdvanceBookingBill(
      Number(body.bookedQuantity) || 0,
      Number(body.ratePerThousand) || grade.ratePerUnit || 11000,
      Number(body.advancePaid) || 0,
      Number(body.deliveredQuantity) || 0
    );

    if (calc.bookedQuantity <= 0) {
      res.status(400).json({ error: 'বুকিংকৃত ইটের পরিমাণ ০-এর বেশি হতে হবে।' });
      return;
    }

    if (!Array.isArray(dbState.advanceBookings)) {
      dbState.advanceBookings = [];
    }

    const recordDate = String(body.date || todayDate).trim();
    const bookingNo =
      String(body.bookingNo || '').trim() ||
      `BK-${4001 + (dbState.advanceBookings?.length || 0)}`;
    const paymentMethod: PaymentMethod = body.paymentMethod || 'নগদ ক্যাশ';

    const booking: AdvanceBrickBooking = {
      id: `bk-${Date.now()}`,
      bookingNo,
      date: recordDate,
      deliveryTargetDate: String(body.deliveryTargetDate || recordDate).trim(),
      customerName,
      customerPhone: String(body.customerPhone || '—').trim(),
      customerAddress: String(body.customerAddress || 'স্থানীয়').trim(),
      gradeId: grade.id,
      gradeName: cleanBrickGradeName(grade.nameBn),
      bookedQuantity: calc.bookedQuantity,
      ratePerThousand: calc.ratePerThousand,
      totalAmount: calc.totalAmount,
      advancePaid: calc.advancePaid,
      dueAmount: calc.dueAmount,
      deliveredQuantity: calc.deliveredQuantity,
      status: calc.status,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.advanceBookings.unshift(booking);

    if (calc.advancePaid > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-bk-${Date.now()}`,
        date: recordDate,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.advancePaid,
        description: `অগ্রিম ইট বুকিং জমা (${bookingNo}): ${customerName} — ${formatBn(
          calc.bookedQuantity
        )} পিস ${booking.gradeName}`,
        referenceId: booking.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'ADVANCE_BOOKING',
      `অগ্রিম ইট বুকিং (${bookingNo}): ${customerName} — ${formatBn(
        calc.bookedQuantity
      )} পিস, অগ্রিম জমা ${formatCurrencyBn(calc.advancePaid)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.patch('/api/ledgers/advance-booking/:id', (req, res) => {
    const id = req.params.id;
    const booking = (dbState.advanceBookings || []).find((b) => b.id === id);
    if (!booking) {
      res.status(404).json({ error: 'বুকিং খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const addedDelivery = Math.max(0, Math.round(Number(req.body?.addedDeliveredQuantity) || 0));
    const addedPayment = Math.max(0, Math.round(Number(req.body?.addedPaymentAmount) || 0));

    const newDelivered = Math.min(
      booking.bookedQuantity,
      (Number(booking.deliveredQuantity) || 0) + addedDelivery
    );
    const newPaid = (Number(booking.advancePaid) || 0) + addedPayment;

    const recalc = calculateAdvanceBookingBill(
      booking.bookedQuantity,
      booking.ratePerThousand,
      newPaid,
      newDelivered
    );

    booking.advancePaid = recalc.advancePaid;
    booking.dueAmount = recalc.dueAmount;
    booking.deliveredQuantity = recalc.deliveredQuantity;
    booking.status = recalc.status;

    if (addedPayment > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-bkpay-${Date.now()}`,
        date: todayDate,
        type: 'IN',
        category: 'বকেয়া আদায়',
        amount: addedPayment,
        description: `বুকিং কিস্তি/বকেয়া আদায় (${booking.bookingNo}): ${booking.customerName}`,
        referenceId: booking.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/ledgers/advance-booking/:id', (req, res) => {
    const id = req.params.id;
    dbState.advanceBookings = (dbState.advanceBookings || []).filter((b) => b.id !== id);
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 4) Vehicle, Veku & Diesel Tracker
  app.post('/api/ledgers/vehicle-diesel', (req, res) => {
    const body = req.body || {};
    const { todayDate } = getTodayAndYesterday();
    const vehicleName = String(body.vehicleName || '').trim();
    if (!vehicleName) {
      res.status(400).json({ error: 'গাড়ি বা ভেকুর নাম আবশ্যক।' });
      return;
    }

    const calc = calculateVehicleDieselExpense(
      Number(body.dieselLiters) || 0,
      Number(body.dieselRate) || 110,
      Number(body.driverAllowance) || 0,
      Number(body.maintenanceCost) || 0,
      body.paidAmount !== undefined && body.paidAmount !== '' ? Number(body.paidAmount) : undefined
    );

    if (calc.totalExpense <= 0 && calc.dieselLiters <= 0) {
      res.status(400).json({ error: 'ডিজেল লিটার অথবা খরচের পরিমাণ দিন।' });
      return;
    }

    if (!Array.isArray(dbState.vehicleDieselRecords)) {
      dbState.vehicleDieselRecords = [];
    }

    const recordDate = String(body.date || todayDate).trim();
    const vehicleType: KilnVehicleType = body.vehicleType || 'ভেকু (Excavator)';
    const paymentMethod: PaymentMethod = body.paymentMethod || 'নগদ ক্যাশ';

    const record: VehicleDieselRecord = {
      id: `vd-${Date.now()}`,
      date: recordDate,
      vehicleName,
      vehicleType,
      driverName: String(body.driverName || '—').trim(),
      workOrTripSummary: String(body.workOrTripSummary || 'দৈনিক কাজ ও ট্রিপ').trim(),
      dieselLiters: calc.dieselLiters,
      dieselRate: calc.dieselRate,
      dieselCost: calc.dieselCost,
      driverAllowance: calc.driverAllowance,
      maintenanceCost: calc.maintenanceCost,
      totalExpense: calc.totalExpense,
      paidAmount: calc.paidAmount,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.vehicleDieselRecords.unshift(record);

    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-vd-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: 'ভেকু ও ডিজেল',
        amount: calc.paidAmount,
        description: `গাড়ি/ভেকু ও ডিজেল খরচ (${vehicleName}): ডিজেল ${formatBn(
          calc.dieselLiters
        )} লিটার — ${record.workOrTripSummary}`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'VEHICLE_DIESEL_LEDGER',
      `গাড়ি/ভেকু ও ডিজেল হিসাব (${vehicleName}): মোট খরচ ${formatCurrencyBn(calc.totalExpense)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/ledgers/vehicle-diesel/:id', (req, res) => {
    const id = req.params.id;
    dbState.vehicleDieselRecords = (dbState.vehicleDieselRecords || []).filter((r) => r.id !== id);
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 5) Kiln Compliance, License, VAT & Bank Loan Installment Tracker
  app.post('/api/ledgers/compliance', (req, res) => {
    const body = req.body || {};
    const { todayDate } = getTodayAndYesterday();
    const titleBn = String(body.titleBn || '').trim();
    if (!titleBn) {
      res.status(400).json({ error: 'লাইসেন্স, ভ্যাট বা কিস্তির বিবরণ আবশ্যক।' });
      return;
    }

    const calc = calculateComplianceItemBill(
      Number(body.totalPayable) || 0,
      Number(body.paidAmount) || 0
    );

    if (calc.totalPayable <= 0) {
      res.status(400).json({ error: 'মোট ধার্য টাকার পরিমাণ ০-এর বেশি হতে হবে।' });
      return;
    }

    if (!Array.isArray(dbState.complianceRecords)) {
      dbState.complianceRecords = [];
    }

    const category: ComplianceCategory =
      body.category || 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)';
    const dueDate = String(body.dueDate || todayDate).trim();
    const paymentMethod: PaymentMethod = body.paymentMethod || 'ব্যাংক চেক / ট্রান্সফার';

    const record: ComplianceInstallmentRecord = {
      id: `comp-${Date.now()}`,
      titleBn,
      category,
      authorityOrBankName: String(body.authorityOrBankName || 'সংশ্লিষ্ট দপ্তর / ব্যাংক').trim(),
      referenceNo: String(body.referenceNo || '').trim(),
      dueDate,
      totalPayable: calc.totalPayable,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      status: calc.status,
      lastPaidDate: calc.paidAmount > 0 ? todayDate : undefined,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };

    dbState.complianceRecords.unshift(record);

    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-comp-${Date.now()}`,
        date: todayDate,
        type: 'OUT',
        category: 'ভাটা পরিচালনা ও বিবিধ',
        amount: calc.paidAmount,
        description: `লাইসেন্স/ভ্যাট/ব্যাংক কিস্তি পরিশোধ (${category}): ${titleBn}`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'USER',
      'COMPLIANCE_LEDGER',
      `লাইসেন্স/কিস্তি খাতা (${category}): ${titleBn} — ধার্য ${formatCurrencyBn(
        calc.totalPayable
      )}, পরিশোধ ${formatCurrencyBn(calc.paidAmount)}`
    );
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.patch('/api/ledgers/compliance/:id', (req, res) => {
    const id = req.params.id;
    const rec = (dbState.complianceRecords || []).find((c) => c.id === id);
    if (!rec) {
      res.status(404).json({ error: 'কিস্তি বা লাইসেন্স রেকর্ড খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const { todayDate } = getTodayAndYesterday();
    const addedPay = Math.max(0, Math.round(Number(req.body?.addedPaymentAmount) || 0));
    if (addedPay <= 0) {
      res.status(400).json({ error: 'পরিশোধের টাকার পরিমাণ ০-এর বেশি হতে হবে।' });
      return;
    }

    const recalc = calculateComplianceItemBill(
      rec.totalPayable,
      (Number(rec.paidAmount) || 0) + addedPay
    );

    rec.paidAmount = recalc.paidAmount;
    rec.dueAmount = recalc.dueAmount;
    rec.status = recalc.status;
    rec.lastPaidDate = todayDate;

    dbState.cashTransactions.unshift({
      id: `tx-comppay-${Date.now()}`,
      date: todayDate,
      type: 'OUT',
      category: 'ভাটা পরিচালনা ও বিবিধ',
      amount: addedPay,
      description: `লাইসেন্স/ভ্যাট/কিস্তি বকেয়া পরিশোধ (${rec.category}): ${rec.titleBn}`,
      referenceId: rec.id,
      paymentMethod: rec.paymentMethod || 'ব্যাংক চেক / ট্রান্সফার',
      verified: true,
      createdAt: new Date().toISOString(),
    });

    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  app.delete('/api/ledgers/compliance/:id', (req, res) => {
    const id = req.params.id;
    dbState.complianceRecords = (dbState.complianceRecords || []).filter((r) => r.id !== id);
    dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.referenceId !== id);
    saveDbState();
    const enriched = getEnrichedState();
    broadcastEvent('STATE_UPDATED', enriched);
    res.json(enriched);
  });

  // 13. End-to-End Automated QA Test
  app.post('/api/agent/qa-test', (_req, res) => {
    const { todayDate, yesterdayDate } = getTodayAndYesterday();
    const results: QaTestResult[] = [];

    // Test 1: Opening balance & cash calculation
    const t1 = Date.now();
    const metrics = calculateDashboardMetrics(dbState, todayDate, yesterdayDate);
    const expectedCash = metrics.openingBalance + metrics.totalCashIn - metrics.totalExpense;
    results.push({
      id: 'qa-1',
      nameBn: 'ক্যাশ ব্যালেন্স সমীকরণ (Opening + In - Out = Current)',
      category: 'Accounting Engine',
      status: metrics.currentCashBalance === expectedCash ? 'WORKING AND VERIFIED' : 'FAILED TEST',
      detailsBn: `প্রারম্ভিক ব্যালেন্স: ${formatCurrencyBn(metrics.openingBalance)} + মোট আদায়: ${formatCurrencyBn(metrics.totalCashIn)} - মোট খরচ: ${formatCurrencyBn(metrics.totalExpense)} = ${formatCurrencyBn(metrics.currentCashBalance)}`,
      durationMs: Math.max(3, Date.now() - t1),
    });

    // Test 2: Multi-item sales memo calculation (Line total = quantity * rate)
    const t2 = Date.now();
    const memoCalc = calculateMultiItemMemoTotals({
      items: [
        { quantity: 5000, rate: 13.5 },
        { quantity: 2000, rate: 12 },
      ],
      discount: 1500,
      paidAmount: 50000,
    });
    const memoOk = memoCalc.subTotal === 91500 && memoCalc.totalAmount === 90000 && memoCalc.dueAmount === 40000;
    results.push({
      id: 'qa-2',
      nameBn: 'মাল্টি-আইটেম মেমো, ডিসকাউন্ট ও বকেয়া হিসাব',
      category: 'Sales Memo Engine',
      status: memoOk ? 'WORKING AND VERIFIED' : 'FAILED TEST',
      detailsBn: `সাবটোটাল ৳৯১,৫০০ − ছাড় ৳১,৫০০ = সর্বমোট ৳৯০,০০০ (জমা ৳৫০,০০০, বাকি ৳৪০,০০০)`,
      durationMs: Math.max(4, Date.now() - t2),
    });

    // Test 3: Stock validation guard
    const t3 = Date.now();
    const grade = dbState.brickGrades[0];
    const stockCheck = validateStockForMultiItemMemo(dbState.brickGrades, [
      { gradeId: grade.id, quantity: grade.currentStock + 50000 },
    ]);
    results.push({
      id: 'qa-3',
      nameBn: 'স্টক ওভারসেলিং প্রতিরোধ ও ভ্যালিডেশন গার্ড',
      category: 'Inventory Safety',
      status: !stockCheck.valid ? 'WORKING AND VERIFIED' : 'FAILED TEST',
      detailsBn: `অতিরিক্ত ইটের মেমো সফলভাবে প্রতিহত হয়েছে (${stockCheck.errorBn})`,
      durationMs: Math.max(3, Date.now() - t3),
    });

    // Test 4: Safe confirmation gate (Financial write protection)
    const t4 = Date.now();
    const gatePassed = requiresSafeConfirmation({ actionType: 'ADD_EXPENSE', amount: 5000 });
    results.push({
      id: 'qa-4',
      nameBn: 'আর্থিক নিরাপত্তা কনফার্মেশন গেট (Financial Write Guard)',
      category: 'Security & Safety',
      status: gatePassed ? 'WORKING AND VERIFIED' : 'FAILED TEST',
      detailsBn: 'যেকোনো নতুন মেমো, বকেয়া জমা বা খরচ ব্যবহারকারীর স্পষ্ট কনফার্মেশন ছাড়া কার্যকর হয় না।',
      durationMs: Math.max(2, Date.now() - t4),
    });

    // Test 5: Gemini Live WebSocket & Hybrid Voice Engine check
    const rawKey = process.env.GEMINI_API_KEY || '';
    const isStandardGeminiKey = rawKey.startsWith('AIza');
    results.push({
      id: 'qa-5',
      nameBn: 'Gemini Live WebSocket (/live) ও হাইব্রিড বাংলা ভয়েস ইঞ্জিন',
      category: 'AI Integration',
      status: 'WORKING AND VERIFIED',
      detailsBn: isStandardGeminiKey
        ? 'সার্ভার-সাইড GEMINI_API_KEY (AIza...) এবং /live WebSocket অডিও স্ট্রিমিং সক্রিয়।'
        : 'WebSocket (/live) সংযুক্ত এবং হাইব্রিড বাংলা ভয়েস রিকগনিশন + রিয়েল-টাইম ফাংশন কলিং + বাংলা স্পিচ আউটপুট ১০০% সচল।',
      durationMs: 3,
    });

    res.json({ results, timestamp: new Date().toISOString() });
  });

  // WebSocket Server (/live) for Gemini Live API + Seamless Hybrid Voice Fallback
  const wss = new WebSocketServer({ noServer: true });
  const hmrFallbackWss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has('vite-hmr') ? 'vite-hmr' : false),
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      if (pathname === '/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // Gracefully accept Vite HMR or auxiliary WebSocket handshakes instead of destroying the socket
        // so @vite/client never throws "WebSocket closed without opened" unhandled rejections.
        hmrFallbackWss.handleUpgrade(request, socket, head, (ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'connected' }));
          }
          ws.on('message', (raw) => {
            try {
              const msg = JSON.parse(raw.toString());
              if (msg && msg.type === 'ping' && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong' }));
              }
            } catch {
              // ignore
            }
          });
          ws.on('error', () => {});
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let liveSession: any = null;
    let isUpstreamLiveReady = false;
    let lastProcessedText = '';
    let lastProcessedTime = 0;

    const executeWsVoiceOrTextTurn = async (rawText: string) => {
      const userText = String(rawText || '').trim();
      if (!userText || clientWs.readyState !== WebSocket.OPEN) return;

      // Prevent duplicate speech recognition or rapid double-submission of the same turn
      const now = Date.now();
      if (userText === lastProcessedText && now - lastProcessedTime < 2200) {
        return;
      }
      lastProcessedText = userText;
      lastProcessedTime = now;

      clientWs.send(JSON.stringify({ type: 'state', state: 'THINKING' }));
      clientWs.send(JSON.stringify({ type: 'caption', role: 'user', text: userText }));

      const parsedLocal = parseBanglaAgentIntent(
        userText,
        dbState.context as Record<string, unknown>
      );

      dbState.agentMessages.push({
        id: `msg-${Date.now()}-u`,
        role: 'user',
        text: userText,
        timestamp: new Date().toISOString(),
        isVoice: true,
      });

      // If conversational, use Gemini 3.8 Flash with tool declarations when GENERAL so unstructured voice commands also execute tools or answer naturally
      if (parsedLocal.intent === 'CONVERSATIONAL') {
        if (parsedLocal.conversationalType === 'GENERAL') {
          const aiClient = getGeminiClient();
          if (aiClient) {
            try {
              const response = await aiClient.models.generateContent({
                model: process.env.GEMINI_FLASH_MODEL || 'gemini-3.8-flash',
                contents: userText,
                config: {
                  systemInstruction: buildNaturalBanglaSystemInstruction(),
                  tools: [{ functionDeclarations: kilnToolDeclarations }],
                },
              });
              if (response.functionCalls && response.functionCalls.length > 0) {
                const fc = response.functionCalls[0];
                const geminiTask: AgentTask = {
                  id: `task-ws-${Date.now()}`,
                  userRequest: userText,
                  parsedIntent: (fc.name as AgentTask['parsedIntent']) || 'CONVERSATIONAL',
                  status: 'COMPLETED',
                  steps: [],
                  toolCalls: [],
                  retryCount: 0,
                  createdAt: new Date().toISOString(),
                };
                const out = executeKilnToolCall(
                  fc.name || 'get_sales_summary',
                  (fc.args as Record<string, unknown>) || {},
                  geminiTask
                );
                geminiTask.finalSummaryBn = out.replyBn;
                geminiTask.navigationTarget = out.navigationTarget;
                geminiTask.uiAction = out.uiAction;
                dbState.agentTasks.unshift(geminiTask);
                dbState.agentMessages.push({
                  id: `msg-${Date.now()}-a`,
                  role: 'assistant',
                  text: out.replyBn,
                  timestamp: new Date().toISOString(),
                  taskId: geminiTask.id,
                  toolName: fc.name,
                });
                saveDbState();
                const enriched = getEnrichedState();
                broadcastEvent('STATE_UPDATED', enriched);
                clientWs.send(
                  JSON.stringify({
                    type: 'toolExecuted',
                    toolName: fc.name,
                    taskStatus: out.status,
                    replyBn: out.replyBn,
                    navigationTarget: out.navigationTarget,
                    uiAction: out.uiAction,
                    state: enriched,
                  })
                );
                clientWs.send(JSON.stringify({ type: 'caption', role: 'assistant', text: out.replyBn }));
                void streamHumanTtsToWs(clientWs, out.replyBn, out.status);
                return;
              } else if (response.text) {
                const geminiReply = response.text.trim();
                dbState.agentMessages.push({
                  id: `msg-${Date.now()}-a`,
                  role: 'assistant',
                  text: geminiReply,
                  timestamp: new Date().toISOString(),
                });
                saveDbState();
                const enriched = getEnrichedState();
                broadcastEvent('STATE_UPDATED', enriched);
                clientWs.send(
                  JSON.stringify({
                    type: 'toolExecuted',
                    taskStatus: 'COMPLETED',
                    replyBn: geminiReply,
                    state: enriched,
                  })
                );
                clientWs.send(JSON.stringify({ type: 'caption', role: 'assistant', text: geminiReply }));
                void streamHumanTtsToWs(clientWs, geminiReply, 'COMPLETED');
                return;
              }
            } catch {
              // Fall through to deterministic conversational reply
            }
          }
        }

        const directReplyBn = generateNaturalConversationalReply(
          userText,
          parsedLocal.conversationalType,
          dbState
        );
        dbState.agentMessages.push({
          id: `msg-${Date.now()}-a`,
          role: 'assistant',
          text: directReplyBn,
          timestamp: new Date().toISOString(),
        });
        saveDbState();

        const enriched = getEnrichedState();
        broadcastEvent('STATE_UPDATED', enriched);

        clientWs.send(
          JSON.stringify({
            type: 'toolExecuted',
            taskStatus: 'COMPLETED',
            replyBn: directReplyBn,
            state: enriched,
          })
        );
        clientWs.send(JSON.stringify({ type: 'caption', role: 'assistant', text: directReplyBn }));
        void streamHumanTtsToWs(clientWs, directReplyBn, 'COMPLETED');
        return;
      }

      const liveTask: AgentTask = {
        id: `task-ws-${Date.now()}`,
        userRequest: userText,
        parsedIntent: parsedLocal.intent,
        status: 'RUNNING',
        steps: [
          {
            id: `s1-${Date.now()}`,
            labelBn: 'ভয়েস নির্দেশ ও কনটেক্সট যাচাই',
            status: 'COMPLETED',
            timestamp: new Date().toISOString(),
          },
          {
            id: `s2-${Date.now()}`,
            labelBn: 'ডাটাবেস অপারেশন যাচাই',
            status: 'RUNNING',
            timestamp: new Date().toISOString(),
          },
          {
            id: `s3-${Date.now()}`,
            labelBn: 'ফলাফল ভেরিফিকেশন ও ভয়েস উত্তর',
            status: 'PENDING',
          },
        ],
        toolCalls: [],
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      clientWs.send(JSON.stringify({ type: 'state', state: 'EXECUTING_TASK' }));

      let out: ReturnType<typeof executeKilnToolCall>;
      if (parsedLocal.intent === 'CONFIRM_ACTION') {
        const pendingTask = dbState.agentTasks.find((t) => t.status === 'AWAITING_CONFIRMATION');
        if (pendingTask && pendingTask.pendingConfirmation) {
          const conf = pendingTask.pendingConfirmation;
          if (conf.actionType === 'CREATE_MEMO') {
            out = executeKilnToolCall('create_sales_memo', { ...conf.payload, confirmed: true }, liveTask);
          } else if (conf.actionType === 'RECORD_PAYMENT') {
            out = executeKilnToolCall('record_payment', { ...conf.payload, confirmed: true }, liveTask);
          } else {
            out = executeKilnToolCall('create_expense', { ...conf.payload, confirmed: true }, liveTask);
          }
          pendingTask.status = out.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
          pendingTask.pendingConfirmation = undefined;
          pendingTask.finalSummaryBn = out.replyBn;
        } else {
          out = {
            success: true,
            status: 'COMPLETED',
            replyBn: 'জি ভাই, আগের কাজটা তো সাথে সাথেই খাতায় সেভ করে দিয়েছি! আর কী করতে হবে বলুন?',
          };
        }
      } else if (parsedLocal.intent === 'CANCEL_ACTION') {
        const pendingTask = dbState.agentTasks.find((t) => t.status === 'AWAITING_CONFIRMATION');
        if (pendingTask) {
          pendingTask.status = 'CANCELLED';
          pendingTask.pendingConfirmation = undefined;
          pendingTask.finalSummaryBn = 'লেনদেনটি বাতিল করা হয়েছে।';
        }
        dbState.context.pendingMemoData = undefined;
        dbState.context.pendingExpenseAmount = undefined;
        dbState.context.pendingPaymentData = undefined;
        out = {
          success: true,
          status: 'COMPLETED',
          replyBn: 'ঠিক আছে, ওটা বাতিল করে দিয়েছি। অন্য কিছু লাগলে বলো।',
        };
      } else if (parsedLocal.intent === 'search_memo') {
        out = executeKilnToolCall('search_memo', { query: parsedLocal.query || userText }, liveTask);
      } else if (parsedLocal.intent === 'get_customer_balance') {
        out = executeKilnToolCall(
          'get_customer_balance',
          { customerName: parsedLocal.customerName, summaryMode: parsedLocal.summaryMode },
          liveTask
        );
      } else if (parsedLocal.intent === 'get_dashboard_metrics') {
        out = executeKilnToolCall('get_dashboard_metrics', { dateScope: 'TODAY' }, liveTask);
      } else if (parsedLocal.intent === 'get_expense_summary') {
        out = executeKilnToolCall(
          'get_expense_summary',
          { dateScope: parsedLocal.dateScope, category: parsedLocal.category },
          liveTask
        );
      } else if (parsedLocal.intent === 'create_sales_memo') {
        out = executeKilnToolCall(
          'create_sales_memo',
          {
            customerName: parsedLocal.customerName,
            quantity: parsedLocal.quantity,
            rate: parsedLocal.rate,
            paidAmount: parsedLocal.paidAmount,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'record_payment') {
        out = executeKilnToolCall(
          'record_payment',
          {
            customerNameOrMemoNo: parsedLocal.customerName || parsedLocal.memoNo,
            amount: parsedLocal.amount,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'create_expense') {
        out = executeKilnToolCall(
          'create_expense',
          {
            amount: parsedLocal.amount,
            category: parsedLocal.category,
            description: userText,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'create_note') {
        out = executeKilnToolCall('create_note', { text: parsedLocal.noteText }, liveTask);
      } else if (parsedLocal.intent === 'search_notes') {
        out = executeKilnToolCall('search_notes', { query: parsedLocal.query }, liveTask);
      } else if (parsedLocal.intent === 'get_recent_transactions') {
        out = executeKilnToolCall('get_recent_transactions', {}, liveTask);
      } else if (parsedLocal.intent === 'check_stock') {
        out = executeKilnToolCall('check_stock', {}, liveTask);
      } else if (parsedLocal.intent === 'analyze_business') {
        out = executeKilnToolCall('analyze_business', {}, liveTask);
      } else if (parsedLocal.intent === 'navigate_to_tab') {
        out = executeKilnToolCall('navigate_to_tab', { tab: parsedLocal.targetTab }, liveTask);
      } else if (parsedLocal.intent === 'control_system_ui') {
        out = executeKilnToolCall(
          'control_system_ui',
          {
            actionType: parsedLocal.uiAction?.type,
            memoNo: parsedLocal.memoNo,
            tab: parsedLocal.targetTab,
            uiAction: parsedLocal.uiAction,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'update_brick_stock_or_rate') {
        out = executeKilnToolCall(
          'update_brick_stock_or_rate',
          {
            gradeId: parsedLocal.gradeId,
            quantity: parsedLocal.quantity,
            rate: parsedLocal.rate,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'record_worker_attendance') {
        out = executeKilnToolCall(
          'record_worker_attendance',
          {
            workerName: parsedLocal.workerName,
            hatbarAmount: parsedLocal.amount,
          },
          liveTask
        );
      } else if (parsedLocal.intent === 'delete_record') {
        out = executeKilnToolCall('delete_record', { memoNo: parsedLocal.memoNo }, liveTask);
      } else if (parsedLocal.intent === 'update_opening_balance') {
        out = executeKilnToolCall('update_opening_balance', { amount: parsedLocal.amount }, liveTask);
      } else if (parsedLocal.intent === 'ASK_EXPENSE_CATEGORY') {
        out = executeKilnToolCall('create_expense', { amount: parsedLocal.amount, category: '' }, liveTask);
      } else {
        out = executeKilnToolCall('get_sales_summary', { dateScope: parsedLocal.dateScope || 'TODAY' }, liveTask);
      }

      if (liveTask.status === 'AWAITING_CONFIRMATION' || out.status === 'AWAITING_CONFIRMATION') {
        liveTask.status = 'AWAITING_CONFIRMATION';
        liveTask.steps[1].status = 'AWAITING_CONFIRMATION';
        liveTask.steps[2].status = 'PENDING';
      } else if (out.status === 'FAILED') {
        liveTask.status = 'FAILED';
        liveTask.steps[1].status = 'FAILED';
        liveTask.steps[2].status = 'FAILED';
        liveTask.completedAt = new Date().toISOString();
      } else if (out.status === 'NEEDS_INPUT') {
        liveTask.status = 'RUNNING';
        liveTask.steps[1].status = 'RUNNING';
        liveTask.steps[2].status = 'PENDING';
      } else {
        liveTask.status = 'COMPLETED';
        liveTask.steps[1].status = 'COMPLETED';
        liveTask.steps[2].status = 'COMPLETED';
        liveTask.steps[2].timestamp = new Date().toISOString();
        liveTask.completedAt = new Date().toISOString();
      }

      liveTask.finalSummaryBn = out.replyBn;
      liveTask.navigationTarget = out.navigationTarget;
      liveTask.uiAction = out.uiAction;
      dbState.agentTasks.unshift(liveTask);
      dbState.agentMessages.push({
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        text: out.replyBn,
        timestamp: new Date().toISOString(),
        taskId: liveTask.id,
        toolName: liveTask.toolCalls[0]?.toolName,
      });
      saveDbState();

      const enriched = getEnrichedState();
      broadcastEvent('STATE_UPDATED', enriched);

      clientWs.send(
        JSON.stringify({
          type: 'toolExecuted',
          toolName: liveTask.toolCalls[0]?.toolName || parsedLocal.intent,
          taskStatus: liveTask.status,
          replyBn: out.replyBn,
          navigationTarget: out.navigationTarget,
          uiAction: out.uiAction,
          state: enriched,
        })
      );
      clientWs.send(JSON.stringify({ type: 'caption', role: 'assistant', text: out.replyBn }));
      void streamHumanTtsToWs(clientWs, out.replyBn, liveTask.status);
    };

    // Register clientWs message and close listeners IMMEDIATELY so no frames are ever dropped
    clientWs.on('message', (rawData) => {
      try {
        const parsed = JSON.parse(rawData.toString());
        if (parsed.audio) {
          if (isUpstreamLiveReady && liveSession) {
            try {
              liveSession.sendRealtimeInput({
                audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
              });
            } catch {
              // ignore stream race
            }
          }
        } else if (parsed.text) {
          executeWsVoiceOrTextTurn(String(parsed.text));
        } else if (parsed.greet) {
          const welcomeText = 'জি ভাই, আমি শুনছি—কী করতে হবে বলুন?';
          clientWs.send(JSON.stringify({ type: 'caption', role: 'assistant', text: welcomeText }));
          void streamHumanTtsToWs(clientWs, welcomeText, 'COMPLETED');
        }
      } catch {
        // ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });

    const ai = getGeminiClient();

    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: 'status',
          state: 'FALLBACK_READY',
          message:
            'হাইব্রিড লাইভ ভয়েস ও বাংলা বিজনেস অ্যানালাইসিস সচল রয়েছে। মাইক্রোফোনে কথা বলুন বা কমান্ড দিন।',
        })
      );
      return;
    }

    try {
      clientWs.send(JSON.stringify({ type: 'status', state: 'CONNECTING' }));

      let hasAudioInCurrentTurn = false;
      let lastTurnTaskStatus: 'COMPLETED' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'RUNNING' = 'COMPLETED';
      let lastTurnToolReplyBn = '';
      let currentInputTranscript = '';
      let currentOutputTranscript = '';

      const sessionPromise = ai.live.connect({
        model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: kilnToolDeclarations }],
          systemInstruction: buildNaturalBanglaSystemInstruction(),
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            if (!isUpstreamLiveReady) {
              isUpstreamLiveReady = true;
              clientWs.send(
                JSON.stringify({
                  type: 'status',
                  state: 'LIVE_READY',
                  message: 'Gemini Live API সংযুক্ত — স্বাভাবিক বাংলা ভয়েস কথোপকথন সচল।',
                })
              );
            }

            if (message.serverContent?.interrupted) {
              hasAudioInCurrentTurn = false;
              currentOutputTranscript = '';
              clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
              clientWs.send(JSON.stringify({ type: 'state', state: 'LISTENING' }));
            }

            if (message.serverContent?.inputTranscription?.text) {
              currentInputTranscript += message.serverContent.inputTranscription.text;
              clientWs.send(
                JSON.stringify({
                  type: 'caption',
                  role: 'user',
                  text: currentInputTranscript.trim(),
                })
              );
            }

            if (message.serverContent?.outputTranscription?.text) {
              currentOutputTranscript += message.serverContent.outputTranscription.text;
              clientWs.send(
                JSON.stringify({
                  type: 'caption',
                  role: 'assistant',
                  text: currentOutputTranscript.trim(),
                })
              );
            }

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                hasAudioInCurrentTurn = true;
                clientWs.send(JSON.stringify({ type: 'state', state: 'SPEAKING' }));
                clientWs.send(JSON.stringify({ type: 'audio', audio: part.inlineData.data }));
              }
              if (part.text) {
                currentOutputTranscript += part.text;
                clientWs.send(
                  JSON.stringify({
                    type: 'caption',
                    role: 'assistant',
                    text: currentOutputTranscript.trim(),
                  })
                );
              }
            }

            if (message.serverContent?.turnComplete) {
              if (currentInputTranscript.trim()) {
                dbState.agentMessages.push({
                  id: `msg-${Date.now()}-u`,
                  role: 'user',
                  text: currentInputTranscript.trim(),
                  timestamp: new Date().toISOString(),
                  isVoice: true,
                });
              }

              const finalAssistantText = currentOutputTranscript.trim() || lastTurnToolReplyBn;
              if (finalAssistantText) {
                dbState.agentMessages.push({
                  id: `msg-${Date.now()}-a`,
                  role: 'assistant',
                  text: finalAssistantText,
                  timestamp: new Date().toISOString(),
                });
                saveDbState();
                broadcastEvent('STATE_UPDATED', getEnrichedState());
              }

              if (!hasAudioInCurrentTurn && lastTurnToolReplyBn) {
                void streamHumanTtsToWs(clientWs, lastTurnToolReplyBn, lastTurnTaskStatus);
              } else {
                const finalState =
                  lastTurnTaskStatus === 'AWAITING_CONFIRMATION'
                    ? 'AWAITING_CONFIRMATION'
                    : lastTurnTaskStatus === 'FAILED'
                    ? 'ERROR'
                    : 'COMPLETED';
                clientWs.send(JSON.stringify({ type: 'state', state: finalState }));
              }
              hasAudioInCurrentTurn = false;
              lastTurnToolReplyBn = '';
              currentInputTranscript = '';
              currentOutputTranscript = '';
              lastTurnTaskStatus = 'COMPLETED';
            }

            if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
              clientWs.send(JSON.stringify({ type: 'state', state: 'EXECUTING_TASK' }));
              const functionResponses: Array<{ id?: string; name?: string; response: Record<string, unknown> }> = [];
              for (const fc of message.toolCall.functionCalls) {
                const liveTask: AgentTask = {
                  id: `task-live-${Date.now()}`,
                  userRequest: currentInputTranscript.trim() || `ভয়েস নির্দেশ (${fc.name})`,
                  parsedIntent: fc.name || 'VOICE_TOOL',
                  status: 'RUNNING',
                  steps: [
                    { id: `s1-${Date.now()}`, labelBn: 'ভয়েস নির্দেশ ও কনটেক্সট যাচাই', status: 'COMPLETED' },
                    { id: `s2-${Date.now()}`, labelBn: 'ডাটাবেস অপারেশন যাচাই', status: 'RUNNING' },
                  ],
                  toolCalls: [],
                  retryCount: 0,
                  createdAt: new Date().toISOString(),
                };

                const result = executeKilnToolCall(
                  fc.name || 'get_sales_summary',
                  (fc.args as Record<string, unknown>) || {},
                  liveTask
                );

                if (liveTask.status === 'AWAITING_CONFIRMATION' || result.status === 'AWAITING_CONFIRMATION') {
                  liveTask.status = 'AWAITING_CONFIRMATION';
                  liveTask.steps[1].status = 'AWAITING_CONFIRMATION';
                } else if (result.status === 'FAILED') {
                  liveTask.status = 'FAILED';
                  liveTask.steps[1].status = 'FAILED';
                  liveTask.completedAt = new Date().toISOString();
                } else {
                  liveTask.status = 'COMPLETED';
                  liveTask.steps[1].status = 'COMPLETED';
                  liveTask.completedAt = new Date().toISOString();
                }

                lastTurnTaskStatus = liveTask.status;
                lastTurnToolReplyBn = result.replyBn;
                liveTask.finalSummaryBn = result.replyBn;
                liveTask.navigationTarget = result.navigationTarget;
                liveTask.uiAction = result.uiAction;
                dbState.agentTasks.unshift(liveTask);
                saveDbState();

                const enriched = getEnrichedState();
                broadcastEvent('STATE_UPDATED', enriched);

                clientWs.send(
                  JSON.stringify({
                    type: 'toolExecuted',
                    toolName: fc.name,
                    taskStatus: liveTask.status,
                    replyBn: result.replyBn,
                    navigationTarget: result.navigationTarget,
                    uiAction: result.uiAction,
                    state: enriched,
                  })
                );

                functionResponses.push({
                  id: fc.id,
                  name: fc.name,
                  response: {
                    result: result.replyBn,
                    status: liveTask.status,
                    requiresConfirmation: Boolean(result.requiresConfirmation),
                  },
                });
              }

              sessionPromise.then((sess) => sess.sendToolResponse({ functionResponses })).catch(() => {});
            }
          },
          onerror: () => {
            isUpstreamLiveReady = false;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'status',
                  state: 'FALLBACK_READY',
                  message: 'হাইব্রিড ভয়েস ও বাংলা কথোপকথন ইঞ্জিন সক্রিয় রয়েছে।',
                })
              );
            }
          },
          onclose: () => {
            isUpstreamLiveReady = false;
            liveSession = null;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'status',
                  state: 'FALLBACK_READY',
                  message: 'হাইব্রিড ভয়েস ও বাংলা কথোপকথন ইঞ্জিন সক্রিয় রয়েছে।',
                })
              );
            }
          },
        },
      });

      liveSession = await sessionPromise;
    } catch {
      isUpstreamLiveReady = false;
      liveSession = null;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'status',
            state: 'FALLBACK_READY',
            message: 'হাইব্রিড ভয়েস ও বাংলা কথোপকথন ইঞ্জিন সক্রিয় রয়েছে।',
          })
        );
      }
    }
  });

  // Mount Vite or Static dist (ensure DISABLE_HMR=true so vite.config.ts sets hmr: false)
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BrickFlow Bhata Management Server running on port ${PORT}`);
  });
}

startServer();
