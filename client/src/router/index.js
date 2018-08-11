import Vue from 'vue'
import Router from 'vue-router'
import SearchPage from '@/pages/SearchPage'
import 'normalize.css'
import 'animate.css'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'SearchPage',
      component: SearchPage
    }
  ]
})
