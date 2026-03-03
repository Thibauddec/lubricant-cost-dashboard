/**
 * Advanced Forecasting Module
 * Implements ARIMA-style forecasting with seasonal adjustments
 */
const Forecast = {
    /**
     * Detect seasonality in data (monthly patterns)
     * @param {Array} data - Time series data [{date, value}]
     * @returns {Object} Seasonal indices by month
     */
    detectSeasonality(data) {
        if (!data || data.length < 24) return null; // Need at least 2 years

        const monthlyAvg = {};
        const monthCounts = {};

        // Calculate average value for each month
        data.forEach(point => {
            const month = new Date(point.date).getMonth();
            if (!monthlyAvg[month]) {
                monthlyAvg[month] = 0;
                monthCounts[month] = 0;
            }
            monthlyAvg[month] += point.value;
            monthCounts[month]++;
        });

        // Calculate overall average
        let overallAvg = 0;
        let totalCount = 0;
        Object.keys(monthlyAvg).forEach(month => {
            monthlyAvg[month] /= monthCounts[month];
            overallAvg += monthlyAvg[month];
            totalCount++;
        });
        overallAvg /= totalCount;

        // Calculate seasonal indices (ratio to overall average)
        const seasonalIndices = {};
        Object.keys(monthlyAvg).forEach(month => {
            seasonalIndices[month] = monthlyAvg[month] / overallAvg;
        });

        return seasonalIndices;
    },

    /**
     * Deseasonalize data
     * @param {Array} data - Time series data
     * @param {Object} seasonalIndices - Seasonal indices by month
     * @returns {Array} Deseasonalized data
     */
    deseasonalize(data, seasonalIndices) {
        if (!seasonalIndices) return data;

        return data.map(point => {
            const month = new Date(point.date).getMonth();
            const index = seasonalIndices[month] || 1;
            return {
                date: point.date,
                value: point.value / index,
                originalValue: point.value
            };
        });
    },

    /**
     * Reseasonalize forecast
     * @param {Array} forecast - Forecast data points
     * @param {Object} seasonalIndices - Seasonal indices
     * @returns {Array} Seasonalized forecast
     */
    reseasonalize(forecast, seasonalIndices) {
        if (!seasonalIndices) return forecast;

        return forecast.map(point => {
            const month = new Date(point.x).getMonth();
            const index = seasonalIndices[month] || 1;
            return {
                x: point.x,
                y: (parseFloat(point.y) * index).toFixed(2)
            };
        });
    },

    /**
     * Calculate autocorrelation for AR model
     * @param {Array} values - Numeric values
     * @param {number} lag - Lag period
     * @returns {number} Autocorrelation coefficient
     */
    autocorrelation(values, lag) {
        const n = values.length;
        if (lag >= n) return 0;

        const mean = values.reduce((a, b) => a + b, 0) / n;
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n - lag; i++) {
            numerator += (values[i] - mean) * (values[i + lag] - mean);
        }

        for (let i = 0; i < n; i++) {
            denominator += Math.pow(values[i] - mean, 2);
        }

        return denominator === 0 ? 0 : numerator / denominator;
    },

    /**
     * ARIMA-style forecast using autoregression
     * @param {Array} data - Historical data [{date, value}]
     * @param {number} periods - Forecast periods
     * @param {number} sentimentMultiplier - News sentiment adjustment
     * @returns {Object} {forecast, confidence, seasonalIndices}
     */
    arimaForecast(data, periods = 6, sentimentMultiplier = 1) {
        if (!data || data.length < 12) {
            return { forecast: [], confidence: [], seasonalIndices: null };
        }

        // Detect and remove seasonality
        const seasonalIndices = this.detectSeasonality(data);
        const deseasonalized = this.deseasonalize(data, seasonalIndices);
        const values = deseasonalized.map(d => d.value);

        // Calculate AR coefficients (using lag 1, 2, 3)
        const ar1 = this.autocorrelation(values, 1);
        const ar2 = this.autocorrelation(values, 2);
        const ar3 = this.autocorrelation(values, 3);

        // Calculate trend using linear regression on deseasonalized data
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        values.forEach((y, i) => {
            sumX += i;
            sumY += y;
            sumXY += i * y;
            sumX2 += i * i;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate standard deviation for confidence intervals
        let sumSquaredErrors = 0;
        values.forEach((y, i) => {
            const predicted = intercept + slope * i;
            sumSquaredErrors += Math.pow(y - predicted, 2);
        });
        const stdDev = Math.sqrt(sumSquaredErrors / (n - 2));

        // Generate forecast
        const lastDate = new Date(data[data.length - 1].date);
        const forecast = [];
        const confidenceUpper = [];
        const confidenceLower = [];

        // Add last actual point
        forecast.push({
            x: data[data.length - 1].date,
            y: data[data.length - 1].value.toFixed(2)
        });

        for (let i = 1; i <= periods; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            const dateStr = futureDate.toISOString().split('T')[0];

            // AR component (weighted recent values)
            const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
            const arComponent = ar1 * values[n - 1] + ar2 * (values[n - 2] || recentAvg) + ar3 * (values[n - 3] || recentAvg);
            const arWeight = Math.abs(ar1) + Math.abs(ar2) + Math.abs(ar3);

            // Trend component
            const trendComponent = intercept + slope * (n + i);

            // Combined forecast (weighted average of AR and trend)
            let predicted;
            if (arWeight > 0.3) {
                predicted = 0.6 * trendComponent + 0.4 * (arComponent / arWeight) * values[n - 1];
            } else {
                predicted = trendComponent;
            }

            // Apply sentiment multiplier
            predicted *= Math.pow(sentimentMultiplier, i * 0.3);

            // Confidence intervals widen over time
            const confidenceWidth = stdDev * 1.96 * Math.sqrt(i);

            forecast.push({ x: dateStr, y: Math.max(0, predicted).toFixed(2) });
            confidenceUpper.push({ x: dateStr, y: Math.max(0, predicted + confidenceWidth).toFixed(2) });
            confidenceLower.push({ x: dateStr, y: Math.max(0, predicted - confidenceWidth).toFixed(2) });
        }

        // Reseasonalize the forecast
        const seasonalizedForecast = this.reseasonalize(forecast, seasonalIndices);
        const seasonalizedUpper = this.reseasonalize(confidenceUpper, seasonalIndices);
        const seasonalizedLower = this.reseasonalize(confidenceLower, seasonalIndices);

        return {
            forecast: seasonalizedForecast,
            confidenceUpper: seasonalizedUpper,
            confidenceLower: seasonalizedLower,
            seasonalIndices,
            trend: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'flat',
            volatility: stdDev / (sumY / n) // Coefficient of variation
        };
    },

    /**
     * Generate scenario impact calculation
     * @param {Object} changes - {crude: %, additives: %, transport: %, labor: %}
     * @param {Object} costWeights - Product cost weightings
     * @returns {Object} Impact by product
     */
    calculateScenarioImpact(changes, costWeights) {
        const impacts = {};

        Object.entries(costWeights.products).forEach(([productId, product]) => {
            let totalImpact = 0;

            // Map scenario inputs to cost factors
            const factorMapping = {
                crude: ['crude', 'baseOil'], // Crude affects both crude and baseOil
                additives: ['additives'],
                transport: ['transport'],
                labor: ['labor']
            };

            Object.entries(changes).forEach(([changeType, changePercent]) => {
                const factors = factorMapping[changeType] || [];
                factors.forEach(factor => {
                    const weight = product.weights[factor] || 0;
                    totalImpact += (changePercent / 100) * weight;
                });
            });

            impacts[productId] = (totalImpact * 100).toFixed(2);
        });

        return impacts;
    }
};
