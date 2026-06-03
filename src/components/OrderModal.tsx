/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: Omit<Order, 'id' | 'createdAt' | 'isProfitDistributed'> & { id?: string }) => void;
  order: Order | null;
  currentUserId?: string;
}

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSubmit, order, currentUserId }) => {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [designsRequested, setDesignsRequested] = useState<number>(1);
  const [designsCompleted, setDesignsCompleted] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [status, setStatus] = useState<Order['status']>('pending');
  const [tiktokAccountName, setTiktokAccountName] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedUserId, setAssignedUserId] = useState(currentUserId || 'Omar');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (order) {
      setClientName(order.clientName);
      setPhone(order.phone);
      setDesignsRequested(order.designsRequested);
      setDesignsCompleted(order.designsCompleted);
      setPrice(order.price);
      setPaidAmount(order.paidAmount);
      setStatus(order.status);
      setTiktokAccountName(order.tiktokAccountName);
      setTiktokUsername(order.tiktokUsername);
      setNotes(order.notes || '');
      setAssignedUserId(order.assignedUserId || 'Omar');
    } else {
      setClientName('');
      setPhone('');
      setDesignsRequested(1);
      setDesignsCompleted(0);
      setPrice(0);
      setPaidAmount(0);
      setStatus('pending');
      setTiktokAccountName('');
      setTiktokUsername('');
      setNotes('');
      setAssignedUserId(currentUserId || 'Omar');
    }
    setErrorMsg('');
  }, [order, isOpen, currentUserId]);

  if (!isOpen) return null;

  // Validate inputs
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg('اسم العميل حقل مطلوب');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('رقم الهاتف حقل مطلوب');
      return;
    }
    if (price <= 0) {
      setErrorMsg('يجب إضافة سعر صالح أكبر من صفر');
      return;
    }
    if (paidAmount < 0) {
      setErrorMsg('المبلغ المدفوع لا يمكن أن يكون سالباً');
      return;
    }
    if (paidAmount > price) {
      setErrorMsg('المبلغ المدفوع لا يمكن أن يتخطى السعر الإجمالي');
      return;
    }
    if (designsRequested < 1) {
      setErrorMsg('عدد التصاميم المطلوبة يجب أن يكون 1 على الأقل');
      return;
    }
    if (designsCompleted > designsRequested) {
      setErrorMsg('عدد التصاميم المنجزة لا يمكن أن يتخطى العدد المطلوب');
      return;
    }

    onSubmit({
      ...(order ? { id: order.id } : {}),
      clientName,
      phone,
      designsRequested,
      designsCompleted,
      price,
      paidAmount,
      status,
      tiktokAccountName: tiktokAccountName.trim() || 'غير محدد',
      tiktokUsername: tiktokUsername.trim() ? (tiktokUsername.startsWith('@') ? tiktokUsername : '@' + tiktokUsername) : 'غير محدد',
      notes,
      assignedUserId
    });

    onClose();
  };

  const isPaidAndDistributed = order?.isProfitDistributed ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-right" dir="rtl">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {order ? 'تعديل تفاصيل الطلب' : 'إضافة طلب جديد'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-640 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isPaidAndDistributed && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                تنبيه أمان: تم دفع هذا الطلب وتوزيع نسب الأرباح مسبقاً على الشركاء. حمايةً للبيانات المالية، تم قفل تعديل السعر والمدفوع. لتغيير السعر، يجب حذف الطلب وإعادة إضافته.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-550 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                placeholder="أحمد علي..."
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                رقم الهاتف <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                placeholder="010XXXXXXXX"
              />
            </div>

            {/* Designs Requested */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                عدد التصاميم المطلوبة
              </label>
              <input
                type="number"
                min="1"
                value={designsRequested}
                onChange={(e) => setDesignsRequested(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-550 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
              />
            </div>

            {/* Designs Completed */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                عدد التصاميم المكتملة
              </label>
              <input
                type="number"
                min="0"
                value={designsCompleted}
                onChange={(e) => setDesignsCompleted(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                السعر الإجمالي (ج.م) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                disabled={isPaidAndDistributed}
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-hidden font-medium transition-all ${
                  isPaidAndDistributed
                    ? 'bg-zinc-150 text-zinc-400 border-zinc-200 cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500'
                    : 'bg-zinc-50 border-zinc-200 focus:border-emerald-550 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-100'
                }`}
              />
            </div>

            {/* Paid amount */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                المبلغ المدفوع مقدماً (ج.م)
              </label>
              <input
                type="number"
                min="0"
                disabled={isPaidAndDistributed}
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-hidden font-medium transition-all ${
                  isPaidAndDistributed
                    ? 'bg-zinc-150 text-zinc-400 border-zinc-200 cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500'
                    : 'bg-zinc-50 border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-100'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TikTok Account Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                اسم حساب التيك توك
              </label>
              <input
                type="text"
                value={tiktokAccountName}
                onChange={(e) => setTiktokAccountName(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                placeholder="مثال: متجر فيزورا وتصميمه"
              />
            </div>

            {/* TikTok Username */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                يوز الكاتب / المعرف التيك توك (@)
              </label>
              <input
                type="text"
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm  focus:outline-hidden focus:border-emerald-555 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                placeholder="@vizora_design"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                حالة الطلب الحالية
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Order['status'])}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium cursor-pointer"
              >
                <option value="pending">⏳ انتظار (قيد البدء)</option>
                <option value="processing">⚙️ قيد التنفيذ (تصميم جاري)</option>
                <option value="completed">💚 تم (شغل مكتمل ومستلم)</option>
              </select>
            </div>

            {/* Assigned Partner */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                الشريك المسؤول عن الطلب
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium cursor-pointer"
              >
                <option value="Omar">عمر (المدير)</option>
                <option value="Mustafa">محمد مصطفى</option>
                <option value="Sayed">محمد السيد</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
              ملاحظات إضافية بخصوص الطلب (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
              placeholder="اكتب أي ملاحظات عمل هنا..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-zinc-650 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] transform transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98] flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>حفظ البيانات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
