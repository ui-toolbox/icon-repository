<template>
  <div class="icon-cell animated fadeIn zoomIn">
    <div class="icon-preview">
      <img v-bind:src="baseUrl + icon.paths.SVG" height="30">
    </div>
    <div class="icon-name">{{icon.name}}</div>
  </div>
</template>

<script>
export default {
  name: 'IconCell',
  props: ['icon'],
  data () {
    return {
        baseUrl: this.$config.baseUrl
    }
  }
}
</script>

<style lang="scss">

$icon-preview-size: 50px;

.icon-cell {
    text-align: center;
    padding: 10px;
    border-radius: 3px;
    position: relative;
  .icon-preview {
    width: $icon-preview-size;
    height: $icon-preview-size;
    // background-color: #CCC;
    margin: 0 auto;
    text-align: center;
    margin-top: 20px;
  }
  .icon-name {
    position: absolute;
    font-family: "Roboto-Light";
    bottom: 10px;
    width: calc(100% - 2*10px);
    text-align: center;
    font-size: 13px;
    overflow: hidden;
    white-space: nowrap;
  text-overflow: ellipsis;
  }
  img {
      transition: all 0.3s ease-in-out;
  }
  &:hover {
    background-color: #F0F0F0;
    img {
      transform: scale(2.0);
    }
  }
}
</style>
