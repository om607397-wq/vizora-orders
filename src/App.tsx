/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { db, auth, loginWithCode, logout } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { User, Order, Expense, Transaction, ActivityLog, ClientStats } from './types';
import { PREDEFINED_USERS, INITIAL_ORDERS, INITIAL_EXPENSES, INITIAL_TRANSACTIONS, INITIAL_LOGS } from './initialData';
import { formatCurrency, formatDate, exportOrdersToCSV, copyOrderToClipboard } from './utils';
import { DonutChart, BarComparison } from './components/Charts';
import { OrderModal } from './components/OrderModal';
import { ExpenseModal } from './components/ExpenseModal';
import {
  Users,
  Coins,
  TrendingUp,
  Activity,
  Download,
  Upload,
  LogOut,
  Sun,
  Moon,
  Plus,
  Trash2,
  Edit3,
  Copy,
  DollarSign,
  Search,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  Wallet,
  FileText,
  Key,
  Database,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  Check,
  UserCheck
} from 'lucide-react';

export default function App() {
  // --- Persistent State Hooks ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- USER LEVEL VISIBILITY CHECK (Permission System) ---
  const isAdmin = currentUser?.role === 'admin';

  const [logoConfig, setLogoConfig] = useState<{
    type: 'svg' | 'image';
    imageUrl: string;
    text: string;
  }>(() => {
    const local = localStorage.getItem('vizora_logo_config');
    return local ? JSON.parse(local) : {
      type: 'svg',
      imageUrl: '',
      text: 'Vizora Orders'
    };
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const local = localStorage.getItem('vizora_dark_mode');
    return local ? JSON.parse(local) === 'true' : false;
  });

  // --- UI/UX Interactive States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'expenses' | 'clients' | 'logs' | 'backup'>('dashboard');
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Custom Toasts Notification System
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  // Search & Filter state for Orders spreadsheet
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | Order['status']>('all');
  const [orderDateRange, setOrderDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [orderPage, setOrderPage] = useState(1);
  const itemsPerPage = 8;

  // Modals management
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutPartnerName, setPayoutPartnerName] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    type: 'order' | 'expense';
    title: string;
    message: string;
  } | null>(null);
  const [logoEditOpen, setLogoEditOpen] = useState(false);
  const [tempLogoUrl, setTempLogoUrl] = useState('');
  const [tempLogoText, setTempLogoText] = useState('');

  // --- Synchronized Cloud / Server States ---
  const [isSyncLoading, setIsSyncLoading] = useState(true);
  const [confirmProfitDistribution, setConfirmProfitDistribution] = useState<{
    id: string;
    clientName: string;
    price: number;
  } | null>(null);

  // --- Side Effects for Persistence ---
  useEffect(() => {
    localStorage.setItem('vizora_logo_config', JSON.stringify(logoConfig));
  }, [logoConfig]);

  useEffect(() => {
    localStorage.setItem('vizora_dark_mode', isDarkMode ? 'true' : 'false');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as User);
          } else {
            // Document doesn't exist yet, we create it from PREDEFINED_USERS based on email matching
            const matchedUser = PREDEFINED_USERS.find(u => `${u.code}@vizora.test` === user.email);
            if (matchedUser) {
              const newUser: User = {
                ...matchedUser,
                id: user.uid, // Override id with Firebase uid
              };
              await setDoc(doc(db, "users", user.uid), newUser);
              setCurrentUser(newUser);
            } else {
               // Fallback
               const newUser: User = {
                 id: user.uid,
                 name: 'مستخدم جديد',
                 code: '0000',
                 ratio: 0,
                 role: 'user'
               };
               await setDoc(doc(db, "users", user.uid), newUser);
               setCurrentUser(newUser);
            }
          }
        } catch (error) {
          console.error("Error fetching user", error);
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Realtime Server State Synchronization with Firestore ---
  useEffect(() => {
    if (!currentUser) {
      setIsSyncLoading(false);
      return;
    }
    
    setIsSyncLoading(true);

    const unsubOrders = onSnapshot(query(collection(db, "orders")), (snapshot) => {
      const dbOrders: Order[] = [];
      snapshot.forEach(doc => { dbOrders.push({ id: doc.id, ...doc.data() } as Order); });
      // Sort client-side by date desc
      setOrders(dbOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setIsSyncLoading(false);
    }, (error) => console.error("Error fetching orders:", error));

    const unsubExpenses = onSnapshot(query(collection(db, "expenses")), (snapshot) => {
      const dbExpenses: Expense[] = [];
      snapshot.forEach(doc => { dbExpenses.push({ id: doc.id, ...doc.data() } as Expense); });
      setExpenses(dbExpenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => console.error("Error fetching expenses:", error));

    const unsubTx = onSnapshot(query(collection(db, "transactions")), (snapshot) => {
      const dbTx: Transaction[] = [];
      snapshot.forEach(doc => { dbTx.push({ id: doc.id, ...doc.data() } as Transaction); });
      setTransactions(dbTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => console.error("Error fetching transactions:", error));

    const unsubLogs = onSnapshot(query(collection(db, "logs")), (snapshot) => {
      const dbLogs: ActivityLog[] = [];
      snapshot.forEach(doc => { dbLogs.push({ id: doc.id, ...doc.data() } as ActivityLog); });
      setLogs(dbLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => console.error("Error fetching logs:", error));

    return () => {
      unsubOrders();
      unsubExpenses();
      unsubTx();
      unsubLogs();
    };
  }, [currentUser]);

  // Toast Trigger Helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Log Activity Helper
  const logActivity = async (action: ActivityLog['action'], details: string) => {
    if (!currentUser) return;
    const logId = `log-${Date.now()}`;
    const newLog: ActivityLog = {
      id: logId,
      action,
      details,
      username: currentUser.name || 'زائر',
      timestamp: new Date().toISOString(),
      userId: currentUser.id
    };
    try {
      await setDoc(doc(db, "logs", logId), newLog);
    } catch (e) {
      console.error("Log error", e);
    }
  };

  // --- Authentication Handler ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = loginCode.trim();
    const foundUser = PREDEFINED_USERS.find(user => user.code === cleanCode);

    if (foundUser) {
      try {
        const email = `${foundUser.code}@vizora.test`;
        const pass = `vizora${foundUser.code}secure`;
        const user = await loginWithCode(email, pass);
        setActiveTab('dashboard');
        setLoginCode('');
        setLoginError('');
        
        logActivity('restore_backup', `سجل الدخول للشريك: ${foundUser.name}`);
        showToast(`تم تسجيل الدخول بنجاح كـ ${foundUser.name}`, 'success');
      } catch (error) {
        setLoginError('حدث خطأ أثناء الاتصال بقاعدة البيانات.');
        showToast('فشل تسجيل الدخول يرجى المحاولة مرة أخرى', 'error');
      }
    } else {
      setLoginError('كود المرور المدخل غير صحيح، يرجى المحاولة مرة أخرى.');
      showToast('فشل تسجيل الدخول: كود غير صحيح', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setActiveTab('dashboard');
      showToast('تم تسجيل الخروج بنجاح', 'info');
    } catch (error) {
       console.error("Logout error", error);
    }
  };

  // --- CRUD Operations for Orders (Admin Only) ---
  const handleAddOrEditOrderSubmit = async (orderData: any) => {
    const timestamp = new Date().toISOString();

    if (orderData.id) {
      // Editing Mode
      const originalOrder = orders.find(o => o.id === orderData.id);
      if (!originalOrder) return;

      // Protection check: Cannot change price after profit allocation
      if (originalOrder.isProfitDistributed && (orderData.price !== originalOrder.price || orderData.paidAmount !== originalOrder.paidAmount)) {
        showToast('خطأ أمان: لا يمكن تعديل التدفقات المالية لطلب تم توزيع أرباحه بالفعل', 'error');
        return;
      }

      try {
        await updateDoc(doc(db, "orders", orderData.id), orderData);
        logActivity('edit_order', `تم تعديل بيانات طلب العميل ${orderData.clientName} بقيمة ${orderData.price} ج.م`);
        showToast(`تم تحديث الطلب بقيمة ${orderData.price} ج.م للعميل ${orderData.clientName}`, 'success');
      } catch (e) {
        showToast('فشل تعديل الطلب', 'error');
      }
    } else {
      // Creation Mode
      const orderId = `ord-${Date.now().toString().slice(-4)}`;
      const newOrder: Order = {
        id: orderId,
        ...orderData,
        createdAt: timestamp,
        isProfitDistributed: false
      };

      try {
        await setDoc(doc(db, "orders", orderId), newOrder);
        logActivity('add_order', `تم إضافة طلب جديد للعميل ${newOrder.clientName} بقيمة ${newOrder.price} ج.م`);
        showToast(`تم إضافة طلب بنجاح للعميل ${newOrder.clientName}`, 'success');
      } catch (e) {
        showToast('فشل إضافة الطلب', 'error');
      }
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    setConfirmDelete({
      id: orderId,
      type: 'order',
      title: '⚠️ تأكيد حذف الطلب والبيانات المالية',
      message: `هل أنت متأكد من حذف طلب العميل: (${orderToDelete.clientName})؟ سيؤدي ذلك أيضاً إلى فقدان سجل العمليات الخاص بالطلب والبيانات المالية المرافقة له.`
    });
  };

  const executeConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    if (type === 'order') {
      const orderToDelete = orders.find(o => o.id === id);
      if (orderToDelete) {
        try {
          await deleteDoc(doc(db, "orders", id));
          
          // Delete transactions logic should really be a batch, but keeping simple for migration
          const docs = await getDocs(query(collection(db, "transactions")));
          docs.forEach(async (d) => {
             if (d.data().orderId === id) {
               await deleteDoc(doc(db, "transactions", d.id));
             }
          });

          logActivity('delete_order', `تم حذف طلب العميل ${orderToDelete.clientName} بقيمة ${orderToDelete.price} ج.م`);
          showToast('تم حذف الطلب والبيانات المالية المرتبطة به بنجاح', 'info');
        } catch (e) {
           showToast('حدث خطأ أثناء حذف الطلب', 'error');
        }
      }
    } else if (type === 'expense') {
      const exp = expenses.find(e => e.id === id);
      if (exp) {
        try {
          await deleteDoc(doc(db, "expenses", id));
          logActivity('delete_expense', `حذف بند المصروف: ${exp.title} بقيمة ${exp.amount} ج.م`);
          showToast('تم حذف بند المصروف المالي بنجاح', 'info');
        } catch (e) {
           showToast('حدث خطأ أثناء حذف المصروف', 'error');
        }
      }
    }
    setConfirmDelete(null);
  };

  // --- Automatic Profit Split Execution ---
  const handleDistributeProfit = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Protection rule
    if (order.isProfitDistributed) {
      showToast('الأرباح موزعة بالفعل لهذا الطلب', 'info');
      return;
    }

    setConfirmProfitDistribution({
      id: order.id,
      clientName: order.clientName,
      price: order.price
    });
  };

  const executeProfitDistribution = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !currentUser) return;

    if (order.isProfitDistributed) {
      showToast('الأرباح موزعة بالفعل لهذا الطلب', 'info');
      return;
    }

    const totalToDistribute = order.price;
    const txId = `tx-${Date.now().toString().slice(-4)}`;

    // 1. Create financial transaction ledger allocation
    const newTx: Transaction = {
      id: txId,
      orderId: order.id,
      clientName: order.clientName,
      totalAmount: totalToDistribute,
      date: new Date().toISOString(),
      allocatedOmar: totalToDistribute * 0.60,
      allocatedMustafa: totalToDistribute * 0.15,
      allocatedSayed: totalToDistribute * 0.15,
      allocatedDevelopment: totalToDistribute * 0.10,
      createdByUid: currentUser.id
    };

    try {
      await setDoc(doc(db, "transactions", txId), newTx);
      
      // 2. Mark order as completed and paid and distributed
      await updateDoc(doc(db, "orders", orderId), {
        status: 'completed',
        paidAmount: totalToDistribute, // force paid amount to match price
        isProfitDistributed: true
      });

      // 3. Keep log entries updated
      logActivity('pay_split', `تم تسجيل عملية دفع وتوزيع الأرباح لطلب ${order.clientName} بقيمة ${totalToDistribute} ج.م`);
      showToast(`مكتمل! تم سداد وتوزيع أرباح بقيمة ${totalToDistribute} ج.م وتوزيع المصارف على الشركاء بنجاح.`, 'success');
    } catch (e) {
      showToast('فشل توزيع الأرباح، يرجى المحاولة لاحقاً', 'error');
    }
    setConfirmProfitDistribution(null);
  };

  // --- Expense Handlers ---
  const handleAddExpenseSubmit = async (expenseData: any) => {
    if (!currentUser) return;
    const expId = `exp-${Date.now().toString().slice(-4)}`;
    const newExpense: Expense = {
      id: expId,
      ...expenseData,
      addedBy: currentUser.name || 'المدير',
      addedByUid: currentUser.id
    };

    try {
      await setDoc(doc(db, "expenses", expId), newExpense);
      logActivity('add_expense', `تم تسجيل بند مصروفات: ${newExpense.title} بمبلغ ${newExpense.amount} ج.م`);
      showToast(`تم تسجيل مصروف بقيمة ${newExpense.amount} ج.م في النظام`, 'success');
    } catch (e) {
      showToast('فشل إضافة المصروفات', 'error');
    }
  };

  const handleDeleteExpense = (id: string) => {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    setConfirmDelete({
      id,
      type: 'expense',
      title: 'تأكيد حذف بند المصروف',
      message: `هل أنت متأكد من رغبتك في حذف بند المصروف: "${exp.title}" بقيمة ${exp.amount} ج.م نهائياً من سجلات المشروع المالية؟`
    });
  };

  const handleRegisterPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('من فضلك أدخل مبلغاً صحيحاً أكبر من الصفر', 'error');
      return;
    }

    const expId = `exp-pay-${Date.now().toString().slice(-4)}`;
    const newExpense: Expense = {
      id: expId,
      title: `سحب أرباح - ${payoutPartnerName}`,
      amount: amountNum,
      date: new Date().toISOString(),
      addedBy: currentUser.name || 'المدير',
      addedByUid: currentUser.id
    };

    try {
      await setDoc(doc(db, "expenses", expId), newExpense);
      logActivity('add_expense', `سحب مسحوبات أرباح للشريك ${payoutPartnerName} بقيمة ${amountNum} ج.م`);
      showToast(`تم تسجيل سحب أرباح للشريك ${payoutPartnerName} بمبلغ ${amountNum} ج.م بنجاح`, 'success');
      
      // Reset state
      setIsPayoutModalOpen(false);
      setPayoutPartnerName('');
      setPayoutAmount('');
    } catch (err) {
      showToast('حدث خطأ أثناء تسجيل السحب', 'error');
    }
  };

  // --- Logo Modification Form Handlers ---
  const saveLogoConfigChanges = () => {
    setLogoConfig({
      type: tempLogoUrl.trim() ? 'image' : 'svg',
      imageUrl: tempLogoUrl.trim(),
      text: tempLogoText.trim() || 'Vizora Orders'
    });
    setLogoEditOpen(false);
    showToast('تم تحديث هوية ولوجو Vizora بنجاح', 'success');
    logActivity('restore_backup', 'تم تعديل إعدادات وهوية اللوجو الخاص بالمنصة');
  };

  // --- Financial Analytics Calculations ---
  const financialSummary = useMemo(() => {
    // Total Revenue of distributed orders
    const totalTransactionsAmount = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
    
    // Dynamic Partner Splits
    const omarProfits = transactions.reduce((acc, t) => acc + t.allocatedOmar, 0);
    const mustafaProfits = transactions.reduce((acc, t) => acc + t.allocatedMustafa, 0);
    const sayedProfits = transactions.reduce((acc, t) => acc + t.allocatedSayed, 0);
    const developmentFundRaw = transactions.reduce((acc, t) => acc + t.allocatedDevelopment, 0);

    // Sum of all custom business expenses
    const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

    // Filter withdrawals per partner from the expenses table
    const omarWithdrawn = expenses
      .filter(e => e.title.includes('سحب أرباح - عمر') || e.title.includes('مسحوبات الشريك عمر'))
      .reduce((acc, e) => acc + e.amount, 0);

    const mustafaWithdrawn = expenses
      .filter(e => e.title.includes('سحب أرباح - محمد مصطفى') || e.title.includes('سحب أرباح - مصطفى') || e.title.includes('مسحوبات الشريك محمد مصطفى'))
      .reduce((acc, e) => acc + e.amount, 0);

    const sayedWithdrawn = expenses
      .filter(e => e.title.includes('سحب أرباح - محمد السيد') || e.title.includes('سحب أرباح - السيد') || e.title.includes('مسحوبات الشريك محمد السيد'))
      .reduce((acc, e) => acc + e.amount, 0);

    // General development/operational expenses (not partner withdrawals)
    const developmentExpenses = expenses
      .filter(e => !e.title.includes('سحب أرباح -') && !e.title.includes('مسحوبات الشريك'))
      .reduce((acc, e) => acc + e.amount, 0);

    // Total calculated pending unpaid orders price
    const pendingOrdersVal = orders
      .filter(o => !o.isProfitDistributed)
      .reduce((acc, o) => acc + o.price, 0);

    const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
    const processingOrdersCount = orders.filter(o => o.status === 'processing').length;
    const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

    // Net Business Profit
    const netProfit = totalTransactionsAmount - totalExpensesAmount;

    // Remaining balances calculated safely
    const omarBalance = omarProfits - omarWithdrawn;
    const mustafaBalance = mustafaProfits - mustafaWithdrawn;
    const sayedBalance = sayedProfits - sayedWithdrawn;
    const availableFund = developmentFundRaw - developmentExpenses;

    return {
      totalRevenue: totalTransactionsAmount,
      totalExpenses: totalExpensesAmount,
      netProfit,
      omarShare: omarProfits,
      mustafaShare: mustafaProfits,
      sayedShare: sayedProfits,
      omarWithdrawn,
      mustafaWithdrawn,
      sayedWithdrawn,
      omarBalance,
      mustafaBalance,
      sayedBalance,
      rawFund: developmentFundRaw,
      availableFund,
      developmentExpenses,
      pendingVolume: pendingOrdersVal,
      completedOrdersCount,
      processingOrdersCount,
      pendingOrdersCount
    };
  }, [orders, expenses, transactions]);

  // --- Client History Records Generator ---
  const clientProfiles = useMemo((): ClientStats[] => {
    const clientMap: { [key: string]: ClientStats } = {};

    orders.forEach(order => {
      // Clean phone or nickname to group
      const key = order.clientName.trim();
      if (!clientMap[key]) {
        clientMap[key] = {
          name: order.clientName,
          phone: order.phone,
          tiktokUsername: order.tiktokUsername,
          totalOrders: 0,
          totalPaid: 0,
          totalRequested: 0
        };
      }

      clientMap[key].totalOrders += 1;
      clientMap[key].totalRequested += order.price;
      clientMap[key].totalPaid += order.paidAmount;
      // Keep phone updated if empty or default
      if (order.phone && order.phone !== 'غير محدد') {
        clientMap[key].phone = order.phone;
      }
      if (order.tiktokUsername && order.tiktokUsername !== 'غير محدد') {
        clientMap[key].tiktokUsername = order.tiktokUsername;
      }
    });

    return Object.values(clientMap);
  }, [orders]);

  // --- Search & Spreadsheet Filtering Logic ---
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch =
        order.clientName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        order.phone.includes(orderSearchQuery) ||
        order.tiktokAccountName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        order.tiktokUsername.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(orderSearchQuery.toLowerCase());

      const matchesStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;

      let matchesDate = true;
      if (orderDateRange !== 'all') {
        const orderDate = new Date(order.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (orderDateRange === 'today') {
          matchesDate = orderDate.toDateString() === now.toDateString();
        } else if (orderDateRange === 'week') {
          matchesDate = diffDays <= 7;
        } else if (orderDateRange === 'month') {
          matchesDate = diffDays <= 30;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [orders, orderSearchQuery, orderStatusFilter, orderDateRange]);

  // Pagination slice
  const paginatedOrders = useMemo(() => {
    const startIndex = (orderPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, orderPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;

  // --- Backup & Restore Engine (JSON Import/Export) ---
  const handleDownloadBackup = () => {
    const backupPayload = {
      appId: 'vizora-orders-premium-backup',
      timestamp: new Date().toISOString(),
      orders,
      expenses,
      transactions,
      logs,
      logoConfig
    };

    const dataBlob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const fileUrl = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `نسخة_احتياطية_Vizora_Orders_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logActivity('restore_backup', 'تم تحميل وتصدير نسخة احتياطية مشفرة من البيانات المالية والطلبات');
    showToast('تم تحميل ملف النسخة الاحتياطية JSON بنجاح', 'success');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (window.confirm('⚠️ تحذير شديد: استيراد النسخة الاحتياطية سيقوم باستبدال كافة البيانات الحالية بالكامل في الذاكرة المحلية (LocalStorage). هل أنت متأكد من المتابعة؟')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target?.result as string);
          
          if (parsedData.orders && parsedData.transactions && parsedData.expenses) {
            setOrders(parsedData.orders);
            setExpenses(parsedData.expenses);
            setTransactions(parsedData.transactions);
            if (parsedData.logs) setLogs(parsedData.logs);
            if (parsedData.logoConfig) setLogoConfig(parsedData.logoConfig);
            
            showToast('تم استعادة البيانات والملفات المالية بنجاح كامل', 'success');
            // Log addition
            const restoredLog: ActivityLog = {
              id: `log-restore-${Date.now()}`,
              action: 'restore_backup',
              details: `تم استعادة النسخة الاحتياطية بنجاح واستبدال البيانات السابقة`,
              username: currentUser?.name || 'المدير',
              timestamp: new Date().toISOString()
            };
            setLogs(prev => [restoredLog, ...prev]);
          } else {
            showToast('تحذير: صيغة ملف النسخة الاحتياطية غير صالحة للتحميل', 'error');
          }
        } catch (error) {
          showToast('فشل في قراءة ملف JSON أو الملف تالف', 'error');
        }
      };
      reader.readAsText(uploadedFile);
    }
    // reset target value to allow uploading same file
    e.target.value = '';
  };

  const resetAllDataToDefault = () => {
    if (window.confirm('⚠️ تحذير نهائي: هل أنت متأكد من رغبتك في تصفير كل شيء وإعادة تحميل البيانات الافتراضية؟ سيتم إزالة جميع الأرباح والمدفوعات والمصروفات المستجدة!')) {
      setOrders(INITIAL_ORDERS);
      setExpenses(INITIAL_EXPENSES);
      setTransactions(INITIAL_TRANSACTIONS);
      setLogs(INITIAL_LOGS);
      setLogoConfig({
        type: 'svg',
        imageUrl: '',
        text: 'Vizora Orders'
      });
      showToast('تم تصفير النظام وإعادة البيانات النموذجية الأولية', 'info');
      logActivity('restore_backup', 'تم إعادة تهيئة قاعدة البيانات المحلية للقيم الافتراضية');
    }
  };

  // Setup initial logo form values
  const openLogoSettings = () => {
    setTempLogoUrl(logoConfig.imageUrl);
    setTempLogoText(logoConfig.text);
    setLogoEditOpen(true);
  };

  // Partner dashboard stats (when non-admin checks their performance)
  const userStats = useMemo(() => {
    if (!currentUser) return { earnings: 0, ratio: 0, count: 0, transactionsList: [], withdrawn: 0, balance: 0 };
    
    // Find ratio
    const userRatio = currentUser.ratio;
    
    // Calculate total allocations
    const matchesTx = transactions.map(t => {
      let personalShare = 0;
      if (currentUser.id === 'Mustafa') personalShare = t.allocatedMustafa;
      else if (currentUser.id === 'Sayed') personalShare = t.allocatedSayed;
      else if (currentUser.id === 'Omar') personalShare = t.allocatedOmar;

      return {
        ...t,
        personalShare
      };
    }).filter(t => t.personalShare > 0);

    const totalPersonalEarnings = matchesTx.reduce((acc, t) => acc + t.personalShare, 0);

    // Filter withdrawals of this partner
    const userName = currentUser.name; // 'عمر', 'محمد مصطفى', or 'محمد السيد'
    const withdrawnValue = expenses
      .filter(e => {
        const lowerTitle = e.title.toLowerCase();
        return lowerTitle.includes(`سحب أرباح - ${userName}`) || 
               lowerTitle.includes(`مسحوبات الشريك ${userName}`) ||
               (userName === 'محمد مصطفى' && (lowerTitle.includes('مصطفى') && lowerTitle.includes('سحب أرباح'))) ||
               (userName === 'محمد السيد' && (lowerTitle.includes('السيد') && lowerTitle.includes('سحب أرباح'))) ||
               (userName === 'عمر' && (lowerTitle.includes('عمر') && lowerTitle.includes('سحب أرباح')));
      })
      .reduce((acc, e) => acc + e.amount, 0);

    const remainingBalance = totalPersonalEarnings - withdrawnValue;

    return {
      earnings: totalPersonalEarnings,
      ratio: userRatio * 100,
      count: matchesTx.length,
      transactionsList: matchesTx,
      withdrawn: withdrawnValue,
      balance: remainingBalance
    };
  }, [currentUser, transactions, expenses]);

  const activeUserLogs = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return logs; // displays all actions
    return logs.filter(log => log.username === currentUser.name); // user actions only
  }, [logs, currentUser, isAdmin]);

  const visibleExpenses = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return expenses;
    return expenses.filter(e => e.addedBy === currentUser.name);
  }, [expenses, currentUser, isAdmin]);

  // --- UNAUTHENTICATED: Render Login Box ---
  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-500 font-sans ${isDarkMode ? 'bg-zinc-950 text-white' : 'bg-slate-50/70 text-slate-900'}`} dir="rtl">
        <div className="absolute top-4 left-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl shadow-xs transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-650" />}
          </button>
        </div>

        <div className="max-w-md w-full bg-white dark:bg-zinc-900 text-right p-8 border border-zinc-100 dark:border-zinc-800/80 rounded-3xl shadow-2xl space-y-6">
          
          {/* Vizora premium brand graphic */}
          <div className="flex flex-col items-center text-center space-y-3">
            {logoConfig.type === 'image' && logoConfig.imageUrl ? (
              <img
                src={logoConfig.imageUrl}
                alt={logoConfig.text}
                referrerPolicy="no-referrer"
                className="h-16 w-16 object-contain rounded-2xl shadow-md border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-500/10 border-2 border-emerald-400/20 font-mono">
                V
              </div>
            )}
            
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 font-sans tracking-tight">
              {logoConfig.text}
            </h1>
            <p className="text-xs text-zinc-500 max-w-[280px]">
              منصة ذكية متكاملة لإدارة الصفقات وتوزيع الأرباح والنسب للشركاء تلقائياً
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                كود تسجيل الدخول الخاص بك
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="أدخل كود المرور المكون من أرقام..."
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center text-lg font-bold tracking-widest focus:outline-hidden focus:border-emerald-550 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-50 transition-all"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-zinc-400">
                  <Key className="w-4 h-4" />
                </span>
              </div>
            </div>

            {loginError && (
              <p className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] transform text-white font-bold py-3 px-4 rounded-xl text-sm transition-all focus:ring-2 focus:ring-emerald-500/50 active:scale-[0.99] shadow-md shadow-emerald-600/10"
            >
              تسجيل دخول آمن
            </button>
          </form>

          {/* Prompt options */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-400 font-semibold block">الأكواد المخصصة للمدير والشركاء معلنة للتجربة في مواصفات النظام:</span>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 px-2 py-1 rounded-sm">عمر: 452009 (المدير)</span>
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 px-2 py-1 rounded-sm">محمد مصطفى: 342007</span>
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 px-2 py-1 rounded-sm">محمد السيد: 2009</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED: Main Application Layout ---
  return (
    <div className={`min-h-screen font-sans flex flex-col transition-all duration-300 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-[#f8fafc] text-slate-900'}`} dir="rtl">
      
      {/* Toast Notifications Panel */}
      <div className="fixed top-5 left-5 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center justify-between animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-250 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-900/50'
                : toast.type === 'error'
                ? 'bg-red-50 text-red-950 border-red-250 dark:bg-zinc-900 dark:text-red-400 dark:border-red-900/50'
                : 'bg-zinc-50 text-zinc-950 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-900 px-4 md:px-6 py-2.5 md:py-4 h-16 flex items-center justify-between shadow-xs">
        
        {/* Brand Logo Display */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 md:p-2 lg:hidden rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </button>

          <div className="flex items-center gap-1.5 md:gap-2">
            {logoConfig.type === 'image' && logoConfig.imageUrl ? (
              <img
                src={logoConfig.imageUrl}
                alt={logoConfig.text}
                referrerPolicy="no-referrer"
                className="h-8 w-8 md:h-9 md:w-9 object-contain rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 md:w-9 md:h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-md md:text-lg shadow-sm shadow-emerald-500/20 font-mono">
                V
              </div>
            )}
            <span className="font-extrabold text-sm md:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-emerald-600 to-zinc-900 dark:from-emerald-400 dark:to-zinc-100 font-sans max-w-[120px] md:max-w-none truncate">
              {logoConfig.text}
            </span>
          </div>

          <span className="hidden md:inline-flex text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
            RTL التجاري الآمن
          </span>
        </div>

        {/* Dynamic Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Logo Customize Trigger for Admin */}
          {isAdmin && (
            <button
              onClick={openLogoSettings}
              title="تخصيص اللوجو واسم الموقع"
              className="hidden sm:flex p-2 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-all text-xs items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="hidden md:inline">ألوان وتعديل اللوجو</span>
            </button>
          )}

          {/* Dark Mode toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
            title="تغيير المظهر"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5 text-indigo-650" />}
          </button>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* Active Operator Chip */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-150 dark:border-zinc-800 text-right">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-right">
              <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-50 line-clamp-1">
                {currentUser.name}
              </span>
              <span className="block text-[9px] font-semibold text-zinc-400">
                {isAdmin ? 'المدير العام (Admin)' : 'شريك مالي للعمل'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="تسجيل خروج"
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </nav>

      {/* Main Container Grid */}
      <div className="flex-1 flex flex-col lg:flex-row relative">

        {/* Sidebar Component */}
        <aside className={`
          fixed lg:static inset-y-0 right-0 z-40 lg:z-10
          w-64 max-w-[280px] bg-white dark:bg-zinc-950 border-l border-zinc-200/50 dark:border-zinc-900/80 p-5 flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <div className="space-y-6">
            <div className="flex items-center justify-between lg:hidden pb-4 border-b border-zinc-100 dark:border-zinc-900">
              <span className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100">قائمة التنقل</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-550 dark:text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">رئيسي</span>
              
              {/* Dashboard tab */}
              <button
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                    : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>لوحة التحكم والشركاء</span>
                {isAdmin && (
                  <span className="mr-auto text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold px-2 py-0.5 rounded-full">الكل</span>
                )}
              </button>

              {/* Orders tab */}
              <button
                onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                  activeTab === 'orders'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                    : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>إدارة الطلبات والصفقات</span>
                <span className="mr-auto text-[9px] bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">
                  {orders.length}
                </span>
              </button>

              {/* Expenses tab (only visible to see/add for managers, but let's allow read/write depending on permission) */}
              <button
                onClick={() => { setActiveTab('expenses'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                  activeTab === 'expenses'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                    : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>مصروفات العمل والمواد</span>
                <span className="mr-auto text-[9px] bg-zinc-100 dark:bg-zinc-850 text-zinc-500 font-semibold px-2 py-0.5 rounded-full">
                  {expenses.length}
                </span>
              </button>

              {isAdmin && (
                <>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 pt-4 mb-2">التقارير المتقدمة</span>

                  {/* Clients Directory tab */}
                  <button
                    onClick={() => { setActiveTab('clients'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                      activeTab === 'clients'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                        : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>دليل وسجل العملاء</span>
                    <span className="mr-auto text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                      {clientProfiles.length}
                    </span>
                  </button>
                </>
              )}

              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 pt-4 mb-2">المتابعة والتوثيق</span>

              {/* Activity Log tab */}
              <button
                onClick={() => { setActiveTab('logs'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                  activeTab === 'logs'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                    : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>سجل العمليات التاريخي</span>
              </button>

              {isAdmin && (
                /* Safe Backup tab */
                <button
                  onClick={() => { setActiveTab('backup'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all border-r-3 ${
                    activeTab === 'backup'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500'
                      : 'text-zinc-650 hover:bg-zinc-50 border-transparent dark:text-zinc-300 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>النسخة الاحتياطية والاستيراد</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900/50 space-y-3">
            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/40 dark:border-emerald-900/20">
              <span className="block text-[10px] font-bold text-center text-emerald-800 dark:text-emerald-400 mb-1">نسب الشركاء بموجب العقد</span>
              <div className="space-y-1 text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>الشريك عمر (المدير):</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-200">60%</span>
                </div>
                <div className="flex justify-between">
                  <span>محمد مصطفى:</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-200">15%</span>
                </div>
                <div className="flex justify-between">
                  <span>محمد السيد:</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-200">15%</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-1 mt-1 text-emerald-700 dark:text-emerald-400">
                  <span>صندوق التطوير:</span>
                  <span className="font-mono">10%</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <span className="text-[9px] font-semibold text-zinc-400">منصة Vizora للأعمال الفنية</span>
              <span className="block text-[8px] font-mono text-zinc-450 dark:text-zinc-500">v2.0.1Premium-Local</span>
            </div>
          </div>
        </aside>

        {/* Sidebar Overlay for Mobile Layout */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Dynamic App Pages */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

          {/* PAGE 1: DASHBOARD AND STATS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Top summary greeting card */}
              <div className="bg-gradient-to-l from-emerald-600 to-indigo-900 p-6 md:p-8 rounded-3xl text-white shadow-lg space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-20 -translate-y-20 blur-2xl" />
                <div className="absolute bottom-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full translate-x-10 translate-y-10 blur-xl" />
                
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 dark:bg-zinc-900/30 text-white rounded-full text-[10px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  مرحبا الشغل مستمر وبكامل كفاءته
                </span>

                <h2 className="text-xl md:text-3xl font-black tracking-tight" id="dashboard_greeting">
                  أهلاً بك، {currentUser.name}
                </h2>
                
                <p className="text-xs md:text-sm text-emerald-100 max-w-xl leading-relaxed">
                  {isAdmin
                    ? 'أنت في لوحة تحكم المدير المالي. يمكنك إضافة الطلبات، ومتابعة مصروفات المشروع، والموافقة على التحويلات وتوزيع كتل الأرباح تلقائياً بضغطة زر واحدة.'
                    : `مرحباً بك كشريك ومصمم في فريق Vizora. نسبتك التعاقدية هي ${userStats.ratio}%. يمكنك الاطلاع بالأسفل على الأرباح المحتسبة لك وتفاصيل الصفقات وسجل دفعاتك.`}
                </p>

                {/* Floating summary info */}
                <div className="pt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-50">
                  <span>حالة النظام: <span className="bg-emerald-450 px-2 py-0.5 rounded-sm">متجانس وآمن</span></span>
                  <span className="hidden sm:inline">|</span>
                  <span>الجدولة الزمنية الحالية: <span className="bg-indigo-800 px-2 py-0.5 rounded-sm">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></span>
                </div>
              </div>

              {/* Alert for orders ready for profit distribution (ADMIN ONLY) */}
              {isAdmin && (() => {
                const ready = orders.filter(o => !o.isProfitDistributed && o.designsCompleted === o.designsRequested && o.designsRequested > 0);
                if (ready.length === 0) return null;
                return (
                  <div className="bg-gradient-to-l from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-3xl p-5 md:p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-400 flex items-center gap-2 font-sans text-right" dir="rtl">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          </span>
                          <span>إشعار هام: هناك ({ready.length}) طلبات مسجلة ومكتملة التصميم وجاهزة لتوزيع أرباحها!</span>
                        </h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          بمجرد انتهاء الشركاء من تسجيل وتصميم طلباتهم (محمد مصطفى / محمد السيد)، تظهر هذه الطلبات هنا تلقائياً لسرعة تفعيل وتوزيع أرباحها والسيولة للجميع بضغطة واحدة.
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ready.map(order => {
                        // Find assigned designer name
                        const designerName = order.assignedUserId === 'Mustafa' ? 'محمد مصطفى' : order.assignedUserId === 'Sayed' ? 'محمد السيد' : 'شريك غير محدد';
                        return (
                          <div key={order.id} className="bg-white dark:bg-zinc-900 border border-amber-250 dark:border-amber-900/40 p-4 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
                            <div className="flex justify-between items-start gap-2">
                              <div className="text-right">
                                <span className="font-extrabold text-xs text-zinc-900 dark:text-zinc-50 block leading-tight">{order.clientName}</span>
                                <span className="text-[9px] text-zinc-400 block font-mono">ID: {order.id}</span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-sm shrink-0">
                                {formatCurrency(order.price)}
                              </span>
                            </div>

                            <div className="space-y-1 pb-1 text-right">
                              <div className="flex justify-between text-[10px] text-zinc-500">
                                <span>المصمم المسؤول:</span>
                                <span className="font-extrabold text-zinc-700 dark:text-zinc-300">{designerName}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-zinc-500">
                                <span>التصاميم المنجزة:</span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{order.designsCompleted}/{order.designsRequested} (مكتملة ✅)</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDistributeProfit(order.id)}
                              className="w-full py-2 bg-gradient-to-l from-emerald-600 to-indigo-900 hover:opacity-90 active:opacity-105 text-white text-[10px] font-extrabold rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-1"
                            >
                              <Coins className="w-3.5 h-3.5 text-amber-300" />
                              <span>تفعيل أرباح الشركاء (عمر / مصطفى / السيد) 💸</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* METRICS ROW (ADMIN ACCORDION VS USER ACCORDION) */}
              {isAdmin ? (
                // ADMIN GENERAL PANEL
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">البيان المالي الشامل (المدير عمر)</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* TOTAL PROFITS */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs flex items-center justify-between transition-all duration-300">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">إجمالي أرباح الصفقات المسددة</span>
                        <span className="text-2xl font-black text-zinc-950 dark:text-white block font-mono">{formatCurrency(financialSummary.totalRevenue)}</span>
                        <span className="text-[10px] text-zinc-400 block">من إجمالي {transactions.length} صفقة مكتملة</span>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                      </div>
                    </div>

                    {/* TOTAL EXPENSES */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs flex items-center justify-between transition-all duration-300">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">إجمالي المصروفات الدورية</span>
                        <span className="text-2xl font-black text-red-600 dark:text-red-400 block font-mono">-{formatCurrency(financialSummary.totalExpenses)}</span>
                        <span className="text-[10px] text-zinc-400 block">تم خصمها من رصيد صندوق التطوير</span>
                      </div>
                      <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 text-red-655 dark:text-red-400 rounded-xl flex items-center justify-center">
                        <Coins className="w-6 h-6" />
                      </div>
                    </div>

                    {/* NET PROFIT WITH EXPENSES DEDUCTED */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs flex items-center justify-between transition-all duration-300">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">صافي الأرباح الكلي الموزع</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 block font-mono">{formatCurrency(financialSummary.netProfit)}</span>
                        <span className="text-[10px] text-zinc-400 block">يشمل الأرباح الصافية بعد الخصم</span>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-655 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                    {/* PENDING / PROCESSING VALUE */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs flex items-center justify-between transition-all duration-300">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">قيمة الصفقات المعلقة</span>
                        <span className="text-2xl font-black text-amber-550 dark:text-amber-450 block font-mono">{formatCurrency(financialSummary.pendingVolume)}</span>
                        <span className="text-[10px] text-zinc-400 block">قيد الانتظار أو العمل الحالي</span>
                      </div>
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
                        <Briefcase className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* SUB PARTNERS DETAILED WALLETS FOR ADMINS */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h4 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Wallet className="w-4.5 h-4.5 text-emerald-500" />
                        الرصيد وحسابات الشركاء والمسحوبات بالتفصيل
                      </h4>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-505">رصيد الشريك = (إجمالي أرباحه من الصفقات الموزعة - المسحوبات المسجلة له)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      
                      {/* OMAR WALLET */}
                      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-1 bg-emerald-500" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              عمر (الشريك الرئيسي)
                            </span>
                            <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-sm">60%</span>
                          </div>
                          
                          <div className="mt-3.5 space-y-2.5 font-sans text-xs">
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>الأرباح المتراكمة:</span>
                              <span className="font-mono font-bold text-zinc-850 dark:text-zinc-100">{formatCurrency(financialSummary.omarShare)}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>المسحوبات المستلمة:</span>
                              <span className="font-mono text-red-500 font-bold">-{formatCurrency(financialSummary.omarWithdrawn)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-350">الرصيد الصافي الحالي:</span>
                              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(financialSummary.omarBalance)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setPayoutPartnerName('عمر');
                            setIsPayoutModalOpen(true);
                          }}
                          className="w-full py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <Coins className="w-3 h-3 text-emerald-500" />
                          <span>تسجيل سحب أرباح</span>
                        </button>
                      </div>

                      {/* MUSTAFA WALLET */}
                      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-1 bg-indigo-500" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              محمد مصطفى (شريك)
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-sm">15%</span>
                          </div>
                          
                          <div className="mt-3.5 space-y-2.5 font-sans text-xs">
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>الأرباح المتراكمة:</span>
                              <span className="font-mono font-bold text-zinc-850 dark:text-zinc-100">{formatCurrency(financialSummary.mustafaShare)}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>المسحوبات المستلمة:</span>
                              <span className="font-mono text-red-500 font-bold">-{formatCurrency(financialSummary.mustafaWithdrawn)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-350">الرصيد الصافي الحالي:</span>
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">{formatCurrency(financialSummary.mustafaBalance)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setPayoutPartnerName('محمد مصطفى');
                            setIsPayoutModalOpen(true);
                          }}
                          className="w-full py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <Coins className="w-3 h-3 text-indigo-500" />
                          <span>تسجيل سحب أرباح</span>
                        </button>
                      </div>

                      {/* SAYED WALLET */}
                      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-1 bg-purple-500" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              محمد السيد (شريك)
                            </span>
                            <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-sm">15%</span>
                          </div>
                          
                          <div className="mt-3.5 space-y-2.5 font-sans text-xs">
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>الأرباح المتراكمة:</span>
                              <span className="font-mono font-bold text-zinc-850 dark:text-zinc-100">{formatCurrency(financialSummary.sayedShare)}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>المسحوبات المستلمة:</span>
                              <span className="font-mono text-red-500 font-bold">-{formatCurrency(financialSummary.sayedWithdrawn)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-350">الرصيد الصافي الحالي:</span>
                              <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-sm">{formatCurrency(financialSummary.sayedBalance)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setPayoutPartnerName('محمد السيد');
                            setIsPayoutModalOpen(true);
                          }}
                          className="w-full py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <Coins className="w-3 h-3 text-purple-500" />
                          <span>تسجيل سحب أرباح</span>
                        </button>
                      </div>

                      {/* DEVELOPMENT FUND */}
                      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-1 bg-teal-500" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-500" />
                              صندوق تطوير الشغل
                            </span>
                            <span className="text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded-sm">10%</span>
                          </div>
                          
                          <div className="mt-3.5 space-y-2.5 font-sans text-xs">
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>أرباح مخصصة للصندوق:</span>
                              <span className="font-mono font-bold text-zinc-850 dark:text-zinc-100">{formatCurrency(financialSummary.rawFund)}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-50 dark:border-zinc-800/40 pb-1.5">
                              <span>مصروفات التشغيل المخصومة:</span>
                              <span className="font-mono text-red-500 font-bold">-{formatCurrency(financialSummary.developmentExpenses)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-350">السيولة المتاحة للتطوير:</span>
                              <span className="font-mono font-black text-teal-600 dark:text-teal-400 text-sm">{formatCurrency(financialSummary.availableFund)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-center py-2 text-[9px] text-zinc-400 dark:text-zinc-505 font-bold leading-normal">
                          سيتم تلقائياً حسم أي مصروفات مسجلة (كأدوات العمل) من هذا الرصيد حصراً لضمان العدالة.
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* VISUAL CHARTS SECTION (ADMIN ONLY) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    {/* Distribution Pie ring Chart */}
                    <DonutChart
                      title="بنية تقسيم الأرباح الحالية للشركاء (تحليل رقمي)"
                      items={[
                        { label: 'عمر (60%)', value: financialSummary.omarShare, color: '#10b981' },
                        { label: 'محمد مصطفى (15%)', value: financialSummary.mustafaShare, color: '#6366f1' },
                        { label: 'محمد السيد (15%)', value: financialSummary.sayedShare, color: '#a855f7' },
                        { label: 'صندوق التطوير (10%)', value: Math.max(0, financialSummary.availableFund), color: '#14b8a6' }
                      ]}
                      totalLabel="رأس المال الموزع"
                      totalValue={financialSummary.totalRevenue}
                    />

                    {/* Comparison bar chart */}
                    <BarComparison
                      title="مؤشر حجم الصفقات والميزانية الكلية للعمل"
                      items={[
                        { label: 'إجمالي أرباح المحفظة', value: financialSummary.totalRevenue, color: '#22c55e' },
                        { label: 'المصروفات المستهلكة للعمل', value: financialSummary.totalExpenses, color: '#ef4444' },
                        { label: 'السيولة المتبقية للتطوير والأدوات', value: Math.max(0, financialSummary.availableFund), color: '#06b6d4' },
                        { label: 'الصفقات المعلقة قيد التحصيل', value: financialSummary.pendingVolume, color: '#f59e0b' }
                      ]}
                    />
                  </div>
                </div>
              ) : (
                // USER/PARTNER REGULAR PANEL
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 font-sans flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    المحفظة المباشرة والأرباح (تفاصيل الشريك {currentUser.name})
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Share ratio card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="space-y-1">
                        <span className="text-xs text-zinc-500 block">نسبتك من الشغل والصفقات</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block font-mono">
                          {userStats.ratio}%
                        </span>
                        <span className="text-[10px] text-zinc-400 block font-medium">موجب عقد منصة Vizora المعتمد</span>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                        <Users className="w-5.5 h-5.5" />
                      </div>
                    </div>

                    {/* Personal Earnings card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="space-y-1">
                        <span className="text-xs text-zinc-500 block">إجمالي الأرباح المتراكمة</span>
                        <span className="text-2xl font-black text-zinc-900 dark:text-white block font-mono">
                          {formatCurrency(userStats.earnings)}
                        </span>
                        <span className="text-[10px] text-zinc-400 block font-medium">مجموع العمولات لكل الطلبات الممولة</span>
                      </div>
                      <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl flex items-center justify-center">
                        <Briefcase className="w-5.5 h-5.5" />
                      </div>
                    </div>

                    {/* Withdrawn card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-zinc-500 block">إجمالي المسحوبات المستلمة</span>
                        <span className="text-2xl font-black text-red-655 dark:text-red-400 block font-mono">
                          {formatCurrency(userStats.withdrawn)}
                        </span>
                        <span className="text-[10px] text-zinc-400 block font-medium">دفعات كاش مستلمة من الإدارة</span>
                      </div>
                      <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-xl flex items-center justify-center">
                        <Coins className="w-5.5 h-5.5" />
                      </div>
                    </div>

                    {/* Net balance card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-5 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-zinc-500 block">رصيد الأرباح المتاح للسحب</span>
                        <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400 block font-mono">
                          {formatCurrency(userStats.balance)}
                        </span>
                        <span className="text-[10px] text-zinc-400 block font-medium">المتبقي الصافي في عهدة المحفظة</span>
                      </div>
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                        <Wallet className="w-5.5 h-5.5" />
                      </div>
                    </div>
                  </div>

                  {/* Visual Chart Comparison and Ledgers */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-2xl shadow-xs lg:col-span-1 justify-between flex flex-col">
                      <div className="space-y-2 text-right">
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">التمثيل الدائري لحصتك</h4>
                        <p className="text-[10px] text-zinc-400">توضيح تناسب أرباحك الشخصية بالنسبة للمحفظة الكلية للشركة والصفقات الموزعة</p>
                      </div>
                      
                      <div className="my-6 relative flex items-center justify-center w-[150px] h-[150px] mx-auto">
                        <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
                          <circle cx="75" cy="75" r="55" fill="none" stroke="#f4f4f5" strokeWidth="12" className="dark:stroke-zinc-800" />
                          <circle
                            cx="75"
                            cy="75"
                            r="55"
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="14"
                            strokeDasharray={2 * Math.PI * 55}
                            strokeDashoffset={(2 * Math.PI * 55) - ((userStats.earnings / (financialSummary.totalRevenue || 1)) * (2 * Math.PI * 55))}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] text-zinc-400 font-bold font-sans">تناسبك</span>
                          <span className="text-sm font-extrabold text-zinc-900 dark:text-white font-mono">
                            {financialSummary.totalRevenue > 0 ? ((userStats.earnings / financialSummary.totalRevenue) * 100).toFixed(1) : '0'}%
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 flex justify-between items-center text-[10px] text-zinc-500 font-bold text-right font-sans">
                        <span>أرباحك المتوقعة:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-450">{formatCurrency(userStats.earnings + (financialSummary.pendingVolume * currentUser.ratio))}</span>
                      </div>
                    </div>

                    {/* PERSONAL TRANSACTIONS LEDGER FOR USERS */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 lg:col-span-2 shadow-xs space-y-6 text-right" dir="rtl">
                      
                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
                          <FileText className="w-4 h-4 text-emerald-500" />
                          أولاً: أرباح المشاريع المحتسبة لك بالتفصيل
                        </h4>

                        {userStats.transactionsList.length === 0 ? (
                          <div className="py-12 text-center text-zinc-450 space-y-1">
                            <AlertTriangle className="w-8 h-8 text-zinc-400 mx-auto animate-pulse" />
                            <p className="text-xs font-semibold">لم يتم توزيع أي دفعات مالية بعد لحسابك.</p>
                            <p className="text-[10px]">بمجرد استلام المدير لدفعات الصفقات المنجزة، ستظهر تفاصيل عمولاتك هنا تلقائياً.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right border-collapse">
                              <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-450 font-bold">
                                  <th className="pb-2">معرف الصرف</th>
                                  <th className="pb-2">اسم العميل والطلب</th>
                                  <th className="pb-2">حجم الصفقة</th>
                                  <th className="pb-2">نسبتك الموزعة</th>
                                  <th className="pb-2">أرباحك المودعة</th>
                                  <th className="pb-2 text-left">التاريخ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userStats.transactionsList.map((tx, index) => (
                                  <tr key={tx.id} className="border-b border-zinc-100/40 dark:border-zinc-800/45 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 font-semibold text-zinc-700 dark:text-zinc-300">
                                    <td className="py-3 font-mono text-zinc-400">#{tx.id}</td>
                                    <td className="py-3 text-zinc-950 dark:text-zinc-50">{tx.clientName}</td>
                                    <td className="py-3 font-mono">{formatCurrency(tx.totalAmount)}</td>
                                    <td className="py-3 font-mono text-emerald-600 dark:text-emerald-450">{(currentUser.ratio * 100)}%</td>
                                    <td className="py-3 font-mono text-indigo-650 dark:text-indigo-400 font-extrabold">{formatCurrency(tx.personalShare)}</td>
                                    <td className="py-3 text-left text-[10px] text-zinc-400 font-mono">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* SECOND TABLE: PERSONAL WITHDRAWALS LIST */}
                      <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                        <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
                          <Coins className="w-4 h-4 text-red-500" />
                          ثانياً: سجل مبالغ المسحوبات النقدية المستلمة (الدفعات)
                        </h4>

                        {(() => {
                          const userName = currentUser.name;
                          const personalWithdrawals = expenses.filter(e => {
                            const lowerTitle = e.title.toLowerCase();
                            return lowerTitle.includes(`سحب أرباح - ${userName}`) || 
                                   lowerTitle.includes(`مسحوبات الشريك ${userName}`) ||
                                   (userName === 'محمد مصطفى' && (lowerTitle.includes('مصطفى') && lowerTitle.includes('سحب أرباح'))) ||
                                   (userName === 'محمد السيد' && (lowerTitle.includes('السيد') && lowerTitle.includes('سحب أرباح'))) ||
                                   (userName === 'عمر' && (lowerTitle.includes('عمر') && lowerTitle.includes('سحب أرباح')));
                          });

                          if (personalWithdrawals.length === 0) {
                            return (
                              <div className="py-10 text-center text-zinc-450 space-y-1">
                                <Coins className="w-7 h-7 text-zinc-355 mx-auto" />
                                <p className="text-xs font-semibold text-zinc-500">لا توجد مسحوبات نقدية مسجلة لك بعد.</p>
                                <p className="text-zinc-400 text-[10px]">عند استلامك لأي دفعات كاش كأرباح من عمر، تظهر هنا بالتفصيل فور إدخالها.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-right border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-450 font-bold">
                                    <th className="pb-2">معرف الدفعة</th>
                                    <th className="pb-2">البند والبيان</th>
                                    <th className="pb-2">المبلغ المستلم</th>
                                    <th className="pb-2 text-left">تاريخ الاستلام</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {personalWithdrawals.map((w, idx) => (
                                    <tr key={w.id} className="border-b border-zinc-100/40 dark:border-zinc-800/45 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 font-semibold text-zinc-700 dark:text-zinc-300">
                                      <td className="py-3 font-mono text-zinc-400">#{w.id}</td>
                                      <td className="py-3 text-zinc-950 dark:text-zinc-50">{w.title}</td>
                                      <td className="py-3 font-mono text-red-650 dark:text-red-400 font-extrabold font-mono">-{formatCurrency(w.amount)}</td>
                                      <td className="py-3 text-left text-[10px] text-zinc-400 font-mono">{new Date(w.date).toLocaleDateString('ar-EG')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAGE 2: ORDERS MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              
              {/* Toolbar Actions & Stats Overview */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/70 shadow-xs">
                {/* Search Box */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="ابحث باسم العميل، الهاتف، أو يوزر التيك توك..."
                    value={orderSearchQuery}
                    onChange={(e) => { setOrderSearchQuery(e.target.value); setOrderPage(1); }}
                    className="w-full px-4 py-2.5 pr-10 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100 transition-all font-semibold"
                  />
                  <Search className="absolute right-3 top-3 w-4 h-4 text-zinc-400" />
                </div>

                {/* Filter Selector - Status */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    <Filter className="w-3.5 h-3.5" />
                    <span>تصفية الحالة:</span>
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => { setOrderStatusFilter(e.target.value as any); setOrderPage(1); }}
                    className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="all">كل الحالات المعروضة</option>
                    <option value="completed">🟢 تم (مكتمل)</option>
                    <option value="processing">🟡 قيد التنفيذ</option>
                    <option value="pending">⚪ انتظار (معلق)</option>
                  </select>

                  {/* Filter Selector - Date Range */}
                  <select
                    value={orderDateRange}
                    onChange={(e) => { setOrderDateRange(e.target.value as any); setOrderPage(1); }}
                    className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-555 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="all">كل الأوقات والتواريخ</option>
                    <option value="today">اليوم فقط</option>
                    <option value="week">آخر 7 أيام</option>
                    <option value="month">آخر 30 يوم</option>
                  </select>

                  {/* Export Excel button */}
                  <button
                    onClick={() => {
                      exportOrdersToCSV(filteredOrders);
                      showToast('تم تصدير ملف إكسل CSV بنجاح', 'success');
                    }}
                    title="تصدير لملف إكسل Excel"
                    className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير Excel</span>
                  </button>

                  {/* Floating Add Button */}
                  <button
                    onClick={() => {
                      setSelectedOrderForEdit(null);
                      setIsOrderModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة طلب جديد</span>
                  </button>
                </div>
              </div>

              {/* Spread-sheet data display */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-zinc-50/50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/50 text-zinc-550 dark:text-zinc-400 font-bold">
                        <th className="p-4">معرف الصفحة</th>
                        <th className="p-4">اسم العميل</th>
                        <th className="p-4">رقم الهاتف</th>
                        <th className="p-4">حساب التيك توك</th>
                        <th className="p-4">التصاميم (منجز/مطلوب)</th>
                        <th className="p-4">السعر الإجمالي</th>
                        <th className="p-4">مقدم المدفوع</th>
                        <th className="p-4">نسب الأرباح</th>
                        <th className="p-4">حالة الطلب</th>
                        <th className="p-4 text-left">أدوات التحكم والتحكيم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-12 text-center text-zinc-450 space-y-1 bg-zinc-50/10">
                            <AlertTriangle className="w-9 h-9 text-zinc-400 mx-auto" />
                            <p className="text-xs font-bold">لم نعثر على أي صفقات أو طلبات مطابقة للبحث</p>
                            <p className="text-[10px]">تأكد من كتابة أحرف البحث بشكل صحيح أو تغيير خيارات التسميات والتصفية أعلاه.</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedOrders.map((order) => {
                          const isDistributed = order.isProfitDistributed;
                          return (
                            <tr
                              key={order.id}
                              style={{ contentVisibility: 'auto' }}
                              className="border-b border-zinc-100/50 dark:border-zinc-800/40 hover:bg-zinc-50/40 dark:hover:bg-zinc-940/25 transition-colors group text-zinc-700 dark:text-zinc-350"
                            >
                              {/* Order ID Code */}
                              <td className="p-4 font-mono font-bold text-zinc-400 text-xs">#{order.id}</td>
                              
                              {/* Client Name */}
                              <td className="p-4 text-zinc-950 dark:text-zinc-50 font-bold">{order.clientName}</td>
                              
                              {/* Phone */}
                              <td className="p-4 font-mono text-xs">{order.phone}</td>
                              
                              {/* TikTok Credentials */}
                              <td className="p-4 space-y-0.5">
                                <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1">{order.tiktokAccountName}</span>
                                <span className="block text-[10px] text-zinc-400 font-mono font-bold">{order.tiktokUsername}</span>
                              </td>

                              {/* Progress metrics */}
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold">
                                  <span className={order.designsCompleted === order.designsRequested ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-amber-600'}>
                                    {order.designsCompleted}
                                  </span>
                                  <span className="text-zinc-300 dark:text-zinc-650">/</span>
                                  <span className="text-zinc-500">{order.designsRequested}</span>
                                </span>
                              </td>

                              {/* Price */}
                              <td className="p-4 font-mono text-zinc-900 dark:text-zinc-50 font-extrabold">{formatCurrency(order.price)}</td>

                              {/* Paid Amount */}
                              <td className="p-4">
                                <span className={`font-mono text-xs font-semibold ${order.paidAmount >= order.price ? 'text-emerald-600 dark:text-emerald-450' : 'text-zinc-500'}`}>
                                  {formatCurrency(order.paidAmount)}
                                </span>
                              </td>

                              {/* Profits Status Badge */}
                              <td className="p-4">
                                {isDistributed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-100 dark:border-emerald-900/50">
                                    💰 تم التوزيع
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold border border-amber-100 dark:border-amber-900/50">
                                    ⏳ معلقة
                                  </span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="p-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                                  order.status === 'completed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                                    : order.status === 'processing'
                                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-100 dark:border-amber-900'
                                    : 'bg-zinc-120 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60'
                                }`}>
                                  {order.status === 'completed' ? 'تم اكتماله' : order.status === 'processing' ? 'قيد التنفيذ' : 'انتظار وبدء'}
                                </span>
                              </td>

                              {/* Actions Column */}
                              <td className="p-4 text-left">
                                <div className="inline-flex items-center gap-1.5 opacity-100 lg:opacity-90 lg:group-hover:opacity-100 transition-opacity">
                                  {/* Copy order details */}
                                  <button
                                    onClick={() => {
                                      copyOrderToClipboard(order);
                                      showToast('تم نسخ بيانات الطلب للحافظة بنجاح', 'success');
                                    }}
                                    title="نسخ ملخص بيانات الطلب"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  {/* MARK AS PAID & DISTRIBUTE (ADMIN ONLY) */}
                                  {isAdmin && !isDistributed && (
                                    <button
                                      onClick={() => handleDistributeProfit(order.id)}
                                      title="استلام المدفوع وتوزيع الأرباح تلقائياً"
                                      className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>توزيع الأرباح</span>
                                    </button>
                                  )}

                                  {/* EDIT (AVAILABLE TO ALL) */}
                                  <button
                                    onClick={() => {
                                      setSelectedOrderForEdit(order);
                                      setIsOrderModalOpen(true);
                                    }}
                                    title="تعديل بيانات العقد"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-550 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* DELETE (AVAILABLE TO ALL) */}
                                  <button
                                    onClick={() => handleDeleteOrder(order.id)}
                                    title="حذف البيانات بالكامل"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="block md:hidden p-4 space-y-4">
                  {paginatedOrders.length === 0 ? (
                    <div className="p-8 text-center text-zinc-450 space-y-2">
                      <AlertTriangle className="w-8 h-8 text-zinc-400 mx-auto" />
                      <p className="text-xs font-bold">لم نعثر على أي صفقات أو طلبات مطابقة للبحث</p>
                    </div>
                  ) : (
                    paginatedOrders.map((order) => {
                      const isDistributed = order.isProfitDistributed;
                      return (
                        <div key={order.id} className="bg-zinc-50 dark:bg-zinc-900/40 p-4 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-3 font-sans text-right">
                          {/* Heading: ID + Status badges */}
                          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <span className="font-mono font-black text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">#{order.id}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                order.status === 'completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-405 border-emerald-100/50 dark:border-emerald-900/50'
                                  : order.status === 'processing'
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/50'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60'
                              }`}>
                                {order.status === 'completed' ? 'تم اكتماله' : order.status === 'processing' ? 'قيد التنفيذ' : 'انتظار وبدء'}
                              </span>
                              {isDistributed ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-100/50">
                                  💰 تم التوزيع
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold border border-amber-100/50">
                                  ⏳ معلقة
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Client details & Phone */}
                          <div className="grid grid-cols-2 gap-2 text-xs border-b border-zinc-100/55 dark:border-zinc-800/40 pb-2">
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">العميل:</span>
                              <span className="text-zinc-950 dark:text-zinc-50 font-black">{order.clientName}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">الهاتف:</span>
                              <a href={`tel:${order.phone}`} className="text-emerald-600 dark:text-emerald-400 font-mono font-bold hover:underline">{order.phone}</a>
                            </div>
                          </div>

                          {/* TikTok profile info */}
                          <div className="grid grid-cols-2 gap-2 text-xs border-b border-zinc-100/55 dark:border-zinc-800/40 pb-2">
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">حساب التيك توك:</span>
                              <span className="text-zinc-800 dark:text-zinc-200 font-bold line-clamp-1">{order.tiktokAccountName}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">المعرف الإلكتروني:</span>
                              <span className="text-zinc-500 dark:text-zinc-405 font-mono font-bold text-[11px]">{order.tiktokUsername}</span>
                            </div>
                          </div>

                          {/* Order Price, Paid amount, and Designs Progress */}
                          <div className="grid grid-cols-3 gap-1 text-xs border-b border-zinc-100/55 dark:border-zinc-800/40 pb-2 bg-zinc-100/20 dark:bg-zinc-950/20 p-2 rounded-xl">
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">المبلغ الإجمالي:</span>
                              <span className="text-zinc-950 dark:text-zinc-50 font-black font-mono text-[11px]">{formatCurrency(order.price)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">المدفوع حالياً:</span>
                              <span className={`font-mono font-black text-[11px] ${order.paidAmount >= order.price ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-650 dark:text-zinc-300'}`}>
                                {formatCurrency(order.paidAmount)}
                              </span>
                            </div>
                            <div className="text-center border-r border-zinc-200/50 dark:border-zinc-800/60 pr-1">
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">التصاميم:</span>
                              <span className="inline-flex items-center gap-0.5 font-mono font-bold text-xs mt-0.5">
                                <span className={order.designsCompleted === order.designsRequested ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-amber-500'}>
                                  {order.designsCompleted}
                                </span>
                                <span className="text-zinc-350 dark:text-zinc-600">/</span>
                                <span className="text-zinc-500">{order.designsRequested}</span>
                              </span>
                            </div>
                          </div>

                          {/* Notes if any */}
                          {order.notes && (
                            <div className="text-xs bg-zinc-100 dark:bg-zinc-850 p-2 rounded-lg text-zinc-650 dark:text-zinc-400 border border-zinc-200/40 dark:border-zinc-800/40">
                              <span className="font-semibold text-[10px] text-zinc-400 dark:text-zinc-500 block mb-0.5">ملاحظات الطلب:</span>
                              <p className="font-medium text-[11px] leading-relaxed line-clamp-3">{order.notes}</p>
                            </div>
                          )}

                          {/* Action Items Footer row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">التحكم والتحكيم:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Copy */}
                              <button
                                onClick={() => {
                                  copyOrderToClipboard(order);
                                  showToast('تم نسخ بيانات الطلب للحافظة بنجاح', 'success');
                                }}
                                title="نسخ ملخص بيانات الطلب"
                                className="px-2.5 py-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold flex items-center gap-1 transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ</span>
                              </button>

                              {/* MARK AS PAID & DISTRIBUTE */}
                              {isAdmin && !isDistributed && (
                                <button
                                  onClick={() => handleDistributeProfit(order.id)}
                                  title="توزيع الأرباح"
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>توزيع الأرباح</span>
                                </button>
                              )}

                              {/* EDIT */}
                              <button
                                onClick={() => {
                                  setSelectedOrderForEdit(order);
                                  setIsOrderModalOpen(true);
                                }}
                                title="تعديل بيانات العقد"
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-xl text-[11px] font-bold border border-indigo-100/50 dark:border-indigo-900/50 flex items-center gap-1 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                                <span>تعديل</span>
                              </button>

                              {/* DELETE */}
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                title="حذف بالكامل"
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-405 rounded-xl text-[11px] font-bold border border-red-100/50 dark:border-red-900/50 flex items-center gap-1 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-550" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Spreadsheet Footer Pagination */}
                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 text-right flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-550 dark:text-zinc-400">
                    عرض {paginatedOrders.length} من إجمالي {filteredOrders.length} طلب متاح
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={orderPage === 1}
                      onClick={() => setOrderPage(prev => Math.max(prev - 1, 1))}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-zinc-900 dark:text-white font-mono font-bold">
                      صفحة {orderPage} من {totalPages}
                    </span>
                    <button
                      disabled={orderPage === totalPages}
                      onClick={() => setOrderPage(prev => Math.min(prev + 1, totalPages))}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 3: EXPENSES MANAGEMENT */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              
              {/* Header block with card stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">إدارة مصروفات ومقتنيات المشروع الكلي</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    يتم تسجيل البيانات والبيوع المالية ومصروفات الأدوات أو التراخيص والبرامج وقيمة الحملات الممولة هنا. سيقوم النظام بخصم المبالغ تلقائياً من الموازنة الصافية والكتلة المالية لصندوق التطوير.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-150 p-4 rounded-xl text-right font-semibold">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">مجموع المصروفات المخصومة حالياً:</span>
                    <span className="text-lg font-black text-red-600 dark:text-red-400 block font-mono">
                      {formatCurrency(financialSummary.totalExpenses)}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة بند مصروف</span>
                  </button>
                </div>
              </div>

              {/* Expenses table list */}
              <div className="bg-white dark:bg-zinc-900 p-6 border border-zinc-150 dark:border-zinc-800 rounded-3xl shadow-xs">
                {visibleExpenses.length === 0 ? (
                  <div className="p-12 text-center text-zinc-450 space-y-1">
                    <Coins className="w-10 h-10 text-zinc-350 mx-auto" />
                    <p className="text-xs font-bold">لا يوجد أي مصروفات مسجلة في هذا الحساب مسبقاً</p>
                    <p className="text-[10px]">بمجرد إضافة مصروف كأدوات العمل، سيقلص النظام رصيد التطوير بشكل دقيق.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                            <th className="pb-3">معرف بند المصرف</th>
                            <th className="pb-3">بيان / اسم بند المصروفات</th>
                            <th className="pb-3">المبلغ المسجل (ج.م)</th>
                            <th className="pb-3">تاريخ تسجيل المعاملة</th>
                            <th className="pb-3">المشرف الذي سجلها</th>
                            <th className="pb-3 text-left">الإجراء المتاح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleExpenses.map((expense) => (
                            <tr key={expense.id} className="border-b border-zinc-100/50 dark:border-zinc-800/40 hover:bg-slate-50/50 dark:hover:bg-zinc-940/20 font-semibold text-zinc-700 dark:text-zinc-300">
                              <td className="py-3.5 font-mono text-zinc-400">#{expense.id}</td>
                              <td className="py-3.5 text-zinc-900 dark:text-zinc-50">{expense.title}</td>
                              <td className="py-3.5 font-mono text-red-650 dark:text-red-400 font-bold">-{formatCurrency(expense.amount)}</td>
                              <td className="py-3.5 text-zinc-500 font-mono text-xs">{formatDate(expense.date).split('في')[0]}</td>
                              <td className="py-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-50 border dark:bg-zinc-800 dark:border-zinc-700 text-zinc-500 text-[10px]">
                                  <UserCheck className="w-3 h-3" />
                                  {expense.addedBy}
                                </span>
                              </td>
                              <td className="py-3.5 text-left">
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                  title="حذف بند المصروف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View (Expenses Cards) */}
                    <div className="block md:hidden space-y-4">
                      {visibleExpenses.map((expense) => (
                        <div key={expense.id} className="bg-zinc-50 dark:bg-zinc-900/40 p-4 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-3 font-sans text-right">
                          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <span className="font-mono font-black text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">#{expense.id}</span>
                            <span className="text-zinc-500 font-mono text-[11px]">{formatDate(expense.date).split('في')[0]}</span>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block font-bold">بند المصروفات:</span>
                            <p className="text-zinc-900 dark:text-zinc-50 font-bold text-sm">{expense.title}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-zinc-100/55 dark:border-zinc-800/40 py-2">
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">المبلغ المسجل:</span>
                              <span className="text-red-650 dark:text-red-400 font-black font-mono">-{formatCurrency(expense.amount)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block mb-0.5 font-bold">المسجل مسؤول:</span>
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-805 text-zinc-650 dark:text-zinc-300 text-[10px] font-bold">
                                  <UserCheck className="w-3 h-3" />
                                  {expense.addedBy}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Delete Action button */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">الإجراء المتاح:</span>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-2 rounded-xl text-zinc-400 hover:text-red-550 hover:bg-red-50 dark:hover:bg-red-950/20 border border-zinc-200 dark:border-zinc-800 transition"
                              title="حذف بند المصروف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PAGE 4: CLIENTS DIRECTORY */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">دليل وسجلات العملاء وقيم المعاملات</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  هذا الدليل يربط سجلات وبيانات العملاء الذين تعاقدوا مسبقاً بشكل آلي، لعرض قيمة صفقاتهم الكلية ومجموع ما أنبثق عنهم من طلبات، مع حساب كلي لحجم المدفوعات المسجلة.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
                {clientProfiles.length === 0 ? (
                  <div className="py-12 text-center text-zinc-450 space-y-1">
                    <Users className="w-10 h-10 text-zinc-405 mx-auto" />
                    <p className="text-xs font-semibold">لم نعثر على أي شريك عملاء بعد.</p>
                    <p className="text-[10px]">بمجرد إضافة صفقات وطلبات في النظام، سيتم ربط العملاء وعرض سجلاتهم هنا آلياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs md:text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold">
                          <th className="pb-3 text-right">اسم العميل والبيئة المقرنة</th>
                          <th className="pb-3 text-right">رقم الهاتف</th>
                          <th className="pb-3 text-right">حساب تيك توك المقرن</th>
                          <th className="pb-3 text-center">عدد الصفقات الإجمالي</th>
                          <th className="pb-3 text-right">مجموع الأموال المدفوعة</th>
                          <th className="pb-3 text-right">القيمة الكلية للطلبات</th>
                          <th className="pb-3 text-left">مؤشر الإتمام والالتزام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientProfiles.map((client, index) => {
                          const ratio = client.totalRequested > 0 ? (client.totalPaid / client.totalRequested) * 100 : 0;
                          return (
                            <tr key={index} className="border-b border-zinc-100/50 dark:border-zinc-800/40 hover:bg-slate-50/50 dark:hover:bg-zinc-940/25 font-semibold text-zinc-700 dark:text-zinc-300">
                              <td className="py-3.5 font-bold text-zinc-900 dark:text-zinc-50">{client.name}</td>
                              <td className="py-3.5 font-mono text-zinc-500 text-xs">{client.phone}</td>
                              <td className="py-3.5">
                                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{client.tiktokUsername}</span>
                              </td>
                              <td className="py-3.5 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">{client.totalOrders} صفقات</td>
                              <td className="py-3.5 font-mono text-emerald-600 dark:text-emerald-450">{formatCurrency(client.totalPaid)}</td>
                              <td className="py-3.5 font-mono font-extrabold text-zinc-900 dark:text-zinc-300">{formatCurrency(client.totalRequested)}</td>
                              <td className="py-3.5 text-left">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ratio}%` }} />
                                  </div>
                                  <span className="font-mono text-[9px] text-zinc-450">{ratio.toFixed(0)}% ملتزم</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAGE 5: SYSTEM ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">سجل عمليات النظام وتغييرات الأرصدة</h3>
                  <p className="text-xs text-zinc-400">
                    رصد توثيقي كامل مبني على حركة التعديل، الحذف، الإضافة، وتوزيع نسب أرباح الشركاء مع توقيت المعاملات واسم الشريك الذي نفذ الإجراء.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm('🚨 هل أنت متأكد من مسح كافة سجلات المتابعة والعمليات الحالية؟ الإجراء لا يمكن التراجع عنه.')) {
                      setLogs([]);
                      showToast('تم إفراغ وتصفير سجل العمليات التاريخية', 'info');
                    }
                  }}
                  className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 rounded-xl text-xs font-semibold select-none flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تفريغ السجل</span>
                </button>
              </div>

              {/* Vertical timeline details */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
                {activeUserLogs.length === 0 ? (
                  <div className="py-12 text-center text-zinc-450 space-y-1">
                    <Activity className="w-10 h-10 text-zinc-300 mx-auto animate-pulse" />
                    <p className="text-xs font-bold">لا يوجد أي عمليات مسجلة في هذا السجل التاريخي بعد</p>
                    <p className="text-[10px]">بمجرد إجراء الشركاء للوظائف، ستظهر الحركات التفصيلية هنا فوراً.</p>
                  </div>
                ) : (
                  <div className="relative border-r border-zinc-200 dark:border-zinc-800 pr-5 space-y-4">
                    {activeUserLogs.map((log) => {
                      const isPay = log.action === 'pay_split';
                      const isDel = log.action === 'delete_order' || log.action === 'delete_expense';
                      const isAdd = log.action === 'add_order' || log.action === 'add_expense';

                      return (
                        <div key={log.id} className="relative space-y-1.5">
                          {/* Circle on timeline */}
                          <span className={`absolute -right-[26px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 flex shadow-sm ${
                            isPay ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : isDel ? 'bg-red-500 ring-2 ring-red-500/20' : isAdd ? 'bg-indigo-500 ring-2 ring-indigo-500/20' : 'bg-zinc-400'
                          }`} />
                          
                          {/* Content row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-md font-bold text-[9px] ${
                                isPay ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450' :
                                isDel ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' :
                                isAdd ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400' :
                                'bg-zinc-50 dark:bg-zinc-800 text-zinc-500'
                              }`}>
                                {log.action === 'add_order' ? '📝 إضافة صفقة' :
                                 log.action === 'edit_order' ? '✏️ تحديث صفقة' :
                                 log.action === 'delete_order' ? '🗑️ حذف صفقة' :
                                 log.action === 'pay_split' ? '💸 دفع وتسوية أرباح' :
                                 log.action === 'add_expense' ? '🛑 تسجيل مصروف' :
                                 log.action === 'delete_expense' ? '🗑️ حذف مصروف' :
                                 '🛡️ نظام أمان وطني'}
                              </span>
                              
                              <p className="text-zinc-900 dark:text-zinc-50 font-semibold leading-relaxed">
                                {log.details}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold self-start md:self-center font-mono">
                              <span>المشغّل: <span className="text-zinc-700 dark:text-zinc-300">{log.username}</span></span>
                              <span>•</span>
                              <span>{formatDate(log.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAGE 6: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6 max-w-3xl">
              
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-sans">أداة النسخ الاحتياطي واستعادة البيانات المالية</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  تعتمد منصة طلبات فيزورا بشكل كامل على الحفظ الآمن في ذاكرة متصفحك المحلية (LocalStorage) لتوفير أسرع واجهة مستخدم. لحماية عملك كلياً من الضياع أو لمشاركة البيانات بين أجهزة الشركاء، يرجى الاستفادة من أدوات حفظ واستيراد الملفات أدناه.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. DOWNLOAD BACKUP BOX */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">تحميل نسخة احتياطية محلية (JSON)</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                      يُنشئ هذا الخيار ملف فوري مشفر بنظام معطيات خفيف بصيغة JSON ويقوم بتنزيله فوراً لجهازك. يحتوي الملف على كافة الطلبات، سجلات الشركاء وعمولاتهم بالتفصيل، المصروفات العامة، وتاريخ العمل الكلي.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadBackup}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 hover:scale-[1.01] transform"
                  >
                    <Download className="w-4 h-4" />
                    <span>توليد وتحميل ملف النسخة الاحتياطية</span>
                  </button>
                </div>

                {/* 2. UPLOAD/RESTORE BACKUP BOX */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100 font-sans">استيراد واستعادة نسخة سابقة (Restore)</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                      رفع ملف JSON منسوخ سابقاً بالكامل سيوفر لك نقرة إرجاع سريعة لاستئناف عملك من تاريخ صدور اللقطة الاحتياطية. <strong className="text-red-500 dark:text-red-400">انتبه! سيؤدي الرفع إلى محو ومزامنة جديدة للبيانات المحلية النشطة حالياً.</strong>
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <button
                      type="button"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 pointer-events-none"
                    >
                      <Upload className="w-4 h-4" />
                      <span>رفع واسترداد البيانات من جهازك</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Danger Zone */}
              <div className="bg-red-50/10 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 p-6 rounded-3xl space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-red-650 dark:text-red-450 font-sans">منطقة الخطر المطور لإدارة الاختبار</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      إذا كنت ترغب في تنظيف محاكيات التجربة كلياً للتجربة برأس مالي فارغ، أو تريد إرجاع البيانات الافتراضية الأنيقة (نظيفة كما صدرت لأول مرة) لتسهيل العرض والمراجعة، يرجى اختيار التصفير.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-end">
                  <button
                    onClick={resetAllDataToDefault}
                    className="px-4 py-2 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:scale-[1.01] active:scale-[0.99] transition-all dark:bg-zinc-900 dark:border-red-900/50 dark:text-red-400"
                  >
                    🔄 تصفير وإستعادة البيانات النموذجية الأولى
                  </button>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* --- ADD/EDIT ORDER DIALOG MODAL --- */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={handleAddOrEditOrderSubmit}
        order={selectedOrderForEdit}
        currentUserId={currentUser?.id}
      />

      {/* --- EXPENSE DIALOG MODAL --- */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSubmit={handleAddExpenseSubmit}
      />

      {/* --- REGISTER PARTNER PAYOUT MODAL --- */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-right" dir="rtl">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-805 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-500" />
                تسجيل سداد مسحوبات الشركاء
              </h3>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                id="close_payout_modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayoutSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 leading-normal">
                <AlertCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  أنت الآن تسجل سحب أرباح مباشر للشريك <strong className="font-extrabold">{payoutPartnerName}</strong>. 
                  سيقوم هذا بتقليص رصيده الصافي الحالي المتبقي على لوحة البيانات الكلية بشكل آمن وتلقائي.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350">اسم الشريك المستلم</label>
                <input
                  type="text"
                  readOnly
                  value={payoutPartnerName}
                  className="w-full text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-zinc-850 dark:text-zinc-100 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350" htmlFor="payout_amount_input">المبلغ المراد سحبه (ج.م)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-bold text-zinc-400 font-mono">EGP</span>
                  <input
                    id="payout_amount_input"
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    placeholder="مثال: 500"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-zinc-950 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 rounded-xl transition"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد سداد المبلغ</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* --- CUSTOMIZABLE LOGO & SITE TITLE MODAL MODAL --- */}
      {logoEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-right" dir="rtl">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">تخصيص لوجو والاسم التجاري للمنصة</h3>
              <button
                onClick={() => setLogoEditOpen(false)}
                className="p-1 rounded-sm text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">اسم المنصة المخصص</label>
                <input
                  type="text"
                  value={tempLogoText}
                  onChange={(e) => setTempLogoText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">رابط اللوجو الخارجي (Logo Image URL)</label>
                <input
                  type="url"
                  placeholder="ضع رابط الصورة هنا (اتركه فارغاً لاستعمال اللوجو الهندسي)..."
                  value={tempLogoUrl}
                  onChange={(e) => setTempLogoUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono"
                />
                <span className="block text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  اترك هذا الحقل فارغاً كلياً حتى يستخدم النظام اللوجو الأيقوني الأنيق لشعار حرف V من طراز Vizora تلقائياً.
                </span>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setLogoEditOpen(false)}
                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveLogoConfigChanges}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
              >
                حفظ وإقرار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM CONFIRM DELETE DIALOG DIALOG --- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-right animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-zinc-950 border border-red-150 dark:border-red-900/60 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 bg-red-50/50 dark:bg-red-950/20 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-black text-red-750 dark:text-red-400">{confirmDelete.title}</h3>
            </div>
            <div className="p-6">
              <p className="text-xs md:text-sm text-zinc-700 dark:text-zinc-350 leading-relaxed font-semibold">
                {confirmDelete.message}
              </p>
            </div>
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-900/80 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-250 dark:border-zinc-700 rounded-lg font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={executeConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black hover:shadow-md transition"
              >
                تأكيد وبدء الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM CONFIRM PROFIT DISTRIBUTION MODAL --- */}
      {confirmProfitDistribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans text-right animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-zinc-950 border border-emerald-150 dark:border-emerald-900/60 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <h3 className="text-sm font-black text-emerald-750 dark:text-emerald-400">تأكيد دفع وتوزيع أرباح الطلب تلقائياً</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl select-none">
                <p className="text-xs text-zinc-500 mb-1">الطلب للعميل:</p>
                <p className="text-sm font-black text-zinc-900 dark:text-white">{confirmProfitDistribution.clientName}</p>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono">القيمة الكلية: {formatCurrency(confirmProfitDistribution.price)}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500">حسبة التوزيع التعاقدية (100%):</p>
                
                <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-900/60">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">الشريك عمر (60%):</span>
                  <span className="font-mono text-indigo-650 dark:text-indigo-400 font-extrabold">{formatCurrency(confirmProfitDistribution.price * 0.60)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-900/60 font-semibold">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">الشريك محمد مصطفى (15%):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(confirmProfitDistribution.price * 0.15)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-900/60 font-semibold">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">الشريك محمد السيد (15%):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(confirmProfitDistribution.price * 0.15)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-900/60 font-semibold">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">صندوق التطوير والتشغيل (10%):</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-extrabold">{formatCurrency(confirmProfitDistribution.price * 0.10)}</span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-455 leading-relaxed text-center font-medium bg-zinc-50 dark:bg-zinc-900 py-2.5 px-3 rounded-2xl">
                ⚠️ بمجرد التأكيد، سيتم قفل تعديل السعر لهذا العقد، وتضاف الأرباح تلقائياً لمحفظة كل شريك وتظهر في حساباتهم فوراً.
              </p>
            </div>
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-900/80 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setConfirmProfitDistribution(null)}
                className="px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-250 dark:border-zinc-700 rounded-xl font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={() => executeProfitDistribution(confirmProfitDistribution.id)}
                className="px-5 py-2 bg-gradient-to-l from-emerald-600 to-indigo-800 hover:opacity-90 text-white rounded-xl font-black shadow-md hover:shadow-lg transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-350" />
                <span>تأكيد صرف وتوزيع الأرباح</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
