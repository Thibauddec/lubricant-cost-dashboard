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
            retryBtn: document.getElementById('retryFailed'),
            lastUpdated: document.getElementById('lastUpdated'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            loadingProgress: document.getElementById('loadingProgress'),
            loadingBar: document.getElementById('loadingBar')
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

        // Retry failed button
        this.elements.retryBtn?.addEventListener('click', () => {
            if (window.App) App.retryFailed();
        });

        // Scenario sliders
        this.setupScenarioControls();
    },

    setupScenarioControls() {
        const sliders = ['Crude', 'Additives', 'Transport', 'Labor'];

        sliders.forEach(name => {
            const slider = document.getElementById(`scenario${name}`);
            const valueDisplay = document.getElementById(`scenario${name}Value`);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const val = parseInt(slider.value);
                    valueDisplay.textContent = `${val > 0 ? '+' : ''}${val.toFixed(0)}%`;
                    valueDisplay.style.color = val > 0 ? '#ef4444' : val < 0 ? '#22c55e' : '#94a3b8';
                    this.updateScenarioResults();
                });
            }
        });

        // Reset button
        const resetBtn = document.getElementById('resetScenario');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                sliders.forEach(name => {
                    const slider = document.getElementById(`scenario${name}`);
                    const valueDisplay = document.getElementById(`scenario${name}Value`);
                    if (slider) slider.value = 0;
                    if (valueDisplay) {
                        valueDisplay.textContent = '0%';
                        valueDisplay.style.color = '#94a3b8';
                    }
                });
                this.updateScenarioResults();
            });
        }
    },

    updateScenarioResults() {
        const changes = {
            crude: parseInt(document.getElementById('scenarioCrude')?.value || 0),
            additives: parseInt(document.getElementById('scenarioAdditives')?.value || 0),
            transport: parseInt(document.getElementById('scenarioTransport')?.value || 0),
            labor: parseInt(document.getElementById('scenarioLabor')?.value || 0)
        };

        if (window.App && App.state.costWeights) {
            const impacts = Forecast.calculateScenarioImpact(changes, App.state.costWeights);

            Object.entries(impacts).forEach(([productId, impact]) => {
                const el = document.getElementById(`scenario${productId}`);
                if (el) {
                    const val = parseFloat(impact);
                    el.textContent = `${val > 0 ? '+' : ''}${impact}%`;
                    el.className = `result-value ${val > 0 ? 'positive' : val < 0 ? 'negative' : ''}`;
                }
            });
        }
    },

    showLoading(text = 'Loading data...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
        // Reset progress bar
        if (this.elements.loadingBar) {
            this.elements.loadingBar.style.width = '0%';
        }
        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.textContent = '';
        }
    },

    /**
     * Update loading progress with visual feedback
     * @param {number} completed - Number of completed items
     * @param {number} total - Total items
     * @param {string} currentName - Name of current item being loaded
     * @param {string} status - Status: 'fetching', 'success', 'failed', 'cached'
     */
    updateLoadingProgress(completed, total, currentName, status) {
        const percent = Math.round((completed / total) * 100);

        if (this.elements.loadingBar) {
            this.elements.loadingBar.style.width = `${percent}%`;
        }

        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.textContent = `${completed}/${total}`;
        }

        if (this.elements.loadingText) {
            let statusIcon = '';
            switch (status) {
                case 'fetching': statusIcon = '...'; break;
                case 'success': statusIcon = ''; break;
                case 'cached': statusIcon = ' (cached)'; break;
                case 'failed': statusIcon = ' (failed)'; break;
            }
            this.elements.loadingText.textContent = `Loading ${currentName}${statusIcon}`;
        }
    },

    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    },

    /**
     * Show error notification
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    },

    /**
     * Show warning notification
     * @param {string} message - Warning message
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    },

    /**
     * Show success notification
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    /**
     * Generic notification display
     * @param {string} message - Message to display
     * @param {string} type - Type: 'error', 'warning', 'success'
     */
    showNotification(message, type = 'info') {
        const colors = {
            error: { bg: '#ef4444', text: 'white' },
            warning: { bg: '#f59e0b', text: 'white' },
            success: { bg: '#22c55e', text: 'white' },
            info: { bg: '#3b82f6', text: 'white' }
        };

        const color = colors[type] || colors.info;

        const notificationDiv = document.createElement('div');
        notificationDiv.className = `notification notification-${type}`;
        notificationDiv.innerHTML = `
            <span>${message}</span>
            ${type === 'warning' ? '<button class="retry-btn" onclick="App.retryFailed(); this.parentElement.remove();">Retry</button>' : ''}
            <button class="close-btn" onclick="this.parentElement.remove();">x</button>
        `;
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${color.bg};
            color: ${color.text};
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 90%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
        `;

        // Style buttons
        const buttons = notificationDiv.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
        });

        document.body.appendChild(notificationDiv);

        // Auto-dismiss after 10 seconds (except for warnings which need user action)
        if (type !== 'warning') {
            setTimeout(() => {
                if (notificationDiv.parentElement) {
                    notificationDiv.remove();
                }
            }, 10000);
        }
    },

    updateTimestamp() {
        if (this.elements.lastUpdated) {
            const now = new Date();
            this.elements.lastUpdated.textContent = `Updated: ${now.toLocaleString()}`;
        }

        // Show/hide retry button based on failed series
        if (this.elements.retryBtn) {
            const failedCount = FredApi.getFailedSeries().length;
            this.elements.retryBtn.style.display = failedCount > 0 ? 'inline-block' : 'none';
            if (failedCount > 0) {
                this.elements.retryBtn.textContent = `Retry Failed (${failedCount})`;
            }
        }
    },

    getSelectedProduct() {
        return this.elements.productSelect?.value || 'GI';
    },

    updateKpiCard(factor, current, changePercent) {
        const valueEl = document.getElementById(`${factor}-value`);
        const changeEl = document.getElementById(`${factor}-change`);
        const cardEl = document.getElementById(`${factor}-card`) || valueEl?.closest('.kpi-card');

        if (valueEl && current !== null) {
            valueEl.textContent = current;
            // Remove any error state
            if (cardEl) cardEl.classList.remove('kpi-error');
        } else if (valueEl) {
            valueEl.textContent = 'N/A';
            if (cardEl) cardEl.classList.add('kpi-error');
        }

        if (changeEl && changePercent !== null) {
            const change = parseFloat(changePercent);
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(2)}%`;
            changeEl.className = `kpi-change ${change >= 0 ? 'positive' : 'negative'}`;
        } else if (changeEl) {
            changeEl.textContent = '--';
            changeEl.className = 'kpi-change';
        }
    },

    updateAllKpis(seriesData) {
        // First, mark all KPI cards as potentially empty
        Object.values(Config.SERIES_META).forEach(meta => {
            const valueEl = document.getElementById(`${meta.factor}-value`);
            const changeEl = document.getElementById(`${meta.factor}-change`);
            if (valueEl) valueEl.textContent = 'Loading...';
            if (changeEl) changeEl.textContent = '--';
        });

        // Then update with actual data
        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (meta) {
                if (data && data.length >= 2) {
                    const current = data[data.length - 1].value;
                    const previous = data[0].value;
                    const changePercent = ((current - previous) / previous) * 100;
                    this.updateKpiCard(meta.factor, current.toFixed(2), changePercent);
                    this.createSparkline(meta.factor, data, meta.color);
                } else {
                    // Mark as unavailable
                    this.updateKpiCard(meta.factor, null, null);
                }
            }
        });
    },

    sparklineInstances: {},

    createSparkline(factor, data, color) {
        const canvas = document.getElementById(`${factor}-spark`);
        if (!canvas) return;

        // Destroy existing chart
        if (this.sparklineInstances[factor]) {
            this.sparklineInstances[factor].destroy();
        }

        if (!data || data.length < 2) {
            // Clear canvas for unavailable data
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Sample data to last 20 points for sparkline
        const sampled = data.slice(-20);
        const values = sampled.map(d => d.value);

        this.sparklineInstances[factor] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: sampled.map((_, i) => i),
                datasets: [{
                    data: values,
                    borderColor: color || '#3498db',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                animation: false
            }
        });
    }
};
