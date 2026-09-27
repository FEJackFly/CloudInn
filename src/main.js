import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import './style.css';

import App from './App.vue';
import i18n from './i18n';

import Login from './views/Login.vue';
import Report from './views/Report.vue';
import Expense from './views/Expense.vue';
import Stats from './views/Stats.vue';
import Users from './views/Users.vue';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  { path: '/report', component: Report, meta: { requiresAuth: true, permission: 'report' } },
  { path: '/expense', component: Expense, meta: { requiresAuth: true, permission: 'expense' } },
  { path: '/stats', component: Stats, meta: { requiresAuth: true, permission: 'stats' } },
  { path: '/users', component: Users, meta: { requiresAuth: true, requiresBoss: true } },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export function getDefaultRoute(user) {
  if (!user) return '/login';
  if (user.role === 'boss') return '/stats';
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('report')) return '/report';
  if (perms.includes('stats')) return '/stats';
  if (perms.includes('expense')) return '/expense';
  return '/report';
}

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch {
    user = null;
  }

  // Route requires authentication
  if (to.meta.requiresAuth) {
    if (!token || !user) {
      return next('/login');
    }

    // Boss-only route guard
    if (to.meta.requiresBoss && user.role !== 'boss') {
      return next(getDefaultRoute(user));
    }

    // Permission-specific route guard for employees
    if (to.meta.permission && user.role !== 'boss') {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      if (!perms.includes(to.meta.permission)) {
        return next(getDefaultRoute(user));
      }
    }
  }

  // Redirect away from login if already authenticated
  if (to.path === '/login' && token && user) {
    return next(getDefaultRoute(user));
  }

  next();
});

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(Antd);
app.mount('#app');
