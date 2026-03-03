/**
 * Main Application
 * Lubricant Cost Dynamics Dashboard
 */
const App = {
    // Current state
    state: {
        dateRange: '1Y',
        startDate: null,
        endDate: null,
        selectedProduct: 'GI',
        seriesData: {},
        fxData: [],
        costWeights: null
    },

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Lubricant Cost Dashboard...');

        // Initialize UI
        UI.init();

        // Load cost weights configuration
        await this.loadCostWeights();

        // Initialize charts
        await Charts.init(this.state.costWeights);

        // Check for API key
        if (!Config.hasApiKey()) {
            UI.showModal();
            UI.hideLoading();
            return;
        }

        // Load data
        await this.loadData();
    },

    /**
     * Load cost weights configuration
     */
    async loadCostWeights() {
        try {
            const response = await fetch('data/costWeights.json');
            this.state.costWeights = await response.json();
            Charts.costWeights = this.state.costWeights;
        } catch (error) {
            console.error('Failed to load cost weights:', error);
            UI.showToast('Failed to load configuration', 'error');
        }
    },

    /**
     * Load all data from APIs
     */
    async loadData() {
        UI.showLoading();

        try {
            // Get date range
            const range = Config.getDateRange(this.state.dateRange);
            this.state.startDate = range.start;
            this.state.endDate = range.end;

            // Update date inputs
            UI.setDateInputs(range.start, range.end);

            // Fetch all FRED series
            const seriesIds = Object.values(Config.SERIES);
            this.state.seriesData = await FredApi.fetchMultipleSeries(
                seriesIds,
                range.start,
                range.end
            );

            // Fetch exchange rate data
            try {
                this.state.fxData = await FrankfurterApi.fetchTimeSeries(
                    range.start,
                    range.end
                );
            } catch (fxError) {
                console.warn('Failed to fetch FX data:', fxError);
                this.state.fxData = [];
            }

            // Update UI
            this.updateDashboard();
            UI.updateTimestamp();

        } catch (error) {
            console.error('Error loading data:', error);
            UI.showToast('Failed to load data. Please check your API key.', 'error');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Update all dashboard components
     */
    updateDashboard() {
        // Update KPI cards
        UI.updateAllKpis(this.state.seriesData, this.state.fxData);

        // Update all charts
        Charts.updateAll(this.state.seriesData, this.state.selectedProduct);
    },

    /**
     * Set date range and reload data
     * @param {string} range - Range preset (1M, 3M, 6M, 1Y, YTD)
     */
    async setDateRange(range) {
        this.state.dateRange = range;
        await this.loadData();
    },

    /**
     * Set custom date range
     * @param {string} start - Start date
     * @param {string} end - End date
     */
    async setCustomDateRange(start, end) {
        this.state.dateRange = 'custom';
        this.state.startDate = start;
        this.state.endDate = end;

        UI.showLoading();

        try {
            // Fetch data with custom range
            const seriesIds = Object.values(Config.SERIES);
            this.state.seriesData = await FredApi.fetchMultipleSeries(
                seriesIds,
                start,
                end
            );

            try {
                this.state.fxData = await FrankfurterApi.fetchTimeSeries(start, end);
            } catch (fxError) {
                console.warn('Failed to fetch FX data:', fxError);
            }

            this.updateDashboard();
            UI.updateTimestamp();

        } catch (error) {
            console.error('Error loading custom range data:', error);
            UI.showToast('Failed to load data for custom range', 'error');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Set selected product
     * @param {string} productId - Product identifier
     */
    setProduct(productId) {
        this.state.selectedProduct = productId;
        Charts.createBreakdownChart(productId, this.state.seriesData);
    },

    /**
     * Refresh all data (bypass cache)
     */
    async refreshData() {
        FredApi.clearCache();
        await this.loadData();
        UI.showToast('Data refreshed successfully', 'success');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App globally available for debugging
window.App = App;
