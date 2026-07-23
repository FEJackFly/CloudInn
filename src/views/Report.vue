<template>
  <div class="report-page">
    <!-- Submit Income Form Card with Glassmorphism -->
    <div class="glass-card">
      <div class="card-header">
        <h3 class="card-title">📝 {{ $t('report.addTitle') }}</h3>
      </div>

      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('report.date')" name="report_date" :rules="[{ required: true, message: 'Select date' }]">
              <a-date-picker v-model:value="form.report_date" value-format="YYYY-MM-DD" style="width: 100%" size="large" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('report.roomNumber')" name="room_number" :rules="[{ required: true, message: 'Enter room number' }]">
              <a-input v-model:value="form.room_number" placeholder="e.g. 801" size="large" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('report.amount')" name="amount" :rules="[{ required: true, message: 'Enter amount' }]">
              <a-input-number v-model:value="form.amount" :min="0" :precision="2" style="width: 100%" size="large" placeholder="0.00" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('report.channel')" name="channel" :rules="[{ required: true, message: 'Select channel' }]">
              <a-select v-model:value="form.channel" size="large" style="width: 100%">
                <a-select-option value="CASH">💵 {{ $t('channel.CASH') }}</a-select-option>
                <a-select-option value="ABA">🏦 {{ $t('channel.ABA') }}</a-select-option>
                <a-select-option value="CRYPTO">🪙 {{ $t('channel.CRYPTO') }}</a-select-option>
                <a-select-option value="WECHAT">💬 {{ $t('channel.WECHAT') }}</a-select-option>
                <a-select-option value="OTHER">💳 {{ $t('channel.OTHER') }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :xs="24" class="flex-end">
            <a-button type="primary" html-type="submit" size="large" class="submit-glow-btn" :loading="submitting">
              {{ $t('report.submitBtn') }}
            </a-button>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- History Table Card -->
    <div class="glass-card">
      <div class="card-header flex-between">
        <h3 class="card-title">📋 {{ $t('report.historyTitle') }}</h3>
        <div class="date-filter">
          <a-range-picker
            v-model:value="dateRange"
            value-format="YYYY-MM-DD"
            @change="fetchReports"
            style="width: 100%"
          />
        </div>
      </div>

      <div class="mobile-table-wrapper">
        <a-table
          :columns="columns"
          :data-source="reports"
          :loading="loading"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">

            <template v-if="column.key === 'amount'">
              <span class="amount-text">{{ currencySymbol }}{{ record.amount.toFixed(2) }}</span>
            </template>

            <template v-if="column.key === 'channel'">
              <a-tag :color="getChannelColor(record.channel)" class="glass-tag">
                {{ $t(`channel.${record.channel}`) || record.channel }}
              </a-tag>
            </template>

            <template v-if="column.key === 'action'">
              <a-popconfirm
                :title="$t('report.deleteConfirm')"
                @confirm="handleDelete(record.id)"
                :ok-text="$t('common.confirm')"
                :cancel-text="$t('common.cancel')"
              >
                <a-button type="link" danger size="small">{{ $t('report.delete') }}</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import api from '../api';

const { t } = useI18n();

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const currencySymbol = computed(() => t('common.currency'));

const submitting = ref(false);
const loading = ref(false);
const reports = ref([]);
const dateRange = ref([]);

const todayStr = dayjs().format('YYYY-MM-DD');
const form = reactive({
  report_date: todayStr,
  room_number: '',
  amount: undefined,
  channel: 'CASH',
});

const getChannelColor = (channel) => {
  switch (channel) {
    case 'CASH': return 'green';
    case 'ABA': return 'blue';
    case 'CRYPTO': return 'purple';
    case 'WECHAT': return 'emerald';
    default: return 'geekblue';
  }
};

const columns = computed(() => {
  const cols = [
    { title: t('report.date'), dataIndex: 'report_date', key: 'report_date', minWidth: 120 },
    { title: t('report.roomNumber'), dataIndex: 'room_number', key: 'room_number', minWidth: 90 },
    { title: t('report.amount'), dataIndex: 'amount', key: 'amount', minWidth: 100 },
    { title: t('report.channel'), dataIndex: 'channel', key: 'channel', minWidth: 110 },
  ];

  if (currentUser.role === 'boss') {
    cols.push({ title: t('report.operator'), dataIndex: 'user_name', key: 'user_name', minWidth: 100 });
  }

  cols.push({ title: t('report.actions'), key: 'action', width: 80 });
  return cols;
});

const fetchReports = async () => {
  loading.value = true;
  try {
    let params = {};
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0];
      params.end_date = dateRange.value[1];
    }
    const res = await api.get('/reports', { params });
    reports.value = res.data;
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to load reports');
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    await api.post('/reports', {
      report_date: form.report_date,
      room_number: form.room_number,
      amount: form.amount,
      channel: form.channel,
    });
    message.success(t('report.successMsg'));
    form.room_number = '';
    form.amount = undefined;
    fetchReports();
  } catch (err) {
    message.error(err.response?.data?.error || 'Submission failed');
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (id) => {
  try {
    await api.delete(`/reports/${id}`);
    message.success(t('report.deleteMsg'));
    fetchReports();
  } catch (err) {
    message.error(err.response?.data?.error || 'Deletion failed');
  }
};

onMounted(() => {
  fetchReports();
});
</script>

<style scoped>
.card-header {
  margin-bottom: 20px;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.flex-end {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.amount-text {
  font-family: 'Fira Code', monospace;
  font-weight: 700;
  color: var(--success-color);
}
.submit-glow-btn {
  min-width: 160px;
  box-shadow: var(--glass-glow) !important;
}
</style>
