/**
 * UI Components Manager
 * Handles all user interface interactions and updates
 */
const UI = {
    elements: {},

    /**
     * Initialize UI components
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
    },

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Modal
            apiKeyModal: document.getElementById('apiKeyModal'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            saveApiKeyBtn: document.getElementById('saveApiKey'),

            // Header controls
            dateRangeBtns: document.querySelectorAll('.range-btn'),
            customDateInputs: document.getElementById('customDateInputs'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            applyCustomDate: document.getElementById('applyCustomDate'),
            productSelect: document.getElementById('productSelect'),

            // Footer
            refreshBtn: document.getElementById('refreshData'),
            clearCacheBtn: document.getElementById('clearCache'),
            lastUpdated: document.getElementById('lastUpdated'),

            // Loading & Toast
            loadingOverlay: document.getElementById('loadingOverlay'),
            errorToast: document.getElementById('errorToast'),

            // KPI Cards
            kpiCards: document.querySelectorAll('.kpi-card')
        };
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // API Key modal
        this.elements.saveApiKeyBtn?.addEventListener('click', () => {
            const key = this.elements.apiKeyInput.value.trim();
            if (key) {
                Config.setApiKey(key);
                this.hideModal();
                if (window.App) {
                    App.loadData();
                }
            }
        });

        this.elements.apiKeyInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.elements.saveApiKeyBtn.click();
            }
        });

        // Date range buttons
        this.elements.dateRangeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;

                // Update active state
                this.elements.dateRangeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (range === 'custom') {
                    this.elements.customDateInputs.style.display = 'flex';
                } else {
                    this.elements.customDateInputs.style.display = 'none';
                    if (window.App) {
                        App.setDateRange(range);
                    }
                }
            });
        });

        // Custom date apply
        this.elements.applyCustomDate?.addEventListener('click', () => {
            const start = this.elements.startDate.value;
            const end = this.elements.endDate.value;
            if (start && end && window.App) {
                App.setCustomDateRange(start, end);
            }
        });

        // Product filter
        this.elements.productSelect?.addEventListener('change', (e) => {
            if (window.App) {
                App.setProduct(e.target.value);
            }
        });

        // Footer buttons
        this.elements.refreshBtn?.addEventListener('click', () => {
            if (window.App) {
                App.refreshData();
            }
        });

        this.elements.clearCacheBtn?.addEventListener('click', () => {
            FredApi.clearCache();
            this.showToast('Cache cleared successfully', 'success');
        });
    },

    /**
     * Show API key modal
     */
    showModal() {
        if (this.elements.apiKeyModal) {
            this.elements.apiKeyModal.classList.remove('hidden');
        }
    },

    /**
     * Hide API key modal
     */
    hideModal() {
        if (this.elements.apiKeyModal) {
            this.elements.apiKeyModal.classList.add('hidden');
        }
    },

    /**
     * Show loading overlay
     */
    showLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    },

    /**
     * Show toast notification
     * @param {string} message
     * @param {string} type - 'error' or 'success'
     */
    showToast(message, type = 'error') {
        const toast = this.elements.errorToast;
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    },

    /**
     * Update KPI card values
     * @param {string} factor - Factor identifier
     * @param {Object} data - {current, changePercent}
     */
    updateKpiCard(factor, data) {
        const valueEl = document.getElementById(`${factor}-value`);
        const changeEl = document.getElementById(`${factor}-change`);

        if (valueEl && data.current !== null) {
            valueEl.textContent = data.current;
        }

        if (changeEl && data.changePercent !== null) {
            const change = parseFloat(data.changePercent);
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change}%`;
            changeEl.className = `kpi-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    },

    /**
     * Update all KPI cards from series data
     * @param {Object} seriesData - All series data
     * @param {Object} fxData - Exchange rate data
     */
    updateAllKpis(seriesData, fxData) {
        // Update FRED series KPIs
        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (meta && data && data.length > 0) {
                const latest = FredApi.getLatestWithChange(data);
                this.updateKpiCard(meta.factor, latest);
            }
        });

        // Update EUR/USD KPI
        if (fxData && fxData.length > 0) {
            const latest = FrankfurterApi.getLatestWithChange(fxData);
            this.updateKpiCard('eurusd', latest);
        }
    },

    /**
     * Update last updated timestamp
     */
    updateTimestamp() {
        if (this.elements.lastUpdated) {
            const now = new Date();
            this.elements.lastUpdated.textContent = `Last updated: ${now.toLocaleString()}`;
        }
    },

    /**
     * Set default date inputs
     * @param {string} start - Start date
     * @param {string} end - End date
     */
    setDateInputs(start, end) {
        if (this.elements.startDate) {
            this.elements.startDate.value = start;
        }
        if (this.elements.endDate) {
            this.elements.endDate.value = end;
        }
    },

    /**
     * Get selected product
     * @returns {string}
     */
    getSelectedProduct() {
        return this.elements.productSelect?.value || 'GI';
    },

    /**
     * Get current date range selection
     * @returns {string}
     */
    getCurrentRange() {
        const activeBtn = document.querySelector('.range-btn.active');
        return activeBtn?.dataset.range || '1Y';
    }
};
