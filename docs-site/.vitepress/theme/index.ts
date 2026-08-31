import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    // 阅读进度条 + 回到顶部
    if (typeof window !== 'undefined') {
      const initEnhancements = () => {
        // 阅读进度条
        if (!document.querySelector('.reading-progress')) {
          const bar = document.createElement('div')
          bar.className = 'reading-progress'
          bar.innerHTML = '<div class="reading-progress-bar"></div>'
          document.body.appendChild(bar)
        }

        // 回到顶部
        if (!document.querySelector('.back-to-top')) {
          const btn = document.createElement('div')
          btn.className = 'back-to-top'
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>'
          btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
          document.body.appendChild(btn)
        }

        // 滚动监听
        const onScroll = () => {
          const scrolled = window.scrollY
          const total = document.documentElement.scrollHeight - window.innerHeight
          const progress = total > 0 ? (scrolled / total) * 100 : 0

          const barEl = document.querySelector('.reading-progress-bar') as HTMLElement
          if (barEl) barEl.style.width = progress + '%'

          const btnEl = document.querySelector('.back-to-top') as HTMLElement
          if (btnEl) {
            if (scrolled > 400) btnEl.classList.add('visible')
            else btnEl.classList.remove('visible')
          }
        }

        window.removeEventListener('scroll', onScroll)
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
      }

      // 路由切换后重新初始化
      router.onAfterRouteChanged = () => {
        setTimeout(initEnhancements, 100)
      }

      setTimeout(initEnhancements, 300)
    }
  }
} satisfies Theme
