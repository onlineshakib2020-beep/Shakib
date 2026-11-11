import type { KilnDatabaseState } from '../types/kiln.ts';

export function getTodayAndYesterday(): { todayDate: string; yesterdayDate: string } {
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10);
  const yest = new Date(now.getTime() - 86400000);
  const yesterdayDate = yest.toISOString().slice(0, 10);
  return { todayDate, yesterdayDate };
}

export function createInitialKilnState(): KilnDatabaseState {
  const { todayDate } = getTodayAndYesterday();

  return {
    settings: {
      bhataName: 'BrickFlow — Bhata Management System',
      tagline: 'ইটভাটার আধুনিক ডিজিটাল সেলস ও সার্বিক হিসাব ব্যবস্থাপনা',
      proprietorName: 'মোঃ কামরুল ইসলাম সাহেব',
      phone1: '০১৯১৩-৬৭৮০১০',
      phone2: '০১৭২৮-২৮৭০১৮',
      address: 'বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা',
      openingBalance: 0,
      theme: 'light',
    },
    brickGrades: [
      {
        id: 'grade-1',
        code: 'BF-1',
        nameBn: '১ নং ইট',
        nameEn: '1 No Brick',
        ratePerUnit: 11000,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
      {
        id: 'grade-1-5',
        code: 'BF-1.5',
        nameBn: '১.৫ নং ইট',
        nameEn: '1.5 No Brick',
        ratePerUnit: 10500,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
      {
        id: 'grade-2',
        code: 'BF-2',
        nameBn: '২ নং ইট',
        nameEn: '2 No Brick',
        ratePerUnit: 9500,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
      {
        id: 'grade-3',
        code: 'BF-3',
        nameBn: '৩ নং ইট',
        nameEn: '3 No Brick',
        ratePerUnit: 8500,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
      {
        id: 'grade-picket',
        code: 'BF-PKT',
        nameBn: 'পিকেট ইট',
        nameEn: 'Picket Brick',
        ratePerUnit: 10000,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
      {
        id: 'grade-goria',
        code: 'BF-GOR',
        nameBn: 'গড়িয়া ও ঝামা ইট',
        nameEn: 'Goria Brick',
        ratePerUnit: 7500,
        ratePerThousand: true,
        currentStock: 0,
        seasonProduced: 0,
      },
    ],
    salesMemos: [],
    cashTransactions: [],
    workerProfiles: [
      {
        id: 'w-1',
        name: 'আব্দুর রহিম সর্দার',
        role: 'সর্দার (Sardar)',
        phone: '০১৭১৪-৯০৮০৭০',
        morningRate: 250,
        afternoonRate: 250,
        active: true,
        totalEarnedSeason: 0,
        totalPaidSeason: 0,
      },
      {
        id: 'w-2',
        name: 'মোঃ মিলন গাজী',
        role: 'ভাটা লোড ও আনলোড (Loader)',
        phone: '০১৯২২-৩৩৪৪৫৫',
        morningRate: 125,
        afternoonRate: 125,
        active: true,
        totalEarnedSeason: 0,
        totalPaidSeason: 0,
      },
      {
        id: 'w-3',
        name: 'আলী হোসেন (আগুন মিস্ত্রি)',
        role: 'আগুন মিস্ত্রি (Fireman)',
        phone: '০১৭৩৩-৬৬৭৭৮৮',
        morningRate: 200,
        afternoonRate: 200,
        active: true,
        totalEarnedSeason: 0,
        totalPaidSeason: 0,
      },
      {
        id: 'w-4',
        name: 'শহিদুল ইসলাম',
        role: 'কাঁচা ইট কাটা (Moulder)',
        phone: '০১৮৪৪-১১২২৩৩',
        morningRate: 125,
        afternoonRate: 125,
        active: true,
        totalEarnedSeason: 0,
        totalPaidSeason: 0,
      },
      {
        id: 'w-5',
        name: 'করিম বক্স (দিনমজুর)',
        role: 'দিনমজুর (Daily Labour)',
        phone: '০১৯৫৫-৭৭৮৮৯৯',
        morningRate: 125,
        afternoonRate: 125,
        active: true,
        totalEarnedSeason: 0,
        totalPaidSeason: 0,
      },
    ],
    workerAttendance: [],
    kilnNotes: [],
    millPots: [],
    chulliLoads: [],
    poraiMistriRecords: [],
    chulliUnloads: [],
    productionPayments: [],
    agentTasks: [],
    agentMessages: [
      {
        id: 'msg-welcome',
        role: 'assistant',
        text: 'আসসালামু আলাইকুম! BrickFlow — Bhata Management System প্রস্তুত। সকল হিসাব ০ (শূন্য) থেকে শুরু করা হয়েছে।',
        timestamp: `${todayDate}T08:00:00.000Z`,
      },
    ],
    auditLogs: [
      {
        id: 'audit-1',
        timestamp: `${todayDate}T08:00:00.000Z`,
        actor: 'SYSTEM_QA',
        action: 'SYSTEM_INIT',
        detailsBn: 'BrickFlow ম্যানেজমেন্ট সিস্টেম সকল হিসাব ০ (শূন্য) করে প্রস্তুত করা হয়েছে।',
        status: 'SUCCESS',
      },
    ],
    context: {},
  };
}
