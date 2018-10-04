<template>
    <div class="icon-cell" @click="detailsRequested">
        <div class="icon-preview">
        <img v-bind:src="firstPath" height="30">
        </div>
        <div class="icon-name">{{icon.name}}</div>
    </div>
</template>

<script>
import { preferredIconfileUrl } from '@/services/icon';

export default {
    name: 'IconCell',
    props: ['icon'],
    computed: {
        firstPath() {
            return preferredIconfileUrl(this.icon);
        }
    },
    methods: {
        detailsRequested() {
            this.$emit('view', this.icon);
        },
    }
}
</script>

<style lang='scss' scoped>

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
    margin-top: 40px;
  }
  .icon-name {
    position: absolute;
    font-family: "Roboto-Light";
    bottom: 30px;
    width: calc(100% - 2*10px);
    text-align: center;
    font-size: 13px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  div.iconcell-control {
        position: absolute;
        top: 6px;
        right: 9px;
        opacity: 0;
        transition: opacity 0.3s 0.1s cubic-bezier(0.4, 0.7, 0.99, 0.99), transform 0.2s ease-in-out;
        &:hover {
            transform: scale(2.0);
        }
  }
  img {
      transition: all 0.3s ease-in-out;
  }
  &:hover {
    background-color: #F0F0F0;
    div.iconcell-control {
        opacity: 1;
    }
    img {
      transform: scale(2.0);
    }
  }
}
</style>
