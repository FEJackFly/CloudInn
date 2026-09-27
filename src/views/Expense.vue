<template>
  <div class="expense-page">
    <!-- Add Expense Form with Glassmorphism -->
    <div class="glass-card">
      <div class="card-header">
        <h3 class="card-title">📉 {{ $t('expense.addTitle') }}</h3>
      </div>

      <a-form :model="form" layout="vertical" @finish="handleSubmit">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('expense.date')" name="expense_date" :rules="[{ required: true, message: 'Select date' }]">
              <a-date-picker v-model:value="form.expense_date" value-format="YYYY-MM-DD" style="width: 100%" size="large" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('expense.category')" name="category" :rules="[{ required: true, message: 'Select category' }]">
              <a-select v-model:value="form.category" size="large" style="width: 100%">
                <a-select-option value="UTILITIES">⚡ {{ $t('expense.catUtilities') }}</a-select-option>
                <a-select-option value="RENT">🏢 {{ $t('expense.catRent') }}</a-select-option>
                <a-select-option value="INTERNET">🌐 {{ $t('expense.catInternet') }}</a-select-option>
                <a-select-option value="LAUNDRY">🧺 {{ $t('expense.catLaundry') }}</a-select-option>
                <a-select-option value="SALARY">💼 {{ $t('expense.catSalary') }}</a-select-option>
                <a-select-option value="OTHER">📦 {{ $t('expense.catOther') }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('expense.amount')" name="amount" :rules="[{ required: true, message: 'Enter amount' }]">
              <a-input-number v-model:value="form.amount" :min="0" :precision="2" style="width: 100%" size="large" placeholder="0.00" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item :label="$t('expense.description')" name="description">
              <a-input v-model:value="form.description" placeholder="e.g. July Water & Power" size="large" />
            </a-form-item>
          </a-col>

          <a-col :xs="24" class="flex-end">
            <a-button type="primary" html-type="submit" size="large" class="submit-glow-btn" :loading="submitting">
              {{ $t('expense.submitBtn') }}
            </a-button>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- Expense History Table Card -->
    <div class="glass-card">
      <div class="card-header flex-between">
        <h3 class="card-title">🧾 {{ $t('expense.historyTitle') }}</h3>
        <div class="month-filter">
          <a-date-picker
            v-model:value="selectedMonth"
            picker="month"
            value-format="YYYY-MM"
            @change="fetchExpenses"
            style="width: 100%"
          />
        </div>
      </div>

      <div class="mobile-table-wrapper">
        <a-table
          :columns="columns"
          :data-source="expenses"
          :loading="loading"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'category'">
              <a-tag color="volcano" class="glass-tag">
                {{ getCatLabel(record.category) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'amount'">
              <span class="expense-amount">{{ currencySymbol }}{{ Number(record.amount || 0).toFixed(2) }}</span>
            </template>

            <template v-if="column.key === 'action'">
              <a-popconfirm
                :title="$t('expense.deleteConfirm')"
                @confirm="handleDelete(record.id)"
                :ok-text="$t('common.confirm')"
                :cancel-text="$t('common.cancel')"
              >
                <a-button type="link" danger size="small">{{ $t('expense.delete') }}</a-button>
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
const currencySymbol = computed(() => t('common.currency'));

const submitting = ref(false);
const loading = ref(false);
const expenses = ref([]);
const selectedMonth = ref(dayjs().format('YYYY-MM'));

const form = reactive({
  expense_date: dayjs().format('YYYY-MM-DD'),
  category: 'UTILITIES',
  amount: undefined,
  description: '',
});

const columns = computed(() => [
  { title: t('expense.date'), dataIndex: 'expense_date', key: 'expense_date', minWidth: 120 },
  { title: t('expense.category'), dataIndex: 'category', key: 'category', minWidth: 120 },
  { title: t('expense.amount'), dataIndex: 'amount', key: 'amount', minWidth: 100 },
  { title: t('expense.description'), dataIndex: 'description', key: 'description', minWidth: 160 },
  { title: t('expense.delete'), key: 'action', width: 80 },
]);

const getCatLabel = (cat) => {
  const map = {
    UTILITIES: t('expense.catUtilities'),
    RENT: t('expense.catRent'),
    INTERNET: t('expense.catInternet'),
    LAUNDRY: t('expense.catLaundry'),
    SALARY: t('expense.catSalary'),
    OTHER: t('expense.catOther'),
  };
  return map[cat] || cat;
};

const fetchExpenses = async () => {
  loading.value = true;
  try {
    const params = {};
    if (selectedMonth.value) {
      params.month = selectedMonth.value;
    }
    const res = await api.get('/expenses', { params });
    expenses.value = res.data;
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to load expenses');
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    await api.post('/expenses', {
      expense_date: form.expense_date,
      category: form.category,
      amount: form.amount,
      description: form.description,
    });
    message.success(t('expense.successMsg'));
    form.amount = undefined;
    form.description = '';
    fetchExpenses();
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to submit expense');
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (id) => {
  try {
    await api.delete(`/expenses/${id}`);
    message.success(t('expense.deleteMsg'));
    fetchExpenses();
  } catch (err) {
    message.error(err.response?.data?.error || 'Deletion failed');
  }
};

onMounted(() => {
  fetchExpenses();
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
.expense-amount {
  font-family: 'Fira Code', monospace;
  font-weight: 700;
  color: var(--danger-color);
}
.submit-glow-btn {
  min-width: 160px;
  box-shadow: var(--glass-glow) !important;
}
</style>
