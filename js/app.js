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
    CATEGORIES: 'pocket_tracker_categories_v1',
    EXPENSES: 'pocket_tracker_expenses_v1',
    THEME: 'pocket_tracker_theme_v1'
  };

  const DEFAULT_CATEGORIES = [
    // Brescia (Totale: 100 €)
    { id: 'cat_bs_gelati', city: 'Brescia', name: 'Gelati', budget: 12.00, color: '#f472b6' },
    { id: 'cat_bs_cena', city: 'Brescia', name: 'Cena', budget: 50.00, color: '#ec4899' },
    { id: 'cat_bs_tennis', city: 'Brescia', name: 'Tennis/sport', budget: 24.00, color: '#fb7185' },
    { id: 'cat_bs_extra', city: 'Brescia', name: 'Extra', budget: 14.00, color: '#e879f9' },

    // Lissone (Totale: 90 €)
    { id: 'cat_ls_colazioni', city: 'Lissone', name: 'Colazioni', budget: 10.00, color: '#fb923c' },
    { id: 'cat_ls_uscite', city: 'Lissone', name: 'Uscite serali', budget: 40.00, color: '#f43f5e' },
    { id: 'cat_ls_cene_pranzi', city: 'Lissone', name: 'Cene/pranzi', budget: 12.00, color: '#db2777' },
    { id: 'cat_ls_spesa', city: 'Lissone', name: 'Spesa', budget: 28.00, color: '#fda4af' },

    // Generale (Totale: 10 €)
    { id: 'cat_gen_extra', city: 'Generale', name: 'Extra', budget: 10.00, color: '#c084fc' }
  ];

  // Città e colori di badge associati - Palette Rose & Pink
  const CITY_COLORS = {
    'Brescia': '#f472b6',
    'Lissone': '#ec4899',
    'Generale': '#c084fc',
    'Altro': '#fb7185'
  };

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
      bar: null
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

  // ==========================================
  // PERSISTENZA LOCAL STORAGE
  // ==========================================

  function loadStateFromStorage() {
    try {
      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (storedCategories) {
        state.categories = JSON.parse(storedCategories);
        // Allinea automaticamente i colori delle categorie standard alla nuova palette rosa
        const defaultColorMap = {};
        DEFAULT_CATEGORIES.forEach(c => { defaultColorMap[c.id] = c.color; });
        let updated = false;
        state.categories.forEach(cat => {
          if (defaultColorMap[cat.id] && cat.color !== defaultColorMap[cat.id]) {
            cat.color = defaultColorMap[cat.id];
            updated = true;
          }
        });
        if (updated) {
          saveCategoriesToStorage();
        }
      } else {
        state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        saveCategoriesToStorage();
      }

      const storedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (storedExpenses) {
        state.expenses = JSON.parse(storedExpenses);
      } else {
        // Se è la primissima volta, aggiungiamo alcune spese demo realistiche per il mese corrente
        // per permettere all'utente di apprezzare subito il design e i grafici interattivi
        state.expenses = createInitialDemoExpenses();
        saveExpensesToStorage();
      }

      const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (storedTheme) {
        state.theme = storedTheme;
      }
    } catch (e) {
      console.error('Errore durante il caricamento dei dati da localStorage:', e);
      state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.expenses = [];
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

  function createInitialDemoExpenses() {
    const y = state.selectedYear;
    const m = String(state.selectedMonth + 1).padStart(2, '0');
    return [
      { id: generateId('exp'), date: `${y}-${m}-01`, categoryId: 'cat_ls_colazioni', description: 'Caffè e cornetto al bar', amount: 3.50 },
      { id: generateId('exp'), date: `${y}-${m}-02`, categoryId: 'cat_bs_gelati', description: 'Coppetta pistacchio e nocciola', amount: 4.00 },
      { id: generateId('exp'), date: `${y}-${m}-03`, categoryId: 'cat_ls_spesa', description: 'Spesa supermercato', amount: 16.80 },
      { id: generateId('exp'), date: `${y}-${m}-05`, categoryId: 'cat_bs_tennis', description: 'Prenotazione campo da tennis', amount: 12.00 },
      { id: generateId('exp'), date: `${y}-${m}-07`, categoryId: 'cat_bs_cena', description: 'Pizzata con gli amici', amount: 22.00 },
      { id: generateId('exp'), date: `${y}-${m}-10`, categoryId: 'cat_ls_uscite', description: 'Aperitivo in centro', amount: 15.00 }
    ];
  }

  // ==========================================
  // ELEMENTI DOM
  // ==========================================

  const dom = {
    // Header & Navigation
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

    // Overview Tab
    cityCardsContainer: document.getElementById('cityCardsContainer'),

    // Expenses Tab
    quickAddForm: document.getElementById('quickAddForm'),
    qaDate: document.getElementById('qaDate'),
    qaCategory: document.getElementById('qaCategory'),
    qaDescription: document.getElementById('qaDescription'),
    qaAmount: document.getElementById('qaAmount'),
    expenseSearchInput: document.getElementById('expenseSearchInput'),
    filterCitySelect: document.getElementById('filterCitySelect'),
    filterCategorySelect: document.getElementById('filterCategorySelect'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    expensesTableBody: document.getElementById('expensesTableBody'),
    expensesEmptyState: document.getElementById('expensesEmptyState'),

    // Charts Tab
    donutTotalSpentSubtitle: document.getElementById('donutTotalSpentSubtitle'),
    categoryDonutChart: document.getElementById('categoryDonutChart'),
    cityBarChart: document.getElementById('cityBarChart'),
    citySummaryGrid: document.getElementById('citySummaryGrid'),

    // Modal: Expense
    expenseModal: document.getElementById('expenseModal'),
    expenseModalForm: document.getElementById('expenseModalForm'),
    expenseModalTitle: document.getElementById('expenseModalTitle'),
    modalExpenseId: document.getElementById('modalExpenseId'),
    modalExpenseDate: document.getElementById('modalExpenseDate'),
    modalExpenseCategory: document.getElementById('modalExpenseCategory'),
    modalExpenseDesc: document.getElementById('modalExpenseDesc'),
    modalExpenseAmount: document.getElementById('modalExpenseAmount'),

    // Modal: Categories
    categoriesModal: document.getElementById('categoriesModal'),
    addCategoryForm: document.getElementById('addCategoryForm'),
    newCatCity: document.getElementById('newCatCity'),
    customCityGroup: document.getElementById('customCityGroup'),
    customCityInput: document.getElementById('customCityInput'),
    newCatName: document.getElementById('newCatName'),
    newCatBudget: document.getElementById('newCatBudget'),
    categoriesManagementContainer: document.getElementById('categoriesManagementContainer'),

    // Footer actions
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
        percentage: 0
      };
    });

    monthExpenses.forEach(exp => {
      if (statsMap[exp.categoryId]) {
        statsMap[exp.categoryId].spent += Number(exp.amount) || 0;
      }
    });

    // Calcolo saldi e percentuali
    Object.values(statsMap).forEach(item => {
      item.balance = item.budget - item.spent;
      item.percentage = item.budget > 0 ? (item.spent / item.budget) * 100 : (item.spent > 0 ? 100 : 0);
    });

    return statsMap;
  }

  // Raggruppamento per città
  function getStatsByCity() {
    const catStats = calculateCategoryStats();
    const citiesMap = {};

    state.categories.forEach(cat => {
      const city = cat.city || 'Generale';
      if (!citiesMap[city]) {
        citiesMap[city] = {
          city: city,
          totalBudget: 0,
          totalSpent: 0,
          categories: []
        };
      }
      const stat = catStats[cat.id];
      citiesMap[city].totalBudget += stat.budget;
      citiesMap[city].totalSpent += stat.spent;
      citiesMap[city].categories.push(stat);
    });

    Object.values(citiesMap).forEach(c => {
      c.remainingBalance = c.totalBudget - c.totalSpent;
      c.percentage = c.totalBudget > 0 ? (c.totalSpent / c.totalBudget) * 100 : 0;
    });

    return citiesMap;
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

    // Badge Colore Spesa
    if (spentPercent >= 100) {
      dom.kpiSpentPercentBadge.style.background = 'var(--color-danger-bg)';
      dom.kpiSpentPercentBadge.style.color = 'var(--color-danger)';
    } else if (spentPercent >= 75) {
      dom.kpiSpentPercentBadge.style.background = 'var(--color-warning-bg)';
      dom.kpiSpentPercentBadge.style.color = 'var(--color-warning)';
    } else {
      dom.kpiSpentPercentBadge.style.background = 'rgba(255, 255, 255, 0.08)';
      dom.kpiSpentPercentBadge.style.color = 'var(--text-secondary)';
    }

    // Saldo Rimanente
    dom.kpiRemainingBalance.textContent = formatCurrency(remainingBalance);

    // Status Tag Saldo
    if (remainingBalance < 0) {
      dom.kpiStatusTag.className = 'status-indicator-tag status-danger';
      dom.kpiStatusTag.textContent = `Sforato di ${formatCurrency(Math.abs(remainingBalance))}`;
    } else if (spentPercent >= 85) {
      dom.kpiStatusTag.className = 'status-indicator-tag status-warning';
      dom.kpiStatusTag.textContent = `In esaurimento (${formatCurrency(remainingBalance)} rimasti)`;
    } else {
      dom.kpiStatusTag.className = 'status-indicator-tag status-positive';
      dom.kpiStatusTag.textContent = 'In budget';
    }

    // Badge conteggio nel tab spese
    dom.expensesCountBadge.textContent = monthExpenses.length;
  }

  // ==========================================
  // RENDERING: TAB 1 - PANORAMICA PER CITTÀ
  // ==========================================

  function renderCityCards() {
    const citiesMap = getStatsByCity();
    dom.cityCardsContainer.innerHTML = '';

    const cityNames = Object.keys(citiesMap);
    if (cityNames.length === 0) {
      dom.cityCardsContainer.innerHTML = `
        <div class="empty-state">
          <p>Nessuna categoria configurata. Clicca su "Budget & Categorie" per crearne una.</p>
        </div>
      `;
      return;
    }

    cityNames.forEach(cityName => {
      const cityData = citiesMap[cityName];
      const cityBadgeColor = CITY_COLORS[cityName] || '#8b5cf6';

      const card = document.createElement('div');
      card.className = 'city-card';

      // Header della card
      const headerHtml = `
        <div class="city-card-header">
          <div class="city-title-group">
            <span class="city-badge-dot" style="background-color: ${cityBadgeColor};"></span>
            <h3 class="city-title">${cityName}</h3>
          </div>
          <div class="city-totals">
            <div class="spent">${formatCurrency(cityData.totalSpent)}</div>
            <div class="budget">su ${formatCurrency(cityData.totalBudget)}</div>
          </div>
        </div>
      `;

      // Categorie della città
      let categoriesHtml = '<div class="category-items-list">';
      cityData.categories.forEach(item => {
        const cat = item.category;
        const progressClamped = Math.min(item.percentage, 100);

        // Colore della barra in base alla percentuale
        let progressClass = 'progress-green';
        let balanceClass = 'status-positive';

        if (item.percentage >= 100) {
          progressClass = 'progress-red';
          balanceClass = 'status-danger';
        } else if (item.percentage >= 75) {
          progressClass = 'progress-yellow';
          balanceClass = 'status-warning';
        }

        const balanceLabel = item.balance >= 0
          ? `Rimangono ${formatCurrency(item.balance)}`
          : `Sforato di ${formatCurrency(Math.abs(item.balance))}`;

        categoriesHtml += `
          <div class="category-row">
            <div class="category-meta">
              <span class="category-name">
                ${cat.name}
              </span>
              <div class="category-amounts">
                <span class="spent-amount">${formatCurrency(item.spent)}</span>
                <span class="budget-limit">/ ${formatCurrency(item.budget)}</span>
                <span class="category-amounts balance-amount ${balanceClass}">
                  ${balanceLabel}
                </span>
              </div>
            </div>
            <div class="progress-bar-container" title="${Math.round(item.percentage)}% consumato">
              <div class="progress-bar-fill ${progressClass}" style="width: ${progressClamped}%"></div>
            </div>
          </div>
        `;
      });
      categoriesHtml += '</div>';

      card.innerHTML = headerHtml + categoriesHtml;
      dom.cityCardsContainer.appendChild(card);
    });
  }

  // ==========================================
  // RENDERING: TAB 2 - REGISTRO SPESE & TABELLA
  // ==========================================

  function populateCategoryDropdowns() {
    const cats = [...state.categories].sort((a, b) => {
      if (a.city === b.city) return a.name.localeCompare(b.name);
      return a.city.localeCompare(b.city);
    });

    // Per form aggiunta rapida
    dom.qaCategory.innerHTML = '';
    // Per modale spesa
    dom.modalExpenseCategory.innerHTML = '';
    // Per filtro categoria
    dom.filterCategorySelect.innerHTML = '<option value="ALL">Tutte le Categorie</option>';

    // Raggruppa per città nel select
    const cityGroups = {};
    cats.forEach(cat => {
      const city = cat.city || 'Generale';
      if (!cityGroups[city]) cityGroups[city] = [];
      cityGroups[city].push(cat);
    });

    Object.keys(cityGroups).forEach(city => {
      const optGroupQa = document.createElement('optgroup');
      optGroupQa.label = city;

      const optGroupModal = document.createElement('optgroup');
      optGroupModal.label = city;

      cityGroups[city].forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat.id;
        opt1.textContent = `${cat.name} (${formatCurrency(cat.budget)})`;
        optGroupQa.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = cat.id;
        opt2.textContent = `${cat.name} [${city}] (${formatCurrency(cat.budget)})`;
        optGroupModal.appendChild(opt2);

        // Per il filtro
        const optFilter = document.createElement('option');
        optFilter.value = cat.id;
        optFilter.textContent = `${cat.name} (${city})`;
        dom.filterCategorySelect.appendChild(optFilter);
      });

      dom.qaCategory.appendChild(optGroupQa);
      dom.modalExpenseCategory.appendChild(optGroupModal);
    });

    // Popola anche il filtro città
    const cities = Array.from(new Set(state.categories.map(c => c.city || 'Generale'))).sort();
    dom.filterCitySelect.innerHTML = '<option value="ALL">Tutte le Città</option>';
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      dom.filterCitySelect.appendChild(opt);
    });
  }

  function renderExpensesTable() {
    const monthExpenses = getSelectedMonthExpenses();
    const query = dom.expenseSearchInput.value.trim().toLowerCase();
    const cityFilter = dom.filterCitySelect.value;
    const catFilter = dom.filterCategorySelect.value;

    const catMap = {};
    state.categories.forEach(c => { catMap[c.id] = c; });

    // Filtraggio
    let filtered = monthExpenses.filter(exp => {
      const cat = catMap[exp.categoryId];
      const cityName = cat ? (cat.city || 'Generale') : '';
      const catName = cat ? cat.name.toLowerCase() : '';
      const desc = (exp.description || '').toLowerCase();

      // Filtro testo
      if (query && !desc.includes(query) && !catName.includes(query) && !cityName.toLowerCase().includes(query)) {
        return false;
      }
      // Filtro città
      if (cityFilter !== 'ALL' && cityName !== cityFilter) {
        return false;
      }
      // Filtro categoria
      if (catFilter !== 'ALL' && exp.categoryId !== catFilter) {
        return false;
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
      const cat = catMap[exp.categoryId] || { name: 'Non assegnata', city: 'N/A' };
      const cityBadgeColor = CITY_COLORS[cat.city] || '#8b5cf6';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Data">${formatDateIT(exp.date)}</td>
        <td data-label="Categoria & Città">
          <span class="cat-pill" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255,255,255,0.1);">
            <span class="city-badge-dot" style="background-color: ${cityBadgeColor};"></span>
            <strong>${cat.name}</strong>
            <span class="city-tag">(${cat.city})</span>
          </span>
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

    // 1. Chart Categorie (Donut)
    // Filtra solo categorie con spesa > 0 per un grafico pulito
    const activeStats = Object.values(catStats).filter(item => item.spent > 0);

    const donutLabels = activeStats.map(s => `${s.category.name} (${s.category.city})`);
    const donutData = activeStats.map(s => s.spent);
    const donutColors = activeStats.map(s => s.category.color || '#ec4899');

    if (state.charts.donut) {
      state.charts.donut.destroy();
    }

    if (donutData.length === 0) {
      // Mostra un placeholder trasparente
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

    // 2. Chart Budget vs Spese per Città (Bar Chart)
    const citiesMap = getStatsByCity();
    const cityLabels = Object.keys(citiesMap);
    const budgetData = cityLabels.map(city => citiesMap[city].totalBudget);
    const spentData = cityLabels.map(city => citiesMap[city].totalSpent);

    if (state.charts.bar) {
      state.charts.bar.destroy();
    }

    state.charts.bar = new Chart(dom.cityBarChart, {
      type: 'bar',
      data: {
        labels: cityLabels,
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

    // 3. Breakdown Summary Boxes
    renderCityBreakdownBoxes(citiesMap);
  }

  function renderCityBreakdownBoxes(citiesMap) {
    dom.citySummaryGrid.innerHTML = '';
    Object.values(citiesMap).forEach(c => {
      const pct = Math.round(c.percentage);
      let pctClass = 'status-positive';
      if (pct >= 100) pctClass = 'status-danger';
      else if (pct >= 75) pctClass = 'status-warning';

      const box = document.createElement('div');
      box.className = 'city-summary-box';
      box.innerHTML = `
        <div class="cs-header">
          <span class="cs-name">${c.city}</span>
          <span class="status-indicator-tag ${pctClass}">${pct}% utilizzato</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${pct >= 100 ? 'progress-red' : (pct >= 75 ? 'progress-yellow' : 'progress-green')}" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        <div class="cs-stats">
          <span>Speso: <strong>${formatCurrency(c.totalSpent)}</strong></span>
          <span>Budget: <strong>${formatCurrency(c.totalBudget)}</strong></span>
        </div>
      `;
      dom.citySummaryGrid.appendChild(box);
    });
  }

  // ==========================================
  // MODALE: GESTIONE CATEGORIE E BUDGET
  // ==========================================

  function populateNewCategoryCities() {
    const existingCities = Array.from(new Set(state.categories.map(c => c.city || 'Generale'))).sort();
    dom.newCatCity.innerHTML = '';

    existingCities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      dom.newCatCity.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = '__NEW__';
    optNew.textContent = '+ Crea Nuova Città...';
    dom.newCatCity.appendChild(optNew);
  }

  function renderCategoriesManagementList() {
    dom.categoriesManagementContainer.innerHTML = '';

    const citiesMap = {};
    state.categories.forEach(cat => {
      const city = cat.city || 'Generale';
      if (!citiesMap[city]) citiesMap[city] = [];
      citiesMap[city].push(cat);
    });

    Object.keys(citiesMap).sort().forEach(city => {
      const group = document.createElement('div');
      group.className = 'cat-mgmt-group';

      const totalCityBudget = citiesMap[city].reduce((s, c) => s + (Number(c.budget) || 0), 0);

      let itemsHtml = `
        <div class="cat-mgmt-header">
          <span>${city}</span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">Totale Budget: ${formatCurrency(totalCityBudget)}</span>
        </div>
        <div class="cat-mgmt-items">
      `;

      citiesMap[city].forEach(cat => {
        itemsHtml += `
          <div class="cat-mgmt-row" data-cat-id="${cat.id}">
            <span class="cat-mgmt-name">${cat.name}</span>
            <div class="cat-mgmt-controls">
              <div class="cat-budget-input-wrap">
                <span>€</span>
                <input type="number" step="0.5" min="0" value="${cat.budget.toFixed(2)}" class="cat-budget-field" data-cat-id="${cat.id}">
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
    });

    // Event listeners per modifica budget al volo (onchange / onblur)
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

    // Controllo se ci sono spese collegate
    const associatedExpenses = state.expenses.filter(e => e.categoryId === catId);
    let confirmMsg = `Sei sicuro di voler eliminare la categoria "${cat.name}" (${cat.city})?`;
    if (associatedExpenses.length > 0) {
      confirmMsg += `\nAttenzione: ci sono ${associatedExpenses.length} spese registrate associate a questa categoria. Verranno mantenute senza categoria.`;
    }

    if (confirm(confirmMsg)) {
      state.categories = state.categories.filter(c => c.id !== catId);
      saveCategoriesToStorage();
      populateNewCategoryCities();
      renderCategoriesManagementList();
      updateAllViews();
      showToast(`Categoria "${cat.name}" eliminata`, 'info');
    }
  }

  // ==========================================
  // MODALE: AGGIUNTA / MODIFICA SPESA
  // ==========================================

  function openNewExpenseModal() {
    dom.expenseModalTitle.textContent = 'Nuova Spesa';
    dom.modalExpenseId.value = '';
    dom.modalExpenseDate.value = getTodayDateString();
    dom.modalExpenseDesc.value = '';
    dom.modalExpenseAmount.value = '';

    // Seleziona la prima categoria disponibile
    if (state.categories.length > 0) {
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
        state.expenses[index] = { ...state.expenses[index], date, categoryId, description, amount };
        showToast('Spesa modificata con successo', 'success');
      }
    } else {
      // Nuova spesa
      const newExp = {
        id: generateId('exp'),
        date,
        categoryId,
        description,
        amount
      };
      state.expenses.push(newExp);
      showToast('Nuova spesa registrata', 'success');
    }

    saveExpensesToStorage();
    dom.expenseModal.classList.add('hidden');

    // Se la spesa aggiunta è di un altro mese, aggiorniamo il mese selezionato per vederla subito
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
      description,
      amount
    };

    state.expenses.push(newExp);
    saveExpensesToStorage();

    // Svuota solo descrizione e importo per comodità di inserimento seriale
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
    showToast(`Aggiunta spesa: -${formatCurrency(amount)}`, 'success');
  }

  // ==========================================
  // AGGIUNTA NUOVA CATEGORIA (MODALE)
  // ==========================================

  function handleAddNewCategory(e) {
    e.preventDefault();

    let city = dom.newCatCity.value;
    if (city === '__NEW__') {
      city = dom.customCityInput.value.trim();
      if (!city) {
        showToast('Specifica il nome della nuova città', 'error');
        return;
      }
    }

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

    // Colore casuale armonico - Palette rosa, corallo, pesca e lavanda
    const colors = ['#f43f85', '#ec4899', '#fb7185', '#f472b6', '#e879f9', '#c084fc', '#fb923c', '#db2777', '#f43f5e', '#fda4af'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newCat = {
      id: generateId('cat'),
      city,
      name,
      budget,
      color: randomColor
    };

    state.categories.push(newCat);
    saveCategoriesToStorage();

    // Reset form
    dom.newCatName.value = '';
    dom.newCatBudget.value = '';
    dom.customCityInput.value = '';
    dom.customCityGroup.classList.add('hidden');

    populateNewCategoryCities();
    renderCategoriesManagementList();
    updateAllViews();

    showToast(`Categoria "${name}" aggiunta con successo per ${city}`, 'success');
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

    let csvContent = 'Data;Città;Categoria;Descrizione;Importo (€)\r\n';
    monthExpenses.forEach(e => {
      const cat = catMap[e.categoryId] || { name: 'Non assegnata', city: 'Generale' };
      const row = [
        formatDateIT(e.date),
        `"${cat.city}"`,
        `"${cat.name}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        (Number(e.amount) || 0).toFixed(2).replace('.', ',')
      ];
      csvContent += row.join(';') + '\r\n';
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Spese_${state.selectedYear}_${String(state.selectedMonth + 1).padStart(2, '0')}.csv`;
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
      version: 1,
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
          if (confirm('Attenzione: il ripristino sostituirà tutti i dati attuali con quelli del backup. Vuoi continuare?')) {
            state.categories = importedData.categories;
            state.expenses = importedData.expenses;
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
      event.target.value = ''; // Reset per consentire il re-upload dello stesso file
    };
    reader.readAsText(file);
  }

  function resetToDefault() {
    if (confirm('Sei sicuro di voler ripristinare le categorie di default iniziali (Brescia, Lissone, Generale per un totale di 200 €)? Le spese attuali verranno azzerate.')) {
      state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.expenses = createInitialDemoExpenses();
      saveCategoriesToStorage();
      saveExpensesToStorage();
      updateAllViews();
      showToast('Dati reimpostati ai valori di default iniziali', 'success');
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
  // AGGIORNAMENTO GLOBALE DELLE VISTE
  // ==========================================

  function updateAllViews() {
    renderMonthHeader();
    renderKpiCards();
    populateCategoryDropdowns();
    renderCityCards();
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
    dom.openNewExpenseModalBtn.addEventListener('click', openNewExpenseModal);
    dom.quickAddExpenseTrigger.addEventListener('click', openNewExpenseModal);
    dom.manageCategoriesBtn.addEventListener('click', () => {
      populateNewCategoryCities();
      renderCategoriesManagementList();
      dom.categoriesModal.classList.remove('hidden');
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

    // Cambio select città nel subform aggiungi categoria
    dom.newCatCity.addEventListener('change', (e) => {
      if (e.target.value === '__NEW__') {
        dom.customCityGroup.classList.remove('hidden');
        dom.customCityInput.focus();
      } else {
        dom.customCityGroup.classList.add('hidden');
      }
    });

    // Filtri tabella spese
    dom.expenseSearchInput.addEventListener('input', renderExpensesTable);
    dom.filterCitySelect.addEventListener('change', renderExpensesTable);
    dom.filterCategorySelect.addEventListener('change', renderExpensesTable);
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
