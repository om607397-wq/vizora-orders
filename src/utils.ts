/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Expense, Transaction, ActivityLog } from './types';

// Format currency in Arabic style
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 1
  }).format(amount).replace('جم', 'ج.م');
}

// Convert UTC/ISO date to elegant Arabic date representation
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Simple CSV / XLS Exporter for Excel Compatibility with perfect Arabic and column Support
export function exportOrdersToCSV(orders: Order[]): void {
  // We'll export as a genuine Excel HTML/XML spreadsheet (.xls) to perfectly preserve columns, 
  // prevent Arabic character corruption, and keep phone numbers' leading zeros.
  const headers = [
    'معرف الطلب',
    'اسم العميل',
    'رقم الهاتف',
    'التصاميم المطلوبة',
    'التصاميم المنجزة',
    'السعر الكلي',
    'المبلغ المدفوع',
    'الحالة',
    'حساب التيك توك',
    'يوزر التيك توك',
    'حالة الأرباح',
    'تاريخ الإنشاء',
    'ملاحظات'
  ];

  const rows = orders.map(order => [
    order.id,
    order.clientName,
    order.phone,
    order.designsRequested,
    order.designsCompleted,
    order.price,
    order.paidAmount,
    order.status === 'completed' ? 'تم' : order.status === 'processing' ? 'قيد التنفيذ' : 'انتظار',
    order.tiktokAccountName,
    order.tiktokUsername,
    order.isProfitDistributed ? 'موزعة' : 'معلقة',
    new Date(order.createdAt).toLocaleDateString('ar-EG'),
    order.notes || ''
  ]);

  // Construct XML/HTML excel content with UTF-8 encoding & RTL orientation
  let excelTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl">
<head>
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>طلبات فيزورا</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; }
  th { background-color: #059669; color: #ffffff; font-weight: bold; border: 1px solid #d4d4d8; padding: 8px 12px; text-align: right; }
  td { border: 1px solid #d4d4d8; padding: 8px 12px; text-align: right; }
  /* Force text formatting to keep phone numbers leading zeros and prevent exponent triggers */
  .text-cell { mso-number-format:"\\@"; }
</style>
</head>
<body>
<table>
  <thead>
    <tr>
      ${headers.map(h => `<th>${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${rows.map(row => `
      <tr>
        <td class="text-cell">${String(row[0]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[1]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td class="text-cell">${String(row[2]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[3]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[4]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[5]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[6]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[7]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[8]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[9]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[10]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[11]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row[12]).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      </tr>
    `).join('')}
  </tbody>
</table>
</body>
</html>`;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `طلبات_فيزورا_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Copy order details to clipboard as styled text message
export function copyOrderToClipboard(order: Order): Promise<boolean> {
  const text = `📋 تفاصيل طلب Vizora Orders:
---------------------------
العميل: ${order.clientName}
الهاتف: ${order.phone}
الحالة: ${order.status === 'completed' ? '🔴 تم التسليم' : order.status === 'processing' ? '🟡 قيد التنفيذ' : '⚪ معلق'}
التصاميم: ${order.designsCompleted} من ${order.designsRequested} مكتمل
الحساب: ${order.tiktokAccountName} (${order.tiktokUsername})
المبلغ الكلي: ${order.price} ج.م
المدفوع: ${order.paidAmount} ج.م
المتبقي: ${order.price - order.paidAmount} ج.م
دفع الأرباح: ${order.isProfitDistributed ? '✅ تم توزيع الأرباح على الشركاء' : '⏳ جاري مراجعة الدفع'}
التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-EG')}
${order.notes ? `ملاحظات: ${order.notes}` : ''}`;

  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => false);
}
