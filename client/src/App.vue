<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style lang="postcss">
html {
  box-sizing: border-box;
}
*, *:before, *:after {
  box-sizing: inherit;
}

$font-dir: "@/assets/";

@font-face {
    font-family: 'Roboto';
    src: url('#{$font-dir}Roboto/Roboto-Regular.eot');
    src: local('Roboto Regular'), local('Roboto-Regular'), url('#{$font-dir}Roboto/Roboto-Regular.eot?#iefix') format('embedded-opentype'), url('#{$font-dir}Roboto/Roboto-Regular.woff2') format('woff2'), url('#{$font-dir}Roboto/Roboto-Regular.woff') format('woff'), url('#{$font-dir}Roboto/Roboto-Regular.ttf') format('truetype'), url('#{$font-dir}Roboto/Roboto-Regular.svg#Roboto') format('svg');
    font-weight: 400;
    font-style: normal;
}

/*@font-face {
    font-family: 'Roboto';
    src: url('#{$font-dir}Roboto/Roboto-Bold.eot');
    src: local('Roboto Bold'), local('Roboto-Bold'), url('#{$font-dir}Roboto/Roboto-Bold.eot?#iefix') format('embedded-opentype'), url('#{$font-dir}Roboto/Roboto-Bold.woff2') format('woff2'), url('#{$font-dir}Roboto/Roboto-Bold.woff') format('woff'), url('#{$font-dir}Roboto/Roboto-Bold.ttf') format('truetype'), url('#{$font-dir}Roboto/Roboto-Bold.svg#Roboto') format('svg');
    font-weight: 700;
    font-style: normal;
}*/

@font-face {
    font-family: 'Roboto-Light';
    src: url('#{$font-dir}Roboto/Roboto-Light.eot');
    src: url('#{$font-dir}Roboto/Roboto-Light.eot?#iefix') format('embedded-opentype'),
         url('#{$font-dir}Roboto/Roboto-Light.woff') format('woff'),
         url('#{$font-dir}Roboto/Roboto-Light.ttf') format('truetype'),
         url('#{$font-dir}Roboto/Roboto-Light.svg#robotolight') format('svg');
    font-weight: normal;
    font-style: normal;
}

#app {
  font-family: 'Roboto', Helvetica, Arial, sans-serif;
  color: #2c3e50;
  margin-top: 0px;
  font-weight: 400;
}
</style>
