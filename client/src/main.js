// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import VueResource from 'vue-resource'

import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en';
import 'element-ui/lib/theme-chalk/index.css';

import { fetchConfig } from '@/services/server-config';

Vue.config.productionTip = false
Vue.use(VueResource)

Vue.use(ElementUI, { locale });

Vue.prototype.$showErrorMessage = error => Vue.prototype.$message({
    duration: 0,
    showClose: true,
    message: error.message || error,
    type: 'error'
});

Vue.prototype.$showSuccessMessage = message => Vue.prototype.$message({
    duration: 3000,
    message,
    type: 'success'
});

fetchConfig()
.then(
    () => new Vue({
        el: '#app',
        router,
        components: { App },
        template: '<App/>'
      })
)
