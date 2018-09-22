<template>
<div class="container">
  <el-tag
      :key="tag"
      v-for="(tag, index) in tags"
      :class="{selected: index === selectedIndex, selectable: typeof selectedIndex === 'number'}"
      :closable="itemsCanBeRemoved"
      :disable-transitions="false"
      size="mini"
      @click.native="selectionChangeRequest(index)"
      @close="tagRemovalRequest(index)">
    {{tag}}
  </el-tag>
  <el-input
      class="new-tag-input"
      v-if="inputVisible && editable"
      v-model="inputValue"
      ref="saveTagInput"
      size="mini"
      @keyup.enter.native="tagAdditionRequest">
  </el-input>
  <el-button v-if="!inputVisible && itemsCanBeAdded" class="new-tag-button" size="mini" @click="showInput">+ New Tag</el-button>
</div>
</template>

<script>
export default {
  name: 'TagCollection',
  props: [
    "tags",
    "selectedIndex",
    "itemsCanBeAdded",
    "itemsCanBeRemoved"
  ],
  data() {
    return {
        inputVisible: false,
        inputValue: ''
    }
  },
  methods: {
    showInput() {
      this.inputVisible = true;
      this.$nextTick(_ => {
        this.$refs.saveTagInput.$refs.input.focus();
      });
    },
    selectionChangeRequest(index) {
      if (typeof this.selectedIndex  === 'number' && index !== this.selectedIndex) {
        this.$emit('change-selection', index);
      }
    },
    tagAdditionRequest() {
      const newTag = this.inputValue;
      this.inputVisible = false;
      this.inputValue = '';
      if (newTag) {
        this.$emit('add-tag', newTag);
      }
    },
    tagRemovalRequest(index) {
      this.$emit('remove-tag', index);
    }
  }
}
</script>

<style lang="scss">
  .el-tag {
    background-color: #efeeee;
    color: #3a3a3a;
    border-radius: 10px;
    height: 20px;
    line-height: 20px;
    padding: 0 10px;
    margin-right: 10px;
    margin-bottom: 10px;
   }
  .el-tag.selected {
    background-color: lightblue;
  }
  .el-tag.selectable {
    cursor: pointer;
  }
  .new-tag-button {
    height: 20px;
    line-height: 20px;
    padding: 0 5px;
  }
  .new-tag-input {
    width: 90px;
    height: 20px;
    line-height: 20px;
    vertical-align: bottom;
    margin-bottom: 10px;
  }
  .el-input--mini .el-input__inner {
    height: 20px;
    line-height: 20px;
    padding: 0 5px;
  }
</style>
