<template>
  <div class="users-page">
    <div class="glass-card">
      <div class="card-header flex-between">
        <h3 class="card-title">👥 {{ $t('users.title') }}</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
          <a-button size="large" :loading="backingUp" @click="downloadBackup">
            💾 {{ $t('users.backupBtn') }}
          </a-button>
          <a-button type="primary" size="large" class="submit-glow-btn" @click="openAddModal">
            + {{ $t('users.addTitle') }}
          </a-button>
        </div>
      </div>

      <div class="mobile-table-wrapper">
        <a-table
          :columns="columns"
          :data-source="users"
          :loading="loading"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'permissions'">
              <span v-if="!record.permissions || record.permissions.length === 0">-</span>
              <template v-else>
                <a-tag v-if="record.permissions.includes('report')" color="blue" class="glass-tag">
                  📝 {{ $t('users.permReport') }}
                </a-tag>
                <a-tag v-if="record.permissions.includes('expense')" color="orange" class="glass-tag">
                  📉 {{ $t('users.permExpense') }}
                </a-tag>
                <a-tag v-if="record.permissions.includes('stats')" color="purple" class="glass-tag">
                  📊 {{ $t('users.permStats') }}
                </a-tag>
              </template>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? $t('users.active') : $t('users.disabled') }}
              </a-tag>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="link" size="small" @click="openEditModal(record)">
                  {{ $t('users.editBtn') }}
                </a-button>
                <a-popconfirm
                  :title="record.status === 'active' ? $t('users.disableConfirm') : $t('users.enableConfirm')"
                  @confirm="toggleStatus(record.id)"
                  :ok-text="$t('common.confirm')"
                  :cancel-text="$t('common.cancel')"
                >
                  <a-button
                    :type="record.status === 'active' ? 'link' : 'primary'"
                    :danger="record.status === 'active'"
                    size="small"
                  >
                    {{ record.status === 'active' ? $t('users.disableBtn') : $t('users.enableBtn') }}
                  </a-button>
                </a-popconfirm>
                <a-popconfirm
                  :title="$t('users.deleteConfirm')"
                  @confirm="deleteUser(record.id)"
                  :ok-text="$t('common.confirm')"
                  :cancel-text="$t('common.cancel')"
                >
                  <a-button type="link" danger size="small">
                    {{ $t('users.deleteBtn') }}
                  </a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- Add Staff Modal with Glassmorphism -->
    <a-modal
      v-model:open="showAddModal"
      :title="$t('users.addTitle')"
      @ok="handleAddUser"
      :confirm-loading="submitting"
      :ok-text="$t('users.submitBtn')"
      :cancel-text="$t('common.cancel')"
    >
      <a-form :model="addForm" layout="vertical" style="padding-top: 12px;">
        <a-form-item :label="$t('users.username')" name="username" :rules="[{ required: true, message: 'Please input username' }]">
          <a-input v-model:value="addForm.username" size="large" />
        </a-form-item>

        <a-form-item :label="$t('users.name')" name="name" :rules="[{ required: true, message: 'Please input full name' }]">
          <a-input v-model:value="addForm.name" size="large" />
        </a-form-item>

        <a-form-item :label="$t('users.password')" name="password" :rules="[{ required: true, message: 'Please input password' }]">
          <a-input-password v-model:value="addForm.password" size="large" />
        </a-form-item>

        <a-form-item :label="$t('users.permissions')">
          <a-checkbox-group v-model:value="addForm.permissions">
            <a-checkbox value="report">📝 {{ $t('users.permReport') }}</a-checkbox>
            <a-checkbox value="expense">📉 {{ $t('users.permExpense') }}</a-checkbox>
            <a-checkbox value="stats">📊 {{ $t('users.permStats') }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Edit Staff Modal -->
    <a-modal
      v-model:open="showEditModal"
      :title="$t('users.editTitle')"
      @ok="handleEditUser"
      :confirm-loading="submitting"
      :ok-text="$t('users.submitBtn')"
      :cancel-text="$t('common.cancel')"
    >
      <a-form :model="editForm" layout="vertical" style="padding-top: 12px;">
        <a-form-item :label="$t('users.username')">
          <a-input v-model:value="editForm.username" size="large" disabled />
        </a-form-item>

        <a-form-item :label="$t('users.name')">
          <a-input v-model:value="editForm.name" size="large" />
        </a-form-item>

        <a-form-item :label="$t('users.password') + ' (' + $t('common.cancel') + ' / optional)'">
          <a-input-password v-model:value="editForm.password" placeholder="Leave empty to keep unchanged" size="large" />
        </a-form-item>

        <a-form-item :label="$t('users.permissions')">
          <a-checkbox-group v-model:value="editForm.permissions">
            <a-checkbox value="report">📝 {{ $t('users.permReport') }}</a-checkbox>
            <a-checkbox value="expense">📉 {{ $t('users.permExpense') }}</a-checkbox>
            <a-checkbox value="stats">📊 {{ $t('users.permStats') }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import api from '../api';

const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const backingUp = ref(false);
const showAddModal = ref(false);
const showEditModal = ref(false);
const users = ref([]);

const addForm = reactive({
  username: '',
  name: '',
  password: '',
  permissions: ['report'],
});

const editForm = reactive({
  id: null,
  username: '',
  name: '',
  password: '',
  permissions: ['report'],
});

const columns = computed(() => [
  { title: t('users.username'), dataIndex: 'username', key: 'username', minWidth: 110 },
  { title: t('users.name'), dataIndex: 'name', key: 'name', minWidth: 110 },
  { title: t('users.permissions'), dataIndex: 'permissions', key: 'permissions', minWidth: 180 },
  { title: t('users.status'), dataIndex: 'status', key: 'status', minWidth: 90 },
  { title: t('users.createdAt'), dataIndex: 'created_at', key: 'created_at', minWidth: 140 },
  { title: t('users.actions'), key: 'action', width: 200 },
]);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await api.get('/users');
    users.value = res.data;
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to fetch users');
  } finally {
    loading.value = false;
  }
};

const openAddModal = () => {
  addForm.username = '';
  addForm.name = '';
  addForm.password = '';
  addForm.permissions = ['report'];
  showAddModal.value = true;
};

const handleAddUser = async () => {
  if (!addForm.username || !addForm.name || !addForm.password) {
    message.warning('Please fill in all required fields');
    return;
  }
  submitting.value = true;
  try {
    await api.post('/users', addForm);
    message.success(t('users.successAdd'));
    showAddModal.value = false;
    fetchUsers();
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to add user');
  } finally {
    submitting.value = false;
  }
};

const openEditModal = (record) => {
  editForm.id = record.id;
  editForm.username = record.username;
  editForm.name = record.name;
  editForm.password = '';
  editForm.permissions = Array.isArray(record.permissions) ? [...record.permissions] : ['report'];
  showEditModal.value = true;
};

const handleEditUser = async () => {
  submitting.value = true;
  try {
    await api.put(`/users/${editForm.id}`, {
      name: editForm.name,
      password: editForm.password,
      permissions: editForm.permissions,
    });
    message.success(t('users.successUpdate'));
    showEditModal.value = false;
    fetchUsers();
  } catch (err) {
    message.error(err.response?.data?.error || 'Failed to update user');
  } finally {
    submitting.value = false;
  }
};

const toggleStatus = async (id) => {
  try {
    await api.patch(`/users/${id}/status`);
    message.success(t('users.successToggle'));
    fetchUsers();
  } catch (err) {
    message.error(err.response?.data?.error || 'Action failed');
  }
};

const deleteUser = async (id) => {
  try {
    await api.delete(`/users/${id}`);
    message.success(t('users.successDelete'));
    fetchUsers();
  } catch (err) {
    message.error(err.response?.data?.error || 'Delete failed');
  }
};

const downloadBackup = async () => {
  backingUp.value = true;
  try {
    const res = await api.get('/database/backup', { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hotel_backup_${dayjs().format('YYYYMMDD_HHmmss')}.db`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    message.success(t('users.backupSuccess'));
  } catch (err) {
    message.error(err.response?.data?.error || t('users.backupError'));
  } finally {
    backingUp.value = false;
  }
};

onMounted(() => {
  fetchUsers();
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
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
.submit-glow-btn {
  box-shadow: var(--glass-glow) !important;
}
</style>
