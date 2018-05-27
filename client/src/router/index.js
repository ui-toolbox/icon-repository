import Vue from 'vue'
import Router from 'vue-router'
import SearchPage from '@/pages/SearchPage'
import 'normalize.css'
import 'animate.css'

Vue.use(Router)

var getUrl = window.location;
const pathName = getUrl.pathname.endsWith('/') ? getUrl.pathname.substring(0, getUrl.pathname.length - 1) : getUrl.pathname;
const baseUrl = getUrl.protocol + "//" + getUrl.host + pathName
Vue.prototype.$config = {
    baseUrl
};

export default new Router({
  routes: [
    {
      path: '/',
      name: 'SearchPage',
      component: SearchPage
    }
  ]
})
