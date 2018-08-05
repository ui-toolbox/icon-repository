<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="30%">
        <el-row>
            <el-col>
                <el-collapse v-model="activeOperation" accordion>
                    <el-collapse-item title="Add icon-file" name="addfile">
                            <add-iconfile
                                :formats="formats"
                                :sizes="sizes"
                                :iconName="icon.name"
                                @iconfileAdded="iconfileAdded"
                                />
                    </el-collapse-item>
                    <el-collapse-item title="List/remove icon-file(s)" name="listfiles">
                            <iconfile-list
                                :iconfiles="iconfileList"
                                @removeIconfile="removeIconfile"/>
                            <span slot="footer" class="dialog-footer">
                                <el-button type="primary" @click="close">Close</el-button>
                            </span>
                    </el-collapse-item>
                </el-collapse>
            </el-col>
        </el-row>
        <el-row id="delete-icon-container">
            <el-col>
                <el-button icon="el-icon-delete" type="danger" @click="deleteIcon">Delete icon</el-button>
            </el-col>
        </el-row>
    </el-dialog>
</template>

<script>
import { List } from 'immutable';
import { describeIcon, deleteIcon, deleteIconfile } from '@/services/icon';
import IconfileList from '@/components/IconfileList'
import AddIconfile from '@/components/AddIconfile';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';
import getEndpointUrl from '@/services/url';

export default {
    props: [
        "icon",
        "formats",
        "sizes",
        "dialogVisible"
    ],
    components: {
        'iconfile-list': IconfileList,
        'add-iconfile': AddIconfile
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
            iconInfo: this.icon,
            activeOperation: "listfiles"
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
        refreshIconfileList() {
            return describeIcon(this.iconInfo.name)
                    .then(info => this.iconInfo = info)

        },
        iconfileAdded() {
            this.refreshIconfileList()
            .then(
                () => this.activeOperation = 'listfiles'
            );
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
                        this.refreshIconfileList()
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
        margin-bottom: 20px;
        &:last-child {
            margin-bottom: 0;
        }
    }
    #delete-icon-container {
        margin-top: 40px;
    }
</style>
