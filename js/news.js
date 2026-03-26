/**
 * News & Sentiment Analysis Module
 * Fetches news and adjusts forecasts based on sentiment
 * Optimized with parallel fetching and timeout support
 */
const News = {
    // Keywords that indicate price increases
    bullishKeywords: [
        'opec cut', 'production cut', 'supply shortage', 'sanctions', 'war',
        'conflict', 'refinery shutdown', 'hurricane', 'embargo', 'tariff',
        'demand surge', 'shortage', 'disruption', 'geopolitical tension',
        'price hike', 'inflation rise', 'supply chain crisis'
    ],

    // Keywords that indicate price decreases
    bearishKeywords: [
        'opec increase', 'production increase', 'oversupply', 'demand drop',
        'recession', 'economic slowdown', 'trade deal', 'sanctions lifted',
        'peace', 'ceasefire', 'surplus', 'glut', 'price drop', 'deflation',
        'weak demand', 'inventory build'
    ],

    currentSentiment: 0, // -1 to 1 scale

    // Request timeout
    REQUEST_TIMEOUT: 10000,

    // CORS proxies for fallback
    CORS_PROXIES: [
        { url: 'https://corsproxy.io/?', encode: true },
        { url: 'https://api.allorigins.win/raw?url=', encode: true }
    ],

    /**
     * Fetch with timeout
     * @param {string} url - URL to fetch
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Response>}
     */
    async fetchWithTimeout(url, timeout = this.REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    },

    /**
     * Try fetching a feed with proxy fallback
     * @param {string} feedUrl - RSS feed URL
     * @returns {Promise<string|null>}
     */
    async fetchFeedWithFallback(feedUrl) {
        for (const proxy of this.CORS_PROXIES) {
            try {
                const proxyUrl = proxy.encode
                    ? `${proxy.url}${encodeURIComponent(feedUrl)}`
                    : `${proxy.url}${feedUrl}`;

                const response = await this.fetchWithTimeout(proxyUrl);
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    },

    /**
     * Parse RSS feed XML to news items
     * @param {string} text - RSS XML text
     * @param {string} feedName - Feed source name
     * @returns {Array} News items
     */
    parseFeed(text, feedName) {
        const items = [];
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const xmlItems = xml.querySelectorAll('item');

            xmlItems.forEach((item, index) => {
                if (index < 5) { // Limit to 5 items per feed
                    const title = item.querySelector('title')?.textContent || '';
                    const pubDate = item.querySelector('pubDate')?.textContent || '';
                    const link = item.querySelector('link')?.textContent || '';

                    items.push({
                        title,
                        date: new Date(pubDate),
                        link,
                        source: feedName,
                        sentiment: this.analyzeSentiment(title)
                    });
                }
            });
        } catch (error) {
            console.warn('Failed to parse feed:', feedName, error);
        }
        return items;
    },

    /**
     * Fetch news from free RSS feeds via proxies - parallelized
     */
    async fetchNews() {
        const feeds = [
            { name: 'Oil & Energy', url: 'https://news.google.com/rss/search?q=oil+price+energy&hl=en-US&gl=US&ceid=US:en' },
            { name: 'Commodities', url: 'https://news.google.com/rss/search?q=crude+oil+commodities&hl=en-US&gl=US&ceid=US:en' }
        ];

        // Fetch all feeds in parallel
        const feedPromises = feeds.map(async (feed) => {
            try {
                const text = await this.fetchFeedWithFallback(feed.url);
                if (text) {
                    return this.parseFeed(text, feed.name);
                }
            } catch (error) {
                console.warn('Failed to fetch news from', feed.name, error);
            }
            return [];
        });

        // Wait for all feeds with a timeout
        const results = await Promise.allSettled(feedPromises);
        const newsItems = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);

        // Sort by date, newest first
        newsItems.sort((a, b) => b.date - a.date);

        // Calculate overall sentiment
        this.calculateOverallSentiment(newsItems);

        return newsItems.slice(0, 8); // Return top 8 items
    },

    /**
     * Analyze sentiment of a headline
     * @param {string} text - Headline text
     * @returns {string} 'positive', 'negative', or 'neutral'
     */
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();

        let bullishScore = 0;
        let bearishScore = 0;

        this.bullishKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) bullishScore++;
        });

        this.bearishKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) bearishScore++;
        });

        if (bullishScore > bearishScore) return 'positive';
        if (bearishScore > bullishScore) return 'negative';
        return 'neutral';
    },

    /**
     * Calculate overall market sentiment
     * @param {Array} newsItems - News items with sentiment
     */
    calculateOverallSentiment(newsItems) {
        let score = 0;
        newsItems.forEach(item => {
            if (item.sentiment === 'positive') score += 1;
            if (item.sentiment === 'negative') score -= 1;
        });

        // Normalize to -1 to 1
        this.currentSentiment = newsItems.length > 0 ? score / newsItems.length : 0;
    },

    /**
     * Get forecast adjustment based on sentiment
     * @returns {Object} {multiplier, description}
     */
    getForecastAdjustment() {
        const sentiment = this.currentSentiment;

        if (sentiment > 0.3) {
            return {
                multiplier: 1.05 + (sentiment * 0.1), // Up to 15% increase
                description: 'Bullish news sentiment - prices may rise faster than trend'
            };
        } else if (sentiment < -0.3) {
            return {
                multiplier: 0.95 + (sentiment * 0.1), // Up to 15% decrease
                description: 'Bearish news sentiment - prices may fall or rise slower'
            };
        } else {
            return {
                multiplier: 1,
                description: 'Neutral sentiment - forecast based on historical trend'
            };
        }
    },

    /**
     * Get sentiment label
     * @returns {string} 'Bullish', 'Bearish', or 'Neutral'
     */
    getSentimentLabel() {
        if (this.currentSentiment > 0.2) return 'Bullish';
        if (this.currentSentiment < -0.2) return 'Bearish';
        return 'Neutral';
    },

    /**
     * Render news items to the DOM
     * @param {Array} newsItems - News items to display
     */
    render(newsItems) {
        const container = document.getElementById('newsContent');
        const badge = document.getElementById('sentimentBadge');
        const adjustment = document.getElementById('forecastAdjustment');

        if (!container) return;

        if (newsItems.length === 0) {
            container.innerHTML = '<p class="news-loading">No recent news available</p>';
            return;
        }

        const html = newsItems.map(item => `
            <div class="news-item">
                <div class="news-sentiment ${item.sentiment}"></div>
                <div class="news-text">
                    <div class="news-title">${item.title}</div>
                    <div class="news-meta">${item.source} - ${this.formatDate(item.date)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Update sentiment badge
        if (badge) {
            const label = this.getSentimentLabel();
            badge.textContent = label;
            badge.className = 'sentiment-badge ' + label.toLowerCase();
        }

        // Update forecast adjustment text
        if (adjustment) {
            const adj = this.getForecastAdjustment();
            adjustment.textContent = adj.description;
        }
    },

    /**
     * Format date for display
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
};
