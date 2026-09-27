<template>
  <div class="login-container">
    <div class="login-card glass-card">
      <div class="brand-header">
        <span class="brand-logo">🏨</span>
        <h2 class="brand-title">{{ $t('brand') }}</h2>
      </div>

      <a-tabs v-model:activeKey="activeTab" centered>
        <a-tab-pane key="login" :tab="$t('auth.loginTitle')">
          <a-form :model="loginForm" layout="vertical" @finish="handleLogin">
            <a-form-item :label="$t('auth.username')" name="username" :rules="[{ required: true, message: 'Please input username' }]">
              <a-input v-model:value="loginForm.username" size="large">
                <template #prefix><UserOutlined style="color: var(--text-muted);" /></template>
              </a-input>
            </a-form-item>

            <a-form-item :label="$t('auth.password')" name="password" :rules="[{ required: true, message: 'Please input password' }]">
              <a-input-password v-model:value="loginForm.password" size="large">
                <template #prefix><LockOutlined style="color: var(--text-muted);" /></template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <a-button type="primary" html-type="submit" size="large" block class="submit-glow-btn" :loading="loading">
                {{ $t('auth.loginBtn') }}
              </a-button>
            </a-form-item>
          </a-form>

          <a-alert
            type="info"
            show-icon
            :message="$t('auth.bossHint')"
            style="margin-top: 12px; font-size: 12px; border-radius: var(--border-radius-sm);"
          />
        </a-tab-pane>

        <a-tab-pane key="register" :tab="$t('auth.registerTitle')">
          <a-form :model="regForm" layout="vertical" @finish="handleRegister">
            <a-form-item :label="$t('auth.username')" name="username" :rules="[{ required: true, message: 'Please input username' }]">
              <a-input v-model:value="regForm.username" size="large">
                <template #prefix><UserOutlined style="color: var(--text-muted);" /></template>
              </a-input>
            </a-form-item>

            <a-form-item :label="$t('auth.name')" name="name" :rules="[{ required: true, message: 'Please input full name' }]">
              <a-input v-model:value="regForm.name" size="large">
                <template #prefix><IdcardOutlined style="color: var(--text-muted);" /></template>
              </a-input>
            </a-form-item>

            <a-form-item :label="$t('auth.password')" name="password" :rules="[{ required: true, message: 'Please input password' }]">
              <a-input-password v-model:value="regForm.password" size="large">
                <template #prefix><LockOutlined style="color: var(--text-muted);" /></template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <a-button type="primary" html-type="submit" size="large" block class="submit-glow-btn" :loading="loading">
                {{ $t('auth.registerBtn') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import api from '../api';

const router = useRouter();
const { t } = useI18n();

const activeTab = ref('login');
const loading = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
});

const regForm = reactive({
  username: '',
  name: '',
  password: '',
});

const handleLogin = async () => {
  loading.value = true;
  try {
    const res = await api.post('/login', loginForm);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    message.success(t('auth.loginSuccess'));

    const user = res.data.user;
    if (user.role === 'boss') {
      router.push('/stats');
    } else {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      if (perms.includes('report')) {
        router.push('/report');
      } else if (perms.includes('stats')) {
        router.push('/stats');
      } else if (perms.includes('expense')) {
        router.push('/expense');
      } else {
        router.push('/report');
      }
    }
  } catch (err) {
    message.error(err.response?.data?.error || 'Login failed');
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  loading.value = true;
  try {
    await api.post('/register', regForm);
    message.success(t('auth.registerSuccess'));
    activeTab.value = 'login';
    loginForm.username = regForm.username;
    loginForm.password = '';
  } catch (err) {
    message.error(err.response?.data?.error || 'Registration failed');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  position: relative;
}

.card-top-tools {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.brand-header {
  text-align: center;
  margin-bottom: 24px;
}

.brand-logo {
  font-size: 52px;
  display: block;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 12px var(--primary-color));
}

.brand-title {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--purple-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.submit-glow-btn {
  box-shadow: var(--glass-glow) !important;
}
</style>
