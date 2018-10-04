<template>
    <div>
        <el-row>
            <el-col :span="5" ><span class="label">{{label}}:</span></el-col>
            <el-col :span="19">
                <tag-collection
                    :tags="tags"
                    :selectedIndex="selectedIndex"
                    :itemsCanBeAdded="itemsCanBeAdded"
                    :itemsCanBeRemoved="itemsCanBeRemoved"
                    @change-selection="selectionChangeRequest"
                    @add-tag="tagAdditionRequest"
                    @remove-tag="tagRemovalRequest"/>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import TagCollection from '@/components/TagCollection'
export default {
    name: 'LabeledTagCollection',
    components: {
        'tag-collection': TagCollection
    },
    props: [
        "label",
        "tags",
        "selectedIndex",
        "itemsCanBeAdded",
        "itemsCanBeRemoved"
    ],
    methods: {
        selectionChangeRequest(index) {
            this.$emit('change-selection', index);
        },
        tagAdditionRequest(tagValue) {
            this.$emit('add-tag', tagValue);
        },
        tagRemovalRequest(index) {
            this.$emit('remove-tag', index);
        }
    }
}
</script>


<style lang='scss' scoped>
    .el-col {
        height: auto;
    }
    .label {
        line-height: 24px;
    }
</style>
