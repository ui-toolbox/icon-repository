<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="30%">
        <table>
            <tr>
                <td>Version:</td><td>{{versionInfo.version}}</td>
            </tr>
            <tr>
                <td>Commit:</td><td>{{versionInfo.commit}}</td>
            </tr>
        </table>
        <span slot="footer" class="dialog-footer">
            <el-button type="primary" @click="close">Close</el-button>
        </span>
    </el-dialog>
</template>

<script>
import { getAppInfo } from '@/services/config';

export default {
    props: [
        'dialogVisible'
    ],
    data() {
        return {
            dialogTitle: 'About Icons',
            versionInfo: getAppInfo().versionInfo
        };
    },
    methods: {
        close() {
            this.$emit('finished');
        }
    }
}
</script>

<style lang='scss' scoped>
    td {
        padding-bottom: 10px;
        &:first-child {
            font-weight: bold;
        }
        &:last-child {
            padding-left: 30px;
        }
    }
</style>
