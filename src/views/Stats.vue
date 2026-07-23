<template>
  <div class="stats-page">
    <!-- Header Bar with Month Picker -->
    <div class="glass-card flex-between">
      <div>
        <h2 class="page-title">📊 {{ $t('stats.title') }}</h2>
      </div>
      <div class="month-selector">
        <a-date-picker
          v-model:value="selectedMonth"
          picker="month"
          value-format="YYYY-MM"
          @change="fetchStats"
          size="large"
          style="width: 100%"
        />
      </div>
    </div>

    <!-- 4 KPI Cards -->
    <a-row :gutter="[16, 16]" class="kpi-row">
      <a-col :xs="24" :sm="12" :lg="6">
        <div class="kpi-card income">
          <div class="kpi-title">{{ $t('stats.kpiIncome') }}</div>
          <div class="kpi-value">{{ currencySymbol }}{{ kpi.totalIncome.toFixed(2) }}</div>
          <span class="kpi-icon">💰</span>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :lg="6">
        <div class="kpi-card expense">
          <div class="kpi-title">{{ $t('stats.kpiExpense') }}</div>
          <div class="kpi-value">{{ currencySymbol }}{{ kpi.totalExpense.toFixed(2) }}</div>
          <span class="kpi-icon">📉</span>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :lg="6">
        <div class="kpi-card profit">
          <div class="kpi-title">{{ $t('stats.kpiProfit') }}</div>
          <div class="kpi-value">{{ currencySymbol }}{{ kpi.netProfit.toFixed(2) }}</div>
          <span class="kpi-icon">💎</span>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :lg="6">
        <div class="kpi-card count">
          <div class="kpi-title">{{ $t('stats.kpiCount') }}</div>
          <div class="kpi-value">{{ kpi.reportCount }}</div>
          <span class="kpi-icon">📑</span>
        </div>
      </a-col>
    </a-row>

    <!-- 4 Dimensional Glass Charts -->
    <a-row :gutter="[16, 16]" class="charts-row" style="margin-top: 16px;">
      <!-- 1. Daily Income Trend (Line Chart) -->
      <a-col :xs="24" :lg="12">
        <div class="glass-card chart-card">
          <h3 class="chart-title">{{ $t('stats.chartDailyTrend') }}</h3>
          <div class="chart-container">
            <canvas ref="dailyTrendCanvas"></canvas>
          </div>
        </div>
      </a-col>

      <!-- 2. Payment Channel Breakdown (Doughnut Chart) -->
      <a-col :xs="24" :lg="12">
        <div class="glass-card chart-card">
          <h3 class="chart-title">{{ $t('stats.chartChannel') }}</h3>
          <div class="chart-container">
            <canvas ref="channelCanvas"></canvas>
          </div>
        </div>
      </a-col>

      <!-- 3. Room Income Comparison (Bar Chart) -->
      <a-col :xs="24" :lg="12">
        <div class="glass-card chart-card">
          <h3 class="chart-title">{{ $t('stats.chartRoom') }}</h3>
          <div class="chart-container">
            <canvas ref="roomCanvas"></canvas>
          </div>
        </div>
      </a-col>

      <!-- 4. Expense Category Breakdown (Doughnut Chart) -->
      <a-col :xs="24" :lg="12">
        <div class="glass-card chart-card">
          <h3 class="chart-title">{{ $t('stats.chartExpense') }}</h3>
          <div class="chart-container">
            <canvas ref="expenseCanvas"></canvas>
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineController,
  BarController,
  DoughnutController,
} from 'chart.js';
import api from '../api';

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineController,
  BarController,
  DoughnutController
);

const { t, locale } = useI18n();
const currencySymbol = computed(() => t('common.currency'));

const selectedMonth = ref(dayjs().format('YYYY-MM'));

const kpi = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  reportCount: 0,
});

const dailyTrendCanvas = ref(null);
const channelCanvas = ref(null);
const roomCanvas = ref(null);
const expenseCanvas = ref(null);

let chart1 = null;
let chart2 = null;
let chart3 = null;
let chart4 = null;

const fetchStats = async () => {
  try {
    const res = await api.get('/stats/monthly', {
      params: { month: selectedMonth.value },
    });
    const data = res.data;

    kpi.totalIncome = data.kpi.totalIncome;
    kpi.totalExpense = data.kpi.totalExpense;
    kpi.netProfit = data.kpi.netProfit;
    kpi.reportCount = data.kpi.reportCount;

    await nextTick();
    renderCharts(data);
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to fetch monthly stats');
  }
};

const renderCharts = (data) => {
  // Destroy existing charts
  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();
  if (chart3) chart3.destroy();
  if (chart4) chart4.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // 1. Daily Income Trend
  if (dailyTrendCanvas.value) {
    chart1 = new ChartJS(dailyTrendCanvas.value, {
      type: 'line',
      data: {
        labels: data.dailyIncomeTrend.map(d => d.date.split('-')[2] + '日'),
        datasets: [{
          label: t('stats.chartDailyTrend'),
          data: data.dailyIncomeTrend.map(d => d.amount),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#38bdf8'
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    });
  }

  // 2. Channel Breakdown
  if (channelCanvas.value) {
    const channelLabels = data.channelBreakdown.map(c => t(`channel.${c.channel}`) || c.channel);
    const channelColors = {
      CASH: '#34d399',
      ABA: '#38bdf8',
      CRYPTO: '#c084fc',
      WECHAT: '#10b981',
      OTHER: '#94a3b8',
    };
    const colors = data.channelBreakdown.map(c => channelColors[c.channel] || '#38bdf8');

    chart2 = new ChartJS(channelCanvas.value, {
      type: 'doughnut',
      data: {
        labels: channelLabels,
        datasets: [{
          data: data.channelBreakdown.map(c => c.amount),
          backgroundColor: colors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth < 768 ? 'bottom' : 'right',
            labels: { color: textColor }
          },
        },
      },
    });
  }

  // 3. Room Income Comparison (Top 10)
  if (roomCanvas.value) {
    const topRooms = data.roomIncome.slice(0, 10);
    chart3 = new ChartJS(roomCanvas.value, {
      type: 'bar',
      data: {
        labels: topRooms.map(r => `${r.room_number}`),
        datasets: [{
          label: t('report.amount'),
          data: topRooms.map(r => r.amount),
          backgroundColor: '#818cf8',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    });
  }

  // 4. Expense Category Breakdown
  if (expenseCanvas.value) {
    const catMap = {
      UTILITIES: t('expense.catUtilities'),
      RENT: t('expense.catRent'),
      INTERNET: t('expense.catInternet'),
      LAUNDRY: t('expense.catLaundry'),
      SALARY: t('expense.catSalary'),
      OTHER: t('expense.catOther'),
    };
    const catLabels = data.expenseCategoryBreakdown.map(e => catMap[e.category] || e.category);
    chart4 = new ChartJS(expenseCanvas.value, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: data.expenseCategoryBreakdown.map(e => e.amount),
          backgroundColor: ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#c084fc'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth < 768 ? 'bottom' : 'right',
            labels: { color: textColor }
          },
        },
      },
    });
  }
};

watch(locale, () => {
  fetchStats();
});

onMounted(() => {
  fetchStats();
});
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.chart-card {
  height: 380px;
  display: flex;
  flex-direction: column;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-main);
}

.chart-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
}
</style>
