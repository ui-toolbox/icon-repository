<template>
    <el-table
        :data="iconfiles"
        height="360"
        style="width: 100%">
        <el-table-column
            label=""
            width="imageColumnWidth">
            <template slot-scope="scope">
                <img :src="iconfiles[scope.$index].url"/>
            </template>
        </el-table-column>
        <el-table-column
            prop="format"
            label="Format"
            width="formatColumnWidth"/>
        <el-table-column
            prop="size"
            label="Size"
            width="sizeColumnWidth"/>
        <el-table-column
            v-if="mutable"
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
        'iconfiles',
        'mutable'
    ],
    data() {
        return {
            imageColumnWidth: this.mutable ? 270 : 230,
            formatColumnWidth: this.mutable ? 80 : 120,
            sizeColumnWidth: this.mutable ? 80 : 120
        };
    },
    methods: {
        deleteIconfile(index) {
            this.$emit('removeIconfile', this.iconfiles[index]);
        }
    }
}
</script>

