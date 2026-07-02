import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import InPage from '@/pages/InPage.vue'
import { useSignStore } from '@/stores/sign'
import { ToSign } from '@/utils/api.ts'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/in',
      name: 'in',
      component: InPage,
    },
    {
      path: '/browse',
      name: 'browse',
      component: () => import('@/pages/BrowsePage.vue'),
      meta: { keepAlive: true },
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('@/pages/DocsPage.vue'),
    },
    {
      path: '/keys',
      name: 'keys',
      component: () => import('@/pages/KeysPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/video/:videoId',
      name: 'video-detail',
      component: () => import('@/pages/VideoDetailPage.vue'),
    },
    {
      path: '/video/:videoId/season/:seasonNumber/episode/:episodeNumber',
      name: 'video-detail-episode',
      component: () => import('@/pages/VideoDetailPage.vue'),
    },
    {
      path: '/workspace/:videoId/version/:versionId',
      name: 'workspace',
      component: () => import('@/pages/WorkspacePage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !useSignStore().isSignedIn) {
    ToSign()
    return false
  }

  return true
})

export default router
