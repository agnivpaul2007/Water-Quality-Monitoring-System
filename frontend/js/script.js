// ========== Configuration ==========
    const PARAMS = {
      pH: {
        label: 'pH Level',
        unit: '',
        icon: '🧪',
        min: 0, max: 14,
        good: [6.5, 8.5],
        warn: [6.0, 9.0],
        base: 7.2,
        variance: 0.15,
        decimals: 2
      },
      temperature: {
        label: 'Temperature',
        unit: '°C',
        icon: '🌡️',
        min: 0, max: 40,
        good: [15, 28],
        warn: [10, 32],
        base: 22.5,
        variance: 0.8,
        decimals: 1
      },
      do: {
        label: 'TDS',
        unit: 'mg/L',
        icon: '💨',
        min: 0, max: 2000,
        good: [200, 800],
        warn: [100, 1200],
        base: 480,
        variance: 25,
        decimals: 0
      },
      turbidity: {
        label: 'Turbidity',
        unit: 'NTU',
        icon: '🌫️',
        min: 0, max: 50,
        good: [0, 5],
        warn: [0, 15],
        base: 2.8,
        variance: 0.9,
        decimals: 1
      },
    };

    const HISTORY_LEN = 30;
    const UPDATE_MS = 2500;
    const SENSOR_COLORS = {
      pH: '#0ea5e9',
      temperature: '#f59e0b',
      do: '#22c55e',
      turbidity: '#a78bfa',
      conductivity: '#f472b6'
    };

    // ========== State ==========
    let history = {};
    let current = {};
    let running = true;
    let sampleCount = 0;
    let startTime = Date.now();
    let alertLog = [];
    let trendChart = null;
    let gaugeCharts = {};
    let activeSensor = 'pH';   // currently plotted sensor

    Object.keys(PARAMS).forEach(k => {
      history[k] = [];
      current[k] = PARAMS[k].base;
    });

    // ========== Helpers ==========
    function clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    }

    function randomWalk(key) {
      const p = PARAMS[key];
      const noise = (Math.random() - 0.5) * 2 * p.variance;
      let next = current[key] + noise;
      // Soft mean reversion
      next += (p.base - next) * 0.08;
      return clamp(next, p.min, p.max);
    }

    function getStatus(key, value) {
      const p = PARAMS[key];
      if (value >= p.good[0] && value <= p.good[1]) return 'good';
      if (value >= p.warn[0] && value <= p.warn[1]) return 'warning';
      return 'critical';
    }

    function statusColor(status) {
      return status === 'good' ? 'var(--good)' :
             status === 'warning' ? 'var(--warning)' : 'var(--critical)';
    }

    function formatValue(key, v) {
      return v.toFixed(PARAMS[key].decimals);
    }

    function nowStr() {
      return new Date().toLocaleTimeString();
    }

    // ========== Rendering ==========
    function renderKPIs() {
      const grid = document.getElementById('kpiGrid');
      grid.innerHTML = Object.keys(PARAMS).map(key => {
        const p = PARAMS[key];
        const val = current[key];
        const status = getStatus(key, val);
        const prev = history[key].length > 1 ? history[key][history[key].length - 2] : val;
        const delta = val - prev;
        const trendArrow = delta > 0.01 ? '↑' : delta < -0.01 ? '↓' : '→';
        const trendText = Math.abs(delta) < 0.01 ? 'stable' : `${trendArrow} ${Math.abs(delta).toFixed(p.decimals)}`;

        return `
          <div class="kpi-card" style="--status-color: ${statusColor(status)}">
            <div class="kpi-header">
              <span class="kpi-label">${p.label}</span>
              <span class="kpi-icon">${p.icon}</span>
            </div>
            <div class="kpi-value">
              ${formatValue(key, val)}<span class="kpi-unit">${p.unit}</span>
            </div>
            <div class="kpi-status ${status}">
              ${status === 'good' ? '● Good' : status === 'warning' ? '▲ Warning' : '■ Critical'}
            </div>
            <div class="kpi-trend">${trendText} from last sample</div>
          </div>
        `;
      }).join('');
    }

    function updateTrendChart() {
      const labels = history[activeSensor].map((_, i) => {
        const offset = HISTORY_LEN - history[activeSensor].length + i;
        return offset === HISTORY_LEN - 1 ? 'Now' : `-${HISTORY_LEN - 1 - offset}`;
      });

      const color = SENSOR_COLORS[activeSensor] || '#0ea5e9';
      const p = PARAMS[activeSensor];

      if (!trendChart) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: p.label,
              data: history[activeSensor],
              borderColor: color,
              backgroundColor: color + '33',
              borderWidth: 2.5,
              tension: 0.35,
              pointRadius: 0,
              pointHoverRadius: 5,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: '#334155',
                borderWidth: 1,
                callbacks: {
                  label: (ctx) => `${p.label}: ${Number(ctx.raw).toFixed(p.decimals)} ${p.unit}`
                }
              }
            },
            scales: {
              x: {
                ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } },
                grid: { color: 'rgba(51, 65, 85, 0.4)' }
              },
              y: {
                ticks: { color: '#64748b', font: { size: 10 } },
                grid: { color: 'rgba(51, 65, 85, 0.4)' },
                title: {
                  display: true,
                  text: p.unit ? `${p.label} (${p.unit})` : p.label,
                  color: '#64748b',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      } else {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].label = p.label;
        trendChart.data.datasets[0].data = history[activeSensor];
        trendChart.data.datasets[0].borderColor = color;
        trendChart.data.datasets[0].backgroundColor = color + '33';
        trendChart.options.scales.y.title.text = p.unit ? `${p.label} (${p.unit})` : p.label;
        trendChart.options.plugins.tooltip.callbacks.label = (ctx) =>
          `${p.label}: ${Number(ctx.raw).toFixed(p.decimals)} ${p.unit}`;
        trendChart.update('none');
      }

      // Update chart title
      const titleEl = document.getElementById('chartTitle');
      if (titleEl) titleEl.textContent = `${p.label} Trend`;
    }

    function switchSensor(sensorKey) {
      if (!PARAMS[sensorKey] || sensorKey === activeSensor) return;
      activeSensor = sensorKey;

      // Update button states
      document.querySelectorAll('.sensor-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sensor === sensorKey);
      });

      updateTrendChart();
    }

    function renderGauges() {
      const section = document.getElementById('gaugeSection');
      const keys = ['pH', 'do', 'turbidity'];

      if (!section.children.length) {
        section.innerHTML = keys.map(key => `
          <div class="gauge-card">
            <h4>${PARAMS[key].label}</h4>
            <div class="gauge-ring"><canvas id="gauge-${key}"></canvas></div>
            <div class="gauge-value" id="gauge-val-${key}">—</div>
          </div>
        `).join('');

        keys.forEach(key => {
          const ctx = document.getElementById(`gauge-${key}`).getContext('2d');
          const p = PARAMS[key];
          gaugeCharts[key] = new Chart(ctx, {
            type: 'doughnut',
            data: {
              datasets: [{
                data: [0, 100],
                backgroundColor: ['#0ea5e9', '#1e293b'],
                borderWidth: 0,
                circumference: 270,
                rotation: 225
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              cutout: '75%',
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              animation: { duration: 400 }
            }
          });
        });
      }

      keys.forEach(key => {
        const p = PARAMS[key];
        const val = current[key];
        const pct = ((val - p.min) / (p.max - p.min)) * 100;
        const status = getStatus(key, val);
        const color = status === 'good' ? '#22c55e' : status === 'warning' ? '#f59e0b' : '#ef4444';

        gaugeCharts[key].data.datasets[0].data = [pct, 100 - pct];
        gaugeCharts[key].data.datasets[0].backgroundColor = [color, '#1e293b'];
        gaugeCharts[key].update('none');

        document.getElementById(`gauge-val-${key}`).textContent =
          `${formatValue(key, val)} ${p.unit}`;
      });
    }

    function addAlert(message, level = 'warning') {
      alertLog.unshift({
        message,
        level,
        time: nowStr()
      });
      if (alertLog.length > 12) alertLog.pop();

      const list = document.getElementById('alertsList');
      document.getElementById('alertCount').textContent = alertLog.length;

      list.innerHTML = alertLog.map(a => `
        <div class="alert-item" style="--alert-color: ${statusColor(a.level)}; border-left-color: ${statusColor(a.level)}">
          <div>
            <strong>${a.message}</strong>
            <div class="time">${a.time}</div>
          </div>
        </div>
      `).join('');
    }

    function updateMeta() {
      document.getElementById('lastUpdate').textContent =
        `Last update: ${nowStr()}`;
    }

    // ========== Simulation loop ==========
    function tick() {
      if (!running) return;

      Object.keys(PARAMS).forEach(key => {
        current[key] = randomWalk(key);
        history[key].push(current[key]);
        if (history[key].length > HISTORY_LEN) history[key].shift();
      });

      sampleCount++;

      // Occasional alert generation
      Object.keys(PARAMS).forEach(key => {
        const status = getStatus(key, current[key]);
        if (status === 'critical' && Math.random() < 0.35) {
          addAlert(`${PARAMS[key].label} critical: ${formatValue(key, current[key])} ${PARAMS[key].unit}`, 'critical');
        } else if (status === 'warning' && Math.random() < 0.12) {
          addAlert(`${PARAMS[key].label} outside optimal range`, 'warning');
        }
      });

      renderKPIs();
      updateTrendChart();
      renderGauges();
      updateMeta();
    }

    // ========== Controls ==========
    document.getElementById('btnPause').addEventListener('click', function () {
      running = !running;
      this.textContent = running ? 'Pause' : 'Resume';
      this.classList.toggle('active', !running);
      if (running) tick();
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      Object.keys(PARAMS).forEach(key => {
        current[key] = PARAMS[key].base;
        history[key] = [];
      });
      sampleCount = 0;
      startTime = Date.now();
      alertLog = [];
      addAlert('Simulation reset — all values nominal', 'good');
      tick();
    });

    // Sensor switcher buttons
    document.querySelectorAll('.sensor-btn').forEach(btn => {
      btn.addEventListener('click', () => switchSensor(btn.dataset.sensor));
    });

    // ========== Init ==========
    // Seed history
    for (let i = 0; i < 12; i++) {
      Object.keys(PARAMS).forEach(key => {
        current[key] = PARAMS[key].base;
        for (let i=0; i < 12; i++) {
          history[key].push(PARAMS[key].base);
        }
      });
    }

    renderKPIs();
    updateTrendChart();
    renderGauges();
    updateMeta();
    addAlert('Dashboard initialized — monitoring Station A-12', 'good');

    setInterval(tick, UPDATE_MS);