<template>
  <a-config-provider :locale="antLocale">
    <div :class="['app-wrapper', `lang-${locale}`]">
      <!-- Glassmorphism Sticky Navigation Header -->
      <header class="app-header">
        <div class="logo-container" @click="handleLogoClick">
          <span class="logo-icon">🏨</span>
          <span class="logo-title">{{ $t('brand') }}</span>
        </div>

        <!-- Desktop Navigation Menu (Logged In) -->
        <div v-if="user" class="desktop-menu desktop-only">
          <a-menu v-model:selectedKeys="selectedKeys" mode="horizontal">
            <a-menu-item v-if="hasPerm('report')" key="/report" @click="router.push('/report')">
              <FileTextOutlined />
              <span>{{ $t('nav.report') }}</span>
            </a-menu-item>
            <a-menu-item v-if="hasPerm('expense')" key="/expense" @click="router.push('/expense')">
              <DollarOutlined />
              <span>{{ $t('nav.expense') }}</span>
            </a-menu-item>
            <a-menu-item v-if="hasPerm('stats')" key="/stats" @click="router.push('/stats')">
              <BarChartOutlined />
              <span>{{ $t('nav.stats') }}</span>
            </a-menu-item>
            <a-menu-item v-if="user && user.role === 'boss'" key="/users" @click="router.push('/users')">
              <TeamOutlined />
              <span>{{ $t('nav.users') }}</span>
            </a-menu-item>
          </a-menu>
        </div>
        <div v-else style="flex: 1;"></div>

        <!-- Right Tools Header Container -->
        <div class="header-right">
          <!-- Desktop Tools Group Wrapper (Hidden 100% on Mobile) -->
          <div class="desktop-tools desktop-only">
            <!-- Theme Toggle Switcher -->
            <button
              class="theme-toggle-btn"
              :title="currentTheme === 'dark' ? $t('theme.toggleDark') : $t('theme.toggleLight')"
              @click="toggleTheme"
            >
              <svg v-if="currentTheme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>

            <!-- Language Selector -->
            <a-dropdown placement="bottomRight">
              <a-button size="middle" class="glass-header-btn">
                <GlobalOutlined />
                <span>{{ currentLangName }}</span>
                <DownOutlined style="font-size: 11px; color: var(--text-muted);" />
              </a-button>
              <template #overlay>
                <a-menu @click="changeLang">
                  <a-menu-item key="zh-CN">🇨🇳 简体中文</a-menu-item>
                  <a-menu-item key="en-US">🇺🇸 English</a-menu-item>
                  <a-menu-item key="km-KH">🇰🇭 ភាសាខ្មែរ (Khmer)</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <!-- User Profile Dropdown (Consolidated Welcome & Logout) -->
          <a-dropdown v-if="user" placement="bottomRight">
            <div class="user-badge user-badge-dropdown">
              <span class="user-name">{{ $t('nav.welcome') }}{{ user.name }}</span>
              <DownOutlined class="dropdown-arrow" />
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item key="logout" danger @click="handleLogout">
                  <LogoutOutlined />
                  <span>{{ $t('nav.logout') }}</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <!-- Mobile Hamburger Toggle (Mobile Only) -->
          <a-button v-if="user" class="mobile-only mobile-hamburger-btn" type="text" @click="drawerVisible = true">
            <MenuOutlined style="font-size: 22px; color: var(--text-main);" />
          </a-button>
        </div>
      </header>

      <!-- Mobile Navigation Drawer -->
      <a-drawer
        v-model:open="drawerVisible"
        placement="right"
        :title="$t('brand')"
        width="280px"
      >
        <!-- User Info Badge in Mobile Drawer -->
        <div v-if="user" class="drawer-user-info">
          <div>{{ $t('nav.welcome') }}<strong>{{ user.name }}</strong></div>
        </div>

        <!-- Navigation Links in Mobile Drawer -->
        <a-menu v-model:selectedKeys="selectedKeys" mode="inline" style="border: none; background: transparent;">
          <a-menu-item v-if="hasPerm('report')" key="/report" @click="navigateTo('/report')">
            <FileTextOutlined />
            <span>{{ $t('nav.report') }}</span>
          </a-menu-item>
          <a-menu-item v-if="hasPerm('expense')" key="/expense" @click="navigateTo('/expense')">
            <DollarOutlined />
            <span>{{ $t('nav.expense') }}</span>
          </a-menu-item>
          <a-menu-item v-if="hasPerm('stats')" key="/stats" @click="navigateTo('/stats')">
            <BarChartOutlined />
            <span>{{ $t('nav.stats') }}</span>
          </a-menu-item>
          <a-menu-item v-if="user && user.role === 'boss'" key="/users" @click="navigateTo('/users')">
            <TeamOutlined />
            <span>{{ $t('nav.users') }}</span>
          </a-menu-item>
        </a-menu>

        <!-- Theme Toggle & Language Selector in Mobile Drawer -->
        <div style="margin: 16px 0; display: flex; flex-direction: column; gap: 14px; padding: 12px; background: var(--input-bg); border-radius: var(--border-radius-md); border: 1px solid var(--glass-border);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px; color: var(--text-main); font-weight: 500;">{{ $t('theme.title') }}</span>
            <a-button type="default" size="small" @click="toggleTheme" style="display: flex; align-items: center; gap: 6px;">
              <svg v-if="currentTheme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>{{ currentTheme === 'dark' ? $t('theme.dark') : $t('theme.light') }}</span>
            </a-button>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px; color: var(--text-main); font-weight: 500;">{{ $t('theme.langTitle') }}</span>
            <a-dropdown placement="bottomRight">
              <a-button size="small" style="display: flex; align-items: center; gap: 4px;">
                <GlobalOutlined />
                <span>{{ currentLangName }}</span>
                <DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="changeLang">
                  <a-menu-item key="zh-CN">🇨🇳 简体中文</a-menu-item>
                  <a-menu-item key="en-US">🇺🇸 English</a-menu-item>
                  <a-menu-item key="km-KH">🇰🇭 ភាសាខ្មែរ (Khmer)</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>

        <div style="margin-top: 20px; padding: 0 4px;">
          <a-button type="primary" danger block @click="handleLogout">
            <LogoutOutlined />
            <span>{{ $t('nav.logout') }}</span>
          </a-button>
        </div>
      </a-drawer>

      <!-- Main Body Container with Glass Page Transition -->
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="glass-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </a-config-provider>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import {
  FileTextOutlined,
  DollarOutlined,
  BarChartOutlined,
  TeamOutlined,
  GlobalOutlined,
  DownOutlined,
  LogoutOutlined,
  MenuOutlined
} from '@ant-design/icons-vue';

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();

const selectedKeys = ref(['/report']);
const drawerVisible = ref(false);
const user = ref(null);

// Theme State (Default to 'dark' for glassmorphism aesthetics, sync with localStorage)
const currentTheme = ref(localStorage.getItem('theme') || 'dark');

const applyTheme = (theme) => {
  currentTheme.value = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
};

const toggleTheme = () => {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
};

const updateUserState = () => {
  const str = localStorage.getItem('user');
  user.value = str ? JSON.parse(str) : null;
};

const hasPerm = (perm) => {
  if (!user.value) return false;
  if (user.value.role === 'boss') return true;
  return Array.isArray(user.value.permissions) && user.value.permissions.includes(perm);
};

const antLocale = computed(() => {
  if (locale.value === 'zh-CN') return zhCN;
  return enUS;
});

const currentLangName = computed(() => {
  if (locale.value === 'zh-CN') return '中文';
  if (locale.value === 'km-KH') return 'ភាសាខ្មែរ';
  return 'English';
});

const changeLang = ({ key }) => {
  locale.value = key;
  localStorage.setItem('lang', key);
  document.documentElement.lang = key;
};

const handleLogoClick = () => {
  if (!user.value) {
    router.push('/login');
    return;
  }
  if (hasPerm('stats')) {
    router.push('/stats');
  } else if (hasPerm('report')) {
    router.push('/report');
  } else if (hasPerm('expense')) {
    router.push('/expense');
  } else {
    router.push('/login');
  }
};

const navigateTo = (path) => {
  drawerVisible.value = false;
  router.push(path);
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user.value = null;
  drawerVisible.value = false;
  router.push('/login');
};

watch(() => route.path, (newPath) => {
  selectedKeys.value = [newPath];
  updateUserState();
}, { immediate: true });

onMounted(() => {
  document.documentElement.lang = locale.value;
  applyTheme(currentTheme.value);
  updateUserState();
});
</script>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.desktop-menu {
  flex: 1;
  margin: 0 32px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.desktop-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-weight: 600;
}

.drawer-user-info {
  padding: 16px;
  margin-bottom: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-md);
}

.desktop-only {
  display: flex !important;
}

.mobile-only {
  display: none !important;
}

@media (max-width: 768px) {
  .desktop-menu,
  .desktop-only,
  .desktop-tools {
    display: none !important;
  }

  .mobile-only {
    display: inline-flex !important;
  }
}
</style>
