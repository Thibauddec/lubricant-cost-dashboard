/**
 * Main Application - Lubricant Cost Dynamics Dashboard
 */
const App = {
    state: {
        dateRange: '5Y',
        selectedProduct: 'GI',
        seriesData: {},
        costWeights: null,
        loadingStatus: {
            total: 0,
            completed: 0,
            current: null,
            failed: []
        }
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
        const seriesIds = Object.values(Config.SERIES);
        this.state.loadingStatus = {
            total: seriesIds.length,
            completed: 0,
            current: null,
            failed: []
        };

        UI.showLoading('Initializing...');

        try {
            const range = Config.getDateRange(this.state.dateRange);

            // Fetch FRED data with progress callback
            this.state.seriesData = await FredApi.fetchMultipleSeries(
                seriesIds,
                range.start,
                range.end,
                true,
                (completed, total, currentId, status) => {
                    this.state.loadingStatus.completed = completed;
                    this.state.loadingStatus.current = currentId;
                    const seriesName = Config.SERIES_META[currentId]?.name || currentId;
                    UI.updateLoadingProgress(completed, total, seriesName, status);
                }
            );

            // Track failed series
            this.state.loadingStatus.failed = FredApi.getFailedSeries();

            // Fetch news in parallel (non-blocking)
            this.loadNewsAsync();

            this.updateDashboard();
            UI.updateTimestamp();

            // Show warning if some series failed
            if (this.state.loadingStatus.failed.length > 0) {
                const failedNames = this.state.loadingStatus.failed
                    .map(id => Config.SERIES_META[id]?.name || id)
                    .join(', ');
                UI.showWarning(`Some data unavailable: ${failedNames}`);
            }

        } catch (error) {
            console.error('Error loading data:', error);
            UI.showError('Failed to load data. Please try refreshing the page.');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Load news asynchronously without blocking main data load
     */
    async loadNewsAsync() {
        try {
            const newsItems = await News.fetchNews();
            News.render(newsItems);
            Charts.sentimentMultiplier = News.getForecastAdjustment().multiplier;
        } catch (newsError) {
            console.warn('News fetch failed:', newsError);
            Charts.sentimentMultiplier = 1;
        }
    },

    updateDashboard() {
        UI.updateAllKpis(this.state.seriesData);
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
    },

    /**
     * Retry loading only failed series
     */
    async retryFailed() {
        const failedIds = FredApi.getFailedSeries();
        if (failedIds.length === 0) return;

        UI.showLoading('Retrying failed downloads...');

        try {
            const range = Config.getDateRange(this.state.dateRange);
            const retryResults = await FredApi.fetchMultipleSeries(
                failedIds,
                range.start,
                range.end,
                false, // Don't use cache for retries
                (completed, total, currentId, status) => {
                    const seriesName = Config.SERIES_META[currentId]?.name || currentId;
                    UI.updateLoadingProgress(completed, total, seriesName, status);
                }
            );

            // Merge retry results
            Object.assign(this.state.seriesData, retryResults);
            this.state.loadingStatus.failed = FredApi.getFailedSeries();

            this.updateDashboard();

            if (this.state.loadingStatus.failed.length > 0) {
                const failedNames = this.state.loadingStatus.failed
                    .map(id => Config.SERIES_META[id]?.name || id)
                    .join(', ');
                UI.showWarning(`Still unavailable: ${failedNames}`);
            } else {
                UI.showSuccess('All data loaded successfully!');
            }

        } catch (error) {
            console.error('Retry failed:', error);
            UI.showError('Retry failed. Please try again later.');
        } finally {
            UI.hideLoading();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
