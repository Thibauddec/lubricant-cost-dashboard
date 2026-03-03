/**
 * Main Application - Lubricant Cost Dynamics Dashboard
 */
const App = {
    state: {
        dateRange: '1Y',
        selectedProduct: 'GI',
        seriesData: {},
        costWeights: null
    },

    async init() {
        UI.init();
        await this.loadCostWeights();
        await Charts.init(this.state.costWeights);
        await this.loadData();
    },

    async loadCostWeights() {
        try {
            const response = await fetch('data/costWeights.json');
            this.state.costWeights = await response.json();
            Charts.costWeights = this.state.costWeights;
        } catch (error) {
            console.error('Failed to load cost weights:', error);
        }
    },

    async loadData() {
        UI.showLoading('Fetching market data...');

        try {
            const range = Config.getDateRange(this.state.dateRange);

            // Fetch all FRED series
            const seriesIds = Object.values(Config.SERIES);
            this.state.seriesData = await FredApi.fetchMultipleSeries(
                seriesIds,
                range.start,
                range.end
            );

            this.updateDashboard();
            UI.updateTimestamp();

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            UI.hideLoading();
        }
    },

    updateDashboard() {
        Charts.updateAll(this.state.seriesData, this.state.selectedProduct);
    },

    async setDateRange(range) {
        this.state.dateRange = range;
        await this.loadData();
    },

    setProduct(productId) {
        this.state.selectedProduct = productId;
        Charts.createBreakdownChart(productId);
    },

    async refreshData() {
        FredApi.clearCache();
        await this.loadData();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
