<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="30%">
        <el-row>
            <el-col>
                <el-button icon="el-icon-delete" type="danger" @click="deleteIcon">Delete icon</el-button>
            </el-col>
        </el-row>
        <el-row>
            <el-col>
                <iconfile-list
                    :iconfiles="iconfileList"
                    @removeIconfile="removeIconfile"/>
                <span slot="footer" class="dialog-footer">
                    <el-button type="primary" @click="close">Close</el-button>
                </span>
            </el-col>
        </el-row>
    </el-dialog>
</template>

<script>
import { List } from 'immutable';
import { describeIcon, deleteIcon, deleteIconfile } from '@/services/icon';
import IconfileList from '@/components/IconfileList'
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';
import getEndpointUrl from '@/services/url';

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
            return `Edit icon: ${this.iconInfo.name}`;
        },
        iconfileList() {
            return this.createIconfileList(this.iconInfo);
        }
    },
    data() {
        return {
            iconInfo: this.icon
        }
    },
    methods: {
        createIconfileList() {
            return List(Object.keys(this.iconInfo.paths))
            .flatMap(format => Object.keys(this.iconInfo.paths[format])
                .map(size => {
                    const path = this.iconInfo.paths[format][size];
                    const url = getEndpointUrl(path);
                    return { format, size, path, url };
                }))
            .toArray();
        },
        isLastIconfile() {
            return this.createIconfileList(this.iconInfo).length === 1;
        },
        deleteIcon() {
            this.$confirm(`Are you sure to delete the icon "${this.iconInfo.name}"?`)
            .then(
                () => deleteIcon(this.iconInfo.name)
                        .then(
                            () => this.hideDialog(SUCCESSFUL),
                            error => this.hideDialog(FAILED, error)
                        ),
                () => undefined
            )
            .catch(error => this.hideDialog(FAILED, error));
        },
        deleteIconfile(iconfileToDelete) {
            deleteIconfile(iconfileToDelete.path)
            .then(
                () => {
                    if (this.isLastIconfile()) {
                        this.hideDialog();
                    } else {
                        describeIcon(this.iconInfo.name)
                            .then(info => this.iconInfo = info)
                    }
                }
            )
        },
        createRemoveIconfileConfirmationMessage(iconfileToDelete) {
            const baseMessage = `Are you sure to delete the icon file for format ${iconfileToDelete.format} and size ${iconfileToDelete.size}?`;
            return this.isLastIconfile()
                ? baseMessage + ` Since this is the last icon file associated with it, ` +
                    `the icon ${this.iconInfo.name} itself will be also deleted!`
                : baseMessage;
        },
        removeIconfile(iconfileToDelete) {
            this.$confirm(this.createRemoveIconfileConfirmationMessage(iconfileToDelete))
            .then(
                () => this.deleteIconfile(iconfileToDelete),
                () => undefined
            )
            .catch(error => this.hideDialog(FAILED, error));
        },
        close() {
            this.hideDialog(SUCCESSFUL);
        },
        hideDialog(status = SUCCESSFUL, error) {
            this.$emit("finished", {
                status,
                error
            });
        }
    }

}
</script>

<style lang="postcss" scoped>
    .el-row {
        margin-bottom: 40px;
        &:last-child {
            margin-bottom: 0;
        }
    }
</style>
