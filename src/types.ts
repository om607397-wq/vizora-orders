/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  code: string;
  ratio: number; // e.g. 0.60, 0.15, 0.15
  role: 'admin' | 'user';
}

export interface Order {
  id: string;
  clientName: string;
  phone: string;
  designsRequested: number;
  designsCompleted: number;
  price: number;
  paidAmount: number;
  status: 'completed' | 'processing' | 'pending'; // تم / قيد التنفيذ / انتظار
  tiktokAccountName: string;
  tiktokUsername: string;
  createdAt: string;
  isProfitDistributed: boolean; // True once "تم الدفع وتوزيع الأرباح" is asserted
  notes?: string;
  assignedUserId?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  addedBy: string;
  addedByUid?: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  clientName: string;
  totalAmount: number;
  date: string;
  allocatedOmar: number; // 60%
  allocatedMustafa: number; // 15%
  allocatedSayed: number; // 15%
  allocatedDevelopment: number; // 10%
  createdByUid?: string;
}

export interface ActivityLog {
  id: string;
  action: string; // 'add_order' | 'edit_order' | 'delete_order' | 'pay_split' | 'add_expense' | 'delete_expense' | 'restore_backup'
  details: string;
  username: string;
  timestamp: string;
  userId?: string;
}

export interface ClientStats {
  name: string;
  phone: string;
  tiktokUsername: string;
  totalOrders: number;
  totalPaid: number;
  totalRequested: number;
}
