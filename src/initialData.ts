/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Order, Expense, Transaction, ActivityLog } from './types';

export const PREDEFINED_USERS: User[] = [
  { id: 'Omar', name: 'عمر', code: '452009', ratio: 0.60, role: 'admin' },
  { id: 'Mustafa', name: 'محمد مصطفى', code: '342007', ratio: 0.15, role: 'user' },
  { id: 'Sayed', name: 'محمد السيد', code: '2009', ratio: 0.15, role: 'user' }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    clientName: 'أحمد محمود العتيبي',
    phone: '01023456789',
    designsRequested: 5,
    designsCompleted: 5,
    price: 1500,
    paidAmount: 1500,
    status: 'completed',
    tiktokAccountName: 'متجر الهدايا الفاخرة',
    tiktokUsername: 'luxury_gifts_shop',
    createdAt: '2026-05-28T14:30:00Z',
    isProfitDistributed: true,
    notes: 'تم تسليم جميع التصميمات بجودة عالية وصيغة PNG شفافة',
    assignedUserId: 'Mustafa'
  },
  {
    id: 'ord-102',
    clientName: 'سارة عبد المجيد',
    phone: '0551234567',
    designsRequested: 3,
    designsCompleted: 3,
    price: 900,
    paidAmount: 900,
    status: 'completed',
    tiktokAccountName: 'سارة ميك أب آرتست',
    tiktokUsername: 'sara_makeup_art',
    createdAt: '2026-05-30T10:15:00Z',
    isProfitDistributed: true,
    notes: 'الطلب جاهز وتم نشره على تيك توك بنجاح',
    assignedUserId: 'Sayed'
  },
  {
    id: 'ord-103',
    clientName: 'خالد بن الوليد',
    phone: '0509876543',
    designsRequested: 8,
    designsCompleted: 5,
    price: 2400,
    paidAmount: 1200,
    status: 'processing',
    tiktokAccountName: 'كافيه برواز الهلال',
    tiktokUsername: 'berwaz_cafe',
    createdAt: '2026-06-01T09:00:00Z',
    isProfitDistributed: false,
    notes: 'جاري العمل على باقي التصاميم الثلاثة',
    assignedUserId: 'Mustafa'
  },
  {
    id: 'ord-104',
    clientName: 'شركة النور للمقاولات',
    phone: '01299988877',
    designsRequested: 10,
    designsCompleted: 0,
    price: 3500,
    paidAmount: 0,
    status: 'pending',
    tiktokAccountName: 'مجموعة النور العقارية',
    tiktokUsername: 'alnoor_realestate',
    createdAt: '2026-06-02T16:45:00Z',
    isProfitDistributed: false,
    notes: 'تم استلام الفكرة وبانتظار الدفعة الأولى لبدء العمل',
    assignedUserId: 'Sayed'
  },
  {
    id: 'ord-105',
    clientName: 'ياسين عمر الجارحي',
    phone: '01555432121',
    designsRequested: 4,
    designsCompleted: 4,
    price: 1200,
    paidAmount: 1200,
    status: 'completed',
    tiktokAccountName: 'ياسين سبورت تيك',
    tiktokUsername: 'yassin_sport_tech',
    createdAt: '2026-06-02T20:30:00Z',
    isProfitDistributed: false,
    notes: 'مكتمل وجاهز للتوزيع من قبل المدير المالي',
    assignedUserId: 'Mustafa'
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    title: 'اشتراك شهري أدوبي كريتيف كلاود',
    amount: 350,
    date: '2026-05-15',
    addedBy: 'عمر'
  },
  {
    id: 'exp-2',
    title: 'حزمة خطوط وقوالب تصميم احترافية',
    amount: 200,
    date: '2026-05-20',
    addedBy: 'عمر'
  },
  {
    id: 'exp-3',
    title: 'إعلانات ممولة لصفحة تيك توك',
    amount: 150,
    date: '2026-06-02',
    addedBy: 'عمر'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    orderId: 'ord-101',
    clientName: 'أحمد محمود العتيبي',
    totalAmount: 1500,
    date: '2026-05-29T11:00:00Z',
    allocatedOmar: 900,        // 60%
    allocatedMustafa: 225,    // 15%
    allocatedSayed: 225,      // 15%
    allocatedDevelopment: 150 // 10%
  },
  {
    id: 'tx-2',
    orderId: 'ord-102',
    clientName: 'سارة عبد المجيد',
    totalAmount: 900,
    date: '2026-05-31T08:20:00Z',
    allocatedOmar: 540,        // 60%
    allocatedMustafa: 135,    // 15%
    allocatedSayed: 135,      // 15%
    allocatedDevelopment: 90   // 10%
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    action: 'add_order',
    details: 'تم إضافة طلب جديد للعميل أحمد محمود العتيبي بقيمة 1500 ج.م',
    username: 'عمر',
    timestamp: '2026-05-28T14:31:00Z'
  },
  {
    id: 'log-2',
    action: 'pay_split',
    details: 'تم تأكيد دفع العميل أحمد محمود العتيبي وتوزيع الأرباح تلقائياً على الشركاء وصندوق التطوير',
    username: 'عمر',
    timestamp: '2026-05-29T11:00:23Z'
  },
  {
    id: 'log-3',
    action: 'add_order',
    details: 'تم إضافة طلب جديد للعميلة سارة عبد المجيد بقيمة 900 ج.م',
    username: 'عمر',
    timestamp: '2026-05-30T10:16:00Z'
  },
  {
    id: 'log-4',
    action: 'pay_split',
    details: 'تم تأكيد دفع العميل سارة عبد المجيد وتوزيع الأرباح تلقائياً',
    username: 'عمر',
    timestamp: '2026-05-31T08:20:10Z'
  },
  {
    id: 'log-5',
    action: 'add_order',
    details: 'تم إضافة طلب جديد للعميل خالد بن الوليد بقيمة 2400 ج.م',
    username: 'عمر',
    timestamp: '2026-06-01T09:05:00Z'
  },
  {
    id: 'log-6',
    action: 'add_expense',
    details: 'تم إضافة مصروف جديد: إعلانات ممولة بقيمة 150 ج.م',
    username: 'عمر',
    timestamp: '2026-06-02T16:50:00Z'
  }
];
