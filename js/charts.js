/**
 * Chart.js Visualization Manager
 * Creates and updates all dashboard charts
 */
const Charts = {
    instances: {},
    costWeights: null,
    sentimentMultiplier: 1, // Adjusted by news sentiment

    /**
     * Initialize charts module
     * @param {Object} costWeights - Cost weighting configuration
     */
    async init(costWeights) {
        this.costWeights = costWeights;

        // Set Chart.js defaults
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = '#475569';
        Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    },

    /**
     * Simple linear regression for prediction
     * @param {Array} data - Array of {x: timestamp, y: value}
     * @returns {Object} {slope, intercept}
     */
    linearRegression(data) {
        const n = data.length;
        if (n < 2) return { slope: 0, intercept: data[0]?.y || 0 };

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        data.forEach((point, i) => {
            sumX += i;
            sumY += parseFloat(point.y);
            sumXY += i * parseFloat(point.y);
            sumX2 += i * i;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    },

    /**
     * Generate forecast data points
     * @param {Array} historicalData - Historical data points
     * @param {number} periods - Number of future periods
     * @returns {Array} Forecast data points
     */
    generateForecast(historicalData, periods = 3) {
        if (!historicalData || historicalData.length < 2) return [];

        const { slope, intercept } = this.linearRegression(historicalData);
        const lastIndex = historicalData.length - 1;
        const lastDate = new Date(historicalData[lastIndex].x);
        const forecast = [];

        // Add last actual point as start of forecast
        forecast.push({
            x: historicalData[lastIndex].x,
            y: historicalData[lastIndex].y
        });

        // Generate future points (monthly) with sentiment adjustment
        for (let i = 1; i <= periods; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            let predictedY = intercept + slope * (lastIndex + i);
            // Apply sentiment multiplier (compounds over time)
            predictedY *= Math.pow(this.sentimentMultiplier, i * 0.5);
            forecast.push({
                x: futureDate.toISOString().split('T')[0],
                y: Math.max(0, predictedY).toFixed(2)
            });
        }

        return forecast;
    },

    /**
     * Create product groups trend chart (main chart)
     * Shows weighted cost index for each product over time
     * @param {Object} seriesData - Raw series data
     * @returns {Chart}
     */
    createProductTrendChart(seriesData) {
        const ctx = document.getElementById('trendChart');
        if (!ctx || !this.costWeights) return null;

        if (this.instances.trend) {
            this.instances.trend.destroy();
        }

        const products = this.costWeights.products;
        const factors = this.costWeights.factors;
        const datasets = [];

        // Get all unique dates from the data
        let allDates = new Set();
        Object.values(seriesData).forEach(data => {
            if (data && data.length > 0) {
                data.forEach(d => allDates.add(d.date));
            }
        });
        allDates = Array.from(allDates).sort();

        // For each product, calculate weighted index over time
        Object.entries(products).forEach(([productId, product]) => {
            const dataPoints = [];

            allDates.forEach(date => {
                let weightedSum = 0;
                let totalWeight = 0;

                Object.entries(product.weights).forEach(([factor, weight]) => {
                    const factorConfig = factors[factor];
                    if (factorConfig && seriesData[factorConfig.seriesId]) {
                        const seriesValues = seriesData[factorConfig.seriesId];
                        const point = seriesValues.find(d => d.date === date);
                        if (point) {
                            // Normalize to first value in series
                            const firstVal = seriesValues[0]?.value || point.value;
                            const normalized = (point.value / firstVal) * 100;
                            weightedSum += normalized * weight;
                            totalWeight += weight;
                        }
                    }
                });

                if (totalWeight > 0) {
                    dataPoints.push({
                        x: date,
                        y: (weightedSum / totalWeight).toFixed(2)
                    });
                }
            });

            if (dataPoints.length > 0) {
                // Historical data (solid line) - thinner for cleaner look
                datasets.push({
                    label: product.name,
                    data: dataPoints,
                    borderColor: product.color,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    fill: false
                });

                // Simple forecast (dotted line only, no confidence bands)
                const forecastResult = Forecast.arimaForecast(
                    dataPoints.map(d => ({ date: d.x, value: parseFloat(d.y) })),
                    3, // Reduced to 3 months
                    this.sentimentMultiplier
                );

                if (forecastResult.forecast.length > 1) {
                    datasets.push({
                        label: product.name + ' (Forecast)',
                        data: forecastResult.forecast,
                        borderColor: product.color + '80', // Semi-transparent
                        borderWidth: 1.5,
                        borderDash: [4, 3],
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    });
                }
            }
        });

        // Update legend (compact, only main products)
        const legend = document.getElementById('trendLegend');
        if (legend) {
            legend.innerHTML = '';
            datasets.filter(ds => !ds.label.includes('Forecast')).forEach(ds => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `<span class="legend-color" style="background-color: ${ds.borderColor}"></span><span>${ds.label}</span>`;
                legend.appendChild(item);
            });
        }

        this.instances.trend = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            title: (items) => items.length > 0 ? new Date(items[0].parsed.x).toLocaleDateString() : '',
                            label: (context) => `${context.dataset.label}: ${parseFloat(context.parsed.y).toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
                        grid: { display: false },
                        ticks: { maxTicksLimit: 12 }
                    },
                    y: {
                        title: { display: true, text: 'Cost Index (Base = 100)' },
                        grid: { color: '#334155' },
                        ticks: {
                            callback: (value) => parseFloat(value).toFixed(1)
                        }
                    }
                }
            }
        });

        return this.instances.trend;
    },

    /**
     * Create cost breakdown donut chart
     * @param {string} productId - Product identifier
     * @returns {Chart}
     */
    createBreakdownChart(productId) {
        const ctx = document.getElementById('breakdownChart');
        if (!ctx || !this.costWeights) return null;

        if (this.instances.breakdown) {
            this.instances.breakdown.destroy();
        }

        const product = this.costWeights.products[productId];
        if (!product) return null;

        const subtitle = document.getElementById('breakdownProduct');
        if (subtitle) subtitle.textContent = product.name;

        const labels = [];
        const data = [];
        const colors = [];

        Object.entries(product.weights).forEach(([factor, weight]) => {
            const factorConfig = this.costWeights.factors[factor];
            if (factorConfig) {
                labels.push(factorConfig.name);
                data.push((weight * 100).toFixed(1));
                colors.push(factorConfig.color);
            }
        });

        this.instances.breakdown = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: '#1e293b',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, usePointStyle: true, pointStyle: 'circle' }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` }
                    }
                }
            }
        });

        return this.instances.breakdown;
    },

    /**
     * Create raw cost factors trend chart
     * @param {Object} seriesData - Series data
     * @returns {Chart}
     */
    createFactorsTrendChart(seriesData) {
        const ctx = document.getElementById('factorsChart');
        if (!ctx) return null;

        if (this.instances.factors) {
            this.instances.factors.destroy();
        }

        const datasets = [];

        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (!meta || !data || data.length === 0) return;

            // Normalize to index
            const firstVal = data[0].value;
            const normalized = data.map(d => ({
                x: d.date,
                y: ((d.value / firstVal) * 100).toFixed(2)
            }));

            datasets.push({
                label: meta.name,
                data: normalized,
                borderColor: meta.color,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false
            });
        });

        this.instances.factors = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, pointStyle: 'line', padding: 15 }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        callbacks: {
                            title: (items) => items.length > 0 ? new Date(items[0].parsed.x).toLocaleDateString() : '',
                            label: (context) => `${context.dataset.label}: ${parseFloat(context.parsed.y).toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'month' },
                        grid: { display: false }
                    },
                    y: {
                        title: { display: true, text: 'Index (Base = 100)' },
                        grid: { color: '#334155' },
                        ticks: {
                            callback: (value) => parseFloat(value).toFixed(1)
                        }
                    }
                }
            }
        });

        return this.instances.factors;
    },

    /**
     * Create YoY comparison bar chart
     * @param {Object} seriesData - Series data
     * @returns {Chart}
     */
    createYoYChart(seriesData) {
        const ctx = document.getElementById('yoyChart');
        if (!ctx || !this.costWeights) return null;

        if (this.instances.yoy) {
            this.instances.yoy.destroy();
        }

        const products = this.costWeights.products;
        const factors = this.costWeights.factors;
        const labels = [];
        const data = [];
        const colors = [];

        // Calculate YoY for each product
        Object.entries(products).forEach(([productId, product]) => {
            let currentWeighted = 0;
            let yearAgoWeighted = 0;
            let totalWeight = 0;

            Object.entries(product.weights).forEach(([factor, weight]) => {
                const factorConfig = factors[factor];
                if (factorConfig && seriesData[factorConfig.seriesId]) {
                    const seriesValues = seriesData[factorConfig.seriesId];
                    if (seriesValues.length > 0) {
                        const current = seriesValues[seriesValues.length - 1].value;
                        const yearAgo = seriesValues[0].value;
                        currentWeighted += current * weight;
                        yearAgoWeighted += yearAgo * weight;
                        totalWeight += weight;
                    }
                }
            });

            if (totalWeight > 0 && yearAgoWeighted > 0) {
                const yoyChange = ((currentWeighted - yearAgoWeighted) / yearAgoWeighted) * 100;
                labels.push(product.name);
                data.push(parseFloat(yoyChange.toFixed(2)));
                colors.push(yoyChange >= 0 ? '#22c55e' : '#ef4444');
            }
        });

        this.instances.yoy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'YoY Change (%)',
                    data,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = parseFloat(ctx.parsed.y).toFixed(2);
                                return `${parseFloat(val) >= 0 ? '+' : ''}${val}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: '#334155' },
                        ticks: { callback: (v) => `${parseFloat(v).toFixed(2)}%` }
                    }
                }
            }
        });

        return this.instances.yoy;
    },

    /**
     * Update all charts
     * @param {Object} seriesData - All series data
     * @param {string} productId - Selected product ID
     */
    updateAll(seriesData, productId) {
        this.createProductTrendChart(seriesData);
        this.createBreakdownChart(productId);
        this.createFactorsTrendChart(seriesData);
        this.createYoYChart(seriesData);
    },

    /**
     * Destroy all chart instances
     */
    destroyAll() {
        Object.values(this.instances).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.instances = {};
    }
};
