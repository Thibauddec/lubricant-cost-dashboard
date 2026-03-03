/**
 * UI Components Manager
 */
const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.setupEventListeners();
    },

    cacheElements() {
        this.elements = {
            dateRangeBtns: document.querySelectorAll('.range-btn'),
            productSelect: document.getElementById('productSelect'),
            refreshBtn: document.getElementById('refreshData'),
            lastUpdated: document.getElementById('lastUpdated'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText')
        };
    },

    setupEventListeners() {
        // Date range buttons
        this.elements.dateRangeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                this.elements.dateRangeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (window.App) App.setDateRange(range);
            });
        });

        // Product tabs
        document.querySelectorAll('.product-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.product-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const product = tab.dataset.product;
                if (this.elements.productSelect) {
                    this.elements.productSelect.value = product;
                }
                if (window.App) App.setProduct(product);
            });
        });

        // Refresh button
        this.elements.refreshBtn?.addEventListener('click', () => {
            if (window.App) App.refreshData();
        });
    },

    showLoading(text = 'Loading data...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    },

    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    },

    updateTimestamp() {
        if (this.elements.lastUpdated) {
            const now = new Date();
            this.elements.lastUpdated.textContent = `Updated: ${now.toLocaleString()}`;
        }
    },

    getSelectedProduct() {
        return this.elements.productSelect?.value || 'GI';
    },

    updateKpiCard(factor, current, changePercent) {
        const valueEl = document.getElementById(`${factor}-value`);
        const changeEl = document.getElementById(`${factor}-change`);

        if (valueEl && current !== null) {
            valueEl.textContent = current;
        }

        if (changeEl && changePercent !== null) {
            const change = parseFloat(changePercent);
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(2)}%`;
            changeEl.className = `kpi-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    },

    updateAllKpis(seriesData) {
        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (meta && data && data.length >= 2) {
                const current = data[data.length - 1].value;
                const previous = data[0].value;
                const changePercent = ((current - previous) / previous) * 100;
                this.updateKpiCard(meta.factor, current.toFixed(2), changePercent);
            }
        });
    }
};
