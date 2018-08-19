<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="30%">
        <iconfile-list :iconfiles="iconfileList" :mutable="false"/>
    </el-dialog>
</template>

<script>
import IconfileList from '@/components/icons/IconfileList'
import { createIconfileList } from '@/services/icon';
import { CANCELLED } from '@/services/constants';

export default {
    props: [
        "icon",
        "dialogVisible"
    ],
    components: {
        'iconfile-list': IconfileList
    },
    computed: {
        dialogTitle() {
            return `Details of: ${this.icon.name}`;
        },
        iconfileList() {
            return createIconfileList(this.icon.paths);
        }
    },
    methods: {
        close() {
            this.hideDialog();
        },
        hideDialog() {
            this.$emit("finished", {
                status: CANCELLED
            });
        }
    }
}
</script>

