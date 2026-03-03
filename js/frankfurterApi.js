/**
 * Frankfurter API Wrapper
 * Handles EUR/USD exchange rate data from the European Central Bank
 */
const FrankfurterApi = {
    /**
     * Fetch exchange rate time series
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} from - Base currency (default: EUR)
     * @param {string} to - Target currency (default: USD)
     * @param {boolean} useCache - Whether to use cached data
     * @returns {Promise<Array>} Array of {date, value} objects
     */
    async fetchTimeSeries(startDate, endDate, from = 'EUR', to = 'USD', useCache = true) {
        const cacheKey = `${Config.CACHE_PREFIX}fx_${from}${to}_${startDate}_${endDate}`;

        // Check cache first
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const url = `${Config.FRANKFURTER_BASE_URL}/${startDate}..${endDate}?from=${from}&to=${to}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Frankfurter API error: ${response.status}`);
            }

            const data = await response.json();

            // Transform data to match our format
            const rates = data.rates || {};
            const processed = Object.entries(rates).map(([date, values]) => ({
                date,
                value: values[to]
            })).sort((a, b) => new Date(a.date) - new Date(b.date));

            // Cache the results
            this.saveToCache(cacheKey, processed);

            return processed;
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            throw error;
        }
    },

    /**
     * Fetch latest exchange rate
     * @param {string} from - Base currency
     * @param {string} to - Target currency
     * @returns {Promise<Object>} {rate, date}
     */
    async fetchLatest(from = 'EUR', to = 'USD') {
        try {
            const url = `${Config.FRANKFURTER_BASE_URL}/latest?from=${from}&to=${to}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Frankfurter API error: ${response.status}`);
            }

            const data = await response.json();

            return {
                rate: data.rates[to],
                date: data.date
            };
        } catch (error) {
            console.error('Error fetching latest rate:', error);
            throw error;
        }
    },

    /**
     * Get the latest value and change from time series
     * @param {Array} data - Time series data
     * @returns {Object} {current, previous, change, changePercent}
     */
    getLatestWithChange(data) {
        if (!data || data.length < 2) {
            return { current: null, previous: null, change: null, changePercent: null };
        }

        const current = data[data.length - 1].value;
        const previous = data[data.length - 2].value;
        const change = current - previous;
        const changePercent = ((change / previous) * 100).toFixed(2);

        return {
            current: current.toFixed(4),
            previous: previous.toFixed(4),
            change: change.toFixed(4),
            changePercent
        };
    },

    /**
     * Get from localStorage cache
     * @param {string} key
     * @returns {Array|null}
     */
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();

            if (now - timestamp > Config.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }

            return data;
        } catch (e) {
            return null;
        }
    },

    /**
     * Save to localStorage cache
     * @param {string} key
     * @param {Array} data
     */
    saveToCache(key, data) {
        try {
            const cacheItem = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheItem));
        } catch (e) {
            console.warn('Failed to cache FX data:', e);
        }
    }
};
