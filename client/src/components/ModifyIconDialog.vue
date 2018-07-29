<template>
<div>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" width="30%">
        <el-button icon="el-icon-delete" @click="deleteIcon">Delete icon</el-button>
        <span slot="footer" class="dialog-footer">
            <el-button type="primary" @click="close">Close</el-button>
        </span>
    </el-dialog>
</div>
</template>

<script>
import deleteIcon from '@/services/delete-icon';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';

export default {
    props: [
        "iconName",
        "dialogVisible"
    ],
    computed: {
        dialogTitle() {
            return `Edit icon: ${this.iconName}`;
        }
    },
    methods: {
        deleteIcon() {
            this.$confirm(`Are you sure to delete the icon "${this.iconName}"?`)
            .then(() => {
                return deleteIcon(this.iconName)
                .then(
                    () => this.hideDialog(SUCCESSFUL),
                    error => this.hideDialog(FAILED, error)
                )
            })
            .catch(error => this.hideDialog(FAILED, error));
        },
        close() {
            this.hideDialog(SUCCESSFUL);
        },
        hideDialog(status, error) {
            this.$emit("finished", {
                status,
                error
            });
        }
    }

}
</script>
