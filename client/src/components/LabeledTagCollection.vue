<template>
    <div>
        <el-row>
            <el-col :span="3" ><span class="label">Label</span></el-col>
            <el-col :span="21"><tag-collection :tags="tags" @tag-added="tagAdded" @tag-removed="tagRemoved"></tag-collection></el-col>
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
        "tags"
    ],
    methods: {
        tagAdded(tagValue) {
            this.$emit('tag-added', tagValue);
        },
        tagRemoved(tag) {
            this.$emit('tag-removed', tag);
        }
    }
}
</script>


<style lang="postcss" scoped>
    .el-col {
        height: 24px;
    }
    .label {
        line-height: 24px;
    }
</style>
