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

        // Product filter
        this.elements.productSelect?.addEventListener('change', (e) => {
            if (window.App) App.setProduct(e.target.value);
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
    }
};
