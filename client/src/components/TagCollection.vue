<template>
<div class="container">
    <el-tag
        :key="tag"
        v-for="tag in tags"
        closable
        :disable-transitions="false"
        size="mini"
        @close="handleClose(tag)">
        {{tag}}
    </el-tag>
    <el-input
        class="input-new-tag"
        v-if="inputVisible"
        v-model="inputValue"
        ref="saveTagInput"
        size="mini"
        @keyup.enter.native="handleInputConfirmed"
        @blur="handleInputConfirmed">
    </el-input>
    <el-button v-if="!inputVisible" class="button-new-tag" size="mini" @click="showInput">+ New Tag</el-button>
</div>
</template>

<script>
export default {
    name: 'TagCollection',
    props: [
        "tags"
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
        handleInputConfirmed() {
            const newTag = this.inputValue;
            this.inputVisible = false;
            this.inputValue = '';
            if (newTag) {
                this.$emit('tag-added', newTag);
            }
        },
        handleClose(tag) {
            this.$emit('tag-removed', tag);
        }
    }
}
</script>

<style lang="css">
    .el-tag {
        background-color: #efeeee;
        color: #3a3a3a;
        border-radius: 10px;
        height: 20px;
        line-height: 20px;
        padding: 0 10px;
    }
    .el-tag + .el-tag {
        margin-left: 10px;
    }
    .button-new-tag {
        margin-left: 10px;
        height: 20px;
        line-height: 20px;
        padding: 0 5px;
    }
    .input-new-tag {
        width: 90px;
        height: 20px;
        line-height: 20px;
        margin-left: 10px;
        vertical-align: bottom;
    }
    .el-input--mini .el-input__inner {
        height: 20px;
        line-height: 20px;
        margin-top: -5px;
        padding: 0 5px;
    }
</style>
