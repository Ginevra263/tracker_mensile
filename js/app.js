/**
 * PocketTracker - Applicazione Gestione Spese e Budget Mensile
 * Architettura modulare con persistenza LocalStorage e Chart.js
 */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURAZIONE & DATI INIZIALI DI DEFAULT
  // ==========================================

  const STORAGE_KEYS = {
    CATEGORIES: 'pocket_tracker_categories_v2',
    EXPENSES: 'pocket_tracker_expenses_v2',
    THEME: 'pocket_tracker_theme_v1'
  };

  // Categorie di primo livello (senza nidificazione per città)
  // Totale iniziale di default: 200,00 €
  const DEFAULT_CATEGORIES = [
    { id: 'cat_cena', name: 'Cena & Ristoranti', budget: 60.00, color: '#ec4899' },
    { id: 'cat_spesa', name: 'Spesa Alimentari', budget: 45.00, color: '#f43f5e' },
    { id: 'cat_uscite', name: 'Uscite serali & Bar', budget: 35.00, color: '#fb923c' },
    { id: 'cat_sport', name: 'Sport & Svago', budget: 25.00, color: '#fb7185' },
    { id: 'cat_gelati', name: 'Gelati & Dolci', budget: 15.00, color: '#f472b6' },
    { id: 'cat_extra', name: 'Extra & Varie', budget: 20.00, color: '#c084fc' }
  ];

  // Palette colori armonici per le categorie (Rose, Coral, Lavender)
  const CATEGORY_PALETTE = [
    '#ec4899', '#f43f5e', '#fb7185', '#fb923c',
    '#f472b6', '#e879f9', '#c084fc', '#a855f7',
    '#db2777', '#f43f85', '#06b6d4', '#10b981'
  ];

  // Helper per generare UUID semplici
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // ==========================================
  // STATO GLOBALE DELL'APPLICAZIONE
  // ==========================================

  const state = {
    currentDate: new Date(),
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth(), // 0-11
    categories: [],
    expenses: [],
    theme: 'light',
    activeTab: 'overview',
    charts: {
      donut: null,
      bar: null,
      line: null
    }
  };

  // ==========================================
  // FORMATTATORI
  // ==========================================

  const currencyFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function formatCurrency(amount) {
    return currencyFormatter.format(amount || 0);
  }

  function formatDateIT(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  function getMonthNameIT(monthIndex) {
    const months = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return months[monthIndex];
  }

  function getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    });
  }

  // ==========================================
  // PERSISTENZA LOCAL STORAGE & MIGRAZIONE
  // ==========================================

  function loadStateFromStorage() {
    try {
      const storedCategoriesV2 = localStorage.getItem(STORAGE_KEYS.CATEGORIES);

      if (storedCategoriesV2) {
        state.categories = JSON.parse(storedCategoriesV2);
      } else {
        // Tentativo di migrazione dalla v1 (con nidificazione per città)
        const storedCategoriesV1 = localStorage.getItem('pocket_tracker_categories_v1');
        const storedExpensesV1 = localStorage.getItem('pocket_tracker_expenses_v1');

        if (storedCategoriesV1) {
          const oldCats = JSON.parse(storedCategoriesV1);
          const oldCatCityMap = {};
          oldCats.forEach(c => { oldCatCityMap[c.id] = c.city || ''; });

          // Ristruttura le categorie eliminando la nidificazione per città
          const newCatsMap = {};
          oldCats.forEach(c => {
            const cleanName = c.name.trim();
            if (!newCatsMap[cleanName]) {
              newCatsMap[cleanName] = {
                id: c.id,
                name: cleanName,
                budget: Number(c.budget) || 0,
                color: c.color || CATEGORY_PALETTE[Object.keys(newCatsMap).length % CATEGORY_PALETTE.length]
              };
            } else {
              // Somma il budget per categorie con lo stesso nome
              newCatsMap[cleanName].budget += (Number(c.budget) || 0);
            }
          });

          state.categories = Object.values(newCatsMap);
          saveCategoriesToStorage();

          // Migra le spese v1 trasformando la città in tag opzionale
          if (storedExpensesV1) {
            const oldExpenses = JSON.parse(storedExpensesV1);
            state.expenses = oldExpenses.map(e => ({
              ...e,
              city: e.city || oldCatCityMap[e.categoryId] || ''
            }));
            saveExpensesToStorage();
          }
        } else {
          // Nessun dato pregresso: inizializza con i default v2
          state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
          saveCategoriesToStorage();
        }
      }

      const storedExpensesV2 = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (storedExpensesV2) {
        state.expenses = JSON.parse(storedExpensesV2);
      } else if (!state.expenses || state.expenses.length === 0) {
        // Popola con dati demo storici realistici per i grafici e le statistiche
        state.expenses = createInitialDemoExpenses();
        saveExpensesToStorage();
      }

      const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (storedTheme) {
        state.theme = storedTheme;
      }
    } catch (e) {
      console.error('Errore durante il caricamento da localStorage:', e);
      state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.expenses = createInitialDemoExpenses();
    }
  }

  function saveCategoriesToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
    } catch (e) {
      console.error('Errore nel salvataggio delle categorie:', e);
      showToast('Errore nel salvataggio delle categorie', 'error');
    }
  }

  function saveExpensesToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
    } catch (e) {
      console.error('Errore nel salvataggio delle spese:', e);
      showToast('Errore nel salvataggio delle spese', 'error');
    }
  }

  function saveThemeToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    } catch (e) {
      console.error('Errore nel salvataggio del tema:', e);
    }
  }

  /**
   * Crea un set di spese demo distribuite su 6 mesi (5 mesi precedenti + mese corrente)
   * per mostrare subito il grafico di confronto storico e i trend di risparmio.
   */
  function createInitialDemoExpenses() {
    const expenses = [];
    const currentY = state.selectedYear;
    const currentM = state.selectedMonth; // 0-11

    // Template di spese per generare trend realistici nei mesi precedenti
    const monthlyBlueprints = [
      // Mese -5
      {
        monthOffset: -5,
        items: [
          { cat: 'cat_cena', city: 'Brescia', desc: 'Cena inaugurazione', amount: 35.00, day: '04' },
          { cat: 'cat_spesa', city: 'Lissone', desc: 'Spesa Esselunga', amount: 38.50, day: '10' },
          { cat: 'cat_uscite', city: 'Milano', desc: 'Aperitivo colleghi', amount: 22.00, day: '15' },
          { cat: 'cat_sport', city: '', desc: 'Abbonamento palestra', amount: 25.00, day: '18' },
          { cat: 'cat_gelati', city: 'Brescia', desc: 'Gelato centro', amount: 5.50, day: '22' },
          { cat: 'cat_extra', city: '', desc: 'Ricarica telefonica', amount: 15.00, day: '27' }
        ]
      },
      // Mese -4
      {
        monthOffset: -4,
        items: [
          { cat: 'cat_cena', city: 'Milano', desc: 'Pizzeria con amici', amount: 48.00, day: '03' },
          { cat: 'cat_spesa', city: '', desc: 'Spesa settimanale', amount: 42.00, day: '09' },
          { cat: 'cat_uscite', city: 'Lissone', desc: 'Cocktail bar', amount: 28.00, day: '16' },
          { cat: 'cat_sport', city: 'Brescia', desc: 'Campo da paddle', amount: 18.00, day: '21' },
          { cat: 'cat_gelati', city: '', desc: 'Coppette gelato', amount: 6.00, day: '25' },
          { cat: 'cat_extra', city: 'Milano', desc: 'Cinema e snack', amount: 19.50, day: '28' }
        ]
      },
      // Mese -3
      {
        monthOffset: -3,
        items: [
          { cat: 'cat_cena', city: 'Brescia', desc: 'Trattoria tipica', amount: 38.00, day: '05' },
          { cat: 'cat_spesa', city: 'Lissone', desc: 'Spesa biologica', amount: 34.00, day: '11' },
          { cat: 'cat_uscite', city: 'Milano', desc: 'Serata musica live', amount: 24.00, day: '17' },
          { cat: 'cat_sport', city: '', desc: 'Nuoto libero', amount: 14.00, day: '23' },
          { cat: 'cat_extra', city: '', desc: 'Libri e riviste', amount: 16.00, day: '26' }
        ]
      },
      // Mese -2
      {
        monthOffset: -2,
        items: [
          { cat: 'cat_cena', city: 'Milano', desc: 'Cena sushi all you can eat', amount: 55.00, day: '06' },
          { cat: 'cat_spesa', city: 'Brescia', desc: 'Supermercato scorte', amount: 44.00, day: '12' },
          { cat: 'cat_uscite', city: 'Brescia', desc: 'Aperitivo lungo', amount: 30.00, day: '18' },
          { cat: 'cat_sport', city: '', desc: 'Torneo tennis', amount: 20.00, day: '22' },
          { cat: 'cat_gelati', city: 'Lissone', desc: 'Gelato artigianale', amount: 7.00, day: '25' },
          { cat: 'cat_extra', city: '', desc: 'Accessori tech', amount: 18.00, day: '29' }
        ]
      },
      // Mese -1
      {
        monthOffset: -1,
        items: [
          { cat: 'cat_cena', city: 'Brescia', desc: 'Cena gourmet amici', amount: 45.00, day: '04' },
          { cat: 'cat_spesa', city: 'Lissone', desc: 'Spesa discount', amount: 39.00, day: '10' },
          { cat: 'cat_uscite', city: 'Milano', desc: 'Drink serali', amount: 26.00, day: '16' },
          { cat: 'cat_sport', city: 'Brescia', desc: 'Noleggio racchette', amount: 15.00, day: '20' },
          { cat: 'cat_gelati', city: '', desc: 'Granite estive', amount: 5.00, day: '24' },
          { cat: 'cat_extra', city: '', desc: 'Regalo compleanno', amount: 22.00, day: '27' }
        ]
      },
      // Mese corrente
      {
        monthOffset: 0,
        items: [
          { cat: 'cat_cena', city: 'Brescia', desc: 'Pizzata con gli amici', amount: 24.50, day: '02' },
          { cat: 'cat_spesa', city: 'Lissone', desc: 'Supermercato settimanale', amount: 28.00, day: '04' },
          { cat: 'cat_uscite', city: 'Milano', desc: 'Aperitivo in centro', amount: 14.00, day: '07' },
          { cat: 'cat_sport', city: '', desc: 'Prenotazione campo tennis', amount: 12.00, day: '09' },
          { cat: 'cat_gelati', city: 'Brescia', desc: 'Gelato artigianale pistacchio', amount: 4.50, day: '11' },
          { cat: 'cat_extra', city: '', desc: 'Cancelleria e libri', amount: 15.00, day: '14' }
        ]
      }
    ];

    monthlyBlueprints.forEach(bp => {
      let targetM = currentM + bp.monthOffset;
      let targetY = currentY;
      while (targetM < 0) {
        targetM += 12;
        targetY--;
      }
      while (targetM > 11) {
        targetM -= 12;
        targetY++;
      }
      const mStr = String(targetM + 1).padStart(2, '0');

      bp.items.forEach(it => {
        expenses.push({
          id: generateId('exp'),
          date: `${targetY}-${mStr}-${it.day}`,
          categoryId: it.cat,
          city: it.city || '',
          description: it.desc,
          amount: it.amount
        });
      });
    });

    return expenses;
  }

  // ==========================================
  // ELEMENTI DOM
  // ==========================================

  const dom = {
    // Header & Navigazione Mese
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    todayBtn: document.getElementById('todayBtn'),
    currentMonthLabel: document.getElementById('currentMonthLabel'),
    monthPickerTrigger: document.getElementById('monthPickerTrigger'),
    hiddenMonthInput: document.getElementById('hiddenMonthInput'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    manageCategoriesBtn: document.getElementById('manageCategoriesBtn'),
    openNewExpenseModalBtn: document.getElementById('openNewExpenseModalBtn'),
    quickAddExpenseTrigger: document.getElementById('quickAddExpenseTrigger'),

    // KPI Cards
    kpiTotalBudget: document.getElementById('kpiTotalBudget'),
    kpiBudgetCount: document.getElementById('kpiBudgetCount'),
    kpiTotalSpent: document.getElementById('kpiTotalSpent'),
    kpiSpentPercentBadge: document.getElementById('kpiSpentPercentBadge'),
    kpiSpentCount: document.getElementById('kpiSpentCount'),
    kpiRemainingBalance: document.getElementById('kpiRemainingBalance'),
    kpiStatusTag: document.getElementById('kpiStatusTag'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    expensesCountBadge: document.getElementById('expensesCountBadge'),

    // Tab 1: Panoramica Budget Categorie
    categoryCardsContainer: document.getElementById('categoryCardsContainer'),

    // Tab 2: Registro Spese
    quickAddForm: document.getElementById('quickAddForm'),
    qaDate: document.getElementById('qaDate'),
    qaCategory: document.getElementById('qaCategory'),
    qaCity: document.getElementById('qaCity'),
    qaDescription: document.getElementById('qaDescription'),
    qaAmount: document.getElementById('qaAmount'),
    expenseSearchInput: document.getElementById('expenseSearchInput'),
    filterCategorySelect: document.getElementById('filterCategorySelect'),
    filterCitySelect: document.getElementById('filterCitySelect'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    expensesTableBody: document.getElementById('expensesTableBody'),
    expensesEmptyState: document.getElementById('expensesEmptyState'),

    // Tab 3: Grafici & Statistiche
    historicalTrendSubtitle: document.getElementById('historicalTrendSubtitle'),
    historicalStatsBanner: document.getElementById('historicalStatsBanner'),
    historicalTrendChart: document.getElementById('historicalTrendChart'),
    donutTotalSpentSubtitle: document.getElementById('donutTotalSpentSubtitle'),
    categoryDonutChart: document.getElementById('categoryDonutChart'),
    categoryBarChart: document.getElementById('categoryBarChart'),
    categorySummaryGrid: document.getElementById('categorySummaryGrid'),

    // Modale: Nuova / Modifica Spesa
    expenseModal: document.getElementById('expenseModal'),
    expenseModalForm: document.getElementById('expenseModalForm'),
    expenseModalTitle: document.getElementById('expenseModalTitle'),
    modalExpenseId: document.getElementById('modalExpenseId'),
    modalExpenseDate: document.getElementById('modalExpenseDate'),
    modalExpenseCategory: document.getElementById('modalExpenseCategory'),
    modalExpenseCity: document.getElementById('modalExpenseCity'),
    modalExpenseDesc: document.getElementById('modalExpenseDesc'),
    modalExpenseAmount: document.getElementById('modalExpenseAmount'),

    // Modale: Gestione Categorie & Budget
    categoriesModal: document.getElementById('categoriesModal'),
    addCategoryForm: document.getElementById('addCategoryForm'),
    newCatName: document.getElementById('newCatName'),
    newCatBudget: document.getElementById('newCatBudget'),
    categoriesManagementContainer: document.getElementById('categoriesManagementContainer'),

    // Footer & Notifiche
    backupDataBtn: document.getElementById('backupDataBtn'),
    restoreDataBtn: document.getElementById('restoreDataBtn'),
    hiddenRestoreInput: document.getElementById('hiddenRestoreInput'),
    resetDemoBtn: document.getElementById('resetDemoBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================
  // LOGICA FILTRI & CALCOLI SPESE
  // ==========================================

  // Restituisce le spese che ricadono nel mese e anno selezionati
  function getSelectedMonthExpenses() {
    return state.expenses.filter(exp => {
      if (!exp.date) return false;
      const [year, month] = exp.date.split('-').map(Number);
      return year === state.selectedYear && (month - 1) === state.selectedMonth;
    });
  }

  // Mappa di calcolo per categoria
  function calculateCategoryStats() {
    const monthExpenses = getSelectedMonthExpenses();
    const statsMap = {};

    state.categories.forEach(cat => {
      statsMap[cat.id] = {
        category: cat,
        spent: 0,
        budget: Number(cat.budget) || 0,
        balance: 0,
        percentage: 0,
        expenses: []
      };
    });

    monthExpenses.forEach(exp => {
      if (statsMap[exp.categoryId]) {
        statsMap[exp.categoryId].spent += Number(exp.amount) || 0;
        statsMap[exp.categoryId].expenses.push(exp);
      }
    });

    // Calcolo saldi e percentuali
    Object.values(statsMap).forEach(item => {
      item.balance = item.budget - item.spent;
      item.percentage = item.budget > 0 ? (item.spent / item.budget) * 100 : (item.spent > 0 ? 100 : 0);
    });

    return statsMap;
  }

  /**
   * Logica degli Allarmi Visivi di Budget:
   * - Verde: budget ampiamente disponibile (< 80% speso)
   * - Giallo/Arancione: superato l'80% dello stanziamento (>= 80% e < 100%)
   * - Rosso: raggiunto o superato il 100% dello stanziamento (>= 100%)
   */
  function getBudgetAlarmInfo(spent, budget) {
    const percentage = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
    const balance = budget - spent;

    if (percentage >= 100) {
      const diff = Math.abs(balance);
      const label = balance < 0 ? `Sforato di ${formatCurrency(diff)}` : 'Budget esaurito (0,00 €)';
      return {
        statusClass: 'badge-alarm-red',
        progressClass: 'progress-red',
        badgeText: label,
        pctLabel: `${Math.round(percentage)}% (Sforato)`,
        state: 'danger',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
      };
    } else if (percentage >= 80) {
      return {
        statusClass: 'badge-alarm-yellow',
        progressClass: 'progress-yellow',
        badgeText: `Attenzione: ${formatCurrency(balance)} rimasti`,
        pctLabel: `${Math.round(percentage)}% (In esaurimento)`,
        state: 'warning',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
      };
    } else {
      return {
        statusClass: 'badge-alarm-green',
        progressClass: 'progress-green',
        badgeText: `Rimangono ${formatCurrency(balance)}`,
        pctLabel: `${Math.round(percentage)}% (Disponibile)`,
        state: 'success',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      };
    }
  }

  /**
   * Calcola le statistiche storiche mensili per gli ultimi N mesi
   * (confrontando la spesa totale e l'andamento del risparmio a lungo termine)
   */
  function getHistoricalMonthlyStats(numMonths = 6) {
    const result = [];
    const currentY = state.selectedYear;
    const currentM = state.selectedMonth;

    for (let i = numMonths - 1; i >= 0; i--) {
      let targetM = currentM - i;
      let targetY = currentY;
      while (targetM < 0) {
        targetM += 12;
        targetY--;
      }
      while (targetM > 11) {
        targetM -= 12;
        targetY++;
      }

      const monthShort = getMonthNameIT(targetM).substring(0, 3);
      const label = `${monthShort} ${String(targetY).slice(-2)}`;

      const monthExpenses = state.expenses.filter(exp => {
        if (!exp.date) return false;
        const [y, m] = exp.date.split('-').map(Number);
        return y === targetY && (m - 1) === targetM;
      });

      const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const totalBudget = state.categories.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
      const savings = totalBudget - totalSpent;

      result.push({
        year: targetY,
        month: targetM,
        label,
        spent: totalSpent,
        budget: totalBudget,
        savings: savings,
        count: monthExpenses.length,
        isCurrent: i === 0
      });
    }

    return result;
  }

  // ==========================================
  // RENDERING: HEADER & MONTH PICKER
  // ==========================================

  function renderMonthHeader() {
    const monthName = getMonthNameIT(state.selectedMonth);
    dom.currentMonthLabel.textContent = `${monthName} ${state.selectedYear}`;

    // Sincronizza l'input type="month" nascosto
    const monthString = String(state.selectedMonth + 1).padStart(2, '0');
    dom.hiddenMonthInput.value = `${state.selectedYear}-${monthString}`;
  }

  function changeMonth(delta) {
    let newMonth = state.selectedMonth + delta;
    let newYear = state.selectedYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    state.selectedMonth = newMonth;
    state.selectedYear = newYear;

    updateAllViews();
  }

  function setTodayMonth() {
    const now = new Date();
    state.selectedYear = now.getFullYear();
    state.selectedMonth = now.getMonth();
    updateAllViews();
  }

  // ==========================================
  // RENDERING: KPI CARDS
  // ==========================================

  function renderKpiCards() {
    const monthExpenses = getSelectedMonthExpenses();
    const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalBudget = state.categories.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
    const remainingBalance = totalBudget - totalSpent;
    const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Budget Totale
    dom.kpiTotalBudget.textContent = formatCurrency(totalBudget);
    dom.kpiBudgetCount.textContent = `${state.categories.length} categorie attive`;

    // Spesa Totale
    dom.kpiTotalSpent.textContent = formatCurrency(totalSpent);
    dom.kpiSpentPercentBadge.textContent = `${Math.round(spentPercent)}% del budget`;
    dom.kpiSpentCount.textContent = `${monthExpenses.length} ${monthExpenses.length === 1 ? 'spesa' : 'spese'}`;

    // Badge Colore Spesa nel KPI
    if (spentPercent >= 100) {
      dom.kpiSpentPercentBadge.style.background = 'var(--color-danger-bg)';
      dom.kpiSpentPercentBadge.style.color = 'var(--color-danger)';
    } else if (spentPercent >= 80) {
      dom.kpiSpentPercentBadge.style.background = 'var(--color-warning-bg)';
      dom.kpiSpentPercentBadge.style.color = 'var(--color-warning)';
    } else {
      dom.kpiSpentPercentBadge.style.background = 'rgba(255, 255, 255, 0.08)';
      dom.kpiSpentPercentBadge.style.color = 'var(--text-secondary)';
    }

    // Saldo Rimanente
    dom.kpiRemainingBalance.textContent = formatCurrency(remainingBalance);

    // Status Tag Saldo - Segue coerentemente la logica degli allarmi visivi
    if (spentPercent >= 100) {
      dom.kpiStatusTag.className = 'status-indicator-tag status-danger';
      dom.kpiStatusTag.textContent = remainingBalance < 0
        ? `Sforato di ${formatCurrency(Math.abs(remainingBalance))}`
        : 'Budget esaurito';
    } else if (spentPercent >= 80) {
      dom.kpiStatusTag.className = 'status-indicator-tag status-warning';
      dom.kpiStatusTag.textContent = `In esaurimento (${formatCurrency(remainingBalance)} rimasti)`;
    } else {
      dom.kpiStatusTag.className = 'status-indicator-tag status-positive';
      dom.kpiStatusTag.textContent = `In budget (+${formatCurrency(remainingBalance)})`;
    }

    // Badge conteggio nel tab spese
    dom.expensesCountBadge.textContent = monthExpenses.length;
  }

  // ==========================================
  // RENDERING: TAB 1 - PANORAMICA BUDGET PER CATEGORIA
  // ==========================================

  function renderCategoryCards() {
    const catStats = calculateCategoryStats();
    dom.categoryCardsContainer.innerHTML = '';

    const categoriesList = state.categories;

    if (categoriesList.length === 0) {
      dom.categoryCardsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h4>Nessuna categoria configurata</h4>
          <p>Clicca sul pulsante "Budget & Categorie" in alto per creare la tua prima categoria di spesa.</p>
        </div>
      `;
      return;
    }

    categoriesList.forEach(cat => {
      const stat = catStats[cat.id] || { spent: 0, budget: cat.budget, balance: cat.budget, percentage: 0, expenses: [] };
      const alarm = getBudgetAlarmInfo(stat.spent, stat.budget);
      const progressClamped = Math.min(stat.percentage, 100);

      // Estrai le città uniche registrate tra le spese di questa categoria per il mese corrente
      const citySet = new Set();
      stat.expenses.forEach(e => {
        if (e.city && e.city.trim()) {
          citySet.add(e.city.trim());
        }
      });
      const uniqueCities = Array.from(citySet).slice(0, 3); // max 3 tag per mantenere il layout pulito

      let cityTagsHtml = '';
      if (uniqueCities.length > 0) {
        cityTagsHtml = `
          <div class="cat-city-tags" title="Tag città rilevati per questa categoria nel mese">
            ${uniqueCities.map(c => `<span class="city-mini-tag">📍 ${escapeHtml(c)}</span>`).join('')}
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = 'category-card';
      card.setAttribute('data-cat-id', cat.id);

      card.innerHTML = `
        <div class="category-card-header">
          <div class="category-title-group">
            <span class="category-badge-dot" style="background-color: ${cat.color || '#ec4899'}; color: ${cat.color || '#ec4899'};"></span>
            <h3 class="category-card-title">${escapeHtml(cat.name)}</h3>
          </div>
          <!-- Badge Allarme Visivo Dinamico per Saldo Rimanente -->
          <span class="budget-alarm-badge ${alarm.statusClass}" title="${alarm.pctLabel}">
            ${alarm.icon}
            <span>${alarm.badgeText}</span>
          </span>
        </div>

        <div class="category-card-body">
          <div class="category-amounts-row">
            <div class="cat-spent-wrap">
              <span class="cat-spent-label">Speso questo mese</span>
              <span class="cat-spent-val">${formatCurrency(stat.spent)}</span>
            </div>
            <div class="cat-budget-wrap">
              <span class="cat-budget-label">Budget stanziato</span>
              <span class="cat-budget-val">su ${formatCurrency(stat.budget)}</span>
            </div>
          </div>

          <!-- Barra di avanzamento con colore dinamico coerente con l'allarme -->
          <div class="progress-bar-container" title="${Math.round(stat.percentage)}% consumato">
            <div class="progress-bar-fill ${alarm.progressClass}" style="width: ${progressClamped}%;"></div>
          </div>

          <div class="category-card-footer">
            <span class="cat-footer-count">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              ${stat.expenses.length} ${stat.expenses.length === 1 ? 'spesa' : 'spese'}
            </span>
            ${cityTagsHtml}
            <button class="btn-card-quick-add" data-cat-id="${cat.id}" title="Aggiungi una spesa per ${escapeHtml(cat.name)}">
              + Aggiungi
            </button>
          </div>
        </div>
      `;

      dom.categoryCardsContainer.appendChild(card);
    });

    // Event listener sul pulsante rapido "+ Aggiungi" presente su ogni card categoria
    dom.categoryCardsContainer.querySelectorAll('.btn-card-quick-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openNewExpenseModal(btn.dataset.catId);
      });
    });
  }

  // ==========================================
  // RENDERING: TAB 2 - REGISTRO SPESE & TABELLA
  // ==========================================

  function populateCategoryDropdowns() {
    const cats = [...state.categories].sort((a, b) => a.name.localeCompare(b.name));

    // Form rapido
    dom.qaCategory.innerHTML = '';
    // Modale spesa
    dom.modalExpenseCategory.innerHTML = '';
    // Filtro categoria
    dom.filterCategorySelect.innerHTML = '<option value="ALL">Tutte le Categorie</option>';

    cats.forEach(cat => {
      const optQa = document.createElement('option');
      optQa.value = cat.id;
      optQa.textContent = `${cat.name} (${formatCurrency(cat.budget)})`;
      dom.qaCategory.appendChild(optQa);

      const optModal = document.createElement('option');
      optModal.value = cat.id;
      optModal.textContent = `${cat.name} (Budget: ${formatCurrency(cat.budget)})`;
      dom.modalExpenseCategory.appendChild(optModal);

      const optFilter = document.createElement('option');
      optFilter.value = cat.id;
      optFilter.textContent = cat.name;
      dom.filterCategorySelect.appendChild(optFilter);
    });

    // Popola il filtro Città raccogliendo tutti i tag città presenti nelle spese registrate
    const citySet = new Set();
    state.expenses.forEach(e => {
      if (e.city && e.city.trim()) {
        citySet.add(e.city.trim());
      }
    });

    const currentFilterCityVal = dom.filterCitySelect.value;
    dom.filterCitySelect.innerHTML = '<option value="ALL">Tutte le Città</option><option value="__NONE__">Senza Città</option>';

    Array.from(citySet).sort().forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      dom.filterCitySelect.appendChild(opt);
    });

    // Ripristina valore selezionato se ancora valido
    if (currentFilterCityVal && (currentFilterCityVal === 'ALL' || currentFilterCityVal === '__NONE__' || citySet.has(currentFilterCityVal))) {
      dom.filterCitySelect.value = currentFilterCityVal;
    }
  }

  function renderExpensesTable() {
    const monthExpenses = getSelectedMonthExpenses();
    const query = dom.expenseSearchInput.value.trim().toLowerCase();
    const catFilter = dom.filterCategorySelect.value;
    const cityFilter = dom.filterCitySelect.value;

    const catMap = {};
    state.categories.forEach(c => { catMap[c.id] = c; });

    // Filtraggio
    let filtered = monthExpenses.filter(exp => {
      const cat = catMap[exp.categoryId];
      const catName = cat ? cat.name.toLowerCase() : '';
      const cityName = (exp.city || '').toLowerCase();
      const desc = (exp.description || '').toLowerCase();

      // Filtro testo (cerca in descrizione, nome categoria o tag città)
      if (query && !desc.includes(query) && !catName.includes(query) && !cityName.includes(query)) {
        return false;
      }
      // Filtro categoria
      if (catFilter !== 'ALL' && exp.categoryId !== catFilter) {
        return false;
      }
      // Filtro città
      if (cityFilter === '__NONE__') {
        if (exp.city && exp.city.trim().length > 0) return false;
      } else if (cityFilter !== 'ALL') {
        if ((exp.city || '').trim().toLowerCase() !== cityFilter.toLowerCase()) return false;
      }

      return true;
    });

    // Ordina per data decrescente
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    dom.expensesTableBody.innerHTML = '';

    if (filtered.length === 0) {
      dom.expensesEmptyState.classList.remove('hidden');
    } else {
      dom.expensesEmptyState.classList.add('hidden');
    }

    filtered.forEach(exp => {
      const cat = catMap[exp.categoryId] || { name: 'Non assegnata', color: '#8b5cf6' };
      const cityTag = (exp.city && exp.city.trim()) ? exp.city.trim() : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Data">${formatDateIT(exp.date)}</td>
        <td data-label="Categoria">
          <span class="cat-pill" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);">
            <span class="category-badge-dot" style="background-color: ${cat.color || '#ec4899'}; color: ${cat.color || '#ec4899'};"></span>
            <strong>${escapeHtml(cat.name)}</strong>
          </span>
        </td>
        <td data-label="Città">
          ${cityTag ? `<span class="city-tag-pill" title="Città: ${escapeHtml(cityTag)}">📍 ${escapeHtml(cityTag)}</span>` : '<span style="color: var(--text-muted); opacity: 0.5;">-</span>'}
        </td>
        <td data-label="Descrizione">${escapeHtml(exp.description || '-')}</td>
        <td data-label="Importo" class="expense-amount-cell" style="text-align: right; color: var(--color-danger);">
          -${formatCurrency(exp.amount)}
        </td>
        <td data-label="Azioni" style="text-align: center;">
          <div class="table-actions">
            <button class="btn-table-action edit-expense-btn" data-id="${exp.id}" title="Modifica spesa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-table-action delete-action delete-expense-btn" data-id="${exp.id}" title="Elimina spesa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </td>
      `;
      dom.expensesTableBody.appendChild(tr);
    });

    // Listener per i bottoni nella tabella
    dom.expensesTableBody.querySelectorAll('.edit-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditExpenseModal(btn.dataset.id));
    });

    dom.expensesTableBody.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteExpense(btn.dataset.id));
    });
  }

  // ==========================================
  // RENDERING: TAB 3 - GRAFICI & STATISTICHE
  // ==========================================

  function renderCharts() {
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#fff1f6' : '#3b1d33';
    const gridColor = isDark ? 'rgba(244, 114, 182, 0.12)' : 'rgba(236, 72, 153, 0.08)';
    const tooltipBg = isDark ? '#271325' : '#ffffff';
    const tooltipText = isDark ? '#fff1f6' : '#3b1d33';

    const catStats = calculateCategoryStats();
    const monthExpenses = getSelectedMonthExpenses();
    const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    dom.donutTotalSpentSubtitle.textContent = `${formatCurrency(totalSpent)} totali spesi`;

    // -------------------------------------------------------------
    // 1. GRAFICO A LINEE: CONFRONTO MENSILE STORICO & RISPARMIO
    // -------------------------------------------------------------
    const historicalData = getHistoricalMonthlyStats(6);
    const lineLabels = historicalData.map(h => h.label);
    const lineSpentData = historicalData.map(h => h.spent);
    const lineBudgetData = historicalData.map(h => h.budget);

    // Calcolo statistiche per il banner di confronto storico
    const currentMonthData = historicalData[historicalData.length - 1];
    const prevMonthsData = historicalData.slice(0, historicalData.length - 1);
    const prevSpentSum = prevMonthsData.reduce((s, h) => s + h.spent, 0);
    const prevAvgSpent = prevMonthsData.length > 0 ? (prevSpentSum / prevMonthsData.length) : currentMonthData.spent;

    // Risparmio a lungo termine (somma dei risparmi positivi nei mesi storici considerati)
    const totalHistoricalSavings = historicalData.reduce((s, h) => s + (h.budget - h.spent), 0);
    const diffFromAvg = prevAvgSpent - currentMonthData.spent; // positivo = speso meno della media (risparmio aumentato)
    const diffPct = prevAvgSpent > 0 ? Math.round((Math.abs(diffFromAvg) / prevAvgSpent) * 100) : 0;

    let diffBadgeHtml = '';
    if (diffFromAvg >= 0) {
      diffBadgeHtml = `<span class="historical-stat-badge status-positive">-${diffPct}% spesa (+${formatCurrency(diffFromAvg)} risparmiati)</span>`;
    } else {
      diffBadgeHtml = `<span class="historical-stat-badge status-warning">+${diffPct}% spesa rispetto alla media</span>`;
    }

    dom.historicalStatsBanner.innerHTML = `
      <div class="historical-stat-item">
        <span class="historical-stat-label">Spesa Mese Corrente</span>
        <div class="historical-stat-val-group">
          <span class="historical-stat-val">${formatCurrency(currentMonthData.spent)}</span>
        </div>
      </div>
      <div class="historical-stat-item">
        <span class="historical-stat-label">Media 5 Mesi Precedenti</span>
        <div class="historical-stat-val-group">
          <span class="historical-stat-val">${formatCurrency(prevAvgSpent)}</span>
        </div>
      </div>
      <div class="historical-stat-item">
        <span class="historical-stat-label">Andamento vs Media</span>
        <div class="historical-stat-val-group">
          ${diffBadgeHtml}
        </div>
      </div>
      <div class="historical-stat-item">
        <span class="historical-stat-label">Risparmio Netto (6 Mesi)</span>
        <div class="historical-stat-val-group">
          <span class="historical-stat-val" style="color: ${totalHistoricalSavings >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${totalHistoricalSavings >= 0 ? '+' : ''}${formatCurrency(totalHistoricalSavings)}
          </span>
        </div>
      </div>
    `;

    if (state.charts.line) {
      state.charts.line.destroy();
    }

    state.charts.line = new Chart(dom.historicalTrendChart, {
      type: 'line',
      data: {
        labels: lineLabels,
        datasets: [
          {
            label: 'Spesa Totale Mensile',
            data: lineSpentData,
            borderColor: '#ec4899',
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(236, 72, 153, 0.15)';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
              gradient.addColorStop(1, 'rgba(236, 72, 153, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointBackgroundColor: historicalData.map(h => h.isCurrent ? '#fb7185' : '#ec4899'),
            pointBorderColor: isDark ? '#271325' : '#ffffff',
            pointBorderWidth: 2,
            pointRadius: historicalData.map(h => h.isCurrent ? 7 : 4),
            pointHoverRadius: 9
          },
          {
            label: 'Budget Stanziato',
            data: lineBudgetData,
            borderColor: '#a855f7',
            borderDash: [6, 6],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 12, weight: 600 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: function (val) { return val + ' €'; }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              boxWidth: 14,
              font: { family: 'Inter', size: 12, weight: 500 }
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: isDark ? 'rgba(244,114,182,0.3)' : 'rgba(236,72,153,0.2)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (context) {
                return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
              },
              afterBody: function (items) {
                const spentItem = items.find(it => it.datasetIndex === 0);
                const budgetItem = items.find(it => it.datasetIndex === 1);
                if (spentItem && budgetItem) {
                  const sp = spentItem.raw || 0;
                  const bg = budgetItem.raw || 0;
                  const sav = bg - sp;
                  const savLabel = sav >= 0 ? `Risparmio: +${formatCurrency(sav)}` : `Sforamento: -${formatCurrency(Math.abs(sav))}`;
                  return [` ${savLabel}`];
                }
                return [];
              }
            }
          }
        }
      }
    });

    // -------------------------------------------------------------
    // 2. CHART CATEGORIE (DONUT)
    // -------------------------------------------------------------
    const activeStats = Object.values(catStats).filter(item => item.spent > 0);
    const donutLabels = activeStats.map(s => s.category.name);
    const donutData = activeStats.map(s => s.spent);
    const donutColors = activeStats.map(s => s.category.color || '#ec4899');

    if (state.charts.donut) {
      state.charts.donut.destroy();
    }

    if (donutData.length === 0) {
      state.charts.donut = new Chart(dom.categoryDonutChart, {
        type: 'doughnut',
        data: {
          labels: ['Nessuna spesa nel mese'],
          datasets: [{
            data: [1],
            backgroundColor: [isDark ? '#271325' : '#fce7f3'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: textColor } },
            tooltip: { enabled: false }
          }
        }
      });
    } else {
      state.charts.donut = new Chart(dom.categoryDonutChart, {
        type: 'doughnut',
        data: {
          labels: donutLabels,
          datasets: [{
            data: donutData,
            backgroundColor: donutColors,
            borderColor: isDark ? '#271325' : '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                boxWidth: 12,
                padding: 12,
                font: { family: 'Inter', size: 12 }
              }
            },
            tooltip: {
              backgroundColor: tooltipBg,
              titleColor: tooltipText,
              bodyColor: tooltipText,
              borderColor: isDark ? 'rgba(244,114,182,0.3)' : 'rgba(236,72,153,0.2)',
              borderWidth: 1,
              callbacks: {
                label: function (context) {
                  const val = context.raw || 0;
                  const pct = totalSpent > 0 ? ((val / totalSpent) * 100).toFixed(1) : 0;
                  return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
                }
              }
            }
          },
          cutout: '65%'
        }
      });
    }

    // -------------------------------------------------------------
    // 3. CHART BUDGET VS SPESE PER CATEGORIA (BAR CHART)
    // -------------------------------------------------------------
    const categoryLabels = state.categories.map(c => c.name);
    const budgetData = state.categories.map(c => Number(c.budget) || 0);
    const spentData = state.categories.map(c => catStats[c.id] ? catStats[c.id].spent : 0);

    if (state.charts.bar) {
      state.charts.bar.destroy();
    }

    state.charts.bar = new Chart(dom.categoryBarChart, {
      type: 'bar',
      data: {
        labels: categoryLabels,
        datasets: [
          {
            label: 'Budget Stanziato',
            data: budgetData,
            backgroundColor: 'rgba(236, 72, 153, 0.75)',
            borderColor: '#ec4899',
            borderWidth: 1.5,
            borderRadius: 8
          },
          {
            label: 'Spesa Effettiva',
            data: spentData,
            backgroundColor: 'rgba(251, 113, 133, 0.85)',
            borderColor: '#fb7185',
            borderWidth: 1.5,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 12, weight: 600 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: function (val) { return val + ' €'; }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              boxWidth: 14,
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
              }
            }
          }
        }
      }
    });

    // -------------------------------------------------------------
    // 4. BREAKDOWN SUMMARY BOXES PER CATEGORIA
    // -------------------------------------------------------------
    renderCategoryBreakdownBoxes(catStats);
  }

  function renderCategoryBreakdownBoxes(catStats) {
    dom.categorySummaryGrid.innerHTML = '';
    state.categories.forEach(cat => {
      const stat = catStats[cat.id] || { spent: 0, budget: cat.budget, balance: cat.budget, percentage: 0 };
      const pct = Math.round(stat.percentage);
      const alarm = getBudgetAlarmInfo(stat.spent, stat.budget);

      const box = document.createElement('div');
      box.className = 'category-summary-box';
      box.innerHTML = `
        <div class="cs-header">
          <div class="cs-name-wrap">
            <span class="category-badge-dot" style="background-color: ${cat.color || '#ec4899'}; color: ${cat.color || '#ec4899'};"></span>
            <span class="cs-name">${escapeHtml(cat.name)}</span>
          </div>
          <span class="budget-alarm-badge ${alarm.statusClass}" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">
            ${pct}% utilizzato
          </span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${alarm.progressClass}" style="width: ${Math.min(pct, 100)}%;"></div>
        </div>
        <div class="cs-stats">
          <span>Speso: <strong>${formatCurrency(stat.spent)}</strong></span>
          <span>Budget: <strong>${formatCurrency(stat.budget)}</strong></span>
          <span>Saldo: <strong style="color: ${stat.balance < 0 ? 'var(--color-danger)' : 'var(--color-success)'};">${formatCurrency(stat.balance)}</strong></span>
        </div>
      `;
      dom.categorySummaryGrid.appendChild(box);
    });
  }

  // ==========================================
  // MODALE: GESTIONE CATEGORIE E BUDGET
  // ==========================================

  function renderCategoriesManagementList() {
    dom.categoriesManagementContainer.innerHTML = '';

    const group = document.createElement('div');
    group.className = 'cat-mgmt-group';

    const totalBudget = state.categories.reduce((s, c) => s + (Number(c.budget) || 0), 0);

    let itemsHtml = `
      <div class="cat-mgmt-header">
        <span>Elenco Categorie (${state.categories.length})</span>
        <span style="color: var(--text-secondary); font-size: 0.85rem;">Budget Totale: <strong>${formatCurrency(totalBudget)}</strong></span>
      </div>
      <div class="cat-mgmt-items">
    `;

    state.categories.forEach(cat => {
      itemsHtml += `
        <div class="cat-mgmt-row" data-cat-id="${cat.id}">
          <div class="cat-mgmt-name-wrap">
            <span class="category-badge-dot" style="background-color: ${cat.color || '#ec4899'}; color: ${cat.color || '#ec4899'};"></span>
            <span class="cat-mgmt-name">${escapeHtml(cat.name)}</span>
          </div>
          <div class="cat-mgmt-controls">
            <div class="cat-budget-input-wrap">
              <span>€</span>
              <input type="number" step="0.5" min="0" value="${cat.budget.toFixed(2)}" class="cat-budget-field" data-cat-id="${cat.id}" title="Modifica budget mensile per ${escapeHtml(cat.name)}">
            </div>
            <button class="btn-table-action delete-action delete-cat-btn" data-cat-id="${cat.id}" title="Elimina categoria">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    });

    itemsHtml += `</div>`;
    group.innerHTML = itemsHtml;
    dom.categoriesManagementContainer.appendChild(group);

    // Event listener per modifica budget al volo
    dom.categoriesManagementContainer.querySelectorAll('.cat-budget-field').forEach(input => {
      input.addEventListener('change', (e) => {
        const catId = e.target.dataset.catId;
        const newBudget = parseFloat(e.target.value);
        if (isNaN(newBudget) || newBudget < 0) {
          showToast('Inserisci un valore di budget valido', 'error');
          return;
        }

        const cat = state.categories.find(c => c.id === catId);
        if (cat) {
          cat.budget = newBudget;
          saveCategoriesToStorage();
          updateAllViews();
          renderCategoriesManagementList();
          showToast(`Budget per "${cat.name}" aggiornato a ${formatCurrency(newBudget)}`, 'success');
        }
      });
    });

    // Event listener eliminazione categoria
    dom.categoriesManagementContainer.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.catId;
        deleteCategory(catId);
      });
    });
  }

  function deleteCategory(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;

    if (state.categories.length <= 1) {
      showToast('Deve rimanere almeno una categoria attiva', 'warning');
      return;
    }

    const associatedExpenses = state.expenses.filter(e => e.categoryId === catId);
    let confirmMsg = `Sei sicuro di voler eliminare la categoria "${cat.name}"?`;
    if (associatedExpenses.length > 0) {
      confirmMsg += `\nAttenzione: ci sono ${associatedExpenses.length} spese registrate in questa categoria. Rimarranno memorizzate.`;
    }

    if (confirm(confirmMsg)) {
      state.categories = state.categories.filter(c => c.id !== catId);
      saveCategoriesToStorage();
      renderCategoriesManagementList();
      updateAllViews();
      showToast(`Categoria "${cat.name}" eliminata`, 'info');
    }
  }

  function handleAddNewCategory(e) {
    e.preventDefault();

    const name = dom.newCatName.value.trim();
    const budget = parseFloat(dom.newCatBudget.value);

    if (!name) {
      showToast('Inserisci un nome per la categoria', 'error');
      return;
    }
    if (isNaN(budget) || budget < 0) {
      showToast('Inserisci un budget valido (>= 0)', 'error');
      return;
    }

    // Controlla se esiste già una categoria con lo stesso nome
    if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Esiste già una categoria con questo nome', 'warning');
      return;
    }

    // Seleziona un colore armonico
    const colorIndex = state.categories.length % CATEGORY_PALETTE.length;
    const color = CATEGORY_PALETTE[colorIndex];

    const newCat = {
      id: generateId('cat'),
      name,
      budget,
      color
    };

    state.categories.push(newCat);
    saveCategoriesToStorage();

    // Reset form
    dom.newCatName.value = '';
    dom.newCatBudget.value = '';

    renderCategoriesManagementList();
    updateAllViews();

    showToast(`Categoria "${name}" creata con successo`, 'success');
  }

  // ==========================================
  // MODALE: AGGIUNTA / MODIFICA SPESA
  // ==========================================

  function openNewExpenseModal(preselectedCatId = null) {
    dom.expenseModalTitle.textContent = 'Nuova Spesa';
    dom.modalExpenseId.value = '';
    dom.modalExpenseDate.value = getTodayDateString();
    dom.modalExpenseCity.value = '';
    dom.modalExpenseDesc.value = '';
    dom.modalExpenseAmount.value = '';

    if (preselectedCatId && state.categories.some(c => c.id === preselectedCatId)) {
      dom.modalExpenseCategory.value = preselectedCatId;
    } else if (state.categories.length > 0) {
      dom.modalExpenseCategory.value = state.categories[0].id;
    }

    dom.expenseModal.classList.remove('hidden');
    dom.modalExpenseAmount.focus();
  }

  function openEditExpenseModal(expenseId) {
    const exp = state.expenses.find(e => e.id === expenseId);
    if (!exp) return;

    dom.expenseModalTitle.textContent = 'Modifica Spesa';
    dom.modalExpenseId.value = exp.id;
    dom.modalExpenseDate.value = exp.date;
    dom.modalExpenseCategory.value = exp.categoryId;
    dom.modalExpenseCity.value = exp.city || '';
    dom.modalExpenseDesc.value = exp.description || '';
    dom.modalExpenseAmount.value = exp.amount;

    dom.expenseModal.classList.remove('hidden');
    dom.modalExpenseAmount.focus();
  }

  function handleSaveExpense(e) {
    e.preventDefault();

    const id = dom.modalExpenseId.value;
    const date = dom.modalExpenseDate.value;
    const categoryId = dom.modalExpenseCategory.value;
    const city = dom.modalExpenseCity.value.trim();
    const description = dom.modalExpenseDesc.value.trim();
    const amount = parseFloat(dom.modalExpenseAmount.value);

    if (!date) {
      showToast('Seleziona una data valida', 'error');
      return;
    }
    if (!categoryId) {
      showToast('Seleziona una categoria', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('Inserisci un importo maggiore di zero', 'error');
      return;
    }

    if (id) {
      // Modifica spesa esistente
      const index = state.expenses.findIndex(e => e.id === id);
      if (index !== -1) {
        state.expenses[index] = { ...state.expenses[index], date, categoryId, city, description, amount };
        showToast('Spesa modificata con successo', 'success');
      }
    } else {
      // Nuova spesa
      const newExp = {
        id: generateId('exp'),
        date,
        categoryId,
        city,
        description,
        amount
      };
      state.expenses.push(newExp);
      showToast('Nuova spesa registrata', 'success');
    }

    saveExpensesToStorage();
    dom.expenseModal.classList.add('hidden');

    // Se la spesa aggiunta è di un altro mese, aggiorniamo la visualizzazione
    const [expYear, expMonth] = date.split('-').map(Number);
    if (expYear !== state.selectedYear || (expMonth - 1) !== state.selectedMonth) {
      state.selectedYear = expYear;
      state.selectedMonth = expMonth - 1;
    }

    updateAllViews();
  }

  function confirmDeleteExpense(expenseId) {
    const exp = state.expenses.find(e => e.id === expenseId);
    if (!exp) return;

    if (confirm(`Sei sicuro di voler eliminare la spesa di ${formatCurrency(exp.amount)} (${exp.description || 'Senza descrizione'})?`)) {
      state.expenses = state.expenses.filter(e => e.id !== expenseId);
      saveExpensesToStorage();
      updateAllViews();
      showToast('Spesa eliminata', 'info');
    }
  }

  // ==========================================
  // AGGIUNTA RAPIDA (FORM SUL TAB SPESE)
  // ==========================================

  function handleQuickAddExpense(e) {
    e.preventDefault();

    const date = dom.qaDate.value;
    const categoryId = dom.qaCategory.value;
    const city = dom.qaCity.value.trim();
    const description = dom.qaDescription.value.trim();
    const amount = parseFloat(dom.qaAmount.value);

    if (!date || !categoryId || isNaN(amount) || amount <= 0) {
      showToast('Completa tutti i campi obbligatori con un importo valido', 'error');
      return;
    }

    const newExp = {
      id: generateId('exp'),
      date,
      categoryId,
      city,
      description,
      amount
    };

    state.expenses.push(newExp);
    saveExpensesToStorage();

    // Svuota i campi opzionali per favorire l'inserimento continuativo
    dom.qaCity.value = '';
    dom.qaDescription.value = '';
    dom.qaAmount.value = '';
    dom.qaAmount.focus();

    // Se la data appartiene a un altro mese, naviga lì
    const [expYear, expMonth] = date.split('-').map(Number);
    if (expYear !== state.selectedYear || (expMonth - 1) !== state.selectedMonth) {
      state.selectedYear = expYear;
      state.selectedMonth = expMonth - 1;
    }

    updateAllViews();
    showToast(`Spesa registrata: -${formatCurrency(amount)}`, 'success');
  }

  // ==========================================
  // ESPORTAZIONE CSV DELLE SPESE DEL MESE
  // ==========================================

  function exportExpensesToCsv() {
    const monthExpenses = getSelectedMonthExpenses();
    if (monthExpenses.length === 0) {
      showToast('Nessuna spesa da esportare per questo mese', 'info');
      return;
    }

    const catMap = {};
    state.categories.forEach(c => { catMap[c.id] = c; });

    let csvContent = 'Data;Categoria;Città;Descrizione;Importo (€)\r\n';
    monthExpenses.forEach(e => {
      const cat = catMap[e.categoryId] || { name: 'Non assegnata' };
      const row = [
        formatDateIT(e.date),
        `"${cat.name}"`,
        `"${(e.city || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        (Number(e.amount) || 0).toFixed(2).replace('.', ',')
      ];
      csvContent += row.join(';') + '\r\n';
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PocketTracker_Spese_${state.selectedYear}_${String(state.selectedMonth + 1).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('File CSV esportato con successo', 'success');
  }

  // ==========================================
  // BACKUP & RIPRISTINO JSON
  // ==========================================

  function backupAllData() {
    const backupObj = {
      version: 2,
      exportDate: new Date().toISOString(),
      categories: state.categories,
      expenses: state.expenses
    };

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PocketTracker_Backup_${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Backup JSON scaricato con successo', 'success');
  }

  function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData.categories) && Array.isArray(importedData.expenses)) {
          if (confirm('Attenzione: il ripristino sostituirà tutti i dati correnti con quelli del backup. Vuoi continuare?')) {
            // Se le categorie importate provengono da una v1, normalizza
            state.categories = importedData.categories.map(c => ({
              id: c.id,
              name: c.name,
              budget: Number(c.budget) || 0,
              color: c.color || CATEGORY_PALETTE[0]
            }));

            state.expenses = importedData.expenses.map(exp => ({
              ...exp,
              city: exp.city || ''
            }));

            saveCategoriesToStorage();
            saveExpensesToStorage();
            updateAllViews();
            showToast('Dati ripristinati correttamente!', 'success');
          }
        } else {
          showToast('Formato file non valido per il backup di PocketTracker', 'error');
        }
      } catch (err) {
        showToast('Errore durante la lettura del file JSON', 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function resetToDefault() {
    if (confirm('Sei sicuro di voler reimpostare i dati predefiniti? Verranno ripristinate le categorie standard (totale 200 €) e i dati storici demo.')) {
      state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.expenses = createInitialDemoExpenses();
      saveCategoriesToStorage();
      saveExpensesToStorage();
      updateAllViews();
      showToast('Dati reimpostati ai valori di default con trend storico', 'success');
    }
  }

  // ==========================================
  // TEMA CHIARO / SCURO
  // ==========================================

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#190d18' : '#fff5f8');
    }
    if (theme === 'dark') {
      dom.themeIconSun.classList.remove('hidden');
      dom.themeIconMoon.classList.add('hidden');
    } else {
      dom.themeIconSun.classList.add('hidden');
      dom.themeIconMoon.classList.remove('hidden');
    }
    saveThemeToStorage();
    if (state.activeTab === 'charts') {
      renderCharts();
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==========================================
  // AGGIORNAMENTO GLOBALE DELLE VISTE
  // ==========================================

  function updateAllViews() {
    renderMonthHeader();
    renderKpiCards();
    populateCategoryDropdowns();
    renderCategoryCards();
    renderExpensesTable();

    if (state.activeTab === 'charts') {
      renderCharts();
    }
  }

  // ==========================================
  // INIZIALIZZAZIONE & EVENT LISTENERS
  // ==========================================

  function initEventListeners() {
    // Navigazione mese
    dom.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    dom.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    dom.todayBtn.addEventListener('click', setTodayMonth);

    // Month picker trigger (input nascosto)
    dom.monthPickerTrigger.addEventListener('click', () => {
      dom.hiddenMonthInput.showPicker ? dom.hiddenMonthInput.showPicker() : dom.hiddenMonthInput.focus();
    });

    dom.hiddenMonthInput.addEventListener('change', (e) => {
      if (e.target.value) {
        const [y, m] = e.target.value.split('-').map(Number);
        state.selectedYear = y;
        state.selectedMonth = m - 1;
        updateAllViews();
      }
    });

    // Theme toggle
    dom.themeToggleBtn.addEventListener('click', toggleTheme);

    // Navigazione Tab
    dom.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        state.activeTab = targetTab;

        dom.tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        dom.tabPanes.forEach(pane => {
          if (pane.id === `tab-${targetTab}`) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });

        if (targetTab === 'charts') {
          setTimeout(renderCharts, 50);
        }
      });
    });

    // Modali: Apertura & Chiusura
    dom.openNewExpenseModalBtn.addEventListener('click', () => openNewExpenseModal());
    dom.quickAddExpenseTrigger.addEventListener('click', () => openNewExpenseModal());
    dom.manageCategoriesBtn.addEventListener('click', () => {
      renderCategoriesManagementList();
      dom.categoriesModal.classList.remove('hidden');
      dom.newCatName.focus();
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        document.getElementById(modalId).classList.add('hidden');
      });
    });

    // Chiudi modale cliccando sul backdrop
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
      }
    });

    // Chiudi modale con tasto Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dom.expenseModal.classList.add('hidden');
        dom.categoriesModal.classList.add('hidden');
      }
    });

    // Submits
    dom.quickAddForm.addEventListener('submit', handleQuickAddExpense);
    dom.expenseModalForm.addEventListener('submit', handleSaveExpense);
    dom.addCategoryForm.addEventListener('submit', handleAddNewCategory);

    // Filtri tabella spese
    dom.expenseSearchInput.addEventListener('input', renderExpensesTable);
    dom.filterCategorySelect.addEventListener('change', renderExpensesTable);
    dom.filterCitySelect.addEventListener('change', renderExpensesTable);
    dom.exportCsvBtn.addEventListener('click', exportExpensesToCsv);

    // Footer actions
    dom.backupDataBtn.addEventListener('click', backupAllData);
    dom.restoreDataBtn.addEventListener('click', () => dom.hiddenRestoreInput.click());
    dom.hiddenRestoreInput.addEventListener('change', handleRestoreFile);
    dom.resetDemoBtn.addEventListener('click', resetToDefault);
  }

  // ==========================================
  // BOOTSTRAP
  // ==========================================

  function init() {
    loadStateFromStorage();
    applyTheme(state.theme);

    // Default per form quick add: data di oggi
    dom.qaDate.value = getTodayDateString();

    initEventListeners();
    updateAllViews();
  }

  // Avvio al caricamento del DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
