const PARAMS = {
      pH:          { label:'pH Level',     unit:'',      icon:'🧪', min:0, max:14,   good:[6.5,8.5], warn:[6.0,9.0],   base:7.2,  decimals:2 },
      temperature: { label:'Temperature',  unit:'°C',    icon:'🌡️', min:0, max:40,   good:[15,28],   warn:[10,32],    base:22.5, decimals:1 },
      tds:         { label:'TDS',          unit:'ppm',   icon:'⚡', min:0, max:2000, good:[200,800], warn:[100,1200], base:480,  decimals:0 },
      turbidity:   { label:'Turbidity',    unit:'NTU',   icon:'🌫️', min:0, max:50,   good:[0,5],     warn:[0,15],     base:2.8,  decimals:1 }
    };
    const HISTORY_LEN = 30;
    const SENSOR_COLORS = { pH:'#0ea5e9', temperature:'#f59e0b', tds:'#22c55e', turbidity:'#a78bfa' };
    const BAUD = 9600;

    // ===================== STATE =====================
    let history = {}, current = {}, running = true;
    let alertLog = [], trendChart = null, gaugeCharts = {};
    let activeSensor = 'pH';
    let port = null, reader = null, keepReading = false;

    Object.keys(PARAMS).forEach(k => {
      history[k] = Array(8).fill(PARAMS[k].base);
      current[k] = PARAMS[k].base;
    });

    // ===================== HELPERS =====================
    function getStatus(key, v) {
      const p = PARAMS[key];
      if (v >= p.good[0] && v <= p.good[1]) return 'good';
      if (v >= p.warn[0] && v <= p.warn[1]) return 'warning';
      return 'critical';
    }
    function statusColor(s) {
      return s === 'good' ? 'var(--good)' : s === 'warning' ? 'var(--warning)' : 'var(--critical)';
    }
    function formatValue(key, v) { return Number(v).toFixed(PARAMS[key].decimals); }
    function nowStr() { return new Date().toLocaleTimeString(); }

    function setConnected(connected) {
      const badge = document.getElementById('connectionBadge');
      const text  = document.getElementById('connectionText');
      document.getElementById('btnConnect').disabled = connected;
      document.getElementById('btnDisconnect').disabled = !connected;

      if (connected) {
        text.textContent = 'LIVE ARDUINO';
        badge.style.background = 'rgba(34,197,94,0.15)';
        badge.style.color = 'var(--good)';
        badge.style.borderColor = 'rgba(34,197,94,0.3)';
      } else {
        text.textContent = 'NOT CONNECTED';
        badge.style.background = 'rgba(148,163,184,0.15)';
        badge.style.color = '#94a3b8';
        badge.style.borderColor = 'rgba(148,163,184,0.25)';
      }
    }

    // ===================== RENDER =====================
    function renderKPIs() {
      document.getElementById('kpiGrid').innerHTML = Object.keys(PARAMS).map(key => {
        const p = PARAMS[key], val = current[key], status = getStatus(key, val);
        const prev = history[key].length > 1 ? history[key][history[key].length-2] : val;
        const delta = val - prev;
        const arrow = delta > 0.01 ? '↑' : delta < -0.01 ? '↓' : '→';
        const trend = Math.abs(delta) < 0.01 ? 'stable' : `${arrow} ${Math.abs(delta).toFixed(p.decimals)}`;
        return `
          <div class="kpi-card" style="--status-color:${statusColor(status)}">
            <div class="kpi-header">
              <span class="kpi-label">${p.label}</span>
              <span class="kpi-icon">${p.icon}</span>
            </div>
            <div class="kpi-value">${formatValue(key,val)}<span class="kpi-unit">${p.unit}</span></div>
            <div class="kpi-status ${status}">${status==='good'?'● Good':status==='warning'?'▲ Warning':'■ Critical'}</div>
            <div class="kpi-trend">${trend} from last sample</div>
          </div>`;
      }).join('');
    }

    function updateTrendChart() {
      const labels = history[activeSensor].map((_,i) => i);
      const color = SENSOR_COLORS[activeSensor];
      const p = PARAMS[activeSensor];

      if (!trendChart) {
        trendChart = new Chart(document.getElementById('trendChart'), {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: p.label, data: history[activeSensor],
              borderColor: color, backgroundColor: color+'33',
              borderWidth: 2.5, tension: 0.35, pointRadius: 0, fill: true
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1e293b',
                callbacks: { label: ctx => `${p.label}: ${Number(ctx.raw).toFixed(p.decimals)} ${p.unit}` }
              }
            },
            scales: {
              x: { ticks:{color:'#64748b',maxTicksLimit:8}, grid:{color:'rgba(51,65,85,0.4)'},
                   title:{display:true,text:'Sample',color:'#64748b'} },
              y: { ticks:{color:'#64748b'}, grid:{color:'rgba(51,65,85,0.4)'},
                   title:{display:true,text:p.unit?`${p.label} (${p.unit})`:p.label,color:'#64748b'} }
            }
          }
        });
      } else {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = history[activeSensor];
        trendChart.data.datasets[0].borderColor = color;
        trendChart.data.datasets[0].backgroundColor = color+'33';
        trendChart.data.datasets[0].label = p.label;
        trendChart.options.scales.y.title.text = p.unit ? `${p.label} (${p.unit})` : p.label;
        trendChart.update('none');
      }
      document.getElementById('chartTitle').textContent = `${p.label} Trend`;
    }

    function renderGauges() {
      const keys = Object.keys(PARAMS);
      const section = document.getElementById('gaugeSection');
      if (!section.children.length) {
        section.innerHTML = keys.map(k => `
          <div class="gauge-card">
            <h4>${PARAMS[k].label}</h4>
            <div class="gauge-ring"><canvas id="gauge-${k}"></canvas></div>
            <div class="gauge-value" id="gauge-val-${k}">—</div>
          </div>`).join('');
        keys.forEach(k => {
          gaugeCharts[k] = new Chart(document.getElementById(`gauge-${k}`), {
            type: 'doughnut',
            data: { datasets:[{ data:[0,100], backgroundColor:['#0ea5e9','#1e293b'], borderWidth:0, circumference:270, rotation:225 }] },
            options: { responsive:true, maintainAspectRatio:true, cutout:'75%',
                       plugins:{legend:{display:false},tooltip:{enabled:false}}, animation:{duration:300} }
          });
        });
      }
      keys.forEach(k => {
        const p = PARAMS[k], val = current[k];
        const pct = Math.min(100, Math.max(0, ((val-p.min)/(p.max-p.min))*100));
        const status = getStatus(k, val);
        const color = status==='good'?'#22c55e':status==='warning'?'#f59e0b':'#ef4444';
        gaugeCharts[k].data.datasets[0].data = [pct, 100-pct];
        gaugeCharts[k].data.datasets[0].backgroundColor = [color,'#1e293b'];
        gaugeCharts[k].update('none');
        document.getElementById(`gauge-val-${k}`).textContent = `${formatValue(k,val)} ${p.unit}`;
      });
    }

    function addAlert(msg, level='warning') {
      alertLog.unshift({ message:msg, level, time:nowStr() });
      if (alertLog.length > 10) alertLog.pop();
      document.getElementById('alertCount').textContent = alertLog.length;
      document.getElementById('alertsList').innerHTML = alertLog.map(a => `
        <div class="alert-item" style="border-left-color:${statusColor(a.level)}">
          <div><strong>${a.message}</strong><div class="time">${a.time}</div></div>
        </div>`).join('');
    }

    // ===================== APPLY SENSOR DATA =====================
    function applyReading(data) {
      if (!running) return;

      if (data.pH !== undefined)          current.pH = Number(data.pH);
      if (data.temperature !== undefined) current.temperature = Number(data.temperature);
      if (data.turbidity !== undefined)   current.turbidity = Number(data.turbidity);
      if (data.tds !== undefined)         current.tds = Number(data.tds);
      if (data.do !== undefined)          current.tds = Number(data.do); // optional mapping

      Object.keys(PARAMS).forEach(k => {
        history[k].push(current[k]);
        if (history[k].length > HISTORY_LEN) history[k].shift();
      });

      Object.keys(PARAMS).forEach(k => {
        if (getStatus(k, current[k]) === 'critical') {
          addAlert(`${PARAMS[k].label} critical: ${formatValue(k,current[k])} ${PARAMS[k].unit}`, 'critical');
        }
      });

      document.getElementById('lastUpdate').textContent = `Last update: ${nowStr()}`;
      renderKPIs();
      updateTrendChart();
      renderGauges();
    }

    // ===================== WEB SERIAL =====================
    async function connectSerial() {
      if (!('serial' in navigator)) {
        addAlert('Web Serial API not supported. Use Chrome or Edge.', 'critical');
        return;
      }

      try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: BAUD });

        setConnected(true);
        addAlert('Arduino connected via Web Serial', 'good');
        keepReading = true;

        const decoder = new TextDecoderStream();
        port.readable.pipeTo(decoder.writable);
        const textReader = decoder.readable.getReader();

        let buffer = '';

        while (keepReading) {
          const { value, done } = await textReader.read();
          if (done) break;

          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop();          // keep incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('{')) continue;
            try {
              const data = JSON.parse(trimmed);
              applyReading(data);
            } catch (e) {
              // ignore malformed lines
            }
          }
        }
      } catch (err) {
        if (err.name !== 'NotFoundError') {
          addAlert('Connection failed: ' + err.message, 'critical');
        }
        setConnected(false);
      }
    }

    async function disconnectSerial() {
      keepReading = false;
      try {
        if (reader) { await reader.cancel(); reader = null; }
        if (port) { await port.close(); port = null; }
      } catch (e) {}
      setConnected(false);
      addAlert('Arduino disconnected', 'warning');
    }

    // ===================== CONTROLS =====================
    document.getElementById('btnConnect').addEventListener('click', connectSerial);
    document.getElementById('btnDisconnect').addEventListener('click', disconnectSerial);

    document.getElementById('btnPause').addEventListener('click', function() {
      running = !running;
      this.textContent = running ? 'Pause' : 'Resume';
      this.classList.toggle('active', !running);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      Object.keys(PARAMS).forEach(k => {
        current[k] = PARAMS[k].base;
        history[k] = Array(8).fill(PARAMS[k].base);
      });
      alertLog = [];
      addAlert('Values reset', 'good');
      renderKPIs(); updateTrendChart(); renderGauges();
    });

    document.querySelectorAll('.sensor-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sensor;
        if (!PARAMS[key] || key === activeSensor) return;
        activeSensor = key;
        document.querySelectorAll('.sensor-btn').forEach(b => b.classList.toggle('active', b.dataset.sensor === key));
        updateTrendChart();
      });
    });

    // ===================== INIT =====================
    renderKPIs();
    updateTrendChart();
    renderGauges();
    setConnected(false);