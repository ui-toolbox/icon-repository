<template>
    <el-table
        :data="iconfiles"
        height="360"
        style="width: 100%">
        <el-table-column
            label=""
            width="230">
            <template slot-scope="scope">
                <img :src="iconfiles[scope.$index].url"/>
            </template>
        </el-table-column>
        <el-table-column
            prop="format"
            label="Format"
            width="80"/>
        <el-table-column
            prop="size"
            label="Size"
            width="80"/>
        <el-table-column
            fixed="right"
            label=""
            width="120">
            <template slot-scope="scope">
                <el-button
                    @click.native.prevent="deleteIconfile(scope.$index)"
                    type="danger"
                    size="small">
                    Remove
                </el-button>
            </template>
        </el-table-column>
    </el-table>
</template>

<script>
export default {
    props: [
        'iconfiles'
    ],
    methods: {
        deleteIconfile(index) {
            this.$emit('removeIconfile', this.iconfiles[index]);
        }
    }
}
</script>

