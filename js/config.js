/**
 * Configuration for the Lubricant Cost Dashboard
 */
const Config = {
    // API Endpoints
    FRED_BASE_URL: 'https://api.stlouisfed.org/fred/series/observations',
    FRANKFURTER_BASE_URL: 'https://api.frankfurter.app',

    // CORS Proxy (needed for GitHub Pages)
    CORS_PROXY: 'https://corsproxy.io/?',

    // Default FRED API Key
    DEFAULT_API_KEY: '0b72c304bd2b4a722908f145656c8ae6',

    // FRED Series IDs
    SERIES: {
        CRUDE_BRENT: 'DCOILBRENTEU',
        CRUDE_WTI: 'DCOILWTICO',
        BASE_OIL_PPI: 'PCU324191324191',
        CHEMICAL_PPI: 'PCU325325',
        TRANSPORT_CPI: 'CPIUTRNS',
        GASOLINE_RETAIL: 'GASREGW',
        MANUFACTURING_PPI: 'PCUOMFGOMFG',
        PACKAGING_PPI: 'PCU322322'
    },

    // Series metadata for display
    SERIES_META: {
        DCOILBRENTEU: {
            name: 'Crude Oil (Brent)',
            factor: 'crude',
            unit: '$/barrel',
            color: '#f39c12'
        },
        DCOILWTICO: {
            name: 'Crude Oil (WTI)',
            factor: 'wti',
            unit: '$/barrel',
            color: '#e67e22'
        },
        PCU324191324191: {
            name: 'Base Oil PPI',
            factor: 'baseOil',
            unit: 'Index',
            color: '#3498db'
        },
        PCU325325: {
            name: 'Chemical Additives PPI',
            factor: 'additives',
            unit: 'Index',
            color: '#e74c3c'
        },
        CPIUTRNS: {
            name: 'Transport Costs',
            factor: 'transport',
            unit: 'Index',
            color: '#1abc9c'
        },
        GASREGW: {
            name: 'Gasoline (Retail)',
            factor: 'gasoline',
            unit: '$/gallon',
            color: '#c0392b'
        },
        PCUOMFGOMFG: {
            name: 'Manufacturing PPI',
            factor: 'labor',
            unit: 'Index',
            color: '#9b59b6'
        },
        PCU322322: {
            name: 'Packaging PPI',
            factor: 'packaging',
            unit: 'Index',
            color: '#34495e'
        }
    },

    // Cache settings
    CACHE_PREFIX: 'lubricant_dashboard_',
    CACHE_DURATION: 4 * 60 * 60 * 1000, // 4 hours in milliseconds

    // Default date range
    DEFAULT_RANGE: '1Y',

    // Chart colors
    COLORS: {
        primary: '#3498db',
        secondary: '#e74c3c',
        success: '#2ecc71',
        warning: '#f39c12',
        info: '#1abc9c',
        purple: '#9b59b6',
        dark: '#34495e',
        orange: '#e67e22'
    },

    // Product colors
    PRODUCT_COLORS: {
        GI: '#3498db',
        MWF: '#e74c3c',
        HighPerf: '#2ecc71',
        Grease: '#9b59b6'
    },

    /**
     * Get date range based on preset
     * @param {string} range - Range preset (1M, 3M, 6M, 1Y, YTD)
     * @returns {Object} Start and end dates
     */
    getDateRange(range) {
        const end = new Date();
        let start = new Date();

        switch (range) {
            case '1M':
                start.setMonth(start.getMonth() - 1);
                break;
            case '3M':
                start.setMonth(start.getMonth() - 3);
                break;
            case '6M':
                start.setMonth(start.getMonth() - 6);
                break;
            case '1Y':
                start.setFullYear(start.getFullYear() - 1);
                break;
            case '2Y':
                start.setFullYear(start.getFullYear() - 2);
                break;
            case 'YTD':
                start = new Date(start.getFullYear(), 0, 1);
                break;
            default:
                start.setFullYear(start.getFullYear() - 1);
        }

        return {
            start: this.formatDate(start),
            end: this.formatDate(end)
        };
    },

    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    /**
     * Get stored API key (falls back to default)
     * @returns {string|null}
     */
    getApiKey() {
        return localStorage.getItem(this.CACHE_PREFIX + 'api_key') || this.DEFAULT_API_KEY;
    },

    /**
     * Store API key
     * @param {string} key
     */
    setApiKey(key) {
        localStorage.setItem(this.CACHE_PREFIX + 'api_key', key);
    },

    /**
     * Check if API key exists
     * @returns {boolean}
     */
    hasApiKey() {
        return !!(localStorage.getItem(this.CACHE_PREFIX + 'api_key') || this.DEFAULT_API_KEY);
    }
};

// Freeze config to prevent modifications
Object.freeze(Config.SERIES);
Object.freeze(Config.SERIES_META);
Object.freeze(Config.COLORS);
Object.freeze(Config.PRODUCT_COLORS);
