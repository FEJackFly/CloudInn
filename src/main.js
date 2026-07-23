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
  { path: '/report', component: Report, meta: { requiresAuth: true } },
  { path: '/expense', component: Expense, meta: { requiresAuth: true, requiresBoss: true } },
  { path: '/stats', component: Stats, meta: { requiresAuth: true, requiresBoss: true } },
  { path: '/users', component: Users, meta: { requiresAuth: true, requiresBoss: true } },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (to.meta.requiresAuth && !token) {
    return next('/login');
  }

  if (to.meta.requiresBoss && (!user || user.role !== 'boss')) {
    return next('/report');
  }

  if (to.path === '/login' && token && user) {
    return next(user.role === 'boss' ? '/stats' : '/report');
  }

  next();
});

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(Antd);
app.mount('#app');
