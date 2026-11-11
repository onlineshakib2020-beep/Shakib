import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Flame,
  Users,
  BookmarkCheck,
  Truck,
  ShieldCheck,
  Plus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  Calendar,
  Coins,
  Fuel,
  Wrench,
  Building2,
  X,
  Landmark,
  Compass,
} from 'lucide-react';
import type {
  AdvanceBrickBooking,
  BrickGrade,
  ComplianceCategory,
  ComplianceInstallmentRecord,
  DadonAdvanceRecord,
  DadonRoleCategory,
  KilnDatabaseState,
  KilnVehicleType,
  NavigationTab,
  PaymentMethod,
  SalesMemo,
  SoilCoalItemType,
  SoilCoalRecord,
  VehicleDieselRecord,
} from '../types/kiln';
import {
  calculateAdvanceBookingBill,
  calculateComplianceItemBill,
  calculateSoilCoalBill,
  calculateVehicleDieselExpense,
  cleanBrickGradeName,
  computeComplianceSummary,
  computeCustomerPartyStatements,
  computeDadonReconciliationSummary,
  computeSoilCoalSummary,
  computeVehicleDieselSummary,
  formatBn,
  formatCurrencyBn,
  parseNum,
  type CustomerPartyStatementRow,
} from '../utils/kilnLogic';

export type AdvancedLedgerSection =
  | 'mati_koyla'
  | 'dadon_khata'
  | 'booking_party'
  | 'veku_truck'
  | 'license_kisti';

interface KilnAdvancedLedgersTabProps {
  activeSection: AdvancedLedgerSection;
  onSelectSection: (section: AdvancedLedgerSection) => void;
  state: KilnDatabaseState;
  todayDate: string;
  onSaveSoilCoal: (payload: Partial<SoilCoalRecord>) => Promise<void>;
  onDeleteSoilCoal: (id: string) => Promise<void>;
  onSaveDadon: (payload: Partial<DadonAdvanceRecord>) => Promise<void>;
  onDeleteDadon: (id: string) => Promise<void>;
  onSaveAdvanceBooking: (payload: Partial<AdvanceBrickBooking>) => Promise<void>;
  onUpdateAdvanceBooking: (
    id: string,
    payload: { addedDeliveredQuantity?: number; addedPaymentAmount?: number }
  ) => Promise<void>;
  onDeleteAdvanceBooking: (id: string) => Promise<void>;
  onSaveVehicleDiesel: (payload: Partial<VehicleDieselRecord>) => Promise<void>;
  onDeleteVehicleDiesel: (id: string) => Promise<void>;
  onSaveCompliance: (payload: Partial<ComplianceInstallmentRecord>) => Promise<void>;
  onUpdateCompliance: (id: string, payload: { addedPaymentAmount: number }) => Promise<void>;
  onDeleteCompliance: (id: string) => Promise<void>;
  onNavigate?: (tab: NavigationTab) => void;
}

export const KilnAdvancedLedgersTab: React.FC<KilnAdvancedLedgersTabProps> = ({
  activeSection,
  onSelectSection,
  state,
  todayDate,
  onSaveSoilCoal,
  onDeleteSoilCoal,
  onSaveDadon,
  onDeleteDadon,
  onSaveAdvanceBooking,
  onUpdateAdvanceBooking,
  onDeleteAdvanceBooking,
  onSaveVehicleDiesel,
  onDeleteVehicleDiesel,
  onSaveCompliance,
  onUpdateCompliance,
  onDeleteCompliance,
  onNavigate,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBn, setFeedbackBn] = useState<string | null>(null);
  const [errorBn, setErrorBn] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setErrorBn(null);
    setFeedbackBn(msg);
    setTimeout(() => setFeedbackBn(null), 4000);
  };

  // ============================================================================
  // 1. মাটি ও এসকো বিল (মাটি ক্রয় ও এসকোভেটর/ভেকু বিল) State
  // ============================================================================
  const [scDate, setScDate] = useState(todayDate);
  const [scType, setScType] = useState<SoilCoalItemType>('ESCO');
  const [scSupplierName, setScSupplierName] = useState('');
  const [soilEscoSubTab, setSoilEscoSubTab] = useState<'SOIL' | 'ESCO'>('SOIL');

  // Dadon season-end settlement calculator state
  const [seasonEndSardarKey, setSeasonEndSardarKey] = useState<string>('');
  const [seasonEndFinalRate, setSeasonEndFinalRate] = useState<string>('1000');
  const [seasonEndCustomBricks, setSeasonEndCustomBricks] = useState<string>('');

  const [scSupplierPhone, setScSupplierPhone] = useState('');
  const [scSpec, setScSpec] = useState('এঁটেল মাটি');
  const [scVehicle, setScVehicle] = useState('');
  const [scQty, setScQty] = useState('');
  const [scUnit, setScUnit] = useState('গাড়ি (ট্রাক/ট্রলি)');
  const [scRate, setScRate] = useState('');
  const [scPaid, setScPaid] = useState('');
  const [scPaymentMethod, setScPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [scNote, setScNote] = useState('');
  const [scHoursWorked, setScHoursWorked] = useState('');
  const [scHoursDateBreakdown, setScHoursDateBreakdown] = useState('');
  const [scWorkSite, setScWorkSite] = useState('');
  const [scFilterType, setScFilterType] = useState<'ALL' | 'ESCO' | 'SOIL'>('ALL');
  const [scSearch, setScSearch] = useState('');

  useEffect(() => {
    if (scType === 'ESCO') {
      setScSpec('এসকোভেটর / ভেকু মাটি কাটার কাজ');
      setScUnit('ঘণ্টা');
    } else {
      setScSpec('এঁটেল মাটি');
      setScUnit('গাড়ি (ট্রাক/ট্রলি)');
    }
  }, [scType]);

  const effectiveQty = useMemo(() => {
    if (scType === 'ESCO') {
      return parseNum(scHoursWorked) || parseNum(scQty);
    }
    return parseNum(scQty);
  }, [scType, scHoursWorked, scQty]);

  const defaultScRate = scType === 'ESCO' ? 2200 : 1500;
  const effectiveScRate = useMemo(() => {
    const parsed = parseNum(scRate, defaultScRate);
    return parsed > 0 ? parsed : defaultScRate;
  }, [scRate, defaultScRate]);

  const scPreview = useMemo(
    () => calculateSoilCoalBill(effectiveQty, effectiveScRate, parseNum(scPaid)),
    [effectiveQty, effectiveScRate, scPaid]
  );

  const soilCoalSummary = useMemo(
    () => computeSoilCoalSummary(state.soilCoalRecords || []),
    [state.soilCoalRecords]
  );

  const filteredSoilCoalRecords = useMemo(() => {
    const list = state.soilCoalRecords || [];
    return list.filter((r) => {
      if (scFilterType !== 'ALL' && r.itemType !== scFilterType) return false;
      if (scSearch.trim()) {
        const q = scSearch.trim().toLowerCase();
        return (
          r.supplierName.toLowerCase().includes(q) ||
          (r.specification || '').toLowerCase().includes(q) ||
          (r.vehicleOrChallan || '').toLowerCase().includes(q) ||
          (r.workSite || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.soilCoalRecords, scFilterType, scSearch]);

  const handleSoilCoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedSupplier =
      scSupplierName.trim() ||
      (scType === 'ESCO'
        ? 'এসকোভেটর / ভেকু মালিক'
        : 'মাটি ব্যাপারী / জমির মালিক');
    if (scPreview.totalBill <= 0 && scPreview.paidAmount <= 0 && effectiveQty <= 0) {
      setErrorBn('অনুগ্রহ করে কাজের ঘণ্টা/পরিমাণ ও দর অথবা নগদ জমার পরিমাণ দিন।');
      return;
    }
    setSubmitting(true);
    try {
      const q = effectiveQty;
      await onSaveSoilCoal({
        date: scDate,
        itemType: scType,
        supplierName: resolvedSupplier,
        supplierPhone: scSupplierPhone.trim(),
        specification: scSpec.trim(),
        vehicleOrChallan: scVehicle.trim(),
        quantity: q,
        unit: scType === 'ESCO' ? 'ঘণ্টা' : scUnit,
        ratePerUnit: effectiveScRate,
        paidAmount: parseNum(scPaid),
        hoursWorked: scType === 'ESCO' ? q : undefined,
        hoursDateBreakdown: scType === 'ESCO' ? scHoursDateBreakdown.trim() : undefined,
        workSite: scWorkSite.trim() || undefined,
        paymentMethod: scPaymentMethod,
        note: scNote.trim(),
      });
      setScQty('');
      setScHoursWorked('');
      setScHoursDateBreakdown('');
      setScWorkSite('');
      setScPaid('');
      setScVehicle('');
      setScNote('');
      showSuccess(
        `${
          scType === 'ESCO'
            ? 'এসকো বিল'
            : scType === 'COAL'
            ? 'কয়লা'
            : 'মাটি ক্রয়'
        } (${resolvedSupplier}) সফলভাবে সংরক্ষিত হয়েছে!`
      );
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // 2. সর্দার ও মিস্ত্রি দাদন (অগ্রিম) সমন্বয় খাতা (Dadon Reconciliation) State
  // ============================================================================
  const [dadonDate, setDadonDate] = useState(todayDate);
  const [dadonName, setDadonName] = useState('');
  const [dadonPhone, setDadonPhone] = useState('');
  const [dadonRole, setDadonRole] = useState<DadonRoleCategory>('মিল সর্দার');
  const [dadonAdvance, setDadonAdvance] = useState('');
  const [dadonManualBill, setDadonManualBill] = useState('');
  const [dadonReturned, setDadonReturned] = useState('');
  const [dadonNote, setDadonNote] = useState('');

  // সিজন সমাপনী চূড়ান্ত হিসাব ও রেট নির্ধারণ ক্যালকুলেটর স্টেট
  const [selectedSettlementSardarKey, setSelectedSettlementSardarKey] = useState<string>('');
  const [seasonSettlementRatePerThousand, setSeasonSettlementRatePerThousand] = useState<string>('650');
  const [customSettlementBricks, setCustomSettlementBricks] = useState<string>('');

  const dadonSummary = useMemo(
    () => computeDadonReconciliationSummary(state),
    [
      state.dadonRecords,
      state.millPots,
      state.chulliLoads,
      state.poraiMistriRecords,
      state.chulliUnloads,
      state.productionPayments,
    ]
  );

  const handleDadonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedRecipient = dadonName.trim() || dadonRole;
    const adv = parseNum(dadonAdvance);
    const manBill = parseNum(dadonManualBill);
    const ret = parseNum(dadonReturned);
    if (adv <= 0 && manBill <= 0 && ret <= 0) {
      setErrorBn('দাদন টাকা, কাজের বিল অথবা সমন্বয় টাকার পরিমাণ দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await onSaveDadon({
        date: dadonDate,
        recipientName: resolvedRecipient,
        recipientPhone: dadonPhone.trim(),
        roleCategory: dadonRole,
        advanceAmount: adv,
        manualWorkBill: manBill,
        cashReturnedOrSettled: ret,
        note: dadonNote.trim(),
      });
      setDadonAdvance('');
      setDadonManualBill('');
      setDadonReturned('');
      setDadonNote('');
      showSuccess(`সর্দার/মিস্ত্রি (${resolvedRecipient}) এর দাদন ও কাজের বিল সমন্বয় সেভ হয়েছে!`);
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // 3. অগ্রিম ইট বুকিং ও কাস্টমার পার্টি খতিয়ান (Advance Booking & Party Statement)
  // ============================================================================
  const defaultGrade: BrickGrade = state.brickGrades[0] || {
    id: 'grade-1',
    code: 'BF-1',
    nameBn: '১ নং ইট',
    nameEn: '1 No Brick',
    ratePerUnit: 11000,
    ratePerThousand: true,
    currentStock: 0,
    seasonProduced: 0,
  };
  const [bkDate, setBkDate] = useState(todayDate);
  const [bkTargetDate, setBkTargetDate] = useState(todayDate);
  const [bkCustomerName, setBkCustomerName] = useState('');
  const [bkCustomerPhone, setBkCustomerPhone] = useState('');
  const [bkCustomerAddress, setBkCustomerAddress] = useState('');
  const [bkGradeId, setBkGradeId] = useState(defaultGrade.id);
  const [bkQty, setBkQty] = useState('');
  const [bkRate, setBkRate] = useState(String(defaultGrade.ratePerUnit || 11000));
  const [bkAdvance, setBkAdvance] = useState('');
  const [bkDelivered, setBkDelivered] = useState('0');
  const [bkNote, setBkNote] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [selectedPartyForPrint, setSelectedPartyForPrint] =
    useState<CustomerPartyStatementRow | null>(null);
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [bookingActionDeliverQty, setBookingActionDeliverQty] = useState('');
  const [bookingActionPayAmt, setBookingActionPayAmt] = useState('');

  const bkPreview = useMemo(
    () =>
      calculateAdvanceBookingBill(
        parseNum(bkQty),
        parseNum(bkRate, 11000) || 11000,
        parseNum(bkAdvance),
        parseNum(bkDelivered)
      ),
    [bkQty, bkRate, bkAdvance, bkDelivered]
  );

  const partyStatementSummary = useMemo(
    () =>
      computeCustomerPartyStatements(
        state.salesMemos || [],
        state.advanceBookings || []
      ),
    [state.salesMemos, state.advanceBookings]
  );

  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return partyStatementSummary.parties;
    const q = partySearch.trim().toLowerCase();
    return partyStatementSummary.parties.filter(
      (p) =>
        p.customerName.toLowerCase().includes(q) ||
        p.customerPhone.toLowerCase().includes(q) ||
        p.customerAddress.toLowerCase().includes(q)
    );
  }, [partyStatementSummary.parties, partySearch]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCustomer = bkCustomerName.trim() || 'অগ্রিম বুকিং ক্রেতা';
    const qtyNum = parseNum(bkQty);
    const advNum = parseNum(bkAdvance);
    if (qtyNum <= 0 && advNum <= 0) {
      setErrorBn('বুকিংকৃত ইটের পরিমাণ অথবা অগ্রিম জমার টাকা দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await onSaveAdvanceBooking({
        date: bkDate,
        deliveryTargetDate: bkTargetDate,
        customerName: resolvedCustomer,
        customerPhone: bkCustomerPhone.trim(),
        customerAddress: bkCustomerAddress.trim(),
        gradeId: bkGradeId,
        bookedQuantity: qtyNum,
        ratePerThousand: parseNum(bkRate, 11000) || 11000,
        advancePaid: advNum,
        deliveredQuantity: parseNum(bkDelivered),
        note: bkNote.trim(),
      });
      setBkCustomerName('');
      setBkCustomerPhone('');
      setBkCustomerAddress('');
      setBkQty('');
      setBkAdvance('');
      setBkDelivered('0');
      setBkNote('');
      showSuccess('নতুন অগ্রিম ইট বুকিং সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'বুকিং সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookingQuickUpdate = async (bookingId: string) => {
    const addDeliv = parseNum(bookingActionDeliverQty);
    const addPay = parseNum(bookingActionPayAmt);
    if (addDeliv <= 0 && addPay <= 0) {
      setErrorBn('ডেলিভারি ইটের সংখ্যা অথবা জমার টাকার পরিমাণ দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await onUpdateAdvanceBooking(bookingId, {
        addedDeliveredQuantity: addDeliv,
        addedPaymentAmount: addPay,
      });
      setBookingActionId(null);
      setBookingActionDeliverQty('');
      setBookingActionPayAmt('');
      showSuccess('বুকিং ডেলিভারি ও জমার হিসাব আপডেট হয়েছে!');
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // 4. নিজস্ব ট্রাক, ট্রলি ও ভেকু হিসাব (Vehicle, Veku & Diesel Tracker) State
  // ============================================================================
  const [vdDate, setVdDate] = useState(todayDate);
  const [vdName, setVdName] = useState('ভেকু-০১');
  const [vdType, setVdType] = useState<KilnVehicleType>('ভেকু (Excavator)');
  const [vdDriver, setVdDriver] = useState('');
  const [vdWork, setVdWork] = useState('');
  const [vdLiters, setVdLiters] = useState('');
  const [vdRate, setVdRate] = useState('110');
  const [vdAllowance, setVdAllowance] = useState('');
  const [vdMaint, setVdMaint] = useState('');
  const [vdNote, setVdNote] = useState('');

  const vdPreview = useMemo(
    () =>
      calculateVehicleDieselExpense(
        parseNum(vdLiters),
        parseNum(vdRate, 110) || 110,
        parseNum(vdAllowance),
        parseNum(vdMaint)
      ),
    [vdLiters, vdRate, vdAllowance, vdMaint]
  );

  const vdSummary = useMemo(
    () => computeVehicleDieselSummary(state.vehicleDieselRecords || []),
    [state.vehicleDieselRecords]
  );

  const handleVehicleDieselSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedVehicle = vdName.trim() || 'ভেকু-০১';
    if (vdPreview.totalExpense <= 0 && vdPreview.dieselLiters <= 0) {
      setErrorBn('অনুগ্রহ করে ডিজেল (লিটার) অথবা খরচের পরিমাণ দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await onSaveVehicleDiesel({
        date: vdDate,
        vehicleName: resolvedVehicle,
        vehicleType: vdType,
        driverName: vdDriver.trim(),
        workOrTripSummary: vdWork.trim() || 'দৈনিক মাটি কাটা / ইট পরিবহন',
        dieselLiters: parseNum(vdLiters),
        dieselRate: parseNum(vdRate, 110) || 110,
        driverAllowance: parseNum(vdAllowance),
        maintenanceCost: parseNum(vdMaint),
        paidAmount: vdPreview.totalExpense,
        note: vdNote.trim(),
      });
      setVdWork('');
      setVdLiters('');
      setVdAllowance('');
      setVdMaint('');
      setVdNote('');
      showSuccess(`${resolvedVehicle}-এর ডিজেল ও খরচের হিসাব ক্যাশবুকে যুক্ত হয়েছে!`);
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // 5. ভাটার লাইসেন্স, ভ্যাট ও সরকারি কিস্তি ট্র্যাকার (Compliance & Installment)
  // ============================================================================
  const [compTitle, setCompTitle] = useState('');
  const [compCategory, setCompCategory] = useState<ComplianceCategory>(
    'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)'
  );
  const [compAuthority, setCompAuthority] = useState('পরিবেশ অধিদপ্তর, সাতক্ষীরা');
  const [compRefNo, setCompRefNo] = useState('');
  const [compDueDate, setCompDueDate] = useState(todayDate);
  const [compPayable, setCompPayable] = useState('');
  const [compPaid, setCompPaid] = useState('');
  const [compNote, setCompNote] = useState('');
  const [compPayModalId, setCompPayModalId] = useState<string | null>(null);
  const [compAddedPayAmt, setCompAddedPayAmt] = useState('');

  const compPreview = useMemo(
    () => calculateComplianceItemBill(parseNum(compPayable), parseNum(compPaid)),
    [compPayable, compPaid]
  );

  const compSummary = useMemo(
    () => computeComplianceSummary(state.complianceRecords || [], todayDate),
    [state.complianceRecords, todayDate]
  );

  const handleComplianceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTitle = compTitle.trim() || compCategory;
    const payableNum = parseNum(compPayable);
    const paidNum = parseNum(compPaid);
    if (payableNum <= 0 && paidNum <= 0) {
      setErrorBn('মোট ধার্য টাকা অথবা পরিশোধিত টাকার পরিমাণ দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await onSaveCompliance({
        titleBn: resolvedTitle,
        category: compCategory,
        authorityOrBankName: compAuthority.trim(),
        referenceNo: compRefNo.trim(),
        dueDate: compDueDate,
        totalPayable: payableNum > 0 ? payableNum : paidNum,
        paidAmount: paidNum,
        note: compNote.trim(),
      });
      setCompTitle('');
      setCompRefNo('');
      setCompPayable('');
      setCompPaid('');
      setCompNote('');
      showSuccess('লাইসেন্স / ভ্যাট / ব্যাংক কিস্তির রেকর্ড সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplianceInstallmentPay = async (id: string) => {
    const amt = parseNum(compAddedPayAmt);
    if (amt <= 0) {
      setErrorBn('পরিশোধের টাকার পরিমাণ ০-এর বেশি হতে হবে।');
      return;
    }
    setSubmitting(true);
    try {
      await onUpdateCompliance(id, { addedPaymentAmount: amt });
      setCompPayModalId(null);
      setCompAddedPayAmt('');
      showSuccess('কিস্তি / সরকারি ফি পরিশোধ ক্যাশবুকে যুক্ত হয়েছে!');
    } catch (err) {
      setErrorBn(err instanceof Error ? err.message : 'পরিশোধ আপডেটে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionTabs: Array<{
    id: AdvancedLedgerSection;
    labelBn: string;
    subBn: string;
    icon: React.ReactNode;
    badgeCount: number;
  }> = [
    {
      id: 'mati_koyla',
      labelBn: '১. মাটি ও এসকো বিল',
      subBn: 'মাটি ক্রয় ও এসকো বিল',
      icon: <Layers className="w-4 h-4" />,
      badgeCount: (state.soilCoalRecords || []).length,
    },
    {
      id: 'dadon_khata',
      labelBn: '২. সর্দার ও মিস্ত্রি দাদন খাতা',
      subBn: 'অগ্রিম ও কাজের বিল সমন্বয়',
      icon: <Users className="w-4 h-4" />,
      badgeCount: dadonSummary.sardarsCount,
    },
    {
      id: 'booking_party',
      labelBn: '৩. অগ্রিম বুকিং ও পার্টি খতিয়ান',
      subBn: 'বুকিং ও ক্রেতাওয়ারী স্টেটমেন্ট',
      icon: <BookmarkCheck className="w-4 h-4" />,
      badgeCount: (state.advanceBookings || []).length + (state.salesMemos || []).length,
    },
    {
      id: 'veku_truck',
      labelBn: '৪. ট্রাক, ট্রলি ও ভেকু হিসাব',
      subBn: 'ডিজেল, ড্রাইভার ও মেরামত',
      icon: <Truck className="w-4 h-4" />,
      badgeCount: (state.vehicleDieselRecords || []).length,
    },
    {
      id: 'license_kisti',
      labelBn: '৫. লাইসেন্স, ভ্যাট ও কিস্তি',
      subBn: 'সরকারি ছাড়পত্র ও ব্যাংক লোন',
      icon: <ShieldCheck className="w-4 h-4" />,
      badgeCount: (state.complianceRecords || []).length,
    },
  ];

  return (
    <div className="space-y-6 pb-12" data-testid="kiln-advanced-ledgers-tab">
      {/* Dedicated Single-Purpose Header for the Active Ledger */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {activeSection === 'mati_koyla' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <Layers className="w-3.5 h-3.5" />
                মাটি ও এসকো বিল · মাটি ক্রয় ও এসকোভেটর/ভেকু কাজের খতিয়ান
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                মাটি ও এসকো বিল (মোট রেকর্ড: {formatBn((state.soilCoalRecords || []).length)}টি)
              </h2>
            </>
          )}
          {activeSection === 'dadon_khata' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <Users className="w-3.5 h-3.5" />
                দাদন সমন্বয় খাতা · অগ্রিম ও কাজের বিল
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                সর্দার ও মিস্ত্রি দাদন খাতা ({formatBn(dadonSummary.sardarsCount)} জন সর্দার)
              </h2>
            </>
          )}
          {activeSection === 'booking_party' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <BookmarkCheck className="w-3.5 h-3.5" />
                অগ্রিম ইট বুকিং ও পার্টি লেজার
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                অগ্রিম বুকিং ও পার্টি খতিয়ান ({formatBn((state.advanceBookings || []).length)}টি সক্রিয় বুকিং)
              </h2>
            </>
          )}
          {activeSection === 'veku_truck' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <Truck className="w-3.5 h-3.5" />
                ভেকু, ট্রাক ও ট্রলি হিসাব · ডিজেল ও মেরামত ট্র্যাকার
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                নিজস্ব ট্রাক, ট্রলি ও ভেকু হিসাব ({formatBn((state.vehicleDieselRecords || []).length)}টি এন্ট্রি)
              </h2>
            </>
          )}
          {activeSection === 'license_kisti' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                লাইসেন্স, পরিবেশ ভ্যাট ও ব্যাংক লোন কিস্তি
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                সরকারি ছাড়পত্র, ভ্যাট ও কিস্তি ট্র্যাকার ({formatBn((state.complianceRecords || []).length)}টি কিস্তি)
              </h2>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-orange-400" />
            এই খাতা প্রিন্ট করুন
          </button>
        </div>
      </div>

      {/* Feedback & Error Toast */}
      {feedbackBn && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedbackBn}</span>
        </div>
      )}
      {errorBn && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorBn}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBn(null)}
            className="text-xs underline cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* ==========================================================================
          MODULE 1: মাটি ও এসকো বিল (মাটি ক্রয় ও এসকোভেটর/ভেকু বিল)
         ========================================================================== */}
      {activeSection === 'mati_koyla' && (
        <div className="space-y-6" data-testid="module-mati-esco">
          {/* Sub-tab Navigation (Mobile Friendly) */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setSoilEscoSubTab('SOIL');
                setScType('SOIL');
              }}
              className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                soilEscoSubTab === 'SOIL'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              🌱 ১. মাটি ক্রয় ও গাড়ি খতিয়ান
            </button>
            <button
              type="button"
              onClick={() => {
                setSoilEscoSubTab('ESCO');
                setScType('ESCO');
              }}
              className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                soilEscoSubTab === 'ESCO'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              🚜 ২. এসকো বিল (ভেকু ঘণ্টা)
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-sky-200 border-t-4 border-t-sky-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">
                মোট এসকো বিল ({formatBn(soilCoalSummary.escoCount || 0)}টি কাজ)
              </div>
              <div className="text-2xl font-black text-sky-700 mt-1 tabular-nums">
                {formatCurrencyBn(soilCoalSummary.escoTotalBill || 0)}
              </div>
              <div className="text-xs text-slate-600 mt-1 font-semibold">
                কাজের সময়: <strong className="text-slate-900">{formatBn(soilCoalSummary.escoTotalHours || 0)} ঘণ্টা</strong> · পরিশোধ: {formatCurrencyBn(soilCoalSummary.escoTotalPaid || 0)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 border-t-4 border-t-amber-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">
                মোট মাটি ক্রয় বিল ({formatBn(soilCoalSummary.soilCount || 0)} চালান)
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatCurrencyBn(soilCoalSummary.soilTotalBill || 0)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                পরিশোধ: {formatCurrencyBn(soilCoalSummary.soilTotalPaid || 0)} · বাকি:{' '}
                <span className="font-bold text-rose-600">
                  {formatCurrencyBn(soilCoalSummary.soilTotalDue || 0)}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 border-t-4 border-t-emerald-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">সর্বমোট নগদ পরিশোধ (এসকো ও মাটি)</div>
              <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
                {formatCurrencyBn(soilCoalSummary.grandTotalPaid)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                মোট বিল: {formatCurrencyBn(soilCoalSummary.grandTotalBill)} (ক্যাশবুকে সমন্বিত)
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 border-t-4 border-t-rose-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">এসকো ও মাটি ব্যাপারীদের বাকি পাওনা</div>
              <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
                {formatCurrencyBn(soilCoalSummary.grandTotalDue)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                মোট পার্টি: {formatBn(soilCoalSummary.suppliers.length)} জন
              </div>
            </div>
          </div>

          {/* Entry Form */}
          <form
            onSubmit={handleSoilCoalSubmit}
            className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-orange-600 p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" />
                  {scType === 'ESCO'
                    ? 'নতুন এসকো বিল এন্ট্রি (কাজের ঘণ্টা, রেট ও বিল)'
                    : scType === 'SOIL'
                    ? 'নতুন মাটি ক্রয় এন্ট্রি (ব্যাপারী, গাড়ি ও দর)'
                    : 'নতুন কয়লা সরবরাহ ও পেমেন্ট এন্ট্রি'}
                </h3>
                <p className="text-xs text-slate-500">
                  {scType === 'ESCO'
                    ? 'এসকো/ভেকু দিয়ে কয় ঘণ্টা কাজ করালেন (আজ কত ঘণ্টা, কাল কত ঘণ্টা), প্রতি ঘণ্টা দর ও তাকে কত টাকা দিলেন তা লিখুন।'
                    : 'মাটি কার কাছ থেকে কতটা কিনলেন, কত টাকার মাটি হলো এবং তাকে কত টাকা দিলেন তার হিসাব লিখুন।'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScType('ESCO')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                    scType === 'ESCO'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🚜 এসকো বিল (Esco Bill)
                </button>
                <button
                  type="button"
                  onClick={() => setScType('SOIL')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
                    scType === 'SOIL'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌱 মাটি ক্রয় (Soil Purchase)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={scDate}
                  onChange={(e) => setScDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {scType === 'ESCO'
                    ? 'এসকো / ড্রাইভার / মালিকের নাম *'
                    : scType === 'SOIL'
                    ? 'কার কাছ থেকে মাটি নিলাম (মালিক/ব্যাপারী) *'
                    : 'সাপ্লায়ার / ব্যাপারীর নাম *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    scType === 'ESCO'
                      ? 'যেমন: জলিল এসকোভেটর / আলিম ড্রাইভার'
                      : scType === 'SOIL'
                      ? 'যেমন: হাজী মোজাম্মেল হক / করিম ব্যাপারী'
                      : 'যেমন: সাতক্ষীরা কোল ট্রেডার্স'
                  }
                  value={scSupplierName}
                  onChange={(e) => setScSupplierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="text"
                  placeholder="০১৭..."
                  value={scSupplierPhone}
                  onChange={(e) => setScSupplierPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {scType === 'ESCO' ? 'কাজের সাইট ও বিবরণ' : 'মাটির ধরণ / জমির দাগ নং'}
                </label>
                <input
                  type="text"
                  value={scSpec}
                  onChange={(e) => setScSpec(e.target.value)}
                  placeholder={
                    scType === 'ESCO'
                      ? 'যেমন: নতুন খামারে মাটি কাটা / ভাটার মাঠ সমান'
                      : 'যেমন: এঁটেল মাটি, বাবুলিয়া দাগ নং ৪১২'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              {scType === 'ESCO' ? (
                <>
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-sky-950 mb-1">
                      ঘণ্টা ট্র্যাকার (আজ কত ঘণ্টা, কাল কত ঘণ্টা কাজের বিবরণ)
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: আজ ৫ ঘণ্টা, কাল ৪.৫ ঘণ্টা"
                      value={scHoursDateBreakdown}
                      onChange={(e) => setScHoursDateBreakdown(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-sky-50/40 text-slate-900 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-sky-950 mb-1">
                      মোট কাজের ঘণ্টা (Hours) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0.1}
                      required
                      placeholder="যেমন: ৯.৫"
                      value={scHoursWorked}
                      onChange={(e) => setScHoursWorked(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white text-slate-900 text-sm font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-sky-950 mb-1">
                      প্রতি ঘণ্টা রেট / দর (৳/ঘণ্টা) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={1}
                      required
                      placeholder="যেমন: ১২০০"
                      value={scRate}
                      onChange={(e) => setScRate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-white text-slate-900 text-sm font-black"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      কতটা মাটি নিলাম (পরিমাণ) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0.1}
                      required
                      placeholder="যেমন: ১০"
                      value={scQty}
                      onChange={(e) => setScQty(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      একক (Unit)
                    </label>
                    <select
                      value={scUnit}
                      onChange={(e) => setScUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                    >
                      <option value="গাড়ি (ট্রাক/ট্রলি)">গাড়ি (ট্রাক/ট্রলি)</option>
                      <option value="সিএফটি (CFT)">সিএফটি (CFT)</option>
                      <option value="ফুট">ফুট (Foot)</option>
                      <option value="টন">টন (Ton)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      দর / রেট (৳ প্রতি গাড়ি/একক) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={1}
                      required
                      placeholder={scType === 'COAL' ? 'যেমন: ২২০০০' : 'যেমন: ৭৫০'}
                      value={scRate}
                      onChange={(e) => setScRate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      গাড়ি / ট্রাক / চালান নং
                    </label>
                    <input
                      type="text"
                      placeholder="ঢাকা মেট্রো-..."
                      value={scVehicle}
                      onChange={(e) => setScVehicle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  তাকে কত টাকা দিলাম (নগদ পরিশোধ ৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ৫০০০"
                  value={scPaid}
                  onChange={(e) => setScPaid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-400 bg-emerald-50/50 text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={scPaymentMethod}
                  onChange={(e) => setScPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                >
                  <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  <option value="ব্যাংক">ব্যাংক চেক / ট্রান্সফার</option>
                  <option value="বিকাশ">বিকাশ</option>
                  <option value="নগদ">নগদ (Nagad)</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নোট / মন্তব্য
                </label>
                <input
                  type="text"
                  placeholder="যেমন: বাকি টাকা আগামী সপ্তাহে প্রদান করা হবে"
                  value={scNote}
                  onChange={(e) => setScNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-bold text-slate-700">
                  মোট {scType === 'ESCO' ? 'এসকো বিল' : 'মাটি বিল'}:{' '}
                  <strong className="text-sm text-slate-900 font-mono">
                    {formatCurrencyBn(scPreview.totalBill)}
                  </strong>
                </span>
                <span className="font-bold text-emerald-700">
                  তাকে দিলাম (পরিশোধ):{' '}
                  <strong className="font-mono">{formatCurrencyBn(scPreview.paidAmount)}</strong>
                </span>
                <span className={`font-bold ${scPreview.paidAmount > scPreview.totalBill ? 'text-amber-700' : 'text-rose-600'}`}>
                  {scPreview.paidAmount > scPreview.totalBill ? 'দিনায় যাবে (অগ্রিম): ' : 'সে পাবে কত (বাকি): '}
                  <strong className="font-mono">
                    {scPreview.paidAmount > scPreview.totalBill
                      ? `দিনা ${formatCurrencyBn(scPreview.paidAmount - scPreview.totalBill)}`
                      : formatCurrencyBn(scPreview.dueAmount)}
                  </strong>
                </span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                {scType === 'ESCO'
                  ? '+ এসকো বিল সংরক্ষণ করুন'
                  : '+ মাটি ক্রয় খতিয়ানে সেভ করুন'}
              </button>
            </div>
          </form>

          {/* Supplier Party Cards */}
          {soilCoalSummary.suppliers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h4 className="text-sm font-black text-slate-900 mb-3">
                এসকো ও মাটি পার্টি খতিয়ান ({formatBn(soilCoalSummary.suppliers.length)} জন)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {soilCoalSummary.suppliers.map((sup) => (
                  <div
                    key={sup.supplierKey}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-slate-900">
                          {sup.supplierName}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          মোট এন্ট্রি: {formatBn(sup.records.length)}টি
                        </span>
                      </div>
                      {sup.supplierPhone && (
                        <div className="text-xs text-slate-500 mt-0.5">{sup.supplierPhone}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                      <div>
                        <div className="text-slate-500">মোট বিল</div>
                        <div className="font-black text-slate-900 font-mono">
                          {formatCurrencyBn(sup.totalBill)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">মোট পরিশোধ</div>
                        <div className="font-black text-emerald-700 font-mono">
                          {formatCurrencyBn(sup.totalPaid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">সে পাবে (বাকি)</div>
                        <div className="font-black text-rose-600 font-mono">
                          {formatCurrencyBn(sup.totalDue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                {(['ALL', 'ESCO', 'SOIL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setScFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      scFilterType === t
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'ALL'
                      ? 'সব এন্ট্রি'
                      : t === 'ESCO'
                      ? '🚜 শুধু এসকো বিল'
                      : '🌱 শুধু মাটি ক্রয়'}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="এসকো, মাটি বা ড্রাইভার খুঁজুন..."
                  value={scSearch}
                  onChange={(e) => setScSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">তারিখ</th>
                    <th className="py-2.5 px-2 font-bold">ধরন</th>
                    <th className="py-2.5 px-2 font-bold">এসকো / ব্যাপারী</th>
                    <th className="py-2.5 px-2 font-bold">সাইট ও বিবরণ / ঘণ্টা ট্র্যাকার</th>
                    <th className="py-2.5 px-2 text-right font-bold">কাজের পরিমাণ ও দর</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট বিল</th>
                    <th className="py-2.5 px-2 text-right font-bold">তাকে দিলাম</th>
                    <th className="py-2.5 px-2 text-right font-bold">সে পাবে কত</th>
                    <th className="py-2.5 px-2 text-center font-bold">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSoilCoalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        মাটি ও এসকো বিলে এখনো কোনো এন্ট্রি নেই। উপরে ফর্ম পূরণ করে যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredSoilCoalRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-orange-50/40">
                        <td className="py-2.5 px-2 font-medium text-slate-800">{r.date}</td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              r.itemType === 'ESCO'
                                ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {r.itemType === 'ESCO' ? '🚜 এসকো বিল' : '🌱 মাটি ক্রয়'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-slate-900">
                          {r.supplierName}
                          {r.supplierPhone && (
                            <div className="text-[11px] text-slate-500 font-normal">
                              {r.supplierPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-slate-700">
                          <div>{r.specification}</div>
                          {r.hoursDateBreakdown && (
                            <div className="text-[11px] font-bold text-sky-700">
                              🕒 {r.hoursDateBreakdown}
                            </div>
                          )}
                          {r.workSite && (
                            <div className="text-[11px] text-slate-500">
                              📍 {r.workSite}
                            </div>
                          )}
                          {r.vehicleOrChallan && (
                            <div className="text-[11px] text-slate-500">
                              গাড়ি নং: {r.vehicleOrChallan}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700 font-mono">
                          {formatBn(r.quantity)} {r.unit} × {formatCurrencyBn(r.ratePerUnit)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-900 font-mono">
                          {formatCurrencyBn(r.totalBill)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700 font-mono">
                          {formatCurrencyBn(r.paidAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold font-mono">
                          {r.paidAmount > r.totalBill ? (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                              দিনা {formatCurrencyBn(r.paidAmount - r.totalBill)}
                            </span>
                          ) : (
                            <span className="text-rose-600">{formatCurrencyBn(r.dueAmount)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteSoilCoal(r.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
    </div>
  )}

      {/* ==========================================================================
          MODULE 2: সর্দার ও মিস্ত্রি দাদন (অগ্রিম) সমন্বয় খাতা (Dadon Reconciliation)
         ========================================================================== */}
      {activeSection === 'dadon_khata' && (
        <div className="space-y-6" data-testid="module-dadon-khata">
          {/* Dadon Business Rule Policy Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-black text-xl shadow-xs">
                🔒
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-sm sm:text-base text-amber-950">
                    ভাটার নিয়ম: সর্দারদের দাদনের টাকা পুরো সিজন অক্ষত থাকবে (এখন কোনো কর্তন হবে না)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold text-[11px]">
                    অক্ষত সিজনাল দাদন
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
                  সরদারদের প্রদত্ত দাদন এককালীন সিজনাল অগ্রিম হিসেবে স্থির থাকে। প্রতি সপ্তাহে তারা যে খোরাকি বা বিল নেয় তা নিয়মিত পরিশোধ হিসাবে জমা থাকে। পুরো সিজন শেষে মোট কাঁচা ইট উৎপাদন/বহনের ওপর মালিক নির্ধারিত <strong>চূড়ান্ত রেট (৳/হাজার)</strong> বসিয়ে, মোট আয় থেকে দাদন ও সাপ্তাহিক খোরাকি একবারে বিয়োগ করে চূড়ান্ত হিসাব ও বকেয়া নিষ্পত্তি করা হয়।
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-amber-300 border-t-4 border-t-amber-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট প্রদত্ত স্থায়ী সিজনাল দাদন</div>
              <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatCurrencyBn(dadonSummary.totalDadonGiven)}
              </div>
              <div className="text-xs font-bold text-amber-800/80 mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                স্থায়ী অগ্রিম অক্ষত রয়েছে ({formatBn(dadonSummary.sardarsCount)} জন সর্দার)
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 border-t-4 border-t-blue-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">সিজনে মোট কাঁচা ইট উৎপাদন / বহন</div>
              <div className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
                {formatBn(dadonSummary.totalBricksHandled)} টি
              </div>
              <div className="text-xs text-slate-500 mt-1">
                মিল পট, ভ্যান লোড, পোড়াই ও আনলোড সম্মিলিত
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 border-t-4 border-t-indigo-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">চলতি সিজনে সাপ্তাহিক খোরাকি উত্তোলন</div>
              <div className="text-2xl font-black text-indigo-700 mt-1 tabular-nums">
                {formatCurrencyBn(dadonSummary.totalWeeklyPaymentsTaken || dadonSummary.totalWorkBillEarned)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                সপ্তাহে সপ্তাহে নিয়মিত রানিং পরিশোধ
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 border-t-4 border-t-emerald-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">সিজন সমাপনী নিষ্পত্তি নিয়ম</div>
              <div className="text-lg font-black text-emerald-700 mt-1 leading-snug">
                সিজন শেষে রেট নির্ধারণ
              </div>
              <div className="text-xs text-emerald-800 font-semibold mt-1">
                মোট ইট × রেট – (দাদন + খোরাকি)
              </div>
            </div>
          </div>

          {/* Entry Form */}
          <form
            onSubmit={handleDadonSubmit}
            className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-orange-600 p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                সর্দার ও মিস্ত্রি স্থায়ী সিজনাল দাদন প্রদান ও খোরাকি এন্ট্রি
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                মিল সর্দার, ভ্যান সর্দার, পোড়াই মিস্ত্রি বা আনলোড সর্দারকে সিজনের দাদন দিন। এই দাদনের টাকা সিজনজুড়ে অক্ষত থাকবে এবং সিজন সমাপনীতে রেট নির্ধারণ সাপেক্ষে চূড়ান্ত হিসাব হবে।
              </p>
            </div>

            {/* Quick Select Sardars */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1">দ্রুত নির্বাচন:</span>
              {[
                { name: 'ওহাব মিল সর্দার', role: 'মিল সর্দার' as DadonRoleCategory },
                { name: 'মফিজুল মিল সর্দার', role: 'মিল সর্দার' as DadonRoleCategory },
                { name: 'শফিকুল মিল সর্দার', role: 'মিল সর্দার' as DadonRoleCategory },
                { name: 'সেলিম সর্দার', role: 'ভ্যান সর্দার' as DadonRoleCategory },
                { name: 'আলী হোসেন (পোড়াই মিস্ত্রি)', role: 'পোড়াই মিস্ত্রি' as DadonRoleCategory },
                { name: 'আব্দুর রহিম সর্দার', role: 'আনলোড সর্দার' as DadonRoleCategory },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setDadonName(preset.name);
                    setDadonRole(preset.role);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-xs font-bold text-slate-800 cursor-pointer transition"
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={dadonDate}
                  onChange={(e) => setDadonDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সর্দার / মিস্ত্রির নাম *
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ওহাব মিল সর্দার"
                  value={dadonName}
                  onChange={(e) => setDadonName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সর্দারের ক্যাটাগরি
                </label>
                <select
                  value={dadonRole}
                  onChange={(e) => setDadonRole(e.target.value as DadonRoleCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                >
                  <option value="মিল সর্দার">মিল সর্দার (কাঁচা ইট কাটা)</option>
                  <option value="ভ্যান সর্দার">ভ্যান সর্দার (চুল্লি লোড)</option>
                  <option value="পোড়াই মিস্ত্রি">পোড়াই মিস্ত্রি (আগুন মিস্ত্রি)</option>
                  <option value="আনলোড সর্দার">আনলোড / নিকল সর্দার</option>
                  <option value="লেবার সর্দার">লেবার সর্দার (শ্রমিক)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1">
                  স্থায়ী সিজনাল দাদন টাকা (৳, অক্ষত থাকবে)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ৫০০০০"
                  value={dadonAdvance}
                  onChange={(e) => setDadonAdvance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-400 bg-amber-50/50 text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-800 mb-1">
                  সাপ্তাহিক খোরাকি / নগদ বিল (৳, ঐচ্ছিক)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ৫০০০"
                  value={dadonManualBill}
                  onChange={(e) => setDadonManualBill(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোবাইল নং / চুক্তি নোট
                </label>
                <input
                  type="text"
                  placeholder="চুক্তির বিবরণ বা মোবাইল নং"
                  value={dadonNote}
                  onChange={(e) => setDadonNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                + স্থায়ী সিজনাল দাদন খাতায় সেভ করুন
              </button>
            </div>
          </form>

          {/* Interactive Season-End Settlement Calculator */}
          {dadonSummary.sardars.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-700/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                    🧮
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-amber-300">
                      সিজন সমাপনী চূড়ান্ত হিসাব ও রেট নির্ধারণ ক্যালকুলেটর
                    </h3>
                    <p className="text-xs text-slate-300">
                      সিজন শেষে মোট কাটা ইটের ওপর ফাইনাল রেট বসিয়ে দাদন ও খোরাকি বাদ দিয়ে চূড়ান্ত নিষ্পত্তি দেখুন
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-900/80 border border-indigo-400/40 text-[11px] font-bold text-indigo-200">
                  <span>সিজন সমাপনী মডিউল</span>
                </div>
              </div>

              {/* Sardar Quick Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 block">
                  হিসাবের জন্য সর্দার নির্বাচন করুন:
                </label>
                <div className="flex flex-wrap gap-2">
                  {dadonSummary.sardars.map((s) => {
                    const isSelected = (selectedSettlementSardarKey || dadonSummary.sardars[0]?.key) === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setSelectedSettlementSardarKey(s.key);
                          setCustomSettlementBricks(s.totalBricksHandled > 0 ? String(s.totalBricksHandled) : '');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                        }`}
                      >
                        <span>{s.recipientName}</span>
                        <span className="text-[10px] opacity-80">({s.roleCategory})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculation Panel */}
              {(() => {
                const activeS = dadonSummary.sardars.find(
                  (s) => s.key === (selectedSettlementSardarKey || dadonSummary.sardars[0]?.key)
                ) || dadonSummary.sardars[0];
                if (!activeS) return null;

                const effectiveBricks = customSettlementBricks !== ''
                  ? parseNum(customSettlementBricks)
                  : (activeS.totalBricksHandled || 0);
                const ratePerThou = parseNum(seasonSettlementRatePerThousand, 650) || 650;
                const totalGrossBill = Math.round((effectiveBricks / 1000) * ratePerThou);
                const standingDadon = activeS.totalDadonGiven || 0;
                const weeklyKhoraki = activeS.weeklyPaymentsTaken || activeS.totalWorkBillEarned || 0;
                const totalDeductions = standingDadon + weeklyKhoraki;
                const netFinalSettlement = totalGrossBill - totalDeductions;

                return (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="text-[11px] text-slate-300 font-bold">স্থায়ী সিজনাল দাদন (অক্ষত)</div>
                        <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
                          {formatCurrencyBn(standingDadon)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">সিজনের শুরুতে দেওয়া দাদন</div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="text-[11px] text-slate-300 font-bold">সিজনের মোট কাঁচা ইট (টি)</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            value={customSettlementBricks !== '' ? customSettlementBricks : (activeS.totalBricksHandled || '')}
                            onChange={(e) => setCustomSettlementBricks(e.target.value)}
                            placeholder="যেমন: ৪০০০০০"
                            className="w-full px-2 py-1 bg-slate-900 border border-indigo-400/50 rounded text-sm font-black text-cyan-300"
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">অটো বা ম্যানুয়াল ইট সংখ্যা</div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="text-[11px] text-slate-300 font-bold">সিজনে সাপ্তাহিক খোরাকি উত্তোলন</div>
                        <div className="text-xl font-black text-indigo-300 mt-0.5 tabular-nums">
                          {formatCurrencyBn(weeklyKhoraki)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">চলতি সময়ে নেওয়া নগদ খোরাকি</div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-xl border border-amber-400/40">
                        <div className="text-[11px] text-amber-200 font-bold">মালিক নির্ধারিত ফাইনাল রেট (৳/হাজার) *</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            value={seasonSettlementRatePerThousand}
                            onChange={(e) => setSeasonSettlementRatePerThousand(e.target.value)}
                            placeholder="যেমন: ৬৫০"
                            className="w-full px-2 py-1 bg-slate-900 border border-amber-400 rounded text-sm font-black text-amber-400"
                          />
                          <span className="text-xs font-bold text-amber-300">৳</span>
                        </div>
                        <div className="text-[10px] text-amber-300/80 mt-1">সিজন সমাপনী রেট</div>
                      </div>
                    </div>

                    {/* Formula & Final Result Box */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-indigo-500/40">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <div className="font-bold text-slate-200 flex items-center gap-2">
                            <span>হিসাবের বিবরণ:</span>
                            <span className="text-amber-300 font-black">{activeS.recipientName}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                            <span>মোট কাজের বিল: {formatCurrencyBn(totalGrossBill)}</span>
                            <span>–</span>
                            <span className="text-amber-300">দাদন: {formatCurrencyBn(standingDadon)}</span>
                            <span>–</span>
                            <span className="text-indigo-300">খোরাকি: {formatCurrencyBn(weeklyKhoraki)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            (মোট কর্তনযোগ্য অগ্রিম: {formatCurrencyBn(totalDeductions)})
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {netFinalSettlement >= 0 ? (
                            <div className="bg-emerald-950/80 border border-emerald-500/60 p-3 rounded-xl text-left md:text-right">
                              <div className="text-[11px] font-bold text-emerald-300">
                                🎉 সর্দারকে চূড়ান্ত প্রদেয় অবশিষ্ট টাকা:
                              </div>
                              <div className="text-2xl font-black text-emerald-400 tabular-nums">
                                {formatCurrencyBn(netFinalSettlement)}
                              </div>
                              <div className="text-[10px] text-emerald-300/80">
                                ভাটা সর্দারকে এই টাকা সমাপনীতে পরিশোধ করবে
                              </div>
                            </div>
                          ) : (
                            <div className="bg-rose-950/80 border border-rose-500/60 p-3 rounded-xl text-left md:text-right">
                              <div className="text-[11px] font-bold text-rose-300">
                                ⚠️ সর্দারের নিকট ভাটার ফেরত পাওনা:
                              </div>
                              <div className="text-2xl font-black text-rose-400 tabular-nums">
                                {formatCurrencyBn(Math.abs(netFinalSettlement))}
                              </div>
                              <div className="text-[10px] text-rose-300/80">
                                অতিরিক্ত উত্তোলিত টাকা সর্দার ফেরত দিবে
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sardar-wise Standing Advance & Production Volume Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  সর্দারওয়ারী স্থায়ী দাদন ও কাঁচা ইট খতিয়ান
                </h4>
                <p className="text-xs text-slate-500">
                  দাদন সিজন চলাকালীন অক্ষত থাকবে; সিজন সমাপনীতে রেট ধরে চূড়ান্ত কর্তন হবে
                </p>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 self-start sm:self-auto">
                মোট সর্দার: {formatBn(dadonSummary.sardars.length)} জন
              </span>
            </div>

            {/* Mobile Cards View (Phones) */}
            <div className="block sm:hidden space-y-3">
              {dadonSummary.sardars.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  এখনো কোনো সর্দারের দাদন এন্ট্রি করা হয়নি। উপরে সর্দারের নাম সিলেক্ট করে দাদন যোগ করুন।
                </div>
              ) : (
                dadonSummary.sardars.map((s) => (
                  <div
                    key={s.key}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-black text-slate-900 text-sm">{s.recipientName}</div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px]">
                        {s.roleCategory}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <div className="text-[10px] text-slate-500 font-bold">স্থায়ী সিজনাল দাদন</div>
                        <div className="text-sm font-black text-amber-700 mt-0.5">
                          {formatCurrencyBn(s.totalDadonGiven)}
                        </div>
                        <div className="text-[9px] text-amber-700/80">🔒 অক্ষত থাকবে</div>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-blue-200">
                        <div className="text-[10px] text-slate-500 font-bold">মোট কাঁচা ইট</div>
                        <div className="text-sm font-black text-blue-700 mt-0.5">
                          {formatBn(s.totalBricksHandled)} টি
                        </div>
                        <div className="text-[9px] text-blue-600">উৎপাদন / বহন</div>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-indigo-200 col-span-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-bold">সাপ্তাহিক রানিং খোরাকি:</span>
                          <span className="text-xs font-black text-indigo-700">
                            {formatCurrencyBn(s.weeklyPaymentsTaken || s.totalWorkBillEarned)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSettlementSardarKey(s.key);
                        setCustomSettlementBricks(s.totalBricksHandled > 0 ? String(s.totalBricksHandled) : '');
                      }}
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>🧮 সিজন সমাপনী রেট ও হিসাব কষুন</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">সর্দার / মিস্ত্রির নাম</th>
                    <th className="py-2.5 px-2 font-bold">ক্যাটাগরি</th>
                    <th className="py-2.5 px-2 text-right font-bold">স্থায়ী সিজনাল দাদন (অক্ষত)</th>
                    <th className="py-2.5 px-2 text-right font-bold">সিজনে মোট কাঁচা ইট</th>
                    <th className="py-2.5 px-2 text-right font-bold">সাপ্তাহিক রানিং খোরাকি</th>
                    <th className="py-2.5 px-2 text-center font-bold">স্থিতি</th>
                    <th className="py-2.5 px-2 text-right font-bold">সমাপনী হিসাব</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadonSummary.sardars.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        এখনো কোনো সর্দারের দাদন এন্ট্রি করা হয়নি। উপরে সর্দারের নাম সিলেক্ট করে দাদন যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    dadonSummary.sardars.map((s) => (
                      <tr key={s.key} className="hover:bg-orange-50/40">
                        <td className="py-2.5 px-2 font-black text-slate-900">
                          {s.recipientName}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                            {s.roleCategory}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-amber-700">
                          {formatCurrencyBn(s.totalDadonGiven)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-blue-700 font-black">
                          {formatBn(s.totalBricksHandled)} টি
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-indigo-700">
                          {formatCurrencyBn(s.weeklyPaymentsTaken || s.totalWorkBillEarned)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            🔒 অক্ষত (সিজন শেষে কর্তন)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSettlementSardarKey(s.key);
                              setCustomSettlementBricks(s.totalBricksHandled > 0 ? String(s.totalBricksHandled) : '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer transition shadow-2xs"
                          >
                            হিসাব কষুন 🧮
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Individual Dadon Entries List */}
            {(state.dadonRecords || []).length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h5 className="text-xs font-black text-slate-700 mb-2">
                  দাদন প্রদানের তারিখওয়ারী লগ ({formatBn((state.dadonRecords || []).length)} টি)
                </h5>
                <div className="space-y-1.5">
                  {(state.dadonRecords || []).map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {d.recipientName}
                        </span>{' '}
                        <span className="text-slate-500">({d.roleCategory})</span> · তারিখ: {d.date}
                        {d.note ? ` · ${d.note}` : ''}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-amber-700">
                          দাদন: {formatCurrencyBn(d.advanceAmount)}
                        </span>
                        {(d.manualWorkBill || 0) > 0 && (
                          <span className="font-bold text-blue-700">
                            বিল সমন্বয়: {formatCurrencyBn(d.manualWorkBill)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteDadon(d.id)}
                          className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODULE 3: অগ্রিম ইট বুকিং ও কাস্টমার পার্টি খতিয়ান (Advance Booking & Party Ledger)
         ========================================================================== */}
      {activeSection === 'booking_party' && (
        <div className="space-y-6" data-testid="module-booking-party">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-amber-200 border-t-4 border-t-amber-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">অগ্রিম বুকিংকৃত মোট ইট</div>
              <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatBn(partyStatementSummary.totalBookedBricks)} পিস
              </div>
              <div className="text-xs text-slate-500 mt-1">
                বুকিং সংখ্যা: {formatBn(partyStatementSummary.totalBookingsCount)} টি · ডেলিভারি বাকি:{' '}
                <strong className="text-rose-600">
                  {formatBn(partyStatementSummary.totalBookingRemainingBricks)} পিস
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 border-t-4 border-t-emerald-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">অগ্রিম বুকিং হতে নগদ জমা</div>
              <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
                {formatCurrencyBn(partyStatementSummary.totalBookingAdvance)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                মোট চুক্তিমূল্য: {formatCurrencyBn(partyStatementSummary.totalBookingAmount)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 border-t-4 border-t-rose-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">বুকিং বাবদ বকেয়া পাওনা</div>
              <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
                {formatCurrencyBn(partyStatementSummary.totalBookingDue)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ডেলিভারিকৃত বুকিং ইট: {formatBn(partyStatementSummary.totalBookingDeliveredBricks)} পিস
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 border-t-4 border-t-blue-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট ক্রেতা পার্টি খতিয়ান (মেমো + বুকিং)</div>
              <div className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
                {formatBn(partyStatementSummary.uniqueCustomersCount)} জন পার্টি
              </div>
              <div className="text-xs text-slate-500 mt-1">
                যেকোনো ক্রেতার পূর্ণাঙ্গ স্টেটমেন্ট প্রিন্টযোগ্য
              </div>
            </div>
          </div>

          {/* Advance Booking Form */}
          <form
            onSubmit={handleBookingSubmit}
            className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-orange-600 p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-orange-600" />
                নতুন অগ্রিম ইট বুকিং ফর্ম (Advance Brick Booking)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                সিজন শুরুর আগে বা চলাকালীন ক্রেতার কাছ থেকে অগ্রিম টাকা নিয়ে ইট বুকিং এন্ট্রি করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বুকিংয়ের তারিখ
                </label>
                <input
                  type="date"
                  value={bkDate}
                  onChange={(e) => setBkDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সম্ভাব্য ডেলিভারির তারিখ
                </label>
                <input
                  type="date"
                  value={bkTargetDate}
                  onChange={(e) => setBkTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ক্রেতা / পার্টির নাম *
                </label>
                <input
                  type="text"
                  placeholder="যেমন: আলহাজ্ব রফিকুল ইসলাম"
                  value={bkCustomerName}
                  onChange={(e) => setBkCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="text"
                  placeholder="০১৭..."
                  value={bkCustomerPhone}
                  onChange={(e) => setBkCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ইটের গ্রেড নির্বাচন
                </label>
                <select
                  value={bkGradeId}
                  onChange={(e) => {
                    setBkGradeId(e.target.value);
                    const g = state.brickGrades.find((gr) => gr.id === e.target.value);
                    if (g) setBkRate(String(g.ratePerUnit));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                >
                  {state.brickGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {cleanBrickGradeName(g.nameBn)} (হাজার ৳{formatBn(g.ratePerUnit)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বুকিংকৃত ইটের পরিমাণ (পিস) *
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ২০০০০"
                  value={bkQty}
                  onChange={(e) => setBkQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  চুক্তিকৃত হাজার দর (৳/১০০০)
                </label>
                <input
                  type="number"
                  value={bkRate}
                  onChange={(e) => setBkRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  অগ্রিম জমা টাকা (৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ১৫০০০০"
                  value={bkAdvance}
                  onChange={(e) => setBkAdvance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-400 bg-emerald-50/50 text-slate-900 text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-700 font-bold">
                  মোট চুক্তিমূল্য: <strong className="text-sm text-slate-900">{formatCurrencyBn(bkPreview.totalAmount)}</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  অগ্রিম জমা: {formatCurrencyBn(bkPreview.advancePaid)}
                </span>
                <span className="text-rose-600 font-bold">
                  বাকি টাকা: {formatCurrencyBn(bkPreview.dueAmount)}
                </span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                + অগ্রিম ইট বুকিং সেভ করুন
              </button>
            </div>
          </form>

          {/* Active Bookings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="text-sm font-black text-slate-900 mb-3">
              অগ্রিম ইট বুকিং তালিকা ({formatBn((state.advanceBookings || []).length)} টি)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">বুকিং নং ও তারিখ</th>
                    <th className="py-2.5 px-2 font-bold">ক্রেতা ও মোবাইল</th>
                    <th className="py-2.5 px-2 font-bold">গ্রেড ও দর</th>
                    <th className="py-2.5 px-2 text-right font-bold">বুকিং ইট</th>
                    <th className="py-2.5 px-2 text-right font-bold">ডেলিভারি / বাকি ইট</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট বিল / অগ্রিম জমা</th>
                    <th className="py-2.5 px-2 text-right font-bold">বকেয়া টাকা</th>
                    <th className="py-2.5 px-2 text-center font-bold">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.advanceBookings || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        এখনো কোনো অগ্রিম ইট বুকিং এন্ট্রি নেই।
                      </td>
                    </tr>
                  ) : (
                    (state.advanceBookings || []).map((b) => {
                      const remBricks = Math.max(0, b.bookedQuantity - b.deliveredQuantity);
                      return (
                        <React.Fragment key={b.id}>
                          <tr className="hover:bg-orange-50/40">
                            <td className="py-2.5 px-2">
                              <span className="font-black text-amber-700">{b.bookingNo}</span>
                              <div className="text-[11px] text-slate-500">
                                বুকিং: {b.date} · ডেলিভারি লক্ষ্য: {b.deliveryTargetDate}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 font-bold text-slate-900">
                              {b.customerName}
                              <div className="text-[11px] text-slate-500 font-normal">
                                {b.customerPhone}
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className="font-bold text-slate-900">{b.gradeName}</span>
                              <div className="text-[11px] text-slate-500">
                                হাজার ৳{formatBn(b.ratePerThousand)}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                              {formatBn(b.bookedQuantity)} পিস
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <span className="text-emerald-700 font-bold">
                                ডেলিভারি: {formatBn(b.deliveredQuantity)}
                              </span>
                              <div className="text-rose-600 font-bold">
                                বাকি: {formatBn(remBricks)} পিস
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <div className="font-bold text-slate-900">{formatCurrencyBn(b.totalAmount)}</div>
                              <div className="text-emerald-700 font-bold">
                                জমা: {formatCurrencyBn(b.advancePaid)}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-rose-600">
                              {formatCurrencyBn(b.dueAmount)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBookingActionId(bookingActionId === b.id ? null : b.id)
                                  }
                                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] cursor-pointer"
                                >
                                  ডেলিভারি / জমা
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteAdvanceBooking(b.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {bookingActionId === b.id && (
                            <tr className="bg-amber-50/70">
                              <td colSpan={8} className="p-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-bold text-slate-900">
                                    {b.bookingNo} ({b.customerName}) আপডেট:
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="নতুন ডেলিভারি ইট (পিস)"
                                    value={bookingActionDeliverQty}
                                    onChange={(e) => setBookingActionDeliverQty(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900"
                                  />
                                  <input
                                    type="number"
                                    placeholder="নতুন কিস্তি জমা (৳)"
                                    value={bookingActionPayAmt}
                                    onChange={(e) => setBookingActionPayAmt(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleBookingQuickUpdate(b.id)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                                  >
                                    নিশ্চিত করুন
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Party Full Ledger Statement */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-black text-slate-900">
                  ক্রেতাওয়ারী পার্টি খতিয়ান ও স্টেটমেন্ট
                </h4>
                <p className="text-xs text-slate-500">
                  কোন পার্টি মোট কত পিস ইট নিয়েছে, কত পিস ডেলিভারি বাকি এবং কত টাকা বকেয়া — এক ক্লিকে খতিয়ান প্রিন্ট করুন।
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ক্রেতার নাম বা ফোন খুঁজুন..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">ক্রেতা / পার্টির নাম</th>
                    <th className="py-2.5 px-2 text-center font-bold">মেমো ও বুকিং</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট অর্ডারকৃত ইট</th>
                    <th className="py-2.5 px-2 text-right font-bold">ডেলিভারিকৃত ইট</th>
                    <th className="py-2.5 px-2 text-right font-bold">ডেলিভারি বাকি</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট বিল</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট জমা</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট বকেয়া</th>
                    <th className="py-2.5 px-2 text-center font-bold">খতিয়ান প্রিন্ট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        কোনো ক্রেতা পার্টি পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredParties.map((p) => (
                      <tr
                        key={p.customerKey}
                        className="hover:bg-orange-50/40"
                      >
                        <td className="py-2.5 px-2 font-black text-slate-900">
                          {p.customerName}
                          <div className="text-[11px] text-slate-500 font-normal">
                            {p.customerPhone} · {p.customerAddress}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-700">
                          মেমো: {formatBn(p.memoCount)} · বুকিং: {formatBn(p.bookingCount)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                          {formatBn(p.totalBricksOrdered)} পিস
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                          {formatBn(p.totalBricksDelivered)} পিস
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                          {formatBn(p.pendingBricksToDeliver)} পিস
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                          {formatCurrencyBn(p.totalBilledAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                          {formatCurrencyBn(p.totalPaidAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-rose-600">
                          {formatCurrencyBn(p.totalDueAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPartyForPrint(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-700 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            খতিয়ান দেখুন
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Printable Customer Party Statement Modal */}
          {selectedPartyForPrint && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {state.settings.bhataName} — ক্রেতা পার্টি পূর্ণাঙ্গ খতিয়ান
                    </h3>
                    <p className="text-xs text-slate-500">
                      ক্রেতা: <strong>{selectedPartyForPrint.customerName}</strong> · মোবাইল:{' '}
                      {selectedPartyForPrint.customerPhone} · ঠিকানা:{' '}
                      {selectedPartyForPrint.customerAddress}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      প্রিন্ট করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPartyForPrint(null)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">মোট অর্ডারকৃত ইট</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {formatBn(selectedPartyForPrint.totalBricksOrdered)} পিস
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-amber-800">ডেলিভারি বাকি ইট</div>
                    <div className="text-base font-black text-amber-800 mt-0.5">
                      {formatBn(selectedPartyForPrint.pendingBricksToDeliver)} পিস
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-emerald-800">মোট জমা টাকা</div>
                    <div className="text-base font-black text-emerald-700 mt-0.5">
                      {formatCurrencyBn(selectedPartyForPrint.totalPaidAmount)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <div className="text-rose-800">মোট বকেয়া পাওনা</div>
                    <div className="text-base font-black text-rose-600 mt-0.5">
                      {formatCurrencyBn(selectedPartyForPrint.totalDueAmount)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedPartyForPrint.memos.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
                    >
                      <div>
                        <span className="font-black text-slate-900">মেমো #{m.memoNo}</span> ({m.date})
                      </div>
                      <div className="flex items-center gap-3">
                        <span>বিল: {formatCurrencyBn(m.totalAmount)}</span>
                        <span className="text-emerald-700 font-bold">
                          জমা: {formatCurrencyBn(m.paidAmount)}
                        </span>
                        <span className="text-rose-600 font-bold">
                          বাকি: {formatCurrencyBn(m.dueAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {selectedPartyForPrint.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 text-xs text-slate-800"
                    >
                      <div>
                        <span className="font-black text-amber-800">
                          বুকিং #{b.bookingNo}
                        </span>{' '}
                        ({b.date}) — {formatBn(b.bookedQuantity)} পিস {b.gradeName}
                      </div>
                      <div className="flex items-center gap-3">
                        <span>বিল: {formatCurrencyBn(b.totalAmount)}</span>
                        <span className="text-emerald-700 font-bold">
                          জমা: {formatCurrencyBn(b.advancePaid)}
                        </span>
                        <span className="text-rose-600 font-bold">
                          বাকি: {formatCurrencyBn(b.dueAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================================================
          MODULE 4: নিজস্ব ট্রাক, ট্রলি ও ভেকু হিসাব (Vehicle, Veku & Diesel Tracker)
         ========================================================================== */}
      {activeSection === 'veku_truck' && (
        <div className="space-y-6" data-testid="module-veku-truck">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-amber-200 border-t-4 border-t-amber-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট ডিজেল ব্যবহার (লিটার)</div>
              <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatBn(vdSummary.totalDieselLiters)} লিটার
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ডিজেল বাবদ খরচ: {formatCurrencyBn(vdSummary.totalDieselCost)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 border-t-4 border-t-blue-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">ড্রাইভার খোরাকি ও ট্রিপ ভাতা</div>
              <div className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
                {formatCurrencyBn(vdSummary.totalDriverAllowance)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                মোট এন্ট্রি: {formatBn(vdSummary.totalRecords)} টি
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-purple-200 border-t-4 border-t-purple-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মেরামত, পার্টস ও ইঞ্জিন অয়েল</div>
              <div className="text-2xl font-black text-purple-700 mt-1 tabular-nums">
                {formatCurrencyBn(vdSummary.totalMaintenanceCost)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                সচল গাড়ি/ভেকু: {formatBn(vdSummary.vehicles.length)} টি
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 border-t-4 border-t-rose-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">সর্বমোট গাড়ি ও ভেকু খরচ</div>
              <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
                {formatCurrencyBn(vdSummary.totalExpense)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ক্যাশবুকে ‘ভেকু ও ডিজেল’ খাতে সমন্বিত
              </div>
            </div>
          </div>

          {/* Entry Form */}
          <form
            onSubmit={handleVehicleDieselSubmit}
            className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-orange-600 p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                দৈনিক ট্রাক, ট্রলি ও ভেকু (ডিজেল এবং মেরামত) এন্ট্রি
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিদিন কোন গাড়িতে বা ভেকুতে কত লিটার ডিজেল লাগলো, ড্রাইভার খোরাকি এবং পার্টস খরচ লিখুন।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1">দ্রুত গাড়ি নির্বাচন:</span>
              {[
                { name: 'ভেকু-০১ (Excavator)', type: 'ভেকু (Excavator)' as KilnVehicleType },
                { name: 'ভাটা ট্রাক-০১', type: 'ট্রাক (Truck)' as KilnVehicleType },
                { name: 'ট্রলি-০১', type: 'ট্রলি / ট্রাক্টর' as KilnVehicleType },
                { name: 'ট্রলি-০২', type: 'ট্রলি / ট্রাক্টর' as KilnVehicleType },
                { name: 'পেলোডার-০১', type: 'পেলোডার / পাওয়ার টিলার' as KilnVehicleType },
              ].map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => {
                    setVdName(v.name);
                    setVdType(v.type);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  {v.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={vdDate}
                  onChange={(e) => setVdDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  গাড়ি / ভেকুর নাম বা নম্বর *
                </label>
                <input
                  type="text"
                  value={vdName}
                  onChange={(e) => setVdName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ড্রাইভার / অপারেটরের নাম
                </label>
                <input
                  type="text"
                  placeholder="যেমন: হাসান ড্রাইভার"
                  value={vdDriver}
                  onChange={(e) => setVdDriver(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কাজের বিবরণ (ঘণ্টা / ট্রিপ সংখ্যা)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ৮ ঘণ্টা মাটি কাটা / ৫ ট্রিপ ইট ডেলিভারি"
                  value={vdWork}
                  onChange={(e) => setVdWork(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1">
                  ডিজেল (লিটার)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="যেমন: ৪০"
                  value={vdLiters}
                  onChange={(e) => setVdLiters(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-400 bg-amber-50/50 text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রতি লিটার ডিজেল দর (৳)
                </label>
                <input
                  type="number"
                  step="any"
                  value={vdRate}
                  onChange={(e) => setVdRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ড্রাইভার খোরাকি / ভাতা (৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ৫০০"
                  value={vdAllowance}
                  onChange={(e) => setVdAllowance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মেরামত ও পার্টস খরচ (৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: ১২০০"
                  value={vdMaint}
                  onChange={(e) => setVdMaint(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-700">
                  ডিজেল খরচ: <strong className="text-slate-900">{formatCurrencyBn(vdPreview.dieselCost)}</strong>
                </span>
                <span className="text-slate-700">
                  খোরাকি ও মেরামত:{' '}
                  <strong className="text-slate-900">
                    {formatCurrencyBn(vdPreview.driverAllowance + vdPreview.maintenanceCost)}
                  </strong>
                </span>
                <span className="text-rose-600 font-black text-sm">
                  সর্বমোট খরচ: {formatCurrencyBn(vdPreview.totalExpense)}
                </span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                + গাড়ি/ভেকু ও ডিজেল হিসাব সেভ করুন
              </button>
            </div>
          </form>

          {/* Vehicle-wise Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="text-sm font-black text-slate-900 mb-3">
              দৈনিক গাড়ি, ভেকু ও ডিজেল খরচের তালিকা ({formatBn((state.vehicleDieselRecords || []).length)} টি)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">তারিখ</th>
                    <th className="py-2.5 px-2 font-bold">গাড়ি / ভেকু</th>
                    <th className="py-2.5 px-2 font-bold">ড্রাইভার ও কাজের বিবরণ</th>
                    <th className="py-2.5 px-2 text-right font-bold">ডিজেল (লিটার × দর)</th>
                    <th className="py-2.5 px-2 text-right font-bold">ডিজেল খরচ</th>
                    <th className="py-2.5 px-2 text-right font-bold">খোরাকি ও মেরামত</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট খরচ</th>
                    <th className="py-2.5 px-2 text-center font-bold">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.vehicleDieselRecords || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        এখনো কোনো গাড়ি বা ভেকুর ডিজেল এন্ট্রি করা হয়নি।
                      </td>
                    </tr>
                  ) : (
                    (state.vehicleDieselRecords || []).map((r) => (
                      <tr key={r.id} className="hover:bg-orange-50/40">
                        <td className="py-2.5 px-2 text-slate-800">{r.date}</td>
                        <td className="py-2.5 px-2 font-black text-slate-900">
                          {r.vehicleName}
                          <div className="text-[11px] text-slate-500 font-normal">
                            {r.vehicleType}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-800">
                          <span className="font-bold">{r.driverName}</span> — {r.workOrTripSummary}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700">
                          {formatBn(r.dieselLiters)} লিটার × ৳{formatBn(r.dieselRate)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                          {formatCurrencyBn(r.dieselCost)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-800">
                          {formatCurrencyBn((r.driverAllowance || 0) + (r.maintenanceCost || 0))}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-rose-600">
                          {formatCurrencyBn(r.totalExpense)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteVehicleDiesel(r.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODULE 5: ভাটার লাইসেন্স, ভ্যাট ও সরকারি কিস্তি ট্র্যাকার (Compliance & Installment)
         ========================================================================== */}
      {activeSection === 'license_kisti' && (
        <div className="space-y-6" data-testid="module-license-kisti">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট লাইসেন্স, ভ্যাট ও কিস্তি খাত</div>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {formatBn(compSummary.totalItems)} টি
              </div>
              <div className="text-xs text-slate-500 mt-1">
                পূর্ণ পরিশোধিত: {formatBn(compSummary.paidCount)} টি
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 border-t-4 border-t-amber-500 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট ধার্যকৃত ফি ও কিস্তি</div>
              <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatCurrencyBn(compSummary.totalPayable)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                সরকারি ছাড়পত্র, ভ্যাট ও ব্যাংক লোন
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 border-t-4 border-t-emerald-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">মোট পরিশোধিত টাকা</div>
              <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
                {formatCurrencyBn(compSummary.totalPaid)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ক্যাশবুকে স্বয়ংক্রিয়ভাবে অন্তর্ভুক্ত
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 border-t-4 border-t-rose-600 shadow-xs">
              <div className="text-xs font-bold text-slate-500">বকেয়া কিস্তি ও সরকারি ফি</div>
              <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
                {formatCurrencyBn(compSummary.totalDue)}
              </div>
              <div className="text-xs text-rose-600 font-bold mt-1">
                মেয়াদোত্তীর্ণ (Overdue): {formatBn(compSummary.overdueCount)} টি
              </div>
            </div>
          </div>

          {/* Entry Form */}
          <form
            onSubmit={handleComplianceSubmit}
            className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-orange-600 p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
                ভাটার লাইসেন্স নবায়ন, ভ্যাট/ট্যাক্স ও ব্যাংক কিস্তি এন্ট্রি ফর্ম
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                পরিবেশ অধিদপ্তর ছাড়পত্র, ডিসি অফিস লাইসেন্স, ভ্যাট/আয়কর, বিএসটিআই এবং ব্যাংক লোন কিস্তির শেষ তারিখ ও টাকার হিসাব সংরক্ষণ করুন।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1">দ্রুত খাত নির্বাচন:</span>
              {[
                {
                  title: 'পরিবেশ অধিদপ্তর ছাড়পত্র নবায়ন ফি',
                  cat: 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)' as ComplianceCategory,
                  auth: 'পরিবেশ অধিদপ্তর, সাতক্ষীরা',
                },
                {
                  title: 'ডিসি অফিস ইটভাটা লাইসেন্স ও খাজনা',
                  cat: 'ডিসি অফিস লাইসেন্স ও খাজনা' as ComplianceCategory,
                  auth: 'জেলা প্রশাসকের কার্যালয়, সাতক্ষীরা',
                },
                {
                  title: 'ইটভাটা বার্ষিক ভ্যাট ও আয়কর (VAT & Tax)',
                  cat: 'ভ্যাট ও আয়কর (VAT & Tax)' as ComplianceCategory,
                  auth: 'কাস্টমস, এক্সাইজ ও ভ্যাট অফিস',
                },
                {
                  title: 'বিএসটিআই ও ফায়ার সার্ভিস লাইসেন্স ফি',
                  cat: 'বিএসটিআই ও ফায়ার সার্ভিস' as ComplianceCategory,
                  auth: 'বিএসটিআই / ফায়ার সার্ভিস',
                },
                {
                  title: 'ব্যাংক সিসি লোন কিস্তি পরিশোধ',
                  cat: 'ব্যাংক লোন / সিসি লোন কিস্তি' as ComplianceCategory,
                  auth: 'ব্যাংক শাখা, সাতক্ষীরা',
                },
              ].map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => {
                    setCompTitle(p.title);
                    setCompCategory(p.cat);
                    setCompAuthority(p.auth);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  {p.title}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  লাইসেন্স / কিস্তির শিরোনাম *
                </label>
                <input
                  type="text"
                  placeholder="যেমন: পরিবেশ অধিদপ্তর ছাড়পত্র নবায়ন ২০২৬-২৭"
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  খাত / ক্যাটাগরি
                </label>
                <select
                  value={compCategory}
                  onChange={(e) => setCompCategory(e.target.value as ComplianceCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                >
                  <option value="পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)">পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)</option>
                  <option value="ডিসি অফিস লাইসেন্স ও খাজনা">ডিসি অফিস লাইসেন্স ও খাজনা</option>
                  <option value="ভ্যাট ও আয়কর (VAT & Tax)">ভ্যাট ও আয়কর (VAT & Tax)</option>
                  <option value="বিএসটিআই ও ফায়ার সার্ভিস">বিএসটিআই ও ফায়ার সার্ভিস</option>
                  <option value="ব্যাংক লোন / সিসি লোন কিস্তি">ব্যাংক লোন / সিসি লোন কিস্তি</option>
                  <option value="অন্যান্য সরকারি ফি ও নবায়ন">অন্যান্য সরকারি ফি ও নবায়ন</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সংশ্লিষ্ট দপ্তর বা ব্যাংকের নাম
                </label>
                <input
                  type="text"
                  value={compAuthority}
                  onChange={(e) => setCompAuthority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  স্মারক / লাইসেন্স / লোন একাউন্ট নং
                </label>
                <input
                  type="text"
                  placeholder="যেমন: DoE-SAT-2026/104"
                  value={compRefNo}
                  onChange={(e) => setCompRefNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">
                  পরিশোধ বা নবায়নের শেষ তারিখ (Due Date)
                </label>
                <input
                  type="date"
                  value={compDueDate}
                  onChange={(e) => setCompDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোট ধার্য টাকা (৳) *
                  </label>
                  <input
                    type="number"
                    placeholder="৫০০০০"
                    value={compPayable}
                    onChange={(e) => setCompPayable(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    জমা / পরিশোধ (৳)
                  </label>
                  <input
                    type="number"
                    placeholder="২০০০০"
                    value={compPaid}
                    onChange={(e) => setCompPaid(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-400 bg-emerald-50/50 text-slate-900 text-sm font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-700">
                ধার্য: {formatCurrencyBn(compPreview.totalPayable)} · পরিশোধ:{' '}
                <span className="text-emerald-700">{formatCurrencyBn(compPreview.paidAmount)}</span> · বাকি:{' '}
                <span className="text-rose-600">{formatCurrencyBn(compPreview.dueAmount)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                + লাইসেন্স ও কিস্তি খাতায় সেভ করুন
              </button>
            </div>
          </form>

          {/* Compliance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="text-sm font-black text-slate-900 mb-3">
              লাইসেন্স, ভ্যাট ও ব্যাংক কিস্তি তালিকা ({formatBn((state.complianceRecords || []).length)} টি)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="py-2.5 px-2 font-bold">বিবরণ ও ক্যাটাগরি</th>
                    <th className="py-2.5 px-2 font-bold">দপ্তর / ব্যাংক ও স্মারক</th>
                    <th className="py-2.5 px-2 font-bold">শেষ তারিখ (Due Date)</th>
                    <th className="py-2.5 px-2 text-right font-bold">মোট ধার্য</th>
                    <th className="py-2.5 px-2 text-right font-bold">পরিশোধিত</th>
                    <th className="py-2.5 px-2 text-right font-bold">বকেয়া</th>
                    <th className="py-2.5 px-2 text-center font-bold">স্ট্যাটাস</th>
                    <th className="py-2.5 px-2 text-center font-bold">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.complianceRecords || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        এখনো কোনো লাইসেন্স বা ব্যাংক কিস্তি রেকর্ড যোগ করা হয়নি।
                      </td>
                    </tr>
                  ) : (
                    (state.complianceRecords || []).map((c) => {
                      const isOverdue = c.dueAmount > 0 && c.dueDate < todayDate;
                      return (
                        <React.Fragment key={c.id}>
                          <tr className="hover:bg-orange-50/40">
                            <td className="py-2.5 px-2 font-black text-slate-900">
                              {c.titleBn}
                              <div className="text-[11px] text-amber-700 font-bold">
                                {c.category}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-slate-800">
                              {c.authorityOrBankName}
                              {c.referenceNo && (
                                <div className="text-[11px] text-slate-500">
                                  নং: {c.referenceNo}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 font-bold text-slate-800">
                              <span className={isOverdue ? 'text-rose-600' : ''}>{c.dueDate}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                              {formatCurrencyBn(c.totalPayable)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                              {formatCurrencyBn(c.paidAmount)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-rose-600">
                              {formatCurrencyBn(c.dueAmount)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  c.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isOverdue
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {c.status === 'PAID'
                                  ? 'পরিশোধিত'
                                  : isOverdue
                                  ? 'মেয়াদোত্তীর্ণ!'
                                  : 'বকেয়া / চলমান'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {c.dueAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCompPayModalId(compPayModalId === c.id ? null : c.id)
                                    }
                                    className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    + কিস্তি দিন
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDeleteCompliance(c.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {compPayModalId === c.id && (
                            <tr className="bg-emerald-50/70">
                              <td colSpan={8} className="p-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-bold text-slate-900">
                                    {c.titleBn} — বকেয়া পরিশোধ (বাকি: {formatCurrencyBn(c.dueAmount)}):
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="পরিশোধের টাকা (৳)"
                                    value={compAddedPayAmt}
                                    onChange={(e) => setCompAddedPayAmt(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleComplianceInstallmentPay(c.id)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                                  >
                                    ক্যাশবুকসহ পরিশোধ নিশ্চিত করুন
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
